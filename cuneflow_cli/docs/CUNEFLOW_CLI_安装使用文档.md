# CUNEFLOW CLI 安装与使用文档

## 1. 文档目的

CUNEFLOW CLI 用于在本机完成 CUNEFLOW 账号授权，并把远程 MCP 服务接入 Codex 或 Claude Code。安装完成后，Agent 可以在当前用户授权范围内调用会议、文件和屏保等 MCP 工具。

本文面向测试人员、开发人员和 AI 客户端使用者，覆盖：

- Windows、macOS 和 Linux 安装
- 正式、测试和本地环境切换
- OAuth 登录与授权状态检查
- Codex、Claude Code 的 MCP 与 Skills 安装
- 文件上传和屏保发布的使用方式
- CLI 升级、卸载与常见问题排查

> 当前仓库中的包名为 `@cuneflow/cli`，要求 Node.js 20 或更高版本。

## 2. 工作原理

```text
Codex / Claude Code
        │ stdio
        ▼
本机 CUNEFLOW CLI（MCP Proxy）
        │ OAuth Bearer Token
        ▼
CUNEFLOW MCP 服务
        │
        ├── 会议、纪要、行动项、文件
        └── 屏保上传、发布预览、正式发布
```

CLI 在本地保存用户授权信息，并代替 AI 客户端连接远程 MCP。业务操作最终使用登录用户的 `user_id`，不需要在命令或提示词中手工传入用户 ID。

## 3. 安装前准备

### 3.1 必备软件

- Node.js 20 或更高版本
- npm
- Codex 或 Claude Code（至少安装一个）
- 能访问对应环境的 CUNEFLOW OAuth 和 MCP 服务

检查版本：

```powershell
node --version
npm --version
```

如果 `node --version` 低于 20，请先升级 Node.js。

### 3.2 环境地址

| 环境 | `CUNEFLOW_ENV` | OAuth 服务 | MCP 服务 |
|---|---|---|---|
| 正式环境 | `prod`，默认值 | `https://api.cuneflow.com` | `https://mcp.cuneflow.com/mcp` |
| 测试环境 | `test` | `https://test-api.cuneflow.com` | `https://test-mcp.cuneflow.com/mcp` |
| 本地环境 | `local` | `http://127.0.0.1:9090` | `http://127.0.0.1:9091/mcp` |

环境变量只影响当前终端时，关闭终端后会失效。安装 MCP 配置时，非正式环境的选择会写入对应 AI 客户端配置。

## 4. 安装 CLI

### 4.1 从 npm 安装

```powershell
npm install -g @cuneflow/cli
```

### 4.2 使用团队提供的 `.tgz` 测试包安装

Windows PowerShell：

```powershell
cd D:\path\to\package
npm install -g .\cuneflow-cli-0.1.7.tgz --force
```

macOS 或 Linux：

```bash
cd /path/to/package
npm install -g ./cuneflow-cli-0.1.7.tgz --force
```

文件名中的版本号以实际收到的安装包为准。

### 4.3 验证安装

```powershell
cuneflow --version
cuneflow --help
npm list -g @cuneflow/cli --depth=0
```

Windows 如果 PowerShell 阻止执行 `cuneflow.ps1`，可以直接使用：

```powershell
cuneflow.cmd --version
```

后续命令中的 `cuneflow` 均可替换成 `cuneflow.cmd`。

## 5. 快速初始化

`setup` 是推荐的首次安装方式。它会检查登录状态、识别本机的 Codex/Claude Code，并安装 MCP 配置和配套 Skills。

### 5.1 正式环境

```powershell
cuneflow setup
```

### 5.2 Windows 测试环境

PowerShell 设置环境变量的语法如下：

```powershell
$env:CUNEFLOW_ENV = "test"
cuneflow.cmd setup
```

不要在 PowerShell 中使用下面这种 macOS/Linux 语法：

```text
CUNEFLOW_ENV=test cuneflow login
```

### 5.3 macOS/Linux 测试环境

```bash
CUNEFLOW_ENV=test cuneflow setup
```

### 5.4 只预览变更

```powershell
cuneflow setup --dry-run
```

初始化完成后，重启 Codex 或 Claude Code，使新的 MCP 配置和 Skills 生效。

## 6. 手动登录与授权管理

如果不使用一键初始化，可以按以下步骤手动配置。

### 6.1 登录

正式环境：

```powershell
cuneflow login
```

Windows 测试环境：

```powershell
$env:CUNEFLOW_ENV = "test"
cuneflow.cmd login
```

CLI 默认打开浏览器完成 OAuth 授权，并监听 `127.0.0.1:7878` 接收回调。

