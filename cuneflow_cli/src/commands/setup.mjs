import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { runLogin } from "./login.mjs";
import { runMcpInstallClaude, runMcpUninstallClaude } from "./mcp-install-claude.mjs";
import { runMcpInstallCodex } from "./mcp-install-codex.mjs";
import { createTokenStore } from "../token/token-store-factory.mjs";
import { loadConfig } from "../util/config.mjs";

const execFileAsync = promisify(execFile);

/** 一键完成登录、AI 客户端检测、MCP 配置和 skills 安装。 */
export async function runSetup(args = []) {
  const options = parseOptions(args);
  const summary = [];
  console.log("CUNEFLOW setup\n");

  const config = loadConfig();
  const store = await createTokenStore(config);
  const record = await store.load();
  if (record) {
    console.log("[1/3] Login: already logged in, skipping.");
    summary.push("login: ok (existing)");
  } else if (options.dryRun) {
    console.log("[1/3] Login: would run `cuneflow login` (opens browser).");
    summary.push("login: pending");
  } else {
    console.log("[1/3] Login: opening browser for authorization...");
    await runLogin();
    summary.push("login: ok");
  }
  console.log("");

  const hasCodex = await detectCodex();
  const hasClaude = await detectClaude();
  console.log(`[2/3] Detected AI clients: ${[hasCodex && "Codex", hasClaude && "Claude Code"].filter(Boolean).join(", ") || "none"}`);
  if (!hasCodex && !hasClaude) {
    console.log("\nNeither Codex nor Claude Code was found on this machine.");
    console.log("Install one of them first, then run `cuneflow setup` again.");
    return;
  }
  console.log("\n[3/3] Configuring clients...");
  if (hasCodex) {
    if (options.dryRun) {
      console.log("  - Codex: would run `cuneflow mcp install codex` and `cuneflow skills install codex`.");
      summary.push("codex: pending");
    } else {
      console.log("  - Codex: installing MCP configuration...");
      await runMcpInstallCodex([]);
      summary.push("codex: ok");
    }
  }
  if (hasClaude) {
    if (options.dryRun) {
      console.log("  - Claude Code: would run `cuneflow mcp install claude` and `cuneflow skills install claude`.");
      summary.push("claude: pending");
    } else {
      console.log("  - Claude Code: installing MCP configuration...");
      await installClaudeMcpIdempotent();
      summary.push("claude: ok");
    }
  }
  console.log(`\nSetup complete: ${summary.join(", ")}\n`);
  console.log("Next steps:");
  if (hasCodex) console.log("  - Restart Codex to reload MCP configuration.");
  if (hasClaude) console.log("  - Restart Claude Code, or run /mcp in an existing session to reconnect.");
  console.log('  - Then try asking your AI tool: "帮我查询最近三个会议"');
}

async function installClaudeMcpIdempotent() {
  try {
    await runMcpInstallClaude([]);
  } catch (error) {
    if (!/already exists/i.test(error.message || "")) throw error;
    console.log("  - Claude Code: existing configuration found, refreshing...");
    await runMcpUninstallClaude([]);
    await runMcpInstallClaude([]);
  }
}

async function detectCodex() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  try { await fs.stat(codexHome); return true; } catch { return commandExists("codex"); }
}

function detectClaude() {
  return commandExists(process.platform === "win32" ? "claude.cmd" : "claude");
}

async function commandExists(command) {
  try {
    await execFileAsync(command, ["--version"], { shell: process.platform === "win32" });
    return true;
  } catch { return false; }
}

function parseOptions(args) {
  const options = { dryRun: false };
  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}
