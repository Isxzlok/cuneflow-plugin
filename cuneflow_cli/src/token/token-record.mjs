/**
 * 将 OAuth token 响应转换为本地 TokenRecord。
 * access token / refresh token 明文只进入 TokenStore，不在命令输出中展示。
 */
export function buildTokenRecord({ config, deviceId, token, now = new Date(), previousRecord = null }) {
  const nowIso = now.toISOString();
  return {
    baseUrl: config.baseUrl,
    clientId: config.clientId,
    resource: token.resource || config.resource,
    // 权限以 OAuth 服务端返回的实际 scope 为准，CLI 不再使用本地默认值兜底。
    scope: token.scope || "",
    deviceId,
    accessToken: token.access_token,
    accessExpiresAt: addSeconds(now, token.expires_in).toISOString(),
    // 当前服务端复用 refresh token；兼容刷新响应省略该字段，避免把仍有效的本地 token 覆盖为空。
    refreshToken: token.refresh_token || previousRecord?.refreshToken,
    refreshExpiresAt: token.refresh_expires_in == null && previousRecord?.refreshExpiresAt
      ? previousRecord.refreshExpiresAt
      : addSeconds(now, token.refresh_expires_in).toISOString(),
    createdAt: previousRecord?.createdAt || nowIso,
    updatedAt: nowIso
  };
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + Number(seconds || 0) * 1000);
}
