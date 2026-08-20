import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const pluginRoot = new URL("../plugins/cuneflow/", import.meta.url);
const workspaceRoot = new URL("../", import.meta.url);

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
  assert.deepEqual(codex.interface.defaultPrompt, [
    "连接 CUNEFLOW，并总结我最近一次会议的关键决策、风险和行动项",
    "查看我明天的日程安排，找出时间冲突并整理待办",
    "把我刚拖入对话的文件上传到 CUNEFLOW，并创建关联会议"
  ]);
});

test("keeps README examples aligned with Codex default prompts", async () => {
  const codex = await readJson(".codex-plugin/plugin.json");
  const readme = await readFile(new URL("README.md", workspaceRoot), "utf8");

  for (const prompt of codex.interface.defaultPrompt) {
    assert.ok(readme.includes(prompt), `README is missing default prompt: ${prompt}`);
  }
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
    "skills/connect-cuneflow/SKILL.md",
    "skills/connect-cuneflow/agents/openai.yaml",
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

test("requires every meeting in a batch to reuse uploaded attachments", async () => {
  const skill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");

  assert.ok(skill.includes("每一次 `create_meeting` 都传入同一批 `fileIds`"));
  assert.ok(skill.includes("不得上传后创建空会议"));
});

test("treats an explicit attachment-backed meeting request as upload authorization", async () => {
  const skill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");

  assert.ok(skill.includes("原始请求已构成本次文件上传和关联创建的明确授权"));
  assert.ok(skill.includes("不要在聊天中再次要求用户回复“同意”"));
  assert.ok(skill.includes("系统级审批仍由宿主管理，不得绕过"));
  assert.ok(skill.includes("实际上传目标和用途超出用户原始请求时，必须先询问"));
});
