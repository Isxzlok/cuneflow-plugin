import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAMES = ["cuneflow", "build-cune-screensavers"];

export async function runSkillsInstallCodex(args = []) {
  const options = parseOptions(args);
  if (options.dryRun) {
    for (const skillName of SKILL_NAMES) {
      console.log(`Would install skill "${skillName}":`);
      console.log(`  from: ${bundledSkillDir(skillName)}`);
      console.log(`  to:   ${agentsSkillDir(skillName)}`);
    }
    return;
  }
  for (const skillName of SKILL_NAMES) {
    const targetDir = agentsSkillDir(skillName);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(bundledSkillDir(skillName), targetDir, { recursive: true });
    console.log(`skill: ${path.join(targetDir, "SKILL.md")}`);
  }
  console.log("CUNEFLOW skills installed for Codex (open agent-skills directory).");
  console.log("New Codex sessions will pick it up automatically.");
}

export async function runSkillsStatusCodex() {
  let allInstalled = true;
  for (const skillName of SKILL_NAMES) {
    const targetPath = path.join(agentsSkillDir(skillName), "SKILL.md");
    const installed = await readIfExists(targetPath);
    const bundled = await readIfExists(path.join(bundledSkillDir(skillName), "SKILL.md"));
    console.log(`Skill path: ${targetPath}`);
    console.log(`Status: ${installed == null ? "not installed" : bundled != null && installed === bundled ? "installed (up to date)" : "installed (differs from bundled version)"}`);
    allInstalled &&= installed != null;
  }
  if (!allInstalled) console.log("Next step: run `cuneflow skills install codex`.");
}

export async function runSkillsUninstallCodex(args = []) {
  const options = parseOptions(args);
  if (options.dryRun) {
    for (const skillName of SKILL_NAMES) console.log(`Would remove: ${agentsSkillDir(skillName)}`);
    return;
  }
  let removed = false;
  for (const skillName of SKILL_NAMES) {
    const targetDir = agentsSkillDir(skillName);
    if (await readIfExists(path.join(targetDir, "SKILL.md")) != null) {
      await fs.rm(targetDir, { recursive: true, force: true });
      removed = true;
    }
  }
  console.log(removed ? "CUNEFLOW skills removed." : "CUNEFLOW skills are not installed for Codex.");
}

function bundledSkillDir(skillName) { return path.join(packageRoot(), "skills", skillName); }
function packageRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); }
function agentsSkillDir(skillName) {
  const base = process.env.CUNEFLOW_AGENTS_SKILLS_DIR ? expandHome(process.env.CUNEFLOW_AGENTS_SKILLS_DIR) : path.join(os.homedir(), ".agents", "skills");
  return path.join(base, skillName);
}
function expandHome(filePath) { return filePath === "~" ? os.homedir() : filePath.startsWith("~/") ? path.join(os.homedir(), filePath.slice(2)) : filePath; }
async function readIfExists(filePath) { try { return await fs.readFile(filePath, "utf8"); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
function parseOptions(args) { const options = { dryRun: false }; for (const arg of args) { if (arg === "--dry-run") options.dryRun = true; else throw new Error(`Unknown option: ${arg}`); } return options; }
