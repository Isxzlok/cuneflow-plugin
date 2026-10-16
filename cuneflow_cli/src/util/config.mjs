import os from "node:os";
import path from "node:path";

const ENVIRONMENTS = {
  prod: {
    baseUrl: "https://api.cuneflow.com",
    resource: "https://mcp.cuneflow.com/mcp",
    mcpUrl: "https://mcp.cuneflow.com/mcp"
  },
  test: {
    baseUrl: "https://test-api.cuneflow.com",
    resource: "https://test-mcp.cuneflow.com/mcp",
    mcpUrl: "https://test-mcp.cuneflow.com/mcp"
  },
  local: {
    baseUrl: "http://127.0.0.1:9090",
    resource: "https://test-mcp.cuneflow.com/mcp",
    mcpUrl: "http://127.0.0.1:9091/mcp"
  }
};

/**
 * 读取 CLI 运行配置。
 * 配置集中在这里，避免命令实现散落读取环境变量。
 */
export function loadConfig() {
  const environment = (process.env.CUNEFLOW_ENV || "prod").trim().toLowerCase();
  const environmentDefaults = ENVIRONMENTS[environment];
  if (!environmentDefaults) {
    throw new Error(`Unsupported CUNEFLOW_ENV: ${environment}. Expected prod, test, or local.`);
  }

  return {
    environment,
    baseUrl: process.env.CUNEFLOW_BASE_URL || environmentDefaults.baseUrl,
    clientId: process.env.CUNEFLOW_CLIENT_ID || "cuneflow-cli",
    resource: process.env.CUNEFLOW_RESOURCE || environmentDefaults.resource,
    mcpUrl: process.env.CUNEFLOW_MCP_URL || process.env.CUNEFLOW_RESOURCE || environmentDefaults.mcpUrl,
    callbackHost: process.env.CUNEFLOW_CALLBACK_HOST || "127.0.0.1",
    callbackPort: Number(process.env.CUNEFLOW_CALLBACK_PORT || "7878"),
    loginTimeoutSeconds: Number(process.env.CUNEFLOW_LOGIN_TIMEOUT_SECONDS || "600"),
    oauthRequestTimeoutMs: secondsToMilliseconds("CUNEFLOW_OAUTH_TIMEOUT_SECONDS", 15),
    mcpInitializeTimeoutMs: secondsToMilliseconds("CUNEFLOW_MCP_INITIALIZE_TIMEOUT_SECONDS", 30),
    mcpRequestTimeoutMs: secondsToMilliseconds("CUNEFLOW_MCP_REQUEST_TIMEOUT_SECONDS", 120),
    mcpUploadTimeoutMs: secondsToMilliseconds("CUNEFLOW_MCP_UPLOAD_TIMEOUT_SECONDS", 300),
    noBrowser: process.env.CUNEFLOW_NO_BROWSER === "1" || process.env.CUNEFLOW_NO_BROWSER === "true",
    tokenStore: process.env.CUNEFLOW_TOKEN_STORE || "auto",
    credentialsFile: expandHome(process.env.CUNEFLOW_CREDENTIALS_FILE || "~/.cuneflow/credentials.json"),
    refreshSkewSeconds: Number(process.env.CUNEFLOW_REFRESH_SKEW_SECONDS || "60")
  };
}

/** 读取正数秒配置并转换为毫秒，避免无效超时被静默当成无限等待。 */
function secondsToMilliseconds(environmentName, defaultSeconds) {
  const seconds = Number(process.env[environmentName] || String(defaultSeconds));
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${environmentName} must be a positive number of seconds.`);
  }
  return seconds * 1000;
}

/**
 * 展开路径开头的 ~，用于文件 token 存储路径。
 */
export function expandHome(filePath) {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function tokenRecordKey(config) {
  return `${config.baseUrl}|${config.clientId}`;
}
