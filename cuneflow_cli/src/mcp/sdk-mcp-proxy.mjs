import {
  Client,
  InsufficientScopeError,
  SdkError,
  SdkErrorCode,
  StreamableHTTPClientTransport,
  UnauthorizedError
} from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { readPackageInfo } from "../util/package-info.mjs";
import { prepareLocalScreensaverPublish } from "./local-screensaver-publish.mjs";

const PROXY_NAME = "cuneflow-cli-mcp-proxy";
const SUPPORTED_USER_FILE_EXTENSIONS = new Set([".pdf", ".epub"]);

const LOCAL_UPLOAD_TOOL = {
  name: "upload_local_files",
  description: "将本机 PDF 或 EPUB 直接上传到 CUNEFLOW。仅在用户明确要求上传文件时调用；文件字节直接 PUT 到短时效 OSS 地址，不经过 MCP JSON-RPC。若同一请求还要求创建会议，必须将返回的全部真实 fileId 传给后续会议创建工具。",
  inputSchema: {
    type: "object",
    properties: {
      paths: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: { type: "string" },
        description: "本机文件绝对路径列表"
      },
      idempotencyKey: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description: "同一次上传重试时必须复用的幂等键"
      }
    },
    required: ["paths", "idempotencyKey"],
    additionalProperties: false
  }
};

const LOCAL_SCREENSAVER_PREPARE_TOOL = {
  name: "prepare_local_screensaver_publish",
  description: "读取并直传本机 .cunesaver，然后执行服务端校验并返回发布预览。不会正式发布；必须等待用户确认后再调用 apply_screensaver_publish。",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        minLength: 1,
        description: "本机 .cunesaver 文件绝对路径"
      },
      idempotencyKey: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description: "同一次上传重试时必须复用的幂等键"
      }
    },
    required: ["path", "idempotencyKey"],
    additionalProperties: false
  }
};

// The proxy must be able to relay every legacy server-to-client request. The
// actual host still decides whether it supports the request when it receives it.
const RELAY_CLIENT_CAPABILITIES = {
  sampling: {
    context: {},
    tools: {}
  },
  elicitation: {
    form: {},
    url: {}
  },
  roots: {
    listChanged: true
  },
  experimental: {},
  extensions: {}
};

// A Standard Schema V1 identity validator lets extension methods pass through
// without the proxy needing to know their result shape in advance.
const PASSTHROUGH_RESULT_SCHEMA = {
  "~standard": {
    version: 1,
    vendor: "cuneflow",
    validate(value) {
      return { value };
    }
  }
};

/**
 * SDK based stdio <-> Streamable HTTP MCP proxy.
 *
 * Both sides own their own JSON-RPC IDs and transport lifecycle. This class
 * only links requests, notifications, progress and cancellation between them.
 */
export class SdkMcpProxy {
  constructor({ config, tokenManager }) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.bridges = new Set();
    this.stdioHandle = null;
  }

  async start() {
    console.error(`CUNEFLOW MCP proxy connecting to ${this.config.mcpUrl}`);

    this.stdioHandle = serveStdio(
      ({ era }) => this.createBridge(era),
      {
        onerror: (error) => console.error(`CUNEFLOW MCP stdio error: ${formatError(error)}`)
      }
    );
  }

  async createBridge(era) {
    const transport = new StreamableHTTPClientTransport(
      new URL(this.config.mcpUrl),
      {
        authProvider: createAuthProvider(this.tokenManager),
        onInsufficientScope: "throw"
      }
    );

    let bridge;
    try {
      bridge = await createProxyBridge({
        remoteTransport: transport,
        remoteEra: era,
        initializeTimeoutMs: this.config.mcpInitializeTimeoutMs,
        requestTimeoutMs: this.config.mcpRequestTimeoutMs,
        uploadTimeoutMs: this.config.mcpUploadTimeoutMs,
        onerror: (error) => console.error(`CUNEFLOW MCP relay error: ${formatError(error)}`)
      });
    } catch (error) {
      throw userFacingRemoteError(error);
    }
    this.bridges.add(bridge);
    bridge.localServer.onclose = () => {
      this.bridges.delete(bridge);
      void bridge.remoteClient.close().catch(() => {});
    };
    console.error(`CUNEFLOW MCP proxy connected (${bridge.protocolVersion})`);
    return bridge.localServer;
  }

  async close() {
    const bridges = [...this.bridges];
    this.bridges.clear();
    await Promise.allSettled([
      this.stdioHandle?.close(),
      ...bridges.map((bridge) => bridge.remoteClient.close())
    ]);
  }
}

/**
 * Creates one protocol-era-aligned bridge. Exported to allow in-memory
 * end-to-end tests without opening stdio or HTTP sockets.
 */
