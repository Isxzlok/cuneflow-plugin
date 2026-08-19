---
name: connect-cuneflow
description: 连接或重新授权 CUNEFLOW MCP。当插件安装后没有自动弹出授权、CUNEFLOW 工具提示未连接或未登录、OAuth 凭据失效，或用户明确要求连接 CUNEFLOW 时使用。
---

# 连接 CUNEFLOW

为当前宿主启动 CUNEFLOW OAuth 登录流程。这是本地或 Git 插件安装未自动显示授权界面时的兜底入口。

## Codex

1. 用户明确要求连接、登录或授权 CUNEFLOW 时，运行 `codex mcp login cuneflow`。
2. 该命令应打开由 Codex 管理的浏览器授权页面。等待用户在页面中完成登录和授权，不要索要、读取或转述 access token、refresh token、授权码或 Cookie。
3. 命令成功结束后，告知用户 CUNEFLOW 已连接，并建议在新任务中重试刚才的查询或上传请求。
4. 如果命令失败，只报告必要错误和可执行的下一步；不要在没有用户确认的情况下反复启动登录。

## 其他宿主

如果当前宿主不是 Codex，不要安装或调用 Codex CLI。使用宿主提供的 MCP 连接/授权入口；如果宿主没有该入口，明确说明当前插件无法代替宿主完成 OAuth。

## 安全边界

- 不要求用户粘贴任何令牌、授权码、Cookie 或密码。
- 不把凭据写入文件、日志、命令参数或对话内容。
- 不用 CUNEFLOW CLI 代替 MCP OAuth。
- 连接成功不代表可以执行任意写操作；上传、创建或修改数据仍需用户明确提出。
