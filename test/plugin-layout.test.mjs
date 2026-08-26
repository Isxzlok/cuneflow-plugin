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
  assert.equal(codex.mcpServers.cuneflow.oauth_resource, codex.mcpServers.cuneflow.url);
  await access(new URL("scripts/attachment-helper.mjs", pluginRoot));
});

test("keeps OAuth recovery available after a user cancels initial authorization", async () => {
  const connectSkill = await readFile(new URL("skills/connect-cuneflow/SKILL.md", pluginRoot), "utf8");
  const mainSkill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");
  const readme = await readFile(new URL("README.md", workspaceRoot), "utf8");

  for (const content of [connectSkill, mainSkill]) {
    assert.ok(content.includes("codex mcp login cuneflow"));
    assert.ok(content.includes("一次用户请求最多启动一次登录"));
  }
  assert.ok(connectSkill.includes("不要只回复“请重新连接”"));
  assert.ok(readme.includes("连接或重新授权 CUNEFLOW"));
  assert.ok(readme.includes("不需要卸载插件或编辑配置"));
});

test("disconnects OAuth before a conversational full uninstall", async () => {
  const disconnectSkill = await readFile(new URL("skills/disconnect-cuneflow/SKILL.md", pluginRoot), "utf8");
  const readme = await readFile(new URL("README.md", workspaceRoot), "utf8");

  const logoutIndex = disconnectSkill.indexOf("codex mcp logout cuneflow");
  const removeIndex = disconnectSkill.indexOf("codex plugin remove cuneflow@cuneflow");

  assert.ok(logoutIndex >= 0);
  assert.ok(removeIndex > logoutIndex);
  assert.ok(disconnectSkill.includes("不能拦截 Codex 设置界面的手动卸载按钮"));
  assert.ok(disconnectSkill.includes("不要声称它会删除 CUNEFLOW 账户"));
  assert.ok(readme.includes("彻底卸载 CUNEFLOW，并清除登录状态"));
  assert.ok(readme.includes("直接在 Codex 设置界面点击“卸载”不会触发 Skill"));
});

test("packages all canonical CLI skills and screensaver resources", async () => {
  const required = [
    "skills/connect-cuneflow/SKILL.md",
    "skills/connect-cuneflow/agents/openai.yaml",
    "skills/disconnect-cuneflow/SKILL.md",
    "skills/disconnect-cuneflow/agents/openai.yaml",
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

test("requires every PDF background meeting in a batch to reuse its source file", async () => {
  const skill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");

  assert.ok(skill.includes("每次 `create_meeting_from_pdf` 复用同一个 `sourceFileId`"));
  assert.ok(skill.includes("源 PDF 保留在文件库，但不会自动成为关联资料"));
});

test("keeps meeting creation independent from schedule creation", async () => {
  const skill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");

  assert.ok(skill.includes("会议创建完成标准：返回会议标题、`meetingId` 和文件背景或关联处理结果"));
  assert.ok(skill.includes("日程写入分支：仅当用户明确要求“创建日程”“加入日历”或“设置提醒”时调用 `create_schedule_task`"));
  assert.ok(!skill.includes("未创建日程"));
});

test("treats an explicit attachment-backed meeting request as upload authorization", async () => {
  const skill = await readFile(new URL("skills/cuneflow/SKILL.md", pluginRoot), "utf8");

  assert.ok(skill.includes("原始请求已构成本次文件上传和关联创建的明确授权"));
  assert.ok(skill.includes("不要在聊天中再次要求用户回复“同意”"));
  assert.ok(skill.includes("系统级审批仍由宿主管理，不得绕过"));
  assert.ok(skill.includes("实际上传目标和用途超出用户原始请求时，必须先询问"));
});
