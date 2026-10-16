import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SERVICE = "cuneflow-cli";

/**
 * macOS Keychain token 存储。
 * 通过系统 security 命令读写，失败时由 factory 决定是否 fallback 到文件存储。
 */
export class KeychainTokenStore {
  constructor(config) {
    this.config = config;
    this.account = `${new URL(config.baseUrl).host}:${config.clientId}`;
  }

  name() {
    return "macOS Keychain";
  }

  async isAvailable() {
    if (process.platform !== "darwin") {
      return false;
    }
    try {
      await execFileAsync("security", ["list-keychains"]);
      return true;
    } catch {
      return false;
    }
  }

  async load() {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-a", this.account,
        "-s", SERVICE,
        "-w"
      ]);
      return JSON.parse(stdout.trim());
    } catch (error) {
      if (error.code === 44 || String(error.stderr || "").includes("could not be found")) {
        return null;
      }
      throw error;
    }
  }

  async save(record) {
    await execFileAsync("security", [
      "add-generic-password",
      "-a", this.account,
      "-s", SERVICE,
      "-w", JSON.stringify(record),
      "-U"
    ]);
  }

  async clear() {
    try {
      await execFileAsync("security", [
        "delete-generic-password",
        "-a", this.account,
        "-s", SERVICE
      ]);
    } catch (error) {
      if (error.code === 44 || String(error.stderr || "").includes("could not be found")) {
        return;
      }
      throw error;
    }
  }
}
