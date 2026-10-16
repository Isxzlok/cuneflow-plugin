import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { expandHome, loadConfig, tokenRecordKey } from "../src/util/config.mjs";

test("expandHome 展开路径", () => {
  assert.equal(expandHome("~"), os.homedir());
  assert.equal(expandHome("~/x/y"), path.join(os.homedir(), "x/y"));
  assert.equal(expandHome("/abs/path"), "/abs/path");
});

test("tokenRecordKey 由 baseUrl 和 clientId 组成", () => {
  assert.equal(tokenRecordKey({ baseUrl: "https://api.example.com", clientId: "codex" }), "https://api.example.com|codex");
});

test("loadConfig 默认使用正式服务和 cuneflow-cli", () => {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith("CUNEFLOW_")) delete process.env[key];
    const config = loadConfig();
    assert.equal(config.environment, "prod");
    assert.equal(config.baseUrl, "https://api.cuneflow.com");
    assert.equal(config.clientId, "cuneflow-cli");
    assert.equal(config.resource, "https://mcp.cuneflow.com/mcp");
    assert.equal(config.mcpUrl, "https://mcp.cuneflow.com/mcp");
    assert.equal(config.callbackHost, "127.0.0.1");
    assert.equal(config.callbackPort, 7878);
    assert.equal(config.oauthRequestTimeoutMs, 15_000);
    assert.equal(config.mcpInitializeTimeoutMs, 30_000);
    assert.equal(config.mcpRequestTimeoutMs, 120_000);
    assert.equal(config.mcpUploadTimeoutMs, 300_000);
  } finally { process.env = saved; }
});

test("loadConfig 拒绝非正数超时", () => {
  const saved = { ...process.env };
  try {
    process.env.CUNEFLOW_OAUTH_TIMEOUT_SECONDS = "0";
    assert.throws(() => loadConfig(), /must be a positive number/);
  } finally { process.env = saved; }
});

test("loadConfig 显式选择测试环境", () => {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith("CUNEFLOW_")) delete process.env[key];
    process.env.CUNEFLOW_ENV = "test";
    const config = loadConfig();
    assert.equal(config.environment, "test");
    assert.equal(config.baseUrl, "https://test-api.cuneflow.com");
    assert.equal(config.resource, "https://test-mcp.cuneflow.com/mcp");
    assert.equal(config.mcpUrl, "https://test-mcp.cuneflow.com/mcp");
  } finally { process.env = saved; }
});

test("loadConfig 拒绝未知环境", () => {
  const saved = { ...process.env };
  try {
    process.env.CUNEFLOW_ENV = "staging-typo";
    assert.throws(() => loadConfig(), /Unsupported CUNEFLOW_ENV/);
  } finally { process.env = saved; }
});

test("loadConfig 支持环境变量覆盖", () => {
  const saved = { ...process.env };
  try {
    process.env.CUNEFLOW_CALLBACK_PORT = "7999";
    process.env.CUNEFLOW_BASE_URL = "https://example.com";
    process.env.CUNEFLOW_CLIENT_ID = "test-client";
    const config = loadConfig();
    assert.equal(config.callbackPort, 7999);
    assert.equal(config.baseUrl, "https://example.com");
    assert.equal(config.clientId, "test-client");
  } finally { process.env = saved; }
});
