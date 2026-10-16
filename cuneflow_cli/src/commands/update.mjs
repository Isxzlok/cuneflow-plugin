import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { readPackageInfo } from "../util/package-info.mjs";

const execFileAsync = promisify(execFile);

/**
 * 将当前全局安装的 CUNEFLOW CLI 升级到 npm latest 版本。
 */
export async function runUpdate({
  packageInfo,
  lookupLatestVersion = defaultLookupLatestVersion,
  installLatestVersion = defaultInstallLatestVersion
} = {}) {
  const { name, version: currentVersion } = packageInfo ?? await readPackageInfo();

  console.log(`Checking for updates to ${name}...`);

  let latestVersion;
  try {
    latestVersion = await lookupLatestVersion(name);
  } catch (error) {
    throw new Error(`Unable to check the latest version from npm: ${formatCommandError(error)}`);
  }

  if (!latestVersion) {
    throw new Error("npm returned an empty latest version.");
  }

  if (compareVersions(currentVersion, latestVersion) >= 0) {
    console.log(`CUNEFLOW CLI is already up to date (${currentVersion}).`);
    return { updated: false, currentVersion, latestVersion };
  }

  console.log(`Updating CUNEFLOW CLI from ${currentVersion} to ${latestVersion}...`);

  try {
    await installLatestVersion(name);
  } catch (error) {
    const hint = isPermissionError(error)
      ? " Check your npm global install permissions; avoid using sudo unless your Node.js installation requires it."
      : "";
    throw new Error(`Unable to update CUNEFLOW CLI: ${formatCommandError(error)}${hint}`);
  }

  console.log(`CUNEFLOW CLI updated successfully: ${currentVersion} -> ${latestVersion}`);
  console.log("Run `cuneflow --version` in a new terminal to verify the installed version.");
  return { updated: true, currentVersion, latestVersion };
}

async function defaultLookupLatestVersion(packageName) {
  const { stdout } = await execFileAsync(npmCommand(), ["view", `${packageName}@latest`, "version", "--json"], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true
  });

  const value = JSON.parse(stdout);
  return String(Array.isArray(value) ? value.at(-1) : value).trim();
}

function defaultInstallLatestVersion(packageName) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), ["install", "--global", `${packageName}@latest`], {
      stdio: "inherit",
      windowsHide: true
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const error = new Error(signal ? `npm was terminated by ${signal}` : `npm exited with code ${code}`);
      error.code = code;
      reject(error);
    });
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }

  if (leftParts.prerelease === rightParts.prerelease) return 0;
  if (!leftParts.prerelease) return 1;
  if (!rightParts.prerelease) return -1;
  return leftParts.prerelease.localeCompare(rightParts.prerelease, undefined, { numeric: true });
}

function parseVersion(version) {
  const match = String(version).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?/);
  if (!match) {
    throw new Error(`Invalid version returned while checking updates: ${version}`);
  }
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  parts.prerelease = match[4] ?? "";
  return parts;
}

function isPermissionError(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.stderr ?? ""}`;
  return /EACCES|EPERM|permission denied/i.test(text);
}

function formatCommandError(error) {
  const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
  return stderr || error?.message || String(error);
}
