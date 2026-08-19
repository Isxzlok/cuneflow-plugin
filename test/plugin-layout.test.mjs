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
  assert.equal(codex.mcpServers, "./.mcp.json");
  assert.equal(claude.mcpServers, "./.claude-plugin/mcp.json");
});

test("uses host-specific MCP path resolution with shared servers", async () => {
  const codex = await readJson(".mcp.json");
  const claude = await readJson(".claude-plugin/mcp.json");

  assert.deepEqual(Object.keys(codex.mcpServers), ["cuneflow", "cuneflow-local-upload"]);
  assert.deepEqual(Object.keys(claude.mcpServers), ["cuneflow", "cuneflow-local-upload"]);
  assert.equal(codex.mcpServers.cuneflow.url, claude.mcpServers.cuneflow.url);
  assert.equal(codex.mcpServers["cuneflow-local-upload"].cwd, "scripts");
  assert.equal(
    claude.mcpServers["cuneflow-local-upload"].args[0],
    "${CLAUDE_PLUGIN_ROOT}/scripts/attachment-inspector.mjs"
  );
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
