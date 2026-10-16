import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, InMemoryTransport, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { createAuthProvider, createProxyBridge } from "../src/mcp/sdk-mcp-proxy.mjs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IDENTITY_SCHEMA = {
  "~standard": {
    version: 1,
    vendor: "cuneflow-test",
    validate(value) {
      return { value };
    }
  }
};

test("SDK proxy 透明转发能力、元数据、进度、通知和反向 roots 请求", async (t) => {
  const [remoteClientTransport, remoteServerTransport] = InMemoryTransport.createLinkedPair();
  const remoteServer = new Server(
    { name: "cuneflow-test-server", version: "1.0.0" },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: {},
        prompts: {},
        experimental: { "acme/echo": {} }
      },
      instructions: "remote instructions"
    }
  );

  let rootsChanged = false;
  let cancelled = false;
  let resolveWaitStarted;
  const waitStarted = new Promise((resolve) => {
    resolveWaitStarted = resolve;
  });
  remoteServer.setNotificationHandler("notifications/roots/list_changed", async () => {
    rootsChanged = true;
  });
  remoteServer.setRequestHandler("tools/list", async () => ({
    tools: [
      {
        name: "inspect",
        description: "inspect",
        inputSchema: { type: "object" }
      },
      {
        name: "wait",
        description: "wait",
        inputSchema: { type: "object" }
      }
    ]
  }));
  remoteServer.setRequestHandler("tools/call", async (request, ctx) => {
    if (request.params.name === "wait") {
      resolveWaitStarted();
      await new Promise((resolve) => {
        ctx.mcpReq.signal.addEventListener("abort", () => {
          cancelled = true;
          resolve();
        }, { once: true });
      });
      return { content: [{ type: "text", text: "cancelled" }] };
    }
    await ctx.mcpReq.notify({
      method: "notifications/progress",
      params: {
        progressToken: ctx.mcpReq._meta.progressToken,
        progress: 0.5,
        total: 1
      }
    });
    const reverseProgress = [];
    const roots = await ctx.mcpReq.send(
      { method: "roots/list" },
      { onprogress: (progress) => reverseProgress.push(progress.progress) }
    );
    return {
      content: [{ type: "text", text: "ok" }],
      structuredContent: {
        roots: roots.roots.map((root) => root.uri),
        reverseProgress
      },
      _meta: { traceId: "trace-1" }
    };
  });
  remoteServer.setRequestHandler("resources/list", async () => ({
    resources: [{ uri: "cuneflow://meeting/1", name: "meeting-1" }]
  }));
  remoteServer.setRequestHandler("prompts/list", async () => ({
    prompts: [{ name: "weekly-review", description: "weekly review" }]
  }));
  remoteServer.setRequestHandler(
    "acme/echo",
    { params: IDENTITY_SCHEMA, result: IDENTITY_SCHEMA },
    async (params) => ({ echoed: params.value, futureField: true })
  );
  await remoteServer.connect(remoteServerTransport);

  const bridge = await createProxyBridge({ remoteTransport: remoteClientTransport });
  t.after(() => bridge.close());

  const [hostTransport, localServerTransport] = InMemoryTransport.createLinkedPair();
  await bridge.localServer.connect(localServerTransport);
  const host = new Client(
    { name: "test-host", version: "1.0.0" },
    { capabilities: { roots: { listChanged: true } } }
  );
  host.setRequestHandler("roots/list", async (_request, ctx) => {
    await ctx.mcpReq.notify({
      method: "notifications/progress",
      params: {
        progressToken: ctx.mcpReq._meta.progressToken,
        progress: 0.25
      }
    });
    return { roots: [{ uri: "file:///workspace", name: "workspace" }] };
  });
  await host.connect(hostTransport);
  t.after(() => host.close());

  let toolsChanged = false;
  host.setNotificationHandler("notifications/tools/list_changed", async () => {
    toolsChanged = true;
  });

  assert.deepEqual(host.getServerCapabilities(), remoteServer.getCapabilities());
  assert.equal(host.getServerVersion().name, "cuneflow-test-server");
  assert.equal(host.getInstructions(), "remote instructions");

  const progress = [];
  const result = await host.callTool(
    { name: "inspect", arguments: {} },
    { onprogress: (value) => progress.push(value) }
  );
  assert.deepEqual(progress, [{ progress: 0.5, total: 1 }]);
  assert.deepEqual(result.structuredContent, {
    roots: ["file:///workspace"],
    reverseProgress: [0.25]
  });
  assert.equal(result._meta.traceId, "trace-1");
  assert.equal((await host.listResources()).resources[0].uri, "cuneflow://meeting/1");
  assert.equal((await host.listPrompts()).prompts[0].name, "weekly-review");

  const abortController = new AbortController();
  const waiting = host.callTool(
    { name: "wait", arguments: {} },
    { signal: abortController.signal }
  );
  await waitStarted;
  abortController.abort(new Error("test cancellation"));
  await assert.rejects(waiting);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, true);

  await host.notification({ method: "notifications/roots/list_changed" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rootsChanged, true);

  await remoteServer.sendToolListChanged();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(toolsChanged, true);

  const extensionResult = await host.request(
    { method: "acme/echo", params: { value: "unchanged" } },
    IDENTITY_SCHEMA
  );
  assert.deepEqual(extensionResult, { echoed: "unchanged", futureField: true });
});

