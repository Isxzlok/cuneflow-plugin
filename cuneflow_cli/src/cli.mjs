#!/usr/bin/env node

import { runAuthRefresh } from "./commands/auth-refresh.mjs";
import { runAuthStatus } from "./commands/auth-status.mjs";
import { runDoctor } from "./commands/doctor.mjs";
import { runLogin } from "./commands/login.mjs";
import { runLogout } from "./commands/logout.mjs";
import { runMcpInstallCodex, runMcpStatusCodex, runMcpUninstallCodex } from "./commands/mcp-install-codex.mjs";
import { runMcpInstallClaude, runMcpStatusClaude, runMcpUninstallClaude } from "./commands/mcp-install-claude.mjs";
import { runMcpProxy } from "./commands/mcp-proxy.mjs";
import { runSetup } from "./commands/setup.mjs";
import { runUpdate } from "./commands/update.mjs";
import { runSkillsInstallClaude, runSkillsStatusClaude, runSkillsUninstallClaude } from "./commands/skills-install-claude.mjs";
import { runSkillsInstallCodex, runSkillsStatusCodex, runSkillsUninstallCodex } from "./commands/skills-install-codex.mjs";
import { readPackageInfo } from "./util/package-info.mjs";

/**
 * CUNEFLOW CLI 入口。
 * 首期使用轻量参数分发，后续命令复杂后再引入专门的 CLI 框架。
 */
async function main() {
  const args = process.argv.slice(2);
  const [command, subcommand] = args;

  if (isHelpCommand(command)) {
    printHelp();
    process.exit(0);
    return;
  }

  if (isVersionCommand(command)) {
    console.log(await readVersion());
    process.exit(0);
    return;
  }

  if (command === "doctor") {
    if (isHelpFlag(subcommand)) {
      printDoctorHelp();
      process.exit(0);
      return;
    }
    const report = await runDoctor(args.slice(1));
    process.exit(report.ok ? 0 : 1);
    return;
  }

  if (command === "setup") {
    if (isHelpFlag(subcommand)) {
      printSetupHelp();
      process.exit(0);
      return;
    }
    await runSetup(args.slice(1));
    process.exit(0);
    return;
  }

  if (command === "update") {
    if (isHelpFlag(subcommand)) {
      printUpdateHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(1), "cuneflow update");
    await runUpdate();
    process.exit(0);
    return;
  }

  if (command === "login") {
    if (isHelpFlag(subcommand)) {
      printLoginHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(1), "cuneflow login");
    await runLogin();
    process.exit(0);
    return;
  }

  if (command === "logout") {
    if (isHelpFlag(subcommand)) {
      printLogoutHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(1), "cuneflow logout");
    await runLogout();
    process.exit(0);
    return;
  }

  if (command === "auth" && isHelpFlag(subcommand)) {
    printAuthHelp();
    process.exit(0);
    return;
  }

  if (command === "auth" && subcommand === "status") {
    if (isHelpFlag(args[2])) {
      printAuthStatusHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(2), "cuneflow auth status");
    await runAuthStatus();
    process.exit(0);
    return;
  }

  if (command === "auth" && subcommand === "refresh") {
    if (isHelpFlag(args[2])) {
      printAuthRefreshHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(2), "cuneflow auth refresh");
    await runAuthRefresh();
    process.exit(0);
    return;
  }

  if (command === "mcp" && isHelpFlag(subcommand)) {
    printMcpHelp();
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "proxy") {
    if (isHelpFlag(args[2])) {
      printMcpProxyHelp();
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(2), "cuneflow mcp proxy");
    await runMcpProxy();
    return;
  }

  if (command === "mcp" && subcommand === "install" && isHelpFlag(args[2])) {
    printMcpInstallHelp();
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "install" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printMcpInstallCodexHelp();
      process.exit(0);
      return;
    }
    await runMcpInstallCodex(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "status" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printMcpStatusCodexHelp();
      process.exit(0);
      return;
    }
    await runMcpStatusCodex(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "uninstall" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printMcpUninstallCodexHelp();
      process.exit(0);
      return;
    }
    await runMcpUninstallCodex(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "install" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printMcpInstallClaudeHelp();
      process.exit(0);
      return;
    }
    await runMcpInstallClaude(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "status" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printMcpStatusClaudeHelp();
      process.exit(0);
      return;
    }
    await runMcpStatusClaude(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "mcp" && subcommand === "uninstall" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printMcpUninstallClaudeHelp();
      process.exit(0);
      return;
    }
    await runMcpUninstallClaude(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "skills" && (subcommand === undefined || isHelpFlag(subcommand))) {
    printSkillsHelp();
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "install" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printSkillsInstallHelp("claude");
      process.exit(0);
      return;
    }
    await runSkillsInstallClaude(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "status" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printSkillsStatusHelp("claude");
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(3), "cuneflow skills status claude");
    await runSkillsStatusClaude();
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "uninstall" && args[2] === "claude") {
    if (isHelpFlag(args[3])) {
      printSkillsUninstallHelp("claude");
      process.exit(0);
      return;
    }
    await runSkillsUninstallClaude(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "install" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printSkillsInstallHelp("codex");
      process.exit(0);
      return;
    }
    await runSkillsInstallCodex(args.slice(3));
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "status" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printSkillsStatusHelp("codex");
      process.exit(0);
      return;
    }
    assertNoArgs(args.slice(3), "cuneflow skills status codex");
    await runSkillsStatusCodex();
    process.exit(0);
    return;
  }

  if (command === "skills" && subcommand === "uninstall" && args[2] === "codex") {
    if (isHelpFlag(args[3])) {
      printSkillsUninstallHelp("codex");
      process.exit(0);
      return;
    }
    await runSkillsUninstallCodex(args.slice(3));
    process.exit(0);
    return;
  }

  console.error(`Unknown or incomplete command: ${args.join(" ")}`);
  printHelp();
  process.exit(1);
}

