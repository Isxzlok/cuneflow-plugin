import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareLocalScreensaverPublish } from "../src/mcp/local-screensaver-publish.mjs";

test("本地屏保发布工具只完成直传和发布预览", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cuneflow-screen-local-"));
  const packagePath = join(temporaryDirectory, "clock.cunesaver");
  await writeFile(packagePath, "fake-cunesaver-package", "utf8");
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const calls = [];
  const remoteClient = {
    async callTool(request) {
      calls.push(request);
      if (request.name === "create_screensaver_upload_session") {
        return {
          structuredContent: {
            sessionId: "session-1",
            method: "PUT",
            uploadUrl: "https://oss.example.test/clock.cunesaver",
            headers: { "Content-Type": "application/vnd.cune.screensaver" }
          }
        };
      }
      return {
        structuredContent: {
          operation: "CREATE",
          confirmationToken: "confirmation-1"
        }
      };
    }
  };
  let uploadedBody = "";
  const result = await prepareLocalScreensaverPublish({
    args: { path: packagePath, idempotencyKey: "screen-request-1" },
    remoteClient,
    uploadFetch: async (_url, options) => {
      for await (const chunk of options.body) uploadedBody += chunk.toString("utf8");
      return new Response(null, { status: 200 });
    },
    uploadTimeoutMs: 10_000,
    signal: new AbortController().signal
  });

  assert.equal(uploadedBody, "fake-cunesaver-package");
  assert.deepEqual(calls.map((call) => call.name), [
    "create_screensaver_upload_session",
    "prepare_screensaver_publish"
  ]);
  assert.equal(calls.some((call) => call.name === "apply_screensaver_publish"), false);
  assert.equal(calls[0].arguments.fileName, "clock.cunesaver");
  assert.equal(calls[0].arguments.sizeBytes, 22);
  assert.match(calls[0].arguments.contentMd5, /^[A-Za-z0-9+/]{22}==$/);
  assert.deepEqual(calls[1].arguments, { sessionId: "session-1" });
  assert.equal(result.structuredContent.sessionId, "session-1");
  assert.equal(result.structuredContent.confirmationToken, "confirmation-1");
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
});

test("本地屏保发布工具拒绝非cunesaver文件", async () => {
  await assert.rejects(
    prepareLocalScreensaverPublish({
      args: { path: "clock.zip", idempotencyKey: "screen-request-2" },
      remoteClient: {},
      uploadFetch: fetch,
      uploadTimeoutMs: 10_000,
      signal: new AbortController().signal
    }),
    /必须使用 \.cunesaver 扩展名/
  );
});
