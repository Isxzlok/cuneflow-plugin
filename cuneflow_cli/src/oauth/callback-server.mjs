import http from "node:http";
import { URL } from "node:url";

/**
 * 启动一次性 localhost callback server。
 * 收到授权结果后立即关闭，避免本地端口长时间暴露。
 */
export function waitForAuthorizationCode({ redirectUri, host, port, expectedState, timeoutSeconds, signal }) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let settled = false;
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, redirectUri);
      if (requestUrl.pathname !== "/oauth/callback") {
        res.writeHead(404, { "Content-Type": "text/plain;charset=UTF-8" });
        res.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/plain;charset=UTF-8" });
        res.end("CUNEFLOW OAuth failed. You can close this page.", () => {
          settleWithError(new Error(`authorize failed: ${error}`));
        });
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");
      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/plain;charset=UTF-8" });
        res.end("CUNEFLOW OAuth state mismatch. You can close this page.", () => {
          settleWithError(new Error("missing code or state mismatch"));
        });
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html;charset=UTF-8" });
      res.end("<html><body><h3>CUNEFLOW OAuth success</h3><p>You can close this page.</p></body></html>", () => {
        settleWithCode(code);
      });
    });

    const abortHandler = () => {
      settleWithError(new Error("OAuth login cancelled."));
    };
    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        settleWithError(new Error(buildPortInUseMessage(host, port)));
        return;
      }
      settleWithError(error);
    });
    server.listen(port, host, () => {
      console.log(`Local callback listening: ${redirectUri}`);
      timeoutId = setTimeout(() => {
        settleWithError(new Error("OAuth login timed out. Please run `cuneflow login` again."));
      }, Number(timeoutSeconds || 600) * 1000);
    });

    async function settleWithCode(code) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      await closeServer(server, timeoutId);
      resolve(code);
    }

    async function settleWithError(error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      await closeServer(server, timeoutId);
      reject(error);
    }

    function cleanup() {
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  });
}

function buildPortInUseMessage(host, port) {
  return [
    `Local callback port ${host}:${port} is already in use.`,
    "If a previous `cuneflow login` is still running, stop it first.",
    `macOS/Linux: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    "Then run: kill <PID>",
    `Windows: netstat -ano | findstr :${port}`,
    "Then run: taskkill /PID <PID> /F",
    `Or use another callback port: CUNEFLOW_CALLBACK_PORT=${Number(port) + 1} cuneflow login`
  ].join("\n");
}

function closeServer(server, timeoutId) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  return new Promise((resolve) => {
    server.close((err) => {
      if (err && err.code !== "ERR_SERVER_NOT_RUNNING") {
        console.warn(`Local callback close warning: ${err.message}`);
      }
      resolve();
    });
  });
}
