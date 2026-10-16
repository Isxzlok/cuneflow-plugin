import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAuthProvider } from "../mcp/sdk-mcp-proxy.mjs";
import {
  currentCodexLaunch,
  inspectCuneflowMcpBlock
} from "./mcp-install-codex.mjs";
import { createTokenStore } from "../token/token-store-factory.mjs";
import { TokenManager } from "../token/token-manager.mjs";
import { loadConfig } from "../util/config.mjs";
import { readPackageInfo } from "../util/package-info.mjs";

const CLIENTS = new Set(["codex", "claude"]);

/**
 * 对 CLI、OAuth、MCP 和目标客户端配置执行只读诊断。
 */
export async function runDoctor(args = [], dependencies = {}) {
  const options = parseOptions(args);
  const services = {
    loadConfig,
    createTokenStore,
    createTokenManager: (config, store) => new TokenManager({ config, store }),
    probeMcp,
    inspectCliPath,
    inspectClient,
    inspectSkill,
    nodeVersion: process.versions.node,
    ...dependencies
  };
  const config = services.loadConfig();
  const checks = [];

  await addCheck(checks, "runtime", "Node.js runtime", async () => {
    const major = Number(services.nodeVersion.split(".")[0]);
    if (major < 20) {
      throw new Error(`Node.js ${services.nodeVersion} is unsupported; Node.js 20 or newer is required.`);
    }
    return { message: `Node.js ${services.nodeVersion}`, details: { version: services.nodeVersion } };
  });

  await addCheck(checks, "cli_path", "CLI executable", async () => services.inspectCliPath());

  let store;
  let record;
  await addCheck(checks, "token_store", "Token store", async () => {
    store = await services.createTokenStore(config);
    record = await store.load();
    if (!record) {
      throw new Error("No saved credentials; run `cuneflow login`.");
    }
    return { message: `${store.name()} is readable`, details: { storage: store.name() } };
  });

  let tokenManager;
  await addCheck(checks, "access_token", "Access token", async () => {
    if (!store || !record) {
      throw new Error("Skipped because no saved credentials are available.");
    }
    tokenManager = services.createTokenManager(config, store);
    await tokenManager.getValidAccessToken();
    return {
      message: "A valid access token is available",
      details: {
        resource: record.resource,
        accessExpiresAt: record.accessExpiresAt,
        refreshAvailable: Boolean(record.refreshToken)
      }
    };
  });

  let mcpProbe;
  await addCheck(checks, "mcp_initialize", "MCP initialize", async () => {
    if (!tokenManager) {
      throw new Error("Skipped because access token validation failed.");
    }
    mcpProbe = await services.probeMcp(config, tokenManager);
    return {
      message: `Connected to ${mcpProbe.serverName}`,
      details: {
        endpoint: config.mcpUrl,
        protocolVersion: mcpProbe.protocolVersion,
        serverName: mcpProbe.serverName,
        serverVersion: mcpProbe.serverVersion
      }
    };
  });

  await addCheck(checks, "tools_list", "MCP tools/list", async () => {
    if (!mcpProbe) {
      throw new Error("Skipped because MCP initialize failed.");
    }
    if (mcpProbe.toolCount < 1) {
      throw new Error("MCP server returned an empty tool list.");
    }
    return { message: `${mcpProbe.toolCount} tools available`, details: { toolCount: mcpProbe.toolCount } };
  });

  for (const client of selectedClients(options.client)) {
    await addCheck(checks, `client_${client}`, `${client} MCP configuration`,
      () => services.inspectClient(client));
    await addCheck(checks, `skill_${client}`, `${client} skill`,
      () => services.inspectSkill(client));
  }

  const report = {
    schemaVersion: 1,
    ok: checks.every((check) => check.status === "pass"),
    environment: config.environment,
    endpoint: config.mcpUrl,
    client: options.client,
    checks
  };
  printReport(report, options.json);
  return report;
}

