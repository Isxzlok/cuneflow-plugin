import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const pluginRoot = new URL("../plugins/cuneflow/", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, pluginRoot), "utf8"));
}

test("shares one plugin identity across Codex and Claude manifests", async () => {
  const codex = await readJson(".codex-plugin/plugin.json");
  const claude = await readJson(".claude-plugin/plugin.json");

  assert.equal(codex.name, "cuneflow");
  assert.equal(claude.name, codex.name);
  assert.equal(claude.version, codex.version);
  assert.equal(claude.description, codex.description);
  assert.equal(codex.mcpServers, "./.mcp.json");
  assert.equal(claude.mcpServers, "./.claude-plugin/mcp.json");
  assert.equal(codex.interface.defaultPrompt.length, 3);
});

test("exposes one authenticated CUNEFLOW MCP server on both hosts", async () => {
  const codex = await readJson(".mcp.json");
  const claude = await readJson(".claude-plugin/mcp.json");

  assert.deepEqual(Object.keys(codex.mcpServers), ["cuneflow"]);
  assert.deepEqual(Object.keys(claude.mcpServers), ["cuneflow"]);
  assert.equal(codex.mcpServers.cuneflow.url, claude.mcpServers.cuneflow.url);
  await access(new URL("scripts/attachment-helper.mjs", pluginRoot));
});

test("packages all canonical CLI skills and screensaver resources", async () => {
  const required = [
    "skills/cuneflow/SKILL.md",
    "skills/build-cune-screensavers/SKILL.md",
    "skills/build-cune-screensavers/agents/openai.yaml",
    "skills/build-cune-screensavers/scripts/cunesaver.py",
    "skills/build-cune-screensavers/scripts/cunesaver.pyz",
    "skills/build-cune-screensavers/references/adb-delivery.md",
    "skills/build-cune-screensavers/references/cuneflow-publishing.md",
    "skills/build-cune-screensavers/references/data-boundary.md",
    "skills/build-cune-screensavers/references/format-v1.md",
    "skills/build-cune-screensavers/references/format-v2.md",
    "skills/build-cune-screensavers/references/testkit-delivery.md"
  ];

  await Promise.all(required.map((relativePath) => access(new URL(relativePath, pluginRoot))));
  assert.ok((await stat(new URL("skills/build-cune-screensavers/scripts/cunesaver.pyz", pluginRoot))).size > 0);
});