function printHelp() {
  console.log(`CUNEFLOW CLI

Usage:
  cuneflow <command>

Commands:
  setup                     One-command onboarding: login + configure detected AI clients
  update                    Update CUNEFLOW CLI to the latest npm version
  login                     Sign in to CUNEFLOW with OAuth and save tokens locally
  logout                    Remove locally stored CUNEFLOW OAuth tokens
  auth status               Show login status and token storage location
  auth refresh              Refresh the current OAuth access token
  doctor                    Diagnose CLI, OAuth, MCP, client config, and skills
  mcp proxy                 Run the local stdio-to-HTTP MCP proxy
  mcp install codex         Install CUNEFLOW MCP proxy configuration and Skill into Codex
  mcp status codex          Check CUNEFLOW MCP configuration in Codex
  mcp uninstall codex       Remove CUNEFLOW MCP configuration from Codex
  mcp install claude        Install CUNEFLOW MCP proxy configuration and Skill into Claude Code
  mcp status claude         Check CUNEFLOW MCP configuration in Claude Code
  mcp uninstall claude      Remove CUNEFLOW MCP configuration from Claude Code
  skills install claude     Install the CUNEFLOW skill into Claude Code
  skills install codex      Install the CUNEFLOW skill for Codex
  skills status claude|codex   Check the installed CUNEFLOW skill
  skills uninstall claude|codex Remove the CUNEFLOW skill

Common setup:
  cuneflow setup

Manual setup:
  cuneflow login
  cuneflow mcp install codex
  cuneflow mcp install claude
  cuneflow skills install codex
  cuneflow skills install claude

Options:
  -h, --help                Show help
  -v, --version             Show version

Run "cuneflow <command> --help" for command-specific help.
`);
}

function printLoginHelp() {
  console.log(`Sign in to CUNEFLOW

Usage:
  cuneflow login

What it does:
  Starts the OAuth login flow, opens the browser authorization page, waits for
  the local callback, and saves access/refresh tokens locally.

Notes:
  macOS uses Keychain by default. Other platforms fall back to a credentials file.
  Set CUNEFLOW_NO_BROWSER=1 if you want to copy the authorization URL manually.
`);
}

