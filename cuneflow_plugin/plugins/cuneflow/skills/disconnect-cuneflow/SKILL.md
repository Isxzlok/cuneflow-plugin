---
name: disconnect-cuneflow
description: 断开 CUNEFLOW OAuth 连接，或在用户明确要求彻底卸载 CUNEFLOW 时先清除 Codex 托管凭据再卸载插件。仅删除插件或在 Codex 界面手动卸载时不会触发本 Skill。
---

# 断开或彻底卸载 CUNEFLOW

根据用户意图区分“断开连接”和“彻底卸载”。不要把普通的插件禁用、移除或故障排查解释成删除授权。

## Codex

### 仅断开连接

当用户明确要求退出登录、断开账户、清除 CUNEFLOW 登录状态或撤销本机连接时：

1. 运行 `codex mcp logout cuneflow`。
2. 只有命令明确报告凭据已删除后，才告知用户本机 OAuth 凭据已清除。
3. 保留插件、Skills 和 MCP 注册；以后再次使用时可通过 `connect-cuneflow` Skill 重新授权。

### 彻底卸载

当用户明确要求彻底卸载 CUNEFLOW 并清除登录状态时，严格按以下顺序执行：

1. 先运行 `codex mcp logout cuneflow`，清除 Codex 托管的 OAuth 凭据。
2. logout 成功后，再运行 `codex plugin remove cuneflow@cuneflow`。
3. 分别报告凭据清理和插件卸载结果。任一步失败时停止，不得声称已经彻底清除。

如果用户只说“卸载插件”，在执行前简短说明：当前 Codex 单独卸载插件可能保留 OAuth 凭据，询问用户是否还要断开 CUNEFLOW。没有得到清除授权的明确意图时，不要运行 logout。

## 能力边界

- 本 Skill 只会在对话中被 Codex 选择并执行，不能拦截 Codex 设置界面的手动卸载按钮。
- 用户直接在 Codex 界面卸载插件时，Codex 不会读取本 Skill；重新安装后可能继续复用原 OAuth 凭据。
- 本 Skill 删除的是当前 Codex 主机为 `cuneflow` MCP 托管的凭据。不要声称它会删除 CUNEFLOW 账户、会议、文件、日程或其他业务数据。
- 不读取、显示、复制或记录 access token、refresh token、授权码、Cookie 或其他凭据。
- 如果当前宿主不是 Codex，不要运行 Codex CLI；使用该宿主提供的断开连接或撤销授权入口。