如果无法自动打开浏览器：

```powershell
$env:CUNEFLOW_NO_BROWSER = "1"
cuneflow.cmd login
```

复制终端输出的授权地址到浏览器打开即可。

### 6.2 查看授权状态

```powershell
cuneflow auth status
```

### 6.3 主动刷新授权

```powershell
cuneflow auth refresh
```

### 6.4 退出登录

```powershell
cuneflow logout
```

如果服务端新增了权限范围，例如屏保发布所需的 `screensaver:write`，旧 Token 不会由 CLI 自动补充该权限，需要退出后重新登录：

```powershell
cuneflow logout
cuneflow login
```

## 7. 接入 Codex

### 7.1 安装 MCP 与 Skills

```powershell
cuneflow mcp install codex
```

默认会同时安装：

- CUNEFLOW MCP 配置
- `cuneflow` Skill
- `build-cune-screensavers` Skill

Codex MCP 配置默认写入：

```text
~/.codex/config.toml
```

写入前 CLI 会保留备份。配置中会记录 Node 和 CLI 的绝对路径，避免 Codex 桌面端与终端的 PATH 不一致。

安装后请完全退出并重新打开 Codex。

### 7.2 查看安装状态

```powershell
cuneflow mcp status codex
cuneflow skills status codex
cuneflow doctor --client codex
```

### 7.3 只安装 MCP，不安装 Skills

```powershell
cuneflow mcp install codex --no-skill
```

### 7.4 使用自定义 Codex 配置文件

```powershell
cuneflow mcp install codex --config D:\path\to\config.toml
cuneflow mcp status codex --config D:\path\to\config.toml
```

## 8. 接入 Claude Code

### 8.1 安装 MCP 与 Skills

```powershell
cuneflow mcp install claude
```

CLI 通过 Claude Code 官方命令将 MCP 配置安装到用户级作用域，并默认安装配套 Skills。

### 8.2 查看安装状态

```powershell
cuneflow mcp status claude
cuneflow skills status claude
cuneflow doctor --client claude
```

### 8.3 只安装 MCP，不安装 Skills

```powershell
cuneflow mcp install claude --no-skill
```

安装后请重启 Claude Code。

## 9. 单独管理 Skills

Codex 的 Skills 默认安装到：

```text
~/.agents/skills/
```

Claude Code 的 Skills 默认安装到：

```text
~/.claude/skills/
```

管理命令：

```powershell
cuneflow skills install codex
cuneflow skills status codex
cuneflow skills uninstall codex

cuneflow skills install claude
cuneflow skills status claude
cuneflow skills uninstall claude
```

只预览安装或卸载结果：

```powershell
cuneflow skills install codex --dry-run
cuneflow skills uninstall codex --dry-run
```

## 10. 在 Agent 中使用

CLI 接入成功后，一般不需要手动执行 `cuneflow mcp proxy`。Codex 或 Claude Code 会根据已写入的配置自动启动本地代理。

### 10.1 查询会议数据

可以直接对 Agent 说：

```text
查询我今天的会议，并整理每场会议的行动项。
```

### 10.2 上传本地文件

```text
请把 D:\Documents\会议资料.pdf 上传到 CUNEFLOW。
```

本地文件上传约束：

- 一次 1～20 个文件
- 单个文件不超过 100 MB
- 一次总大小不超过 500 MB
- 文件原始字节由 CLI 直传对象存储，不进入模型上下文，也不作为 MCP JSON 内容转发

### 10.3 生成并发布静态屏保

```text
为 SE05 生成一个静态天气风格屏保，先创建发布预览，不要直接正式发布。
```

Agent 将使用屏保 Skill 生成并校验 `.cunesaver`，然后调用本地上传工具创建服务端发布预览。

看到预览信息后，用户明确回复“确认发布”，Agent 才应调用正式发布工具。没有确认时不得正式发布。

### 10.4 生成并发布动态屏保

```text
为 SE05 生成一个展示今日会议的动态屏保。使用设备端数据源，先创建发布预览。
```

动态屏保仍然发布为 `.cunesaver` 文件。包内保存 HTML/CSS/JavaScript 模板和数据源声明，实际业务数据由 SE05 设备端获取并在本地渲染，不应把制作电脑上的会议或阅读数据写死到包里。

屏保包最大为 20 MiB。

## 11. 健康检查

检查所有已识别客户端：

```powershell
cuneflow doctor
```

检查指定客户端：

```powershell
cuneflow doctor --client codex
cuneflow doctor --client claude
```

输出 JSON，适合自动化测试：

```powershell
cuneflow doctor --json --client codex
```