export async function createProxyBridge({
  remoteTransport,
  remoteEra = "legacy",
  initializeTimeoutMs = 30_000,
  requestTimeoutMs = 120_000,
  uploadTimeoutMs = 300_000,
  uploadFetch = globalThis.fetch,
  onerror = () => {}
}) {
  const proxyInfo = {
    name: PROXY_NAME,
    version: (await readPackageInfo()).version
  };
  const remoteClient = new Client(proxyInfo, {
    capabilities: RELAY_CLIENT_CAPABILITIES,
    versionNegotiation: {
      mode: remoteEra === "modern" ? { pin: "2026-07-28" } : "legacy"
    },
    inputRequired: {
      autoFulfill: false
    }
  });
  remoteClient.onerror = onerror;
  await remoteClient.connect(remoteTransport, { timeout: initializeTimeoutMs });

  const protocolVersion = remoteClient.getNegotiatedProtocolVersion();
  const remoteInfo = remoteClient.getServerVersion() ?? proxyInfo;
  const localServer = new Server(remoteInfo, {
    capabilities: remoteClient.getServerCapabilities() ?? {},
    instructions: remoteClient.getInstructions(),
    supportedProtocolVersions: protocolVersion ? [protocolVersion] : undefined
  });
  localServer.onerror = onerror;

  const forwardRemoteRequest = async (request, ctx) => {
    const progressToken = request.params?._meta?.progressToken;
    try {
      return await remoteClient.request(request, PASSTHROUGH_RESULT_SCHEMA, {
        signal: ctx.mcpReq.signal,
        timeout: timeoutForRequest(request, requestTimeoutMs, uploadTimeoutMs),
        allowInputRequired: true,
        resetTimeoutOnProgress: true,
        onprogress: progressToken === undefined
          ? undefined
          : (progress) => {
              void ctx.mcpReq.notify({
                method: "notifications/progress",
                params: {
                  ...progress,
                  progressToken
                }
              });
            }
      });
    } catch (error) {
      throw userFacingRemoteError(error);
    }
  };

  localServer.fallbackRequestHandler = async (request, ctx) => {
    if (request.method === "tools/list") {
      const result = await forwardRemoteRequest(request, ctx);
      return {
        ...result,
        tools: request.params?.cursor
          ? (result.tools ?? [])
          : [...(result.tools ?? []), LOCAL_UPLOAD_TOOL, LOCAL_SCREENSAVER_PREPARE_TOOL]
      };
    }
    if (request.method === "tools/call" && request.params?.name === LOCAL_UPLOAD_TOOL.name) {
      try {
        return await uploadLocalFiles({
          args: request.params.arguments,
          remoteClient,
          uploadFetch,
          uploadTimeoutMs,
          signal: ctx.mcpReq.signal
        });
      } catch (error) {
        throw userFacingRemoteError(error);
      }
    }
    if (request.method === "tools/call" && request.params?.name === LOCAL_SCREENSAVER_PREPARE_TOOL.name) {
      try {
        return await prepareLocalScreensaverPublish({
          args: request.params.arguments,
          remoteClient,
          uploadFetch,
          uploadTimeoutMs,
          signal: ctx.mcpReq.signal
        });
      } catch (error) {
        throw userFacingRemoteError(error);
      }
    }
    return forwardRemoteRequest(request, ctx);
  };

  localServer.fallbackNotificationHandler = (notification) => remoteClient.notification(notification);

  remoteClient.fallbackRequestHandler = (request, ctx) => {
    const progressToken = request.params?._meta?.progressToken;
    return localServer.request(
      request,
      PASSTHROUGH_RESULT_SCHEMA,
      {
        signal: ctx.mcpReq.signal,
        allowInputRequired: true,
        resetTimeoutOnProgress: true,
        onprogress: progressToken === undefined
          ? undefined
          : (progress) => {
              void ctx.mcpReq.notify({
                method: "notifications/progress",
                params: {
                  ...progress,
                  progressToken
                }
              });
            }
      }
    );
  };
  remoteClient.fallbackNotificationHandler = (notification) => localServer.notification(notification);

  remoteClient.onclose = () => {
    void localServer.close().catch(() => {});
  };

  return {
    localServer,
    remoteClient,
    protocolVersion,
    async close() {
      await Promise.allSettled([localServer.close(), remoteClient.close()]);
    }
  };
}

