import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runSkillsInstallCodex } from "./skills-install-codex.mjs";
import { loadConfig } from "../util/config.mjs";

const SERVER_NAME = "cuneflow";

/**
 * 将 CUNEFLOW MCP proxy 安装到 Codex 配置中。
 */
export async function runMcpInstallCodex(args = []) {
  const options = parseOptions(args);
  const config = loadConfig();
  const configPath = resolveCodexConfigPath(options.configPath);
  const nextBlock = buildCuneflowMcpBlock(config.environment, currentCodexLaunch());
  const currentContent = await readIfExists(configPath);
  const nextContent = upsertMcpServerBlock(currentContent, nextBlock);

  if (options.dryRun) {
    console.log(`Codex config path: ${configPath}`);
    console.log("");
    console.log(nextContent);
    if (!options.noSkill) {
      await runSkillsInstallCodex(["--dry-run"]);
    }
    return;
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  if (currentContent !== null) {
    const backupPath = `${configPath}.bak-${timestampForFileName()}`;
    await fs.writeFile(backupPath, currentContent, "utf8");
    console.log(`Backup created: ${backupPath}`);
  }
  await fs.writeFile(configPath, nextContent, "utf8");

  console.log("CUNEFLOW MCP server installed into Codex config.");
  console.log(`config: ${configPath}`);
  if (options.noSkill) {
    console.log("CUNEFLOW Skill installation skipped (--no-skill).");
  } else {
    try {
      await runSkillsInstallCodex([]);
    } catch (error) {
      throw new Error(`MCP configuration installed, but Skill installation failed: ${error.message}`);
    }
  }
  console.log("Please restart Codex to reload MCP server configuration.");
}

/**
 * 检查 Codex 配置中 CUNEFLOW MCP proxy 的安装状态。
 */
export async function runMcpStatusCodex(args = []) {
  const options = parseOptions(args);
  const configPath = resolveCodexConfigPath(options.configPath);
  const currentContent = await readIfExists(configPath);
  const block = currentContent == null ? null : extractMcpServerBlock(currentContent);

  console.log(`Codex config path: ${configPath}`);
  if (currentContent == null) {
    console.log("Status: not installed");
    console.log("Reason: config file does not exist.");
    console.log("Next step: run `cuneflow mcp install codex`.");
    return;
  }
  if (block == null) {
    console.log("Status: not installed");
    console.log("Reason: [mcp_servers.cuneflow] block was not found.");
    console.log("Next step: run `cuneflow mcp install codex`.");
    return;
  }

  const command = readTomlStringValue(block, "command");
  const argsValue = readTomlArrayValue(block, "args");
  const url = readTomlStringValue(block, "url");
  const inspection = inspectCuneflowMcpBlock(block, currentCodexLaunch());

  console.log(inspection.ok ? "Status: installed" : "Status: needs update");
  if (command) {
    console.log(`command: ${command}`);
  }
  if (argsValue) {
    console.log(`args: ${argsValue}`);
  }
  if (url) {
    console.log(`url: ${url}`);
  }
  if (!inspection.ok) {
    console.log(`Reason: ${inspection.reason}`);
    console.log("Next step: run `cuneflow mcp install codex`.");
  } else {
    console.log("Next step: restart Codex if you installed or changed this config recently.");
  }
}

/**
 * 从 Codex 配置中移除 CUNEFLOW MCP 配置。
 */
export async function runMcpUninstallCodex(args = []) {
  const options = parseOptions(args);
  const configPath = resolveCodexConfigPath(options.configPath);
  const currentContent = await readIfExists(configPath);
  if (currentContent == null || extractMcpServerBlock(currentContent) == null) {
    console.log("CUNEFLOW MCP server is not installed in Codex config.");
    console.log(`config: ${configPath}`);
    return;
  }

  const nextContent = removeMcpServerBlock(currentContent);
  if (options.dryRun) {
    console.log(`Codex config path: ${configPath}`);
    console.log("");
    console.log(nextContent);
    return;
  }

  const backupPath = `${configPath}.bak-${timestampForFileName()}`;
  await fs.writeFile(backupPath, currentContent, "utf8");
  await fs.writeFile(configPath, nextContent, "utf8");
  console.log(`Backup created: ${backupPath}`);
  console.log("CUNEFLOW MCP server removed from Codex config.");
  console.log(`config: ${configPath}`);
  console.log("Please restart Codex to reload MCP server configuration.");
}

function parseOptions(args) {
  const options = {
    configPath: null,
    dryRun: false,
    noSkill: false
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--no-skill") {
      options.noSkill = true;
      continue;
    }
    if (arg === "--config") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--config requires a file path");
      }
      options.configPath = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function resolveCodexConfigPath(configPath) {
  if (configPath) {
    return expandHome(configPath);
  }
  if (process.env.CUNEFLOW_CODEX_CONFIG_FILE) {
    return expandHome(process.env.CUNEFLOW_CODEX_CONFIG_FILE);
  }
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return path.join(expandHome(codexHome), "config.toml");
}

export function buildCuneflowMcpBlock(environment = "prod", launch = currentCodexLaunch()) {
  const normalizedLaunch = normalizeCodexLaunch(launch);
  const lines = [
    `[mcp_servers.${SERVER_NAME}]`,
    `command = ${tomlString(normalizedLaunch.command)}`,
    `args = [${[
      normalizedLaunch.cliEntrypoint,
      "mcp",
      "proxy"
    ].map(tomlString).join(", ")}]`
  ];
  if (environment !== "prod") {
    lines.push(`env = { CUNEFLOW_ENV = "${environment}" }`);
  }
  lines.push(`tool_timeout_sec = 120`);
  return lines.join("\n");
}

/**
 * 返回当前 CLI 可供 Codex 桌面端稳定启动的绝对路径。
 *
 * <p>不能只写 command = "cuneflow"：桌面应用不会可靠继承 nvm 等 shell PATH，
 * 机器上存在多套 Node.js 时可能静默启动旧版 CLI。</p>
 */
export function currentCodexLaunch() {
  return normalizeCodexLaunch({
    command: process.execPath,
    cliEntrypoint: process.argv[1]
  });
}

/**
 * 检查配置块是否固定到了当前 Node.js 与 CLI 入口。
 */
export function inspectCuneflowMcpBlock(block, expectedLaunch = currentCodexLaunch()) {
  if (!block) {
    return { ok: false, reason: "CUNEFLOW MCP configuration was not found." };
  }
  const command = readTomlStringValue(block, "command");
  const args = readTomlStringArrayValue(block, "args");
  if (command === "cuneflow" && args?.join("\0") === ["mcp", "proxy"].join("\0")) {
    return {
      ok: false,
      reason: "The legacy PATH-based launcher is not reliable for Codex Desktop."
    };
  }
  if (!command || !path.isAbsolute(command)) {
    return { ok: false, reason: "The configured Node.js command is not an absolute path." };
  }
  if (!args || args.length !== 3 || !path.isAbsolute(args[0])
      || args[1] !== "mcp" || args[2] !== "proxy") {
    return { ok: false, reason: "The configured CLI entrypoint or proxy arguments are invalid." };
  }

  const expected = normalizeCodexLaunch(expectedLaunch);
  if (path.resolve(command) !== expected.command || path.resolve(args[0]) !== expected.cliEntrypoint) {
    return {
      ok: false,
      reason: "The configuration points to a different Node.js or CLI installation."
    };
  }
  return {
    ok: true,
    command,
    cliEntrypoint: args[0]
  };
}

function normalizeCodexLaunch(launch) {
  const rawCommand = String(launch?.command || "");
  const rawCliEntrypoint = String(launch?.cliEntrypoint || "");
  if (!rawCommand || !rawCliEntrypoint
      || !path.isAbsolute(rawCommand) || !path.isAbsolute(rawCliEntrypoint)) {
    throw new Error("Codex Node.js command and CLI entrypoint must be absolute paths.");
  }
  return {
    command: path.resolve(rawCommand),
    cliEntrypoint: path.resolve(rawCliEntrypoint)
  };
}

function tomlString(value) {
  return JSON.stringify(value);
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function upsertMcpServerBlock(content, block) {
  let base = removeMcpServerBlock(content || "").replace(/\s+$/g, "");
  if (base.length > 0) {
    base += "\n\n";
  }
  return `${base}${block}\n`;
}

function removeMcpServerBlock(content) {
  const normalizedContent = content || "";
  const lines = normalizedContent.split(/\r?\n/);
  const keptLines = [];
  let skipping = false;

  for (const line of lines) {
    const tableName = parseTomlTableName(line);
    if (tableName) {
      if (isCuneflowMcpTable(tableName)) {
        skipping = true;
        continue;
      }
      skipping = false;
    }
    if (!skipping) {
      keptLines.push(line);
    }
  }
  const nextContent = keptLines.join("\n").replace(/\s+$/g, "");
  return nextContent.length > 0 ? `${nextContent}\n` : "";
}

function extractMcpServerBlock(content) {
  const lines = content.split(/\r?\n/);
  const blockLines = [];
  let collecting = false;

  for (const line of lines) {
    const tableName = parseTomlTableName(line);
    if (tableName) {
      if (isCuneflowMcpTable(tableName)) {
        collecting = true;
        blockLines.push(line);
        continue;
      }
      if (collecting) {
        break;
      }
    }
    if (collecting) {
      blockLines.push(line);
    }
  }
  return blockLines.length === 0 ? null : blockLines.join("\n");
}

function parseTomlTableName(line) {
  const match = line.trim().match(/^\[([^\]]+)]$/);
  return match ? match[1].trim() : null;
}

function isCuneflowMcpTable(tableName) {
  return tableName === `mcp_servers.${SERVER_NAME}` || tableName.startsWith(`mcp_servers.${SERVER_NAME}.`);
}

function readTomlStringValue(block, key) {
  const match = block.match(new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`, "m"));
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function readTomlArrayValue(block, key) {
  const match = block.match(new RegExp(`^${key}\\s*=\\s*(\\[[^\\]]*])\\s*$`, "m"));
  if (!match) {
    return null;
  }
  return match[1].trim();
}

function readTomlStringArrayValue(block, key) {
  const rawValue = readTomlArrayValue(block, key);
  if (!rawValue) {
    return null;
  }
  try {
    const value = JSON.parse(rawValue);
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
  } catch {
    return null;
  }
}

function expandHome(filePath) {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function timestampForFileName() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.(\d+)Z$/, "$1Z");
}
