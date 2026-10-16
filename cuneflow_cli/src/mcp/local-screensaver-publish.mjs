import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

/**
 * 本地读取并直传屏保包，随后请求服务端生成发布预览。
 * 该流程故意不接受 apply 客户端，避免本地上传工具绕过用户确认直接发布。
 */
export async function prepareLocalScreensaverPublish({
  args,
  remoteClient,
  uploadFetch,
  uploadTimeoutMs,
  signal
}) {
  const inputPath = args?.path;
  const idempotencyKey = args?.idempotencyKey;
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw new Error("屏保包路径不能为空。");
  }
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 128) {
    throw new Error("idempotencyKey 不能为空且不能超过 128 个字符。");
  }

  const packagePath = resolve(inputPath);
  if (extname(packagePath).toLowerCase() !== ".cunesaver") {
    throw new Error("屏保包必须使用 .cunesaver 扩展名。");
  }
  const packageStat = await stat(packagePath);
  if (!packageStat.isFile()) {
    throw new Error(`不是普通文件: ${packagePath}`);
  }
  if (packageStat.size <= 0 || packageStat.size > 20 * 1024 * 1024) {
    throw new Error(`屏保包大小必须在 1 字节到 20 MiB 之间: ${packagePath}`);
  }

  const createResult = await remoteClient.callTool({
    name: "create_screensaver_upload_session",
    arguments: {
      fileName: basename(packagePath),
      sizeBytes: packageStat.size,
      contentMd5: await md5Base64(packagePath),
      idempotencyKey: idempotencyKey.trim()
    }
  }, { signal, timeout: uploadTimeoutMs });
  const session = extractToolData(createResult);
  if (typeof session.sessionId !== "string" || session.method !== "PUT"
      || typeof session.uploadUrl !== "string" || !session.headers) {
    throw new Error("CUNEFLOW 返回了无效的屏保上传会话。");
  }

  const uploadSignal = AbortSignal.any([signal, AbortSignal.timeout(uploadTimeoutMs)]);
  const response = await uploadFetch(session.uploadUrl, {
    method: "PUT",
    headers: session.headers,
    body: createReadStream(packagePath),
    duplex: "half",
    signal: uploadSignal
  });
  if (!response.ok) {
    throw new Error(`屏保包直传失败: ${basename(packagePath)} (HTTP ${response.status})`);
  }

  const prepareResult = await remoteClient.callTool({
    name: "prepare_screensaver_publish",
    arguments: { sessionId: session.sessionId }
  }, { signal, timeout: uploadTimeoutMs });
  const preview = extractToolData(prepareResult);
  if (typeof preview.confirmationToken !== "string" || !preview.confirmationToken) {
    throw new Error("CUNEFLOW 返回的屏保发布预览缺少 confirmationToken。");
  }
  if (preview.sessionId !== undefined && preview.sessionId !== session.sessionId) {
    throw new Error("CUNEFLOW 返回的屏保发布预览与上传会话不匹配。");
  }

  // 兼容尚未返回 sessionId 的旧服务端，并确保 Agent 拿到 apply 所需的完整参数。
  const completePreview = { ...preview, sessionId: session.sessionId };
  return {
    ...prepareResult,
    content: [{ type: "text", text: JSON.stringify(completePreview) }],
    structuredContent: completePreview
  };
}

async function md5Base64(path) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("base64");
}

function extractToolData(result) {
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (typeof text !== "string") {
    throw new Error("CUNEFLOW 工具没有返回结构化结果。");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("CUNEFLOW 工具返回结果无法解析。", { cause: error });
  }
}