function printUpdateHelp() {
  console.log(`Update CUNEFLOW CLI

Usage:
  cuneflow update

What it does:
  Checks the latest npm version and updates the global @cuneflow/cli installation.
  If the installed version is already current, no installation is performed.
`);
}

function printLogoutHelp() {
  console.log(`Sign out from CUNEFLOW

Usage:
  cuneflow logout

What it does:
  Removes locally stored CUNEFLOW OAuth tokens from Keychain or the credentials file.
`);
}

function printAuthStatusHelp() {
  console.log(`Show CUNEFLOW login status

Usage:
  cuneflow auth status

What it does:
  Shows whether the CLI has stored credentials and which TokenStore is being used.
`);
}

function printDoctorHelp() {
  console.log(`Diagnose the CUNEFLOW CLI and MCP connection

Usage:
  cuneflow doctor [--json] [--client codex|claude|all]

What it checks:
  Node.js and CLI PATH, token storage and refresh, MCP initialize and tools/list,
  target client MCP configuration, and the installed CUNEFLOW Skill.

Options:
  --json                     Print a stable machine-readable report
  --client <client>          Check codex, claude, or all (default: all)

The doctor never calls business tools and never prints token values.
`);
}

function printAuthHelp() {
  console.log(`Manage CUNEFLOW OAuth credentials

Usage:
  cuneflow auth status
  cuneflow auth refresh

Commands:
  status                    Show login status and token storage location
  refresh                   Refresh the current OAuth access token
`);
}

function printAuthRefreshHelp() {
  console.log(`Refresh CUNEFLOW access token

Usage:
  cuneflow auth refresh

What it does:
  Uses the stored refresh token to obtain a new access token and updates local storage.
`);
}

function printMcpHelp() {
  console.log(`Use CUNEFLOW with MCP-compatible AI tools

Usage:
  cuneflow mcp proxy
  cuneflow mcp install codex [--dry-run] [--no-skill] [--config <path>]
  cuneflow mcp status codex [--config <path>]
  cuneflow mcp uninstall codex [--dry-run] [--config <path>]
  cuneflow mcp install claude [--dry-run] [--no-skill]
  cuneflow mcp status claude
  cuneflow mcp uninstall claude

Commands:
  proxy                     Run the local stdio-to-HTTP MCP proxy
  install codex             Install Codex configuration for the proxy
  status codex              Check whether Codex is configured for the proxy
  uninstall codex           Remove CUNEFLOW config from Codex
  install claude            Install Claude Code configuration for the proxy
  status claude             Check whether Claude Code is configured for the proxy
  uninstall claude          Remove CUNEFLOW config from Claude Code
`);
}

function printMcpInstallClaudeHelp() {
  console.log(`Install CUNEFLOW MCP configuration into Claude Code

Usage:
  cuneflow mcp install claude [--dry-run] [--no-skill]

What it does:
  Runs Claude Code's official MCP command and installs CUNEFLOW as a user-level
  stdio server named "cuneflow", then installs the CUNEFLOW Skill.

Options:
  --dry-run                  Print the Claude Code command without running it
  --no-skill                 Configure MCP without installing the CUNEFLOW Skill
`);
}

function printMcpStatusClaudeHelp() {
  console.log(`Check CUNEFLOW MCP configuration in Claude Code

Usage:
  cuneflow mcp status claude
`);
}

function printMcpUninstallClaudeHelp() {
  console.log(`Remove CUNEFLOW MCP configuration from Claude Code

Usage:
  cuneflow mcp uninstall claude
`);
}

function printMcpProxyHelp() {
  console.log(`Run CUNEFLOW MCP proxy

Usage:
  cuneflow mcp proxy

What it does:
  Uses the official MCP SDK to transparently relay requests, notifications,
  progress and cancellation between stdio and the remote CUNEFLOW MCP server.
  Remote requests automatically use the stored OAuth Bearer token.

Usually you do not run this manually. Codex starts it from its MCP config.
`);
}