test("SDK proxy 将本地 token 管理器接入官方 401 重试钩子", async () => {
  const calls = [];
  const provider = createAuthProvider({
    async getValidAccessToken() {
      calls.push("token");
      return "access-1";
    },
    async forceRefreshAccessToken() {
      calls.push("refresh");
      return "access-2";
    }
  });

  assert.equal(await provider.token(), "access-1");
  await provider.onUnauthorized({
    response: new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer error=\"invalid_token\"" }
    })
  });
  assert.deepEqual(calls, ["token", "refresh"]);

  await assert.rejects(
    provider.onUnauthorized({ response: new Response(null, { status: 401 }) }),
    /refresh was skipped/
  );
  assert.deepEqual(calls, ["token", "refresh"]);
});

test("远端 503 不会触发 token refresh", async () => {
  let refreshCount = 0;
  const authProvider = createAuthProvider({
    async getValidAccessToken() {
      return "access-1";
    },
    async forceRefreshAccessToken() {
      refreshCount += 1;
      return "access-2";
    }
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.example.com/mcp"),
    {
      authProvider,
      fetch: async () => new Response("temporarily unavailable", { status: 503 })
    }
  );
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await assert.rejects(client.connect(transport));
  assert.equal(refreshCount, 0);
});

test("SDK proxy 区分普通请求和上传请求超时", async (t) => {
  const [remoteClientTransport, remoteServerTransport] = InMemoryTransport.createLinkedPair();
  const remoteServer = new Server(
    { name: "timeout-test-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  remoteServer.setRequestHandler("tools/call", async (request) => {
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { content: [{ type: "text", text: request.params.name }] };
  });
  await remoteServer.connect(remoteServerTransport);
  t.after(() => remoteServer.close());

  const bridge = await createProxyBridge({
    remoteTransport: remoteClientTransport,
    requestTimeoutMs: 20,
    uploadTimeoutMs: 200
  });
  t.after(() => bridge.close());

  const [hostTransport, localServerTransport] = InMemoryTransport.createLinkedPair();
  await bridge.localServer.connect(localServerTransport);
  const host = new Client({ name: "timeout-test-host", version: "1.0.0" });
  await host.connect(hostTransport);
  t.after(() => host.close());

  await assert.rejects(
    host.callTool({ name: "ordinary_tool", arguments: {} }),
    /timed out/i
  );
  const uploadResult = await host.callTool({ name: "create_file_upload_session", arguments: {} });
  assert.equal(uploadResult.content[0].text, "create_file_upload_session");
});

test("SDK proxy 本地上传工具直传原始文件且完成调用只发送 sessionId", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cuneflow-upload-test-"));
  const filePath = join(temporaryDirectory, "demo.pdf");
  await writeFile(filePath, "hello cuneflow", "utf8");
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const [remoteClientTransport, remoteServerTransport] = InMemoryTransport.createLinkedPair();
  const remoteServer = new Server(
    { name: "upload-test-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  let createArguments;
  let completeArguments;
  remoteServer.setRequestHandler("tools/list", async () => ({
    tools: [{ name: "create_file_upload_session", inputSchema: { type: "object" } }]
  }));
  remoteServer.setRequestHandler("tools/call", async (request) => {
    if (request.params.name === "create_file_upload_session") {
      createArguments = request.params.arguments;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: "session-1",
            files: [{
              name: "demo.pdf",
              method: "PUT",
              uploadUrl: "https://oss.example.test/demo.pdf",
              headers: { "Content-Type": "application/pdf", "Content-MD5": "test-md5" }
            }]
          })
        }]
      };
    }
    completeArguments = request.params.arguments;
    return { content: [{ type: "text", text: JSON.stringify({ completed: true }) }] };
  });
  await remoteServer.connect(remoteServerTransport);
  t.after(() => remoteServer.close());

  let uploadedBody = "";
  const bridge = await createProxyBridge({
    remoteTransport: remoteClientTransport,
    uploadFetch: async (_url, options) => {
      for await (const chunk of options.body) {
        uploadedBody += chunk.toString("utf8");
      }
      return new Response(null, { status: 200 });
    }
  });
  t.after(() => bridge.close());

  const [hostTransport, localServerTransport] = InMemoryTransport.createLinkedPair();
  await bridge.localServer.connect(localServerTransport);
  const host = new Client({ name: "upload-test-host", version: "1.0.0" });
  await host.connect(hostTransport);
  t.after(() => host.close());

  const listedTools = await host.listTools();
  assert.equal(listedTools.tools.some((tool) => tool.name === "upload_local_files"), true);
  const result = await host.callTool({
    name: "upload_local_files",
    arguments: { paths: [filePath], idempotencyKey: "upload-request-1" }
  });

  assert.equal(uploadedBody, "hello cuneflow");
  assert.equal(createArguments.files[0].name, "demo.pdf");
  assert.equal(createArguments.files[0].sizeBytes, 14);
  assert.equal(createArguments.files[0].contentType, "application/pdf");
  assert.match(createArguments.files[0].contentMd5, /^[A-Za-z0-9+/]{22}==$/);
  assert.deepEqual(completeArguments, { sessionId: "session-1" });
  assert.deepEqual(JSON.parse(result.content[0].text), { completed: true });
});

