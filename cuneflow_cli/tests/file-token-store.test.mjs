import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { FileTokenStore } from "../src/token/file-token-store.mjs";

test("多个 FileTokenStore 并发写入时保留全部客户端记录", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cuneflow-token-store-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const credentialsFile = path.join(directory, "credentials.json");
  const codexStore = new FileTokenStore(config(credentialsFile, "codex"));
  const claudeStore = new FileTokenStore(config(credentialsFile, "claude"));

  await Promise.all([
    codexStore.save({ accessToken: "codex-access", refreshToken: "shared-refresh" }),
    claudeStore.save({ accessToken: "claude-access", refreshToken: "shared-refresh" })
  ]);

  assert.deepEqual(await codexStore.load(), {
    accessToken: "codex-access",
    refreshToken: "shared-refresh"
  });
  assert.deepEqual(await claudeStore.load(), {
    accessToken: "claude-access",
    refreshToken: "shared-refresh"
  });
  const files = await fs.readdir(directory);
  assert.deepEqual(files, ["credentials.json"]);
});

test("并发更新同一记录时凭证文件保持为完整 JSON", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cuneflow-token-store-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const credentialsFile = path.join(directory, "credentials.json");
  const stores = Array.from(
    { length: 10 },
    () => new FileTokenStore(config(credentialsFile, "cuneflow-cli"))
  );

  await Promise.all(stores.map((store, index) => store.save({
    accessToken: `access-${index}`,
    refreshToken: "reusable-refresh"
  })));

  const document = JSON.parse(await fs.readFile(credentialsFile, "utf8"));
  const record = document.records["https://api.example.com|cuneflow-cli"];
  assert.match(record.accessToken, /^access-\d+$/);
  assert.equal(record.refreshToken, "reusable-refresh");
  assert.deepEqual(await fs.readdir(directory), ["credentials.json"]);
});

function config(credentialsFile, clientId) {
  return {
    baseUrl: "https://api.example.com",
    clientId,
    credentialsFile
  };
}
