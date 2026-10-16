# CUNEFLOW CLI

CUNEFLOW 命令行工具，用于承接 CUNEFLOW AI OAuth 登录、token 安全存储和 MCP proxy。

## 安装

开发联调阶段可以先用本地 tar 包模拟真实用户安装：

```bash
npm pack
npm install -g ./cuneflow-cli-<version>.tgz
```

正式发布到 npm 后，用户可以直接安装：

```bash
npm install -g @cuneflow/cli
```

后续升级无需再次手动输入 npm 安装命令：

```bash
cuneflow update
```

要求 Node.js 20 或更高版本。

CLI 默认连接正式环境。本地开发或测试必须显式选择环境：

```bash
CUNEFLOW_ENV=test cuneflow login
CUNEFLOW_ENV=local cuneflow login
```

`prod`、`test`、`local` 之外的值会直接报错；各 URL 仍可通过现有环境变量单独覆盖。
使用非生产环境执行 `mcp install` 时，CLI 会把环境选择写入 Codex 或 Claude Code 的 MCP 配置，重启客户端后仍然生效。

macOS / Windows 完整操作文档见：[docs/macos-windows-usage.md](docs/macos-windows-usage.md)。

## 快速开始

```bash
npm install -g @cuneflow/cli
cuneflow login
cuneflow mcp install codex
cuneflow mcp status codex
```

该命令会同时安装 CUNEFLOW MCP 配置和 Codex Skill。完成后重启 Codex，让 Codex 重新加载 MCP 配置和 Skill。

如果只需要配置 MCP、不安装 Skill，可以使用：

```bash
cuneflow mcp install codex --no-skill
```

也可以使用一键引导完成登录、客户端检测、MCP 配置和 Skill 安装：

```bash
cuneflow setup
```

首次执行前可以预览操作：

```bash
cuneflow setup --dry-run
```

## 命令

```bash
cuneflow login
cuneflow auth status
cuneflow auth refresh
cuneflow doctor --client codex
cuneflow doctor --json
cuneflow logout
cuneflow update
cuneflow mcp proxy
cuneflow mcp install codex
cuneflow mcp status codex
cuneflow mcp uninstall codex
cuneflow mcp install claude
cuneflow mcp status claude
cuneflow mcp uninstall claude
cuneflow skills install codex
cuneflow skills status codex
cuneflow skills uninstall codex
cuneflow skills install claude
cuneflow skills status claude
cuneflow skills uninstall claude
cuneflow --help
cuneflow --version
```

macOS 默认优先使用 Keychain。其他平台或 Keychain 不可用时，会 fallback 到 `~/.cuneflow/credentials.json`。

源码开发时也可以直接运行：

```bash
node src/cli.mjs login
```

常用帮助命令：

```bash
cuneflow --help
cuneflow --version
cuneflow login --help
cuneflow mcp --help
cuneflow mcp install codex --help
cuneflow setup --help
cuneflow skills --help
```

## CUNEFLOW Skill

CLI 可以将 CUNEFLOW Skill 安装到 AI 工具的用户级目录，帮助 AI 更稳定地组合使用会议、转写、纪要和行动项工具：

```bash
cuneflow skills install codex
cuneflow skills install claude
```

检查或移除 Skill：

```bash
cuneflow skills status codex
cuneflow skills uninstall codex
cuneflow skills status claude
cuneflow skills uninstall claude
```

## MCP Proxy

本地 proxy 使用官方 MCP TypeScript SDK 在 stdio 与 Remote Streamable HTTP 之间透明转发完整 MCP 能力，包括并发请求、通知、进度、取消和会话管理。TokenStore 中的 Bearer token 会自动附加到远端请求；上游返回 401 时会强制 refresh 一次并由 SDK 重试。

本地联调示例：

```bash
CUNEFLOW_TOKEN_STORE=file \
CUNEFLOW_CREDENTIALS_FILE=/private/tmp/cuneflow-cli-test-credentials.json \
CUNEFLOW_MCP_URL=http://127.0.0.1:9091/mcp \
cuneflow mcp proxy
```

Codex 配置示例：

```toml
[mcp_servers.cuneflow]
command = "cuneflow"
args = ["mcp", "proxy"]
tool_timeout_sec = 120
```

如果不使用 CLI 写入配置，而是直接在 Codex 中填写 MCP 地址或手工编辑配置，
还需要单独安装 CUNEFLOW Skill：

```bash
npx @cuneflow/cli skills install codex
```

Skill 默认安装到 `~/.agents/skills/cuneflow/SKILL.md`。安装后重启 Codex，
让 Codex 重新发现 Skill。Claude Code 用户可以执行：

```bash
npx @cuneflow/cli skills install claude
```

Skill 默认安装到 `~/.claude/skills/cuneflow/SKILL.md`。

也可以让 CLI 自动写入 Codex 配置：

```bash
cuneflow mcp install codex
cuneflow mcp status codex
```

该命令默认写入 `~/.codex/config.toml`，写入前会自动生成备份文件。

Codex 桌面端不会可靠继承终端中的 nvm、fnm 等 PATH。安装命令因此会把当前
Node.js 可执行文件和 CUNEFLOW CLI 入口的绝对路径写入配置，避免桌面端误启旧版
CLI。切换、升级或删除 Node.js 安装后，请重新执行 `cuneflow mcp install codex`。

想先预览将写入的配置：

```bash
cuneflow mcp install codex --dry-run
```

