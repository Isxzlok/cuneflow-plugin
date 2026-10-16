import crypto from "node:crypto";

/**
 * 生成 OAuth PKCE verifier/challenge。
 * verifier 只保留在当前进程内存，换取 token 前不落盘。
 */
export function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier, "ascii").digest());
  return { verifier, challenge };
}

export function base64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
