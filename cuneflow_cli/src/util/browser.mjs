import { spawn } from "node:child_process";

/**
 * 尝试用系统默认浏览器打开 URL。
 * 打开失败不影响 OAuth 主流程，CLI 仍会打印 URL 供用户手动复制。
 */
export function openBrowser(url) {
  const { command, args } = buildOpenCommand(url);
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore"
      });
      child.once("error", (error) => {
        resolve({ opened: false, error });
      });
      child.once("spawn", () => {
        child.unref();
        resolve({ opened: true });
      });
    } catch (error) {
      resolve({ opened: false, error });
    }
  });
}

/**
 * 根据操作系统选择打开默认浏览器的命令。
 */
function buildOpenCommand(url) {
  if (process.platform === "darwin") {
    return { command: "open", args: [url] };
  }
  if (process.platform === "win32") {
    return { command: "rundll32", args: ["url.dll,FileProtocolHandler", url] };
  }
  return { command: "xdg-open", args: [url] };
}
