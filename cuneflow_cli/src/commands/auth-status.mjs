import { OAuthClient } from "../oauth/oauth-client.mjs";
import { createTokenStore } from "../token/token-store-factory.mjs";
import { loadConfig } from "../util/config.mjs";
import { formatDuration, maskToken } from "../util/mask.mjs";

/**
 * 展示本地登录状态，所有 token 只做脱敏输出。
 */
export async function runAuthStatus() {
  const config = loadConfig();
  const store = await createTokenStore(config);
  const record = await store.load();
  if (!record) {
    console.log("Logged in: no");
    console.log(`Storage: ${store.name()}`);
    return;
  }

  const expiresInMs = new Date(record.accessExpiresAt).getTime() - Date.now();
  console.log("Logged in: yes");
  console.log(`Client: ${record.clientId}`);
  console.log(`Resource: ${record.resource}`);
  console.log(`Scopes: ${record.scope}`);
  console.log(`Access token: ${maskToken(record.accessToken)}`);
  console.log(`Access token expires in: ${formatDuration(expiresInMs)}`);
  console.log(`Refresh token expires at: ${record.refreshExpiresAt}`);
  console.log(`Storage: ${store.name()}`);

  const oauthClient = new OAuthClient(config);
  const introspect = await oauthClient.introspect(record.accessToken);
  console.log(`Introspect active: ${introspect.active}`);
  if (!introspect.active) {
    console.log(`Introspect error: ${introspect.errorCode || introspect.error_code || ""}`);
  }
}