async function probeMcp(config, tokenManager) {
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    authProvider: createAuthProvider(tokenManager),
    onInsufficientScope: "throw"
  });
  const client = new Client({
    name: "cuneflow-cli-doctor",
    version: (await readPackageInfo()).version
  }, { capabilities: {} });
  try {
    await client.connect(transport, { timeout: config.mcpInitializeTimeoutMs });
    const tools = await client.listTools(undefined, { timeout: config.mcpRequestTimeoutMs });
    const server = client.getServerVersion() ?? {};
    return {
      protocolVersion: client.getNegotiatedProtocolVersion() ?? null,
      serverName: server.name ?? "unknown MCP server",
      serverVersion: server.version ?? null,
      toolCount: tools.tools?.length ?? 0
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function inspectCliPath() {
  const entrypoint = path.resolve(process.argv[1]);
  await fs.access(entrypoint);
  const executable = await findExecutable("cuneflow");
  if (!executable) {
    throw new Error(`Current CLI entrypoint is ${entrypoint}, but "cuneflow" is not available in PATH.`);
  }
  return { message: executable, details: { entrypoint, executable } };
}

async function inspectClient(client) {
  if (client === "codex") {
    const configPath = process.env.CUNEFLOW_CODEX_CONFIG_FILE
      || path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");
    const content = await fs.readFile(configPath, "utf8");
    const block = extractCodexMcpBlock(content);
    const inspection = inspectCuneflowMcpBlock(block, currentCodexLaunch());
    if (!inspection.ok) {
      throw new Error(`${inspection.reason} Run \`cuneflow mcp install codex\` again.`);
    }
    await fs.access(inspection.command, constants.X_OK);
    await fs.access(inspection.cliEntrypoint);
    return {
      message: `Configured in ${configPath}`,
      details: {
        configPath,
        command: inspection.command,
        cliEntrypoint: inspection.cliEntrypoint
      }
    };
  }

  const executable = await findExecutable("claude");
  if (!executable) {
    throw new Error("Claude Code is not available in PATH.");
  }
  const result = await runCommand(executable, ["mcp", "get", "cuneflow"]);
  if (result.exitCode !== 0 || !result.output.includes("cuneflow")
      || !result.output.includes("mcp") || !result.output.includes("proxy")) {
    throw new Error("Claude Code does not contain the CUNEFLOW MCP proxy configuration.");
  }
  return { message: "Configured in Claude Code", details: { executable } };
}

function extractCodexMcpBlock(content) {
  const match = content.match(/\[mcp_servers\.cuneflow]\s*[\s\S]*?(?=\n\[[^\]]+]|$)/);
  return match ? match[0] : null;
}

async function inspectSkill(client) {
  const skillRoot = client === "codex"
    ? path.join(os.homedir(), ".agents", "skills")
    : path.join(os.homedir(), ".claude", "skills");
  const skillPaths = ["cuneflow", "build-cune-screensavers"]
    .map((name) => path.join(skillRoot, name, "SKILL.md"));
  const screensaverBuilder = path.join(
    skillRoot, "build-cune-screensavers", "scripts", "cunesaver.pyz");
  await Promise.all([...skillPaths, screensaverBuilder].map((artifactPath) => fs.access(artifactPath)));
  return {
    message: `${skillPaths.length} skills installed`,
    details: { paths: skillPaths, screensaverBuilder }
  };
}

async function findExecutable(name) {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const directory of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension.toLowerCase()}`);
      try {
        await fs.access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // 继续检查下一个 PATH 目录。
      }
    }
  }
  return null;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let output = "";
    const timer = setTimeout(() => child.kill(), 10_000);
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, output });
    });
  });
}

async function addCheck(checks, id, name, execute) {
  const startedAt = Date.now();
  try {
    const result = await execute();
    checks.push({
      id,
      name,
      status: "pass",
      message: result?.message ?? "OK",
      durationMs: Date.now() - startedAt,
      ...(result?.details ? { details: result.details } : {})
    });
  } catch (error) {
    checks.push({
      id,
      name,
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt
    });
  }
}

function selectedClients(client) {
  return client === "all" ? [...CLIENTS] : [client];
}

function parseOptions(args) {
  const options = { json: false, client: "all" };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") {
      options.json = true;
      continue;
    }
    if (args[index] === "--client") {
      const value = args[index + 1];
      if (!CLIENTS.has(value) && value !== "all") {
        throw new Error("--client must be codex, claude, or all");
      }
      options.client = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${args[index]}`);
  }
  return options;
}

function printReport(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`CUNEFLOW doctor (${report.environment})`);
  console.log(`Endpoint: ${report.endpoint}`);
  for (const check of report.checks) {
    console.log(`${check.status === "pass" ? "PASS" : "FAIL"}  ${check.name}: ${check.message}`);
  }
  console.log(report.ok ? "Result: healthy" : "Result: problems found");
}