function printMcpInstallHelp() {
  console.log(`Install CUNEFLOW MCP configuration

Usage:
  cuneflow mcp install codex [--dry-run] [--no-skill] [--config <path>]
  cuneflow mcp status codex [--config <path>]
  cuneflow mcp uninstall codex [--dry-run] [--config <path>]
  cuneflow mcp install claude [--dry-run] [--no-skill]
  cuneflow mcp status claude
  cuneflow mcp uninstall claude

Commands:
  codex                     Install configuration into Codex
  claude                    Install configuration into Claude Code
`);
}

function printMcpInstallCodexHelp() {
  console.log(`Install CUNEFLOW MCP configuration into Codex

Usage:
  cuneflow mcp install codex [--dry-run] [--no-skill] [--config <path>]

What it does:
  Adds or replaces the [mcp_servers.cuneflow] block in Codex config so Codex
  can start "cuneflow mcp proxy" automatically, then installs the CUNEFLOW Skill.

Options:
  --dry-run                  Print the resulting Codex config without writing it
  --no-skill                 Configure MCP without installing the CUNEFLOW Skill
  --config <path>            Use a custom Codex config path

Default config path:
  ~/.codex/config.toml

After installing:
  Restart Codex to reload MCP server configuration.
`);
}

function printMcpStatusCodexHelp() {
  console.log(`Check CUNEFLOW MCP configuration in Codex

Usage:
  cuneflow mcp status codex [--config <path>]

What it does:
  Reads Codex config and checks whether [mcp_servers.cuneflow] is installed
  and points to "cuneflow mcp proxy".

Options:
  --config <path>            Use a custom Codex config path
`);
}

function printMcpUninstallCodexHelp() {
  console.log(`Remove CUNEFLOW MCP configuration from Codex

Usage:
  cuneflow mcp uninstall codex [--dry-run] [--config <path>]

What it does:
  Removes [mcp_servers.cuneflow] from Codex config. The original config is
  backed up before writing.

Options:
  --dry-run                  Print the resulting Codex config without writing it
  --config <path>            Use a custom Codex config path
`);
}

function printSetupHelp() {
  console.log(`One-command CUNEFLOW onboarding

Usage:
  cuneflow setup [--dry-run]

What it does:
  1. Logs you in if needed (opens the browser authorization page)
  2. Detects installed AI clients (Codex, Claude Code)
  3. Installs MCP configuration and the CUNEFLOW skill for each detected client

Safe to run repeatedly. Use --dry-run to preview without changing anything.
`);
}

function printSkillsHelp() {
  console.log(`Manage CUNEFLOW skills for AI tools

Usage:
  cuneflow skills install claude|codex [--dry-run]
  cuneflow skills status claude|codex
  cuneflow skills uninstall claude|codex [--dry-run]

Targets:
  claude                    ~/.claude/skills/{cuneflow,build-cune-screensavers}/
  codex                     ~/.agents/skills/{cuneflow,build-cune-screensavers}/
`);
}

function printSkillsInstallHelp(client) {
  console.log(`Install the CUNEFLOW skill for ${client}

Usage:
  cuneflow skills install ${client} [--dry-run]
`);
}

function printSkillsStatusHelp(client) {
  console.log(`Check the installed CUNEFLOW skill for ${client}

Usage:
  cuneflow skills status ${client}
`);
}

function printSkillsUninstallHelp(client) {
  console.log(`Remove the CUNEFLOW skill for ${client}

Usage:
  cuneflow skills uninstall ${client} [--dry-run]
`);
}

function isHelpCommand(value) {
  return value === undefined || value === "-h" || value === "--help" || value === "help";
}

function isHelpFlag(value) {
  return value === "-h" || value === "--help" || value === "help";
}

function isVersionCommand(value) {
  return value === "-v" || value === "--version" || value === "version";
}

function assertNoArgs(args, usage) {
  if (args.length > 0) {
    throw new Error(`Unexpected argument: ${args[0]}. Usage: ${usage}`);
  }
}

async function readVersion() {
  return (await readPackageInfo()).version;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
