import { createTokenStore } from "../token/token-store-factory.mjs";
import { TokenManager } from "../token/token-manager.mjs";
import { loadConfig } from "../util/config.mjs";
import { maskToken } from "../util/mask.mjs";

/**
 * 手动触发 refresh token 轮换。
 * 用于验证自动 refresh 前的核心链路：远端刷新成功后，本地 TokenStore 必须覆盖为新 token。
 */
export async function runAuthRefresh() {
  const config = loadConfig();
  const store = await createTokenStore(config);
  const record = await store.load();
  if (!record) {
    throw new Error("not_logged_in: please run `cuneflow login` first");
  }

  const tokenManager = new TokenManager({ config, store });
  const refreshedRecord = await tokenManager.refresh(record);

  console.log("CUNEFLOW token refresh succeeded.");
  console.log(`storage: ${store.name()}`);
  console.log(`old_access_token: ${maskToken(record.accessToken)}`);
  console.log(`new_access_token: ${maskToken(refreshedRecord.accessToken)}`);
  console.log(`old_refresh_token: ${maskToken(record.refreshToken)}`);
  console.log(`new_refresh_token: ${maskToken(refreshedRecord.refreshToken)}`);
  console.log(`access_expires_at: ${refreshedRecord.accessExpiresAt}`);
  console.log(`refresh_expires_at: ${refreshedRecord.refreshExpiresAt}`);
}
