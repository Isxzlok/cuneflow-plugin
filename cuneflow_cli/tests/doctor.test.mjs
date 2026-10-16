import assert from "node:assert/strict";
import test from "node:test";
import { runDoctor } from "../src/commands/doctor.mjs";

test("doctor 返回稳定分层结果且不泄漏 token", async () => {
  const secretAccessToken = "access-token-must-not-appear";
  const secretRefreshToken = "refresh-token-must-not-appear";
  const store = {
    name: () => "test-store",
    load: async () => ({
      accessToken: secretAccessToken,
      refreshToken: secretRefreshToken,
      accessExpiresAt: "2099-01-01T00:00:00.000Z",
      resource: "https://mcp.cuneflow.test/mcp"
    })
  };
  const report = await withMutedConsole(() => runDoctor(["--json", "--client", "codex"], {
    nodeVersion: "20.19.0",
    loadConfig: () => ({
      environment: "test",
      mcpUrl: "https://mcp.cuneflow.test/mcp"
    }),
    inspectCliPath: async () => ({ message: "/bin/cuneflow" }),
    createTokenStore: async () => store,
    createTokenManager: () => ({ getValidAccessToken: async () => secretAccessToken }),
    probeMcp: async () => ({
      protocolVersion: "2025-11-25",
      serverName: "cuneflow-ai-mcp-server",
      serverVersion: "0.1.0",
      toolCount: 23
    }),
    inspectClient: async () => ({ message: "configured" }),
    inspectSkill: async () => ({ message: "installed" })
  }));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((check) => check.id), [
    "runtime",
    "cli_path",
    "token_store",
    "access_token",
    "mcp_initialize",
    "tools_list",
    "client_codex",
    "skill_codex"
  ]);
  assert.equal(JSON.stringify(report).includes(secretAccessToken), false);
  assert.equal(JSON.stringify(report).includes(secretRefreshToken), false);
});

test("doctor 任一层失败时返回失败结果并保留后续诊断", async () => {
  const report = await withMutedConsole(() => runDoctor(["--client", "claude"], {
    nodeVersion: "20.19.0",
    loadConfig: () => ({ environment: "test", mcpUrl: "https://mcp.cuneflow.test/mcp" }),
    inspectCliPath: async () => ({ message: "/bin/cuneflow" }),
    createTokenStore: async () => ({ name: () => "test-store", load: async () => null }),
    inspectClient: async () => ({ message: "configured" }),
    inspectSkill: async () => ({ message: "installed" })
  }));

  assert.equal(report.ok, false);
  assert.equal(report.checks.find((check) => check.id === "token_store").status, "fail");
  assert.equal(report.checks.find((check) => check.id === "client_claude").status, "pass");
});

async function withMutedConsole(callback) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}