健康检查会覆盖：

- Node.js 和 CLI 路径
- Token 存储与刷新
- MCP 初始化和工具列表
- AI 客户端 MCP 配置
- Skills 安装状态

健康检查不会调用会议、上传或发布等业务工具，也不会输出完整 Token。

## 12. 命令速查

| 命令 | 用途 |
|---|---|
| `cuneflow setup [--dry-run]` | 一键登录并安装已识别客户端的 MCP 与 Skills |
| `cuneflow login` | 浏览器 OAuth 登录 |
| `cuneflow logout` | 清除当前环境的本地授权 |
| `cuneflow auth status` | 查看授权状态 |
| `cuneflow auth refresh` | 主动刷新 Token |
| `cuneflow doctor [--json] [--client codex\|claude\|all]` | 执行分层健康检查 |
| `cuneflow mcp install codex [--dry-run] [--no-skill]` | 安装 Codex MCP 配置 |
| `cuneflow mcp status codex` | 查看 Codex MCP 状态 |
| `cuneflow mcp uninstall codex [--dry-run]` | 卸载 Codex MCP 配置 |
| `cuneflow mcp install claude [--dry-run] [--no-skill]` | 安装 Claude Code MCP 配置 |
| `cuneflow mcp status claude` | 查看 Claude Code MCP 状态 |
| `cuneflow mcp uninstall claude [--dry-run]` | 卸载 Claude Code MCP 配置 |
| `cuneflow skills install codex\|claude [--dry-run]` | 安装配套 Skills |
| `cuneflow skills status codex\|claude` | 查看 Skills 状态 |
| `cuneflow skills uninstall codex\|claude [--dry-run]` | 卸载配套 Skills |
| `cuneflow mcp proxy` | 手工启动 stdio MCP 代理，通常由 AI 客户端自动启动 |
| `cuneflow --version` | 查看版本 |
| `cuneflow --help` | 查看帮助 |

## 13. 环境变量

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `CUNEFLOW_ENV` | `prod` | 环境：`prod`、`test` 或 `local` |
| `CUNEFLOW_BASE_URL` | 随环境变化 | OAuth API 地址 |
| `CUNEFLOW_CLIENT_ID` | `cuneflow-cli` | OAuth Client ID |
| `CUNEFLOW_RESOURCE` | 随环境变化 | OAuth Resource |
| `CUNEFLOW_MCP_URL` | 随环境变化 | MCP 地址 |
| `CUNEFLOW_CALLBACK_HOST` | `127.0.0.1` | OAuth 回调监听地址 |
| `CUNEFLOW_CALLBACK_PORT` | `7878` | OAuth 回调端口 |
| `CUNEFLOW_LOGIN_TIMEOUT_SECONDS` | `600` | 浏览器登录超时 |
| `CUNEFLOW_OAUTH_TIMEOUT_SECONDS` | `15` | OAuth 请求超时 |
| `CUNEFLOW_MCP_INITIALIZE_TIMEOUT_SECONDS` | `30` | MCP 初始化超时 |
| `CUNEFLOW_MCP_REQUEST_TIMEOUT_SECONDS` | `120` | 普通 MCP 请求超时 |
| `CUNEFLOW_MCP_UPLOAD_TIMEOUT_SECONDS` | `300` | 上传请求超时 |
| `CUNEFLOW_NO_BROWSER` | 未设置 | 设为 `1` 时不自动打开浏览器 |
| `CUNEFLOW_TOKEN_STORE` | `auto` | Token 存储：`auto`、`keychain` 或 `file` |
| `CUNEFLOW_CREDENTIALS_FILE` | `~/.cuneflow/credentials.json` | 文件型 Token 存储路径 |

除非正在调试服务地址，否则优先只设置 `CUNEFLOW_ENV`，避免多个地址变量互相覆盖。

## 14. 升级、重装与卸载

### 14.1 升级 npm 版本

```powershell
npm install -g @cuneflow/cli@latest
cuneflow --version
cuneflow mcp install codex
cuneflow doctor --client codex
```

### 14.2 重装本地 `.tgz`

```powershell
npm uninstall -g @cuneflow/cli
npm install -g .\cuneflow-cli-<version>.tgz --force
cuneflow.cmd mcp install codex
```

Node.js 升级或切换版本后，也应重新执行 `mcp install`，让配置中的绝对 Node/CLI 路径更新。

### 14.3 卸载客户端配置和 CLI

```powershell
cuneflow mcp uninstall codex
cuneflow skills uninstall codex
cuneflow logout
npm uninstall -g @cuneflow/cli
```

如果使用 Claude Code，将 `codex` 替换为 `claude`。

