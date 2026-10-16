# CUNEFLOW CLI macOS / Windows 使用文档

本文档用于指导用户在 macOS 和 Windows 上安装、登录并配置 CUNEFLOW MCP 到 Codex。

## 一、准备工作

使用前请确认已经安装 Node.js 20 或更高版本。

检查版本：

```bash
node -v
npm -v
```

如果 `node -v` 低于 20，请先升级 Node.js。

## 二、安装 CLI

### 方式一：从 npm 安装

正式发布后使用：

```bash
npm install -g @cuneflow/cli
```

### 方式二：使用本地 tar 包安装

开发或测试阶段可以使用本地包：

```bash
npm install -g ./cuneflow-cli-<version>.tgz
```

安装完成后检查：

macOS / Windows CMD：

```bash
cuneflow --version
cuneflow --help
```

Windows PowerShell 如果提示禁止运行脚本，可以使用：

```powershell
cuneflow.cmd --version
cuneflow.cmd --help
```

## 三、登录 CUNEFLOW

### macOS

```bash
cuneflow login
```

CLI 会自动打开浏览器授权页。请在已登录 CUNEFLOW 的浏览器中完成授权。

### Windows CMD

```cmd
cuneflow login
```

### Windows PowerShell

推荐使用：

```powershell
cuneflow.cmd login
```

如果 PowerShell 直接执行 `cuneflow login` 报错：

```text
因为在此系统上禁止运行脚本
```

说明 PowerShell 禁止执行 npm 生成的 `.ps1` 启动脚本。可以继续使用 `cuneflow.cmd`，或执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

然后重新运行：

```powershell
cuneflow login
```

## 四、登录状态检查

```bash
cuneflow auth status
```

已登录时会看到登录状态和 token 存储位置。

macOS 默认使用 Keychain。其他平台默认使用文件存储。

## 五、配置 Codex MCP

登录成功后执行：

macOS / Windows CMD：

```bash
cuneflow mcp install codex
cuneflow mcp status codex
```

Windows PowerShell：

```powershell
cuneflow.cmd mcp install codex
cuneflow.cmd mcp status codex
```

配置完成后请重启 Codex，让 Codex 重新加载 MCP 配置。

安装器会固定记录当前 Node.js 和 CUNEFLOW CLI 的绝对路径，避免 Codex 桌面端在
nvm、fnm 或多 Node.js 环境中启动到旧版 CLI。以后切换、升级或删除 Node.js 安装后，
需要重新执行 `cuneflow mcp install codex` 并重启 Codex。

上面的 CLI 命令会同时安装 CUNEFLOW Skill。如果你选择在 Codex 中手工填写 MCP
地址或手工编辑 `~/.codex/config.toml`，请另外执行：

```bash
npx @cuneflow/cli skills install codex
```

Skill 默认安装到 `~/.agents/skills/cuneflow/SKILL.md`。安装后重启 Codex，
让 Codex 重新发现 Skill。

状态正常时会看到类似：

```text
Status: installed
command: cuneflow
args: ["mcp", "proxy"]
```

## 六、在 Codex 中使用

重启 Codex 后，可以直接向 Codex 提问，例如：

```text
帮我查询最近三个会议
```

或：

```text
帮我查看某个会议的行动项
```

Codex 会通过本机 `cuneflow mcp proxy` 自动调用 CUNEFLOW MCP tools。

正常用户不需要手动运行：

```bash
cuneflow mcp proxy
```

这个命令由 Codex 自动启动。

## 七、配置 Claude Code MCP

确认已经安装 Claude Code，并且 `claude` 命令可以在终端中使用。登录 CUNEFLOW
后执行：

macOS / Windows CMD：

```bash
cuneflow mcp install claude
cuneflow mcp status claude
```

Windows PowerShell：

```powershell
cuneflow.cmd mcp install claude
cuneflow.cmd mcp status claude
```

CLI 会调用 Claude Code 官方 MCP 命令，将 `cuneflow mcp proxy` 安装为用户级
MCP server，并同时安装 CUNEFLOW Skill。配置完成后重启 Claude Code，或重新连接 MCP server。

如果你是手工配置 MCP，而不是使用 CLI 安装 MCP，请另外执行：

```bash
npx @cuneflow/cli skills install claude
```

