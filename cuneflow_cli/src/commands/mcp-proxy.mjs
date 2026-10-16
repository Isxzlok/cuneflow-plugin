import { createTokenStore } from "../token/token-store-factory.mjs";
import { TokenManager } from "../token/token-manager.mjs";
import { loadConfig } from "../util/config.mjs";
import { SdkMcpProxy } from "../mcp/sdk-mcp-proxy.mjs";

/**
 * MCP proxy 命令入口。
 */
export async function runMcpProxy() {
  const config = loadConfig();
  const store = await createTokenStore(config);
  const tokenManager = new TokenManager({ config, store });
  const proxy = new SdkMcpProxy({ config, tokenManager });
  await proxy.start();
}