如果要写入自定义配置文件：

```bash
cuneflow mcp install codex --config /path/to/config.toml
```

如需移除 Codex 配置：

```bash
cuneflow mcp uninstall codex
```

Claude Code 配置：

```bash
cuneflow mcp install claude
cuneflow mcp status claude
```

CLI 会调用 Claude Code 官方的 `claude mcp add --scope user` 命令，将本地
`cuneflow mcp proxy` 注册为用户级 stdio MCP server，并同时安装 CUNEFLOW Skill。
只安装 MCP 而不安装 Skill 时，可以使用 `--no-skill`。移除配置：

```bash
cuneflow mcp uninstall claude
```

安装前可以先预览命令：

```bash
cuneflow mcp install claude --dry-run
```

### 本机文件直传

CLI MCP 代理会在远端工具之外增加 `upload_local_files` 本地工具。用户明确要求上传时，
Agent 可以传入 1 到 20 个本机文件绝对路径和幂等键；CLI 在本地计算文件大小、MIME 类型和 MD5，
再把原始二进制直接 PUT 到服务端签发的短时效 OSS 地址，最后只通过 MCP 提交上传会话 ID。
文件正文不会进入 MCP JSON-RPC 或模型参数。单文件最大 100 MB，单次总量最大 500 MB。

### 制作并发布 SE05 屏保

CLI 会同时安装 `build-cune-screensavers` Skill，并提供本地工具
`prepare_local_screensaver_publish`。Skill 使用随包附带的确定性构建器生成和校验
`.cunesaver`；本地工具计算大小与 MD5、直传 OSS，并返回服务端发布预览。

上传和预览不会正式发布。Agent 必须先展示新增/更新类型、版本、动态数据源和原 revision，
得到用户明确确认后，再调用远端 `apply_screensaver_publish`。屏保包最大 20 MiB，
原始二进制不会进入 MCP JSON-RPC。

## 环境变量

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CUNEFLOW_ENV` | `prod` | 运行环境：`prod` / `test` / `local` |
| `CUNEFLOW_BASE_URL` | `https://api.cuneflow.com` | OAuth Server 地址 |
| `CUNEFLOW_CLIENT_ID` | `cuneflow-cli` | OAuth client_id |
| `CUNEFLOW_RESOURCE` | `https://mcp.cuneflow.com/mcp` | MCP resource |
| `CUNEFLOW_MCP_URL` | `CUNEFLOW_RESOURCE` | Remote MCP Server 地址 |
| `CUNEFLOW_CALLBACK_HOST` | `127.0.0.1` | callback host |
| `CUNEFLOW_CALLBACK_PORT` | `7878` | callback port |
| `CUNEFLOW_LOGIN_TIMEOUT_SECONDS` | `600` | 登录授权等待超时 |
| `CUNEFLOW_OAUTH_TIMEOUT_SECONDS` | `15` | OAuth 单次 HTTP 请求和响应读取超时 |
| `CUNEFLOW_MCP_INITIALIZE_TIMEOUT_SECONDS` | `30` | MCP 初始化超时 |
| `CUNEFLOW_MCP_REQUEST_TIMEOUT_SECONDS` | `120` | MCP 普通请求超时，进度通知会续期 |
| `CUNEFLOW_MCP_UPLOAD_TIMEOUT_SECONDS` | `300` | MCP 上传会话相关请求超时 |
| `CUNEFLOW_NO_BROWSER` | 未设置 | 设为 `1` 或 `true` 时不自动打开浏览器 |
| `CUNEFLOW_TOKEN_STORE` | `auto` | `auto` / `keychain` / `file` |
| `CUNEFLOW_CREDENTIALS_FILE` | `~/.cuneflow/credentials.json` | 文件 token 存储路径 |

OAuth scope 由服务端根据 client policy 统一决定，CLI 不再通过本地配置覆盖授权范围。

## 常见问题

### 提示未登录

重新登录：

```bash
cuneflow login
```

如果是在 Codex 中使用 MCP，登录后需要重启 Codex。

### token 刷新失败

refresh token 可能已过期或被撤销，重新登录即可：

```bash
cuneflow login
```

### 登录提示 callback 端口被占用

`cuneflow login` 会临时监听本机 callback 地址：

```bash
http://127.0.0.1:7878/oauth/callback
```

登录成功、授权失败、超时、按 `Ctrl+C` 或 `Ctrl+Z` 取消时，CLI 会主动释放该端口。

如果仍提示端口被占用，通常是之前的登录进程仍在运行。macOS/Linux 可以查看并结束进程：

```bash
lsof -nP -iTCP:7878 -sTCP:LISTEN
kill <PID>
```

Windows PowerShell：

```powershell
netstat -ano | findstr :7878
taskkill /PID <PID> /F
```

也可以临时换一个 callback 端口：

```bash
CUNEFLOW_CALLBACK_PORT=7879 cuneflow login
```

Windows PowerShell：

```powershell
$env:CUNEFLOW_CALLBACK_PORT="7879"
cuneflow.cmd login
```

### Codex 里看不到 CUNEFLOW tools

先检查配置：

```bash
cuneflow mcp status codex
```

确认配置正常后重启 Codex。

### MCP 服务连接失败

检查 `CUNEFLOW_MCP_URL` 是否正确，默认地址是：

```bash
https://mcp.cuneflow.com/mcp
```

## 发布前检查

```bash
npm run check
npm test
npm run pack:dry-run
```