## 15. 从源码测试并打包（开发人员）

进入 CLI 工程：

```powershell
cd D:\IdeaProject\cuneflow-plugin\cuneflow_cli
```

安装依赖并测试：

```powershell
npm ci
npm test
npm run pack:dry-run
npm pack
```

`npm pack` 成功后，当前目录会生成类似下面的文件：

```text
cuneflow-cli-0.1.7.tgz
```

当前 `npm run check` 使用了 Unix 的 `find` 和 `xargs`。Windows PowerShell 可用以下命令进行等价语法检查：

```powershell
Get-ChildItem .\src -Recurse -Filter *.mjs | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "语法检查失败：$($_.FullName)"
    }
}
```

## 16. 常见问题

### 16.1 PowerShell 提示 `CUNEFLOW_ENV=test` 不是命令

原因是 PowerShell 不支持 Unix 风格的单行环境变量语法。

正确写法：

```powershell
$env:CUNEFLOW_ENV = "test"
cuneflow.cmd login
```

### 16.2 PowerShell 禁止运行 `cuneflow.ps1`

直接使用 npm 生成的 Windows 命令入口：

```powershell
cuneflow.cmd --help
```

### 16.3 登录页面未自动打开

```powershell
$env:CUNEFLOW_NO_BROWSER = "1"
cuneflow.cmd login
```

然后手动打开终端显示的地址。

### 16.4 登录回调端口被占用

临时修改端口：

```powershell
$env:CUNEFLOW_CALLBACK_PORT = "7879"
cuneflow.cmd login
```

OAuth 服务端必须允许对应的回调地址。

### 16.5 MCP 已安装但 Agent 看不到工具

依次检查：

```powershell
cuneflow auth status
cuneflow mcp status codex
cuneflow skills status codex
cuneflow doctor --client codex
```

然后完全退出并重启 Codex。Claude Code 同理。

### 16.6 屏保工具提示权限不足

确认服务端 OAuth Client 已配置 `screensaver:write`，然后重新登录：

```powershell
cuneflow logout
cuneflow login
```

CLI 不会为 Token 伪造服务端未授予的权限。

### 16.7 `npm ci` 报 `EALLOWREMOTE`

如果 `package-lock.json` 中记录的是 `registry.npmmirror.com`，而 npm 当前使用其他 Registry，npm 12 可能拒绝下载锁文件中的远程地址。优先让本次安装使用与锁文件一致的 Registry：

```powershell
npm ci --offline=false --registry=https://registry.npmmirror.com/
```

仍然报错时，可仅对本次命令允许锁文件中的远程包地址：

```powershell
npm ci --offline=false --registry=https://registry.npmmirror.com/ --allow-remote=all
```

不要为了临时构建问题直接修改全局 npm 配置。

### 16.8 `npm run check` 提示找不到 `xargs`

这是因为当前脚本使用 Unix 命令。Windows 请使用第 15 节提供的 PowerShell 语法检查命令；`npm test` 可以直接在 Windows 执行。

### 16.9 npm 被强制离线或代理不可用

只在确认这些变量是本次终端中的错误临时配置后清除：

```powershell
Remove-Item Env:NPM_CONFIG_OFFLINE -ErrorAction SilentlyContinue
Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
```

然后重新执行安装命令。

## 17. 测试环境验收清单

Windows 下可按以下顺序完成最小验收：

```powershell
$env:CUNEFLOW_ENV = "test"
cuneflow.cmd --version
cuneflow.cmd login
cuneflow.cmd auth status
cuneflow.cmd mcp install codex
cuneflow.cmd doctor --client codex
```

重启 Codex 后，在 Agent 中验证：

1. 能列出 CUNEFLOW MCP 工具。
2. 能查询当前用户有权限访问的会议或文件。
3. 能通过本地文件上传工具上传测试文件。
4. 能生成并校验 `.cunesaver`。
5. 能创建屏保发布预览，并返回 `sessionId`。
6. 未确认前不会调用正式发布。
7. 用户确认后能正式发布，并返回屏保记录与 revision。

## 18. 安全说明

- 不要把 Access Token、Refresh Token 或凭证文件提交到 Git。
- 不要在日志、截图或群聊中发送完整 Token。
- Windows 等文件型存储环境默认使用 `~/.cuneflow/credentials.json`，应限制该文件的访问权限。
- 对象存储签名 URL 属于临时敏感信息，不应长期保存或转发。
- 屏保正式发布属于会改变服务端状态的操作，必须先展示发布预览并取得用户明确确认。
- MCP 权限由 OAuth 服务端授予，CLI 不应自行补充或伪造 scope。
