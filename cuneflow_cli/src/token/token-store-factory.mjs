import { FileTokenStore } from "./file-token-store.mjs";
import { KeychainTokenStore } from "./keychain-token-store.mjs";

/**
 * 根据配置选择 TokenStore。
 * auto 模式下 macOS 优先 Keychain，不可用时 fallback 到文件存储。
 */
export async function createTokenStore(config) {
  if (config.tokenStore === "file") {
    return new FileTokenStore(config);
  }

  if (config.tokenStore === "keychain") {
    const store = new KeychainTokenStore(config);
    if (!(await store.isAvailable())) {
      throw new Error("macOS Keychain is not available");
    }
    return store;
  }

  const keychainStore = new KeychainTokenStore(config);
  if (await keychainStore.isAvailable()) {
    return keychainStore;
  }
  return new FileTokenStore(config);
}
