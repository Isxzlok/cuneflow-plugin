import { OAuthClient } from "../oauth/oauth-client.mjs";
import { createTokenStore } from "../token/token-store-factory.mjs";
import { loadConfig } from "../util/config.mjs";

/**
 * 撤销远端 refresh token，并清理本地 token。
 */
export async function runLogout() {
  const config = loadConfig();
  const store = await createTokenStore(config);
  const record = await store.load();
  if (!record) {
    console.log("Already logged out.");
    return;
  }

  const oauthClient = new OAuthClient(config);
  try {
    await oauthClient.revoke(record.refreshToken);
    console.log("Remote OAuth authorization revoked.");
  } catch (error) {
    console.warn(`Remote revoke failed: ${error.message}`);
    console.warn("Local token will still be cleared.");
  }

  await store.clear();
  console.log("Local CUNEFLOW token cleared.");
}