async function uploadLocalFiles({ args, remoteClient, uploadFetch, uploadTimeoutMs, signal }) {
  const paths = args?.paths;
  const idempotencyKey = args?.idempotencyKey;
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 20) {
    throw new Error("本地文件数量必须为 1 到 20 个。");
  }
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 128) {
    throw new Error("idempotencyKey 不能为空且不能超过 128 个字符。");
  }

  const localFiles = [];
  let totalBytes = 0;
  for (const inputPath of paths) {
    if (typeof inputPath !== "string" || !inputPath.trim()) {
      throw new Error("文件路径不能为空。");
    }
    const path = resolve(inputPath);
    const extension = extname(path).toLowerCase();
    if (!SUPPORTED_USER_FILE_EXTENSIONS.has(extension)) {
      throw new Error(`MCP 仅支持添加 PDF、EPUB 文件: ${path}`);
    }
    const fileStat = await stat(path);
    if (!fileStat.isFile()) {
      throw new Error(`不是普通文件: ${path}`);
    }
    totalBytes += fileStat.size;
    if (fileStat.size <= 0 || fileStat.size > 100 * 1024 * 1024 || totalBytes > 500 * 1024 * 1024) {
      throw new Error(`文件大小超过上传限制: ${path}`);
    }
    localFiles.push({
      path,
      name: basename(path),
      sizeBytes: fileStat.size,
      contentType: contentTypeForPath(path),
      contentMd5: await md5Base64(path)
    });
  }

  const createResult = await remoteClient.callTool({
    name: "create_file_upload_session",
    arguments: {
      files: localFiles.map(({ name, sizeBytes, contentType, contentMd5 }) => ({
        name,
        sizeBytes,
        contentType,
        contentMd5
      })),
      idempotencyKey: idempotencyKey.trim()
    }
  }, { signal, timeout: uploadTimeoutMs });
  const session = extractToolData(createResult);
  if (session.completed && session.completionResult) {
    return toolResult(session.completionResult);
  }
  if (typeof session.sessionId !== "string" || !Array.isArray(session.files)
      || session.files.length !== localFiles.length) {
    throw new Error("CUNEFLOW 返回了无效的上传会话。");
  }

  for (let index = 0; index < localFiles.length; index += 1) {
    const localFile = localFiles[index];
    const target = session.files[index];
    if (target.name !== localFile.name || target.method !== "PUT"
        || typeof target.uploadUrl !== "string" || !target.headers) {
      throw new Error(`CUNEFLOW 上传目标与本地文件不匹配: ${localFile.name}`);
    }
    const uploadSignal = AbortSignal.any([signal, AbortSignal.timeout(uploadTimeoutMs)]);
    const response = await uploadFetch(target.uploadUrl, {
      method: "PUT",
      headers: target.headers,
      body: createReadStream(localFile.path),
      duplex: "half",
      signal: uploadSignal
    });
    if (!response.ok) {
      throw new Error(`文件直传失败: ${localFile.name} (HTTP ${response.status})`);
    }
  }

  return remoteClient.callTool({
    name: "complete_file_uploads",
    arguments: { sessionId: session.sessionId }
  }, { signal, timeout: uploadTimeoutMs });
}

async function md5Base64(path) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("base64");
}

function contentTypeForPath(path) {
  const extension = extname(path).toLowerCase();
  return {
    ".csv": "text/csv",
    ".json": "application/json",
    ".md": "text/markdown",
    ".epub": "application/epub+zip",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4"
  }[extension] ?? "application/octet-stream";
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

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value
  };
}

export function createAuthProvider(tokenManager) {
  return {
    token: () => tokenManager.getValidAccessToken(),
    onUnauthorized: async ({ response }) => {
      const challenge = response.headers.get("www-authenticate") ?? "";
      if (!/\berror\s*=\s*"?invalid_token"?/i.test(challenge)) {
        throw new Error("CUNEFLOW authorization request was rejected without an invalid_token challenge; token refresh was skipped.");
      }
      await tokenManager.forceRefreshAccessToken();
    }
  };
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function userFacingRemoteError(error) {
  if (error instanceof UnauthorizedError) {
    return new Error("CUNEFLOW authorization was rejected. Run `cuneflow login` again, then restart your MCP client.", { cause: error });
  }
  if (error instanceof InsufficientScopeError) {
    return new Error("CUNEFLOW rejected this request because the token lacks permission. Run `cuneflow login` again to grant the required scope.", { cause: error });
  }
  if (error instanceof SdkError && error.code === SdkErrorCode.RequestTimeout) {
    return new Error("CUNEFLOW MCP request timed out. Check your network and retry the operation.", { cause: error });
  }
  return error;
}

function timeoutForRequest(request, requestTimeoutMs, uploadTimeoutMs) {
  const toolName = request.method === "tools/call" ? request.params?.name : null;
  return toolName === "create_file_upload_session" || toolName === "complete_file_uploads"
      || toolName === "create_screensaver_upload_session"
      || toolName === "prepare_screensaver_publish"
      || toolName === LOCAL_SCREENSAVER_PREPARE_TOOL.name
    ? uploadTimeoutMs
    : requestTimeoutMs;
}
