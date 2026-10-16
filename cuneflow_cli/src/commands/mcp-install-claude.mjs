import { spawn } from "node:child_process";
import { runSkillsInstallClaude } from "./skills-install-claude.mjs";
import { loadConfig } from "../util/config.mjs";

const SERVER_NAME = "cuneflow";
const PROXY_COMMAND = "cuneflow";
const PROXY_ARGS = ["mcp", "proxy"];

/**
 * 将 CUNEFLOW MCP proxy 安装到 Claude Code 的用户级 MCP 配置中。
 */
export async function runMcpInstallClaude(args = []) {
  const options = parseOptions(args);
  const config = loadConfig();
  const commandArgs = buildMcpAddArgs(config.environment);
  if (options.dryRun) {
    console.log("Claude Code MCP command:");
    console.log(formatCommand(commandArgs));
    if (!options.noSkill) {
      await runSkillsInstallClaude(["--dry-run"]);
    }
    return;
  }

  await runClaudeCommand(commandArgs);
  console.log("CUNEFLOW MCP server installed into Claude Code user config.");
  if (options.noSkill) {
    console.log("CUNEFLOW Skill installation skipped (--no-skill).");
  } else {
    try {
      await runSkillsInstallClaude([]);
    } catch (error) {
      throw new Error(`MCP configuration installed, but Skill installation failed: ${error.message}`);
    }
  }
  console.log("Please restart Claude Code or reconnect MCP servers to reload the configuration.");
}

/** 构造 Claude Code MCP 安装参数，非生产环境随 stdio 服务配置持久化。 */
export function buildMcpAddArgs(environment = "prod") {
  const args = ["mcp", "add", "--scope", "user"];
  if (environment !== "prod") {
    args.push("-e", `CUNEFLOW_ENV=${environment}`);
  }
  args.push(SERVER_NAME, "--", PROXY_COMMAND, ...PROXY_ARGS);
  return args;
}

/**
 * 检查 Claude Code 中 CUNEFLOW MCP proxy 的安装状态。
 */
export async function runMcpStatusClaude(args = []) {
  parseOptions(args);
  const result = await runClaudeCommand(["mcp", "get", SERVER_NAME], { allowFailure: true });
  if (result.exitCode !== 0) {
    console.log("Status: not installed");
    console.log("Next step: run `cuneflow mcp install claude`.");
    return;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const installedAsProxy = output.includes(PROXY_COMMAND) &&
    output.includes(PROXY_ARGS[0]) && output.includes(PROXY_ARGS[1]);
  console.log(installedAsProxy ? "Status: installed" : "Status: needs update");
  if (!installedAsProxy) {
    console.log("Reason: CUNEFLOW MCP is not configured to use local OAuth proxy.");
    console.log("Next step: run `cuneflow mcp install claude`.");
  } else {
    console.log("Next step: restart Claude Code if you installed or changed this config recently.");
  }
}

/**
 * 从 Claude Code 的用户级 MCP 配置中移除 CUNEFLOW MCP。
 */
export async function runMcpUninstallClaude(args = []) {
  parseOptions(args);
  const result = await runClaudeCommand(["mcp", "remove", SERVER_NAME], { allowFailure: true });
  if (result.exitCode !== 0) {
    console.log("CUNEFLOW MCP server is not installed in Claude Code user config.");
    return;
  }
  console.log("CUNEFLOW MCP server removed from Claude Code user config.");
  console.log("Please restart Claude Code or reconnect MCP servers to reload the configuration.");
}

function parseOptions(args) {
  const options = { dryRun: false, noSkill: false };
  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--no-skill") {
      options.noSkill = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function runClaudeCommand(args, { allowFailure = false } = {}) {
  const command = process.platform === "win32" ? "claude.cmd" : "claude";
  return new Promise((resolve, reject) => {
    // Windows 上 claude 是 .cmd 垫片，Node 18.20+ 要求经 shell 启动，否则报 EINVAL。
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      reject(new Error(`无法执行 Claude Code 命令，请确认已安装并且 \\"claude\\" 在 PATH 中：${error.message}`));
    });
    child.on("close", (exitCode) => {
      if (exitCode !== 0 && !allowFailure) {
        reject(new Error(stderr.trim() || stdout.trim() || `Claude Code 命令执行失败（退出码 ${exitCode}）。`));
        return;
      }
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function formatCommand(args) {
  return `claude ${args.map((arg) => quoteShellArg(arg)).join(" ")}`;
}

function quoteShellArg(value) {
  return /^[a-zA-Z0-9_./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}
