/**
 * OAuth Server HTTP 客户端。
 * 只负责协议请求和兼容旧版 Result / 标准 OAuth 响应，不负责 token 存储。
 */
export class OAuthClient {
  constructor(config) {
    this.config = config;
  }

  buildAuthorizeUrl({ state, codeChallenge, redirectUri, deviceId }) {
    const authorizeUrl = new URL("/oauth/authorize", this.config.baseUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", this.config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("resource", this.config.resource);
    authorizeUrl.searchParams.set("device_id", deviceId);
    return authorizeUrl.toString();
  }

  async exchangeCode({ code, codeVerifier, redirectUri }) {
    const tokenUrl = new URL("/oauth/token", this.config.baseUrl);
    const body = new URLSearchParams();
    body.set("grantType", "authorization_code");
    body.set("code", code);
    body.set("clientId", this.config.clientId);
    body.set("redirectUri", redirectUri);
    body.set("codeVerifier", codeVerifier);
    return this.postForm(tokenUrl, body, "token exchange");
  }

  async refresh(refreshToken) {
    const refreshUrl = new URL("/oauth/refresh", this.config.baseUrl);
    const body = new URLSearchParams();
    body.set("grantType", "refresh_token");
    body.set("refreshToken", refreshToken);
    body.set("clientId", this.config.clientId);
    return this.postForm(refreshUrl, body, "refresh");
  }

  async revoke(refreshToken) {
    const revokeUrl = new URL("/oauth/revoke", this.config.baseUrl);
    const body = new URLSearchParams();
    body.set("token", refreshToken);
    body.set("tokenTypeHint", "refresh_token");
    body.set("clientId", this.config.clientId);
    return this.postForm(revokeUrl, body, "revoke");
  }

  async introspect(accessToken) {
    const introspectUrl = new URL("/oauth/introspect", this.config.baseUrl);
    return fetchResultWithTimeout(introspectUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    }, this.config.oauthRequestTimeoutMs, "introspect");
  }

  async postForm(url, body, actionName) {
    return fetchResultWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }, this.config.oauthRequestTimeoutMs, actionName);
  }
}

async function readResultResponse(response, actionName) {
  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw OAuthRequestError.fromResponse(actionName, response, null);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw OAuthRequestError.fromResponse(actionName, response, null);
  }
  // token endpoint 遵循 OAuth 标准直接返回 access_token；旧接口仍返回 Result.data。
  if (response.ok && payload.code === undefined) {
    return payload;
  }
  if (!response.ok || payload.code !== 200) {
    throw OAuthRequestError.fromResponse(actionName, response, payload);
  }
  return payload.data;
}

/** 带超时执行 OAuth HTTP 请求，超时后主动终止底层连接。 */
async function fetchResultWithTimeout(url, init, timeoutMs, actionName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("request timeout")), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await readResultResponse(response, actionName);
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw OAuthRequestError.timeout(actionName, timeoutMs, error);
    }
    throw OAuthRequestError.network(actionName, error);
  } finally {
    clearTimeout(timeout);
  }
}

/** 包含稳定分类信息的 OAuth 请求异常。 */
export class OAuthRequestError extends Error {
  constructor(message, { code, status = null, requestId = null, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = "OAuthRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
  }

  static timeout(actionName, timeoutMs, cause) {
    return new OAuthRequestError(
      `${actionName} timed out after ${timeoutMs}ms. Check your network and try again.`,
      { code: "request_timeout", retryable: true, cause }
    );
  }

  static network(actionName, cause) {
    return new OAuthRequestError(
      `${actionName} could not reach the CUNEFLOW OAuth service. Check your network and try again.`,
      { code: "network_error", retryable: true, cause }
    );
  }

  static fromResponse(actionName, response, payload) {
    const status = response.status;
    const rawCode = payload?.error || (payload?.code && payload.code !== 200 ? String(payload.code) : `http_${status}`);
    const code = normalizeDiagnosticValue(rawCode, 64) || `http_${status}`;
    const requestId = normalizeDiagnosticValue(payload?.request_id || response.headers.get("x-request-id"), 128);
    const retryable = status === 429 || [502, 503, 504].includes(status);
    const detail = safeErrorDetail(payload?.error_description || payload?.msg || response.statusText || "invalid response");
    const action = nextAction(status);
    const diagnostic = [
      `code=${code}`,
      `status=${status}`,
      `retryable=${retryable}`,
      requestId ? `request_id=${requestId}` : null
    ].filter(Boolean).join(", ");
    return new OAuthRequestError(`${actionName} failed: ${detail}. ${action} (${diagnostic})`, {
      code, status, requestId, retryable
    });
  }
}

function normalizeDiagnosticValue(value, maxLength) {
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return text.length <= maxLength && /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

function safeErrorDetail(value) {
  return String(value)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{64,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function nextAction(status) {
  if (status === 400) return "Check the request configuration and try again.";
  if (status === 401) return "Run `cuneflow login` again.";
  if (status === 403) return "Confirm that this OAuth client is allowed to perform the request.";
  if (status === 404) return "Check the configured CUNEFLOW OAuth service URL.";
  if (status === 409) return "Refresh the current state before trying again.";
  if (status === 429 || status >= 500) return "Wait briefly and try again.";
  return "Check the service URL and try again.";
}
