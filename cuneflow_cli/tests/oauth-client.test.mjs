import assert from "node:assert/strict";
import { test } from "node:test";
import { OAuthClient, OAuthRequestError } from "../src/oauth/oauth-client.mjs";

test("OAuthClient 保留非 JSON 错误响应的 HTTP 分类", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("gateway error", {
    status: 502,
    statusText: "Bad Gateway",
    headers: { "X-Request-Id": "request-502" }
  });
  try {
    const client = new OAuthClient(config());
    await assert.rejects(client.refresh("refresh-token"), (error) => {
      assert.ok(error instanceof OAuthRequestError);
      assert.equal(error.status, 502);
      assert.equal(error.code, "http_502");
      assert.equal(error.requestId, "request-502");
      assert.equal(error.retryable, true);
      return true;
    });
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("OAuthClient 超时后主动终止请求", async () => {
  const savedFetch = globalThis.fetch;
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  try {
    const client = new OAuthClient(config(10));
    await assert.rejects(client.introspect("access-token"), (error) => {
      assert.ok(error instanceof OAuthRequestError);
      assert.equal(error.code, "request_timeout");
      assert.equal(error.retryable, true);
      return true;
    });
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("OAuthClient 错误信息会清理敏感串和非法请求Id", async () => {
  const savedFetch = globalThis.fetch;
  const secret = "x".repeat(80);
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "temporarily_unavailable",
    error_description: `Bearer ${secret}`,
    request_id: "invalid\nrequest-id"
  }), { status: 503, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(new OAuthClient(config()).refresh("refresh-token"), (error) => {
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.match(error.message, /\[redacted]/);
      assert.equal(error.requestId, null);
      return true;
    });
  } finally {
    globalThis.fetch = savedFetch;
  }
});

function config(oauthRequestTimeoutMs = 1_000) {
  return {
    baseUrl: "https://api.cuneflow.com",
    clientId: "cuneflow-cli",
    resource: "https://mcp.cuneflow.com/mcp",
    oauthRequestTimeoutMs
  };
}
