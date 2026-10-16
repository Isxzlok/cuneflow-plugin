import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tokenRecordKey } from "../util/config.mjs";

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

/**
 * 文件 token 存储。
 * 作为 Keychain 不可用时的兜底，目录权限 0700，文件权限 0600。
 */
export class FileTokenStore {
  constructor(config) {
    this.config = config;
    this.filePath = config.credentialsFile;
  }

  name() {
    return `file:${this.filePath}`;
  }

  async load() {
    const data = await this.readFile();
    return data.records[tokenRecordKey(this.config)] || null;
  }

  async save(record) {
    await this.withFileLock(async () => {
      // 获取跨进程锁后重新读取，避免使用加锁前的旧快照覆盖其他客户端记录。
      const data = await this.readFile();
      data.records[tokenRecordKey(this.config)] = record;
      await this.writeFile(data);
    });
  }

  async clear() {
    await this.withFileLock(async () => {
      const data = await this.readFile();
      delete data.records[tokenRecordKey(this.config)];
      await this.writeFile(data);
    });
  }

  async readFile() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version || 1,
        records: parsed.records || {}
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return { version: 1, records: {} };
      }
      throw error;
    }
  }

  async writeFile(data) {
    await this.ensureDirectory();
    // 每次写入使用独立临时文件，避免多个进程争用固定 credentials.json.tmp。
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      await fs.chmod(tmpPath, 0o600).catch(() => {});
      await fs.rename(tmpPath, this.filePath);
      await fs.chmod(this.filePath, 0o600).catch(() => {});
    } finally {
      await fs.unlink(tmpPath).catch((error) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      });
    }
  }

  /**
   * 对凭证文件的 read-modify-write 加跨进程锁，防止 Codex、Claude 等多个代理互相覆盖。
   * Refresh Token 仍由服务端允许重复使用；这里的锁只保护本地文件完整性。
   */
  async withFileLock(operation) {
    await this.ensureDirectory();
    const lockPath = `${this.filePath}.lock`;
    const ownerId = `${process.pid}:${randomUUID()}`;
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    let lockHandle;

    while (!lockHandle) {
      try {
        const candidateHandle = await fs.open(lockPath, "wx", 0o600);
        try {
          await candidateHandle.writeFile(ownerId, "utf8");
          lockHandle = candidateHandle;
        } catch (error) {
          await candidateHandle.close().catch(() => {});
          await fs.unlink(lockPath).catch(() => {});
          throw error;
        }
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw error;
        }
        await this.removeStaleLock(lockPath);
        if (Date.now() >= deadline) {
          throw new Error(`Timed out waiting for CUNEFLOW credentials lock: ${lockPath}`);
        }
        await delay(LOCK_RETRY_MS);
      }
    }

    try {
      return await operation();
    } finally {
      await lockHandle.close().catch(() => {});
      // 锁超时接管后，旧持有者不能误删新进程创建的锁文件。
      const currentOwner = await fs.readFile(lockPath, "utf8").catch(() => null);
      if (currentOwner === ownerId) {
        await fs.unlink(lockPath).catch(() => {});
      }
    }
  }

  /**
   * 清理异常退出遗留的锁。正常凭证写入耗时很短，超过阈值可视为持有进程已失效。
   */
  async removeStaleLock(lockPath) {
    try {
      const stat = await fs.stat(lockPath);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        await fs.unlink(lockPath).catch(() => {});
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * 创建仅当前用户可访问的凭证目录。
   */
  async ensureDirectory() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.chmod(dir, 0o700).catch(() => {});
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
