import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAMES = ["cuneflow", "build-cune-screensavers"];

export async function runSkillsInstallClaude(args = []) {
  const options = parseOptions(args);
  if (options.dryRun) {
    for (const skillName of SKILL_NAMES) {
      console.log(`Would install skill "${skillName}":`);
      console.log(`  from: ${bundledSkillDir(skillName)}`);
      console.log(`  to:   ${claudeSkillDir(skillName)}`);
    }
    return;
  }
  for (const skillName of SKILL_NAMES) {
    const targetDir = claudeSkillDir(skillName);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(bundledSkillDir(skillName), targetDir, { recursive: true });
    console.log(`skill: ${path.join(targetDir, "SKILL.md")}`);
  }
  console.log("CUNEFLOW skills installed for Claude Code.");
  console.log("New Claude Code sessions will pick it up automatically.");
}

export async function runSkillsStatusClaude() {
  let allInstalled = true;
  for (const skillName of SKILL_NAMES) {
    const targetPath = path.join(claudeSkillDir(skillName), "SKILL.md");
    const installed = await readIfExists(targetPath);
    const bundled = await readIfExists(path.join(bundledSkillDir(skillName), "SKILL.md"));
    console.log(`Skill path: ${targetPath}`);
    console.log(`Status: ${installed == null ? "not installed" : bundled != null && installed === bundled ? "installed (up to date)" : "installed (differs from bundled version)"}`);
    allInstalled &&= installed != null;
  }
  if (!allInstalled) console.log("Next step: run `cuneflow skills install claude`.");
}

export async function runSkillsUninstallClaude(args = []) {
  const options = parseOptions(args);
  if (options.dryRun) {
    for (const skillName of SKILL_NAMES) console.log(`Would remove: ${claudeSkillDir(skillName)}`);
    return;
  }
  let removed = false;
  for (const skillName of SKILL_NAMES) {
    const targetDir = claudeSkillDir(skillName);
    if (await readIfExists(path.join(targetDir, "SKILL.md")) != null) {
      await fs.rm(targetDir, { recursive: true, force: true });
      removed = true;
    }
  }
  console.log(removed ? "CUNEFLOW skills removed from Claude Code." : "CUNEFLOW skills are not installed for Claude Code.");
}

function bundledSkillDir(skillName) { return path.join(packageRoot(), "skills", skillName); }
function packageRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); }
function claudeSkillDir(skillName) {
  const base = process.env.CUNEFLOW_CLAUDE_SKILLS_DIR ? expandHome(process.env.CUNEFLOW_CLAUDE_SKILLS_DIR) : path.join(os.homedir(), ".claude", "skills");
  return path.join(base, skillName);
}
function expandHome(filePath) { return filePath === "~" ? os.homedir() : filePath.startsWith("~/") ? path.join(os.homedir(), filePath.slice(2)) : filePath; }
async function readIfExists(filePath) { try { return await fs.readFile(filePath, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
function parseOptions(args) { const options = { dryRun: false }; for (const arg of args) { if (arg === "--dry-run") options.dryRun = true; else throw new Error(`Unknown option: ${arg}`); } return options; }
