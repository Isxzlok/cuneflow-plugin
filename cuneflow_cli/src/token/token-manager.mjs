import { OAuthClient } from "../oauth/oauth-client.mjs";
import { buildTokenRecord } from "./token-record.mjs";

/**
 * token 生命周期管理器。
 * 命令和 MCP proxy 通过它获取可用 access token，避免重复写 refresh 判断。
 */
export class TokenManager {
  constructor({ config, store }) {
    this.config = config;
    this.store = store;
    this.oauthClient = new OAuthClient(config);
    this.refreshPromise = null;
  }

  async getValidAccessToken() {
    const record = await this.store.load();
    if (!record) {
      throw new Error("Not logged in. Run `cuneflow login` before using CUNEFLOW MCP.");
    }
    if (!this.shouldRefresh(record)) {
      return record.accessToken;
    }
    const refreshed = await this.refresh(record);
    return refreshed.accessToken;
  }

  /**
   * 忽略 access token 当前过期时间，强制使用 refresh token 轮换。
   * MCP 上游返回 401 时调用该方法重试一次，避免旧 token 刚被撤销或刚过期。
   */
  async forceRefreshAccessToken() {
    const record = await this.store.load();
    if (!record) {
      throw new Error("Not logged in. Run `cuneflow login` before using CUNEFLOW MCP.");
    }
    const refreshed = await this.refresh(record);
    return refreshed.accessToken;
  }

  async refresh(record) {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh(record).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async doRefresh(record) {
    let token;
    try {
      token = await this.oauthClient.refresh(record.refreshToken);
    } catch (error) {
      throw new Error(`Could not refresh CUNEFLOW token. Run \`cuneflow login\` again. (${error.message})`);
    }
    const refreshedRecord = buildTokenRecord({
      config: this.config,
      deviceId: record.deviceId,
      token,
      previousRecord: record
    });
    await this.store.save(refreshedRecord);
    return refreshedRecord;
  }

  shouldRefresh(record) {
    const expiresAt = new Date(record.accessExpiresAt).getTime();
    const skewMs = this.config.refreshSkewSeconds * 1000;
    return Number.isNaN(expiresAt) || expiresAt - Date.now() <= skewMs;
  }
}
