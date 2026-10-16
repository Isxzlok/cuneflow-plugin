# Changelog

## 0.1.7

- 新增 `cuneflow update` 自升级命令，自动检查 npm 最新版本并更新全局安装的 `@cuneflow/cli`。
- 已是最新版或本地版本更高时跳过安装，并为网络、npm 和全局安装权限错误提供明确提示。
- 随 CLI 安装官方 `build-cune-screensavers` Skill、格式参考和确定性 `.cunesaver` 构建器。
- 增加 `prepare_local_screensaver_publish` 本地工具，完成屏保包 MD5、OSS 直传和服务端发布预览。
- 屏保正式发布保持二次确认，只有用户确认后才调用 `apply_screensaver_publish`。

## 0.1.6

- MCP proxy 统一迁移到官方 MCP TypeScript SDK 2.0.0，删除手写代理引擎。
- 完整转发 tools、resources、prompts、通知、进度、取消、反向请求和扩展方法。
- 仅在远端明确返回 `invalid_token` 时刷新 token，避免服务故障触发无意义刷新。
- 保留可重复使用的 refresh token 策略，并修复多进程文件凭证写入冲突。
- CLI 默认使用正式环境，测试和本地环境必须通过 `CUNEFLOW_ENV` 显式选择。
- 为 OAuth 和 MCP 请求增加分级超时，并保留 HTTP 状态、请求 ID 与可重试语义。
- 增加 `upload_local_files` 本地工具，使用预签名 PUT 将原始文件直传 OSS，移除 MCP JSON-RPC 中的大文件 Base64。
- 增加 `cuneflow doctor` 分层诊断 CLI、OAuth、MCP、客户端配置和 Skill，支持稳定 JSON 输出与失败退出码。
- 删除仓库中的旧版 `package/` 解包副本，发布内容只由根目录 `package.json` 的 files 白名单生成。
- 未知命令和不接受参数的命令现在会拒绝多余参数并返回非零退出码。
- 最低 Node.js 版本提升到 20。
- Codex 安装配置固定使用当前 Node.js 与 CLI 的绝对路径，避免桌面端在 nvm 多版本环境中误启旧版代理。

## 0.1.5

- 权限范围统一由服务端控制，支持文件和日程写入权限。
- 完善 ChatGPT MCP OAuth 授权流程和直接 MCP URL 配置支持。
- 增加日程读写权限对应的 MCP 代理能力。

## 0.1.4

- 新增 `cuneflow setup` 一键登录、检测 AI 客户端并配置 MCP。
- 新增 Codex / Claude Code 的 CUNEFLOW Skill 安装和管理。
- 新增 npm 安装完成提示、单元测试和跨平台 CI。
- 修复 Windows 下调用 Claude Code `.cmd` 的兼容性问题。
- 修复 Windows 下 Skill 文件路径解析问题。

## 0.1.0

- OAuth 授权码 + PKCE 登录。
- macOS 钥匙串 / 文件凭证存储和 token 自动续期。
- stdio ↔ HTTP MCP 代理及 Codex / Claude Code 配置管理。
