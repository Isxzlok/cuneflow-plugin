import crypto from "node:crypto";
import { OAuthClient } from "../oauth/oauth-client.mjs";
import { waitForAuthorizationCode } from "../oauth/callback-server.mjs";
import { createPkcePair } from "../oauth/pkce.mjs";
import { buildTokenRecord } from "../token/token-record.mjs";
import { createTokenStore } from "../token/token-store-factory.mjs";
import { openBrowser } from "../util/browser.mjs";
import { loadConfig } from "../util/config.mjs";
import { maskToken } from "../util/mask.mjs";

/**
 * 执行 OAuth 登录并保存 token。
 */
export async function runLogin() {
  const config = loadConfig();
  const store = await createTokenStore(config);
  const oauthClient = new OAuthClient(config);
  const abortController = new AbortController();
  const interruptHandler = () => abortController.abort();

  const state = crypto.randomUUID();
  const deviceId = `cli-${crypto.randomUUID()}`;
  const { verifier, challenge } = createPkcePair();
  const redirectUri = `http://${config.callbackHost}:${config.callbackPort}/oauth/callback`;
  const authorizeUrl = oauthClient.buildAuthorizeUrl({
    state,
    codeChallenge: challenge,
    redirectUri,
    deviceId
  });

  if (!config.noBrowser) {
    const browserResult = await openBrowser(authorizeUrl);
    if (browserResult.opened) {
      console.log("Opened CUNEFLOW authorization URL in your default browser.");
    } else {
      console.warn(`Could not open browser automatically: ${browserResult.error.message}`);
    }
  }

  console.log("Authorization URL:");
  console.log(authorizeUrl);
  console.log("If the browser asks you to sign in, complete sign-in and approve CUNEFLOW access.");
  console.log(`Waiting for browser authorization for up to ${config.loginTimeoutSeconds} seconds.`);
  console.log("");

  process.once("SIGINT", interruptHandler);
  process.once("SIGTERM", interruptHandler);
  process.once("SIGBREAK", interruptHandler);
  if (process.platform !== "win32") {
    process.once("SIGTSTP", interruptHandler);
  }
  let code;
  try {
    code = await waitForAuthorizationCode({
      redirectUri,
      host: config.callbackHost,
      port: config.callbackPort,
      expectedState: state,
      timeoutSeconds: config.loginTimeoutSeconds,
      signal: abortController.signal
    });
  } finally {
    process.removeListener("SIGINT", interruptHandler);
    process.removeListener("SIGTERM", interruptHandler);
    process.removeListener("SIGBREAK", interruptHandler);
    if (process.platform !== "win32") {
      process.removeListener("SIGTSTP", interruptHandler);
    }
  }
  const token = await oauthClient.exchangeCode({ code, codeVerifier: verifier, redirectUri });
  const record = buildTokenRecord({ config, deviceId, token });
  await store.save(record);

  console.log("CUNEFLOW login succeeded.");
  console.log(`storage: ${store.name()}`);
  console.log(`access_token: ${maskToken(record.accessToken)}`);
  console.log(`refresh_token: ${maskToken(record.refreshToken)}`);
  console.log(`scope: ${record.scope}`);
  console.log(`resource: ${record.resource}`);
}