test("SDK proxy 屏保本地工具直传包并只返回发布预览", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "cuneflow-screensaver-test-"));
  const packagePath = join(temporaryDirectory, "clock.cunesaver");
  await writeFile(packagePath, "fake-cunesaver-package", "utf8");
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const [remoteClientTransport, remoteServerTransport] = InMemoryTransport.createLinkedPair();
  const remoteServer = new Server(
    { name: "screensaver-test-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  let createArguments;
  let prepareArguments;
  let applyCalled = false;
  remoteServer.setRequestHandler("tools/list", async () => ({
    tools: [
      { name: "create_screensaver_upload_session", inputSchema: { type: "object" } },
      { name: "prepare_screensaver_publish", inputSchema: { type: "object" } },
      { name: "apply_screensaver_publish", inputSchema: { type: "object" } }
    ]
  }));
  remoteServer.setRequestHandler("tools/call", async (request) => {
    if (request.params.name === "create_screensaver_upload_session") {
      createArguments = request.params.arguments;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: "screensaver-session-1",
            method: "PUT",
            uploadUrl: "https://oss.example.test/clock.cunesaver",
            headers: {
              "Content-Type": "application/vnd.cune.screensaver",
              "Content-MD5": "test-md5"
            }
          })
        }]
      };
    }
    if (request.params.name === "prepare_screensaver_publish") {
      prepareArguments = request.params.arguments;
      return {
        content: [{ type: "text", text: JSON.stringify({
          operation: "CREATE",
          confirmationToken: "confirmation-1"
        }) }]
      };
    }
    applyCalled = true;
    return { content: [{ type: "text", text: "applied" }] };
  });
  await remoteServer.connect(remoteServerTransport);
  t.after(() => remoteServer.close());

  let uploadedBody = "";
  const bridge = await createProxyBridge({
    remoteTransport: remoteClientTransport,
    uploadFetch: async (_url, options) => {
      for await (const chunk of options.body) uploadedBody += chunk.toString("utf8");
      return new Response(null, { status: 200 });
    }
  });
  t.after(() => bridge.close());

  const [hostTransport, localServerTransport] = InMemoryTransport.createLinkedPair();
  await bridge.localServer.connect(localServerTransport);
  const host = new Client({ name: "screensaver-test-host", version: "1.0.0" });
  await host.connect(hostTransport);
  t.after(() => host.close());

  const listedTools = await host.listTools();
  assert.equal(listedTools.tools.some((tool) => tool.name === "prepare_local_screensaver_publish"), true);
  const result = await host.callTool({
    name: "prepare_local_screensaver_publish",
    arguments: { path: packagePath, idempotencyKey: "screensaver-request-1" }
  });

  assert.equal(uploadedBody, "fake-cunesaver-package");
  assert.equal(createArguments.fileName, "clock.cunesaver");
  assert.equal(createArguments.sizeBytes, 22);
  assert.match(createArguments.contentMd5, /^[A-Za-z0-9+/]{22}==$/);
  assert.deepEqual(prepareArguments, { sessionId: "screensaver-session-1" });
  assert.equal(applyCalled, false);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    operation: "CREATE",
    confirmationToken: "confirmation-1",
    sessionId: "screensaver-session-1"
  });
});