Skill 默认安装到 `~/.claude/skills/cuneflow/SKILL.md`。

移除配置：

```bash
cuneflow mcp uninstall claude
```

## 八、升级 CLI

如果拿到了新的本地 tar 包：

```bash
npm install -g ./cuneflow-cli-<version>.tgz
```

如果正式发布到了 npm：

```bash
npm install -g @cuneflow/cli@latest
```

升级后检查：

```bash
cuneflow --version
```

Windows PowerShell：

```powershell
cuneflow.cmd --version
```

## 八、卸载或重新配置 Codex MCP

移除 Codex 配置：

```bash
cuneflow mcp uninstall codex
```

Windows PowerShell：

```powershell
cuneflow.cmd mcp uninstall codex
```

移除后请重启 Codex。

如果只是重新写入配置：

```bash
cuneflow mcp install codex
```

## 九、常见问题

### 1. PowerShell 提示禁止运行脚本

现象：

```text
无法加载文件 ... cuneflow.ps1，因为在此系统上禁止运行脚本
```

解决方式一，直接使用 `.cmd`：

```powershell
cuneflow.cmd --help
cuneflow.cmd login
```

解决方式二，允许当前用户运行本地脚本：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 2. 登录时 callback 端口被占用

`cuneflow login` 默认会监听：

```text
http://127.0.0.1:7878/oauth/callback
```

如果提示端口被占用，通常是之前的登录进程还在运行。

macOS / Linux：

```bash
lsof -nP -iTCP:7878 -sTCP:LISTEN
kill <PID>
```

Windows PowerShell：

```powershell
netstat -ano | findstr :7878
taskkill /PID <PID> /F
```

也可以临时换一个端口。

macOS / Linux：

```bash
CUNEFLOW_CALLBACK_PORT=7879 cuneflow login
```

Windows PowerShell：

```powershell
$env:CUNEFLOW_CALLBACK_PORT="7879"
cuneflow.cmd login
```

### 3. 登录过程中想取消

macOS / Linux 可以按：

```text
Ctrl+C
```

如果误按 `Ctrl+Z`，新版本 CLI 也会取消登录并释放端口。

Windows 终端中可以按：

```text
Ctrl+C
```

### 4. 浏览器没有自动打开

可以手动复制终端输出的 `Authorization URL` 到浏览器。

也可以强制不自动打开浏览器。

macOS / Linux：

```bash
CUNEFLOW_NO_BROWSER=1 cuneflow login
```

Windows PowerShell：

```powershell
$env:CUNEFLOW_NO_BROWSER="1"
cuneflow.cmd login
```

### 5. Codex 里看不到 CUNEFLOW tools

先检查配置：

```bash
cuneflow mcp status codex
```

Windows PowerShell：

```powershell
cuneflow.cmd mcp status codex
```

确认配置正常后重启 Codex。

### 6. 提示未登录或 token 刷新失败

重新登录：

```bash
cuneflow login
```

Windows PowerShell：

```powershell
cuneflow.cmd login
```

登录完成后重启 Codex。

## 十、默认服务地址

当前 CLI 默认连接生产环境：

```text
OAuth API: https://api.cuneflow.com
MCP Server: https://mcp.cuneflow.com/mcp
```

测试或本地联调必须显式选择环境：

```bash
CUNEFLOW_ENV=test cuneflow login
CUNEFLOW_ENV=local cuneflow login
```

随后在同一个环境变量下执行 `cuneflow mcp install codex` 或
`cuneflow mcp install claude`，CLI 会把非生产环境选择保存到 MCP 配置中。

Windows PowerShell 示例：

```powershell
$env:CUNEFLOW_ENV="test"
cuneflow.cmd login
```

也可以按需覆盖单个服务地址：

```bash
CUNEFLOW_BASE_URL=<OAuth API 地址>
CUNEFLOW_RESOURCE=<MCP resource>
CUNEFLOW_MCP_URL=<MCP Server 地址>
```

Windows PowerShell 地址覆盖示例：

```powershell
$env:CUNEFLOW_BASE_URL="https://api.cuneflow.com"
$env:CUNEFLOW_RESOURCE="https://mcp.cuneflow.com/mcp"
$env:CUNEFLOW_MCP_URL="https://mcp.cuneflow.com/mcp"
```
