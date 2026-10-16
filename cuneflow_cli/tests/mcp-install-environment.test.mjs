import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  buildCuneflowMcpBlock,
  inspectCuneflowMcpBlock
} from "../src/commands/mcp-install-codex.mjs";
import { buildMcpAddArgs } from "../src/commands/mcp-install-claude.mjs";

test("Codex 生产配置不写入冗余环境变量", () => {
  assert.doesNotMatch(buildCuneflowMcpBlock("prod", codexLaunch()), /CUNEFLOW_ENV/);
});

test("Codex 测试配置持久化环境选择", () => {
  const launch = codexLaunch();
  const block = buildCuneflowMcpBlock("test", launch);
  assert.ok(block.includes(`command = ${JSON.stringify(launch.command)}`));
  assert.ok(block.includes(`args = [${JSON.stringify(launch.cliEntrypoint)}, "mcp", "proxy"]`));
  assert.match(block, /env = \{ CUNEFLOW_ENV = "test" }/);
  assert.equal(inspectCuneflowMcpBlock(block, launch).ok, true);
});

test("Codex 旧 PATH 配置会被识别为需要更新", () => {
  const result = inspectCuneflowMcpBlock(`
[mcp_servers.cuneflow]
command = "cuneflow"
args = ["mcp", "proxy"]
`, codexLaunch());
  assert.equal(result.ok, false);
  assert.match(result.reason, /PATH-based/);
});

test("Codex 配置指向其他 Node 版本时会被识别为需要更新", () => {
  const block = buildCuneflowMcpBlock("test", {
    command: path.resolve("fixtures", "node18", "bin", "node"),
    cliEntrypoint: path.resolve("fixtures", "node18", "lib", "cuneflow", "cli.mjs")
  });
  const result = inspectCuneflowMcpBlock(block, codexLaunch());
  assert.equal(result.ok, false);
  assert.match(result.reason, /different Node.js or CLI/);
});

test("Claude Code 测试配置持久化环境选择", () => {
  assert.deepEqual(buildMcpAddArgs("test"), [
    "mcp", "add", "--scope", "user", "-e", "CUNEFLOW_ENV=test",
    "cuneflow", "--", "cuneflow", "mcp", "proxy"
  ]);
});

function codexLaunch() {
  return {
    command: path.resolve("fixtures", "node20", "bin", "node"),
    cliEntrypoint: path.resolve("fixtures", "CUNEFLOW CLI", "cli.mjs")
  };
}
