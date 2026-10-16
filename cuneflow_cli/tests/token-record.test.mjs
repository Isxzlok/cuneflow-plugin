import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTokenRecord } from "../src/token/token-record.mjs";

const config = { baseUrl: "https://api.example.com", clientId: "cuneflow-cli", resource: "https://mcp.example.com/mcp" };
const token = { access_token: "access-1", expires_in: 3600, refresh_token: "refresh-1", refresh_expires_in: 86400 };
const now = new Date("2026-01-01T00:00:00.000Z");

test("buildTokenRecord 计算过期时间并保存字段", () => {
  const record = buildTokenRecord({ config, deviceId: "cli-1", token, now });
  assert.equal(record.accessToken, "access-1");
  assert.equal(record.refreshToken, "refresh-1");
  assert.equal(record.accessExpiresAt, "2026-01-01T01:00:00.000Z");
  assert.equal(record.refreshExpiresAt, "2026-01-02T00:00:00.000Z");
  assert.equal(record.baseUrl, config.baseUrl);
  assert.equal(record.clientId, config.clientId);
  assert.equal(record.deviceId, "cli-1");
});

test("token 未带 scope/resource 时不由 CLI 伪造权限", () => {
  const record = buildTokenRecord({ config, deviceId: "cli-1", token, now });
  assert.equal(record.scope, "");
  assert.equal(record.resource, config.resource);
});

test("token 自带 scope/resource 时优先使用", () => {
  const record = buildTokenRecord({ config, deviceId: "cli-1", token: { ...token, scope: "a:read", resource: "https://other/mcp" }, now });
  assert.equal(record.scope, "a:read");
  assert.equal(record.resource, "https://other/mcp");
});

test("refresh 轮换时保留首次 createdAt", () => {
  const record = buildTokenRecord({ config, deviceId: "cli-1", token, now, previousRecord: { createdAt: "2025-12-01T00:00:00.000Z" } });
  assert.equal(record.createdAt, "2025-12-01T00:00:00.000Z");
  assert.equal(record.updatedAt, now.toISOString());
});

test("刷新响应省略 refresh token 时保留原值和原过期时间", () => {
  const record = buildTokenRecord({
    config,
    deviceId: "cli-1",
    token: { access_token: "access-2", expires_in: 3600 },
    now,
    previousRecord: {
      refreshToken: "refresh-1",
      refreshExpiresAt: "2026-02-01T00:00:00.000Z"
    }
  });

  assert.equal(record.refreshToken, "refresh-1");
  assert.equal(record.refreshExpiresAt, "2026-02-01T00:00:00.000Z");
});
