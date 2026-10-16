import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const CLI_PATH = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

test("未知命令返回非零退出码", () => {
  const result = runCli(["unknown-command"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown or incomplete command/);
});

test("无参数命令拒绝多余参数", () => {
  const result = runCli(["login", "unexpected"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument/);
});

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
    env: { ...process.env, CUNEFLOW_ENV: "test" }
  });
}
