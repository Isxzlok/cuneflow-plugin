# CUNEFLOW Plugin

CUNEFLOW 的 Codex 与 Claude 插件。安装并授权后，可以通过自然语言查询会议、转写、纪要、行动项和日程，也可以把当前对话中附加的本地文件安全上传到 CUNEFLOW。

文件上传使用插件内置 Helper 将原始字节直接发送到 CUNEFLOW 返回的短时效预签名地址。文件内容不会进入 MCP JSON-RPC，也不要求用户安装 `cuneflow-cli`。

## 在 Codex 中安装

将 GitHub 仓库 `Isxzlok/cuneflow-plugin` 添加为插件市场，然后安装其中的 CUNEFLOW 插件。也可以使用命令行：

```bash
codex plugin marketplace add Isxzlok/cuneflow-plugin --ref main
codex plugin add cuneflow@cuneflow
```

安装完成后新建一个 Codex 任务，发送“连接 CUNEFLOW”。插件会启动由 Codex 管理的 OAuth 授权流程；完成授权后，建议再新建一个任务验证会议、日程或文件功能。

Codex 会把插件内的 MCP 配置映射到已注册的 CUNEFLOW 应用连接。插件详情页可以查看连接状态，并提供连接、重新连接和断开连接入口；`.mcp.json` 同时保留，用于 Codex CLI 与 Claude 等宿主的兼容。

### 重新连接

如果首次安装时取消或拒绝了授权，或者登录凭据后来失效，不需要卸载插件或编辑配置。在任意 Codex 任务中发送：

```text
连接或重新授权 CUNEFLOW
```

也可以直接提出会议、日程或文件请求；检测到未连接时，插件会为该请求启动一次 OAuth 授权流程。若用户关闭或拒绝授权页面，插件不会反复弹出，之后再次发送上面的连接请求即可重试。

## 使用示例

### 会议与行动项

```text
连接 CUNEFLOW，并总结我最近一次会议的关键决策、风险和行动项
```

```text
总结我上周参加的会议，按负责人整理还没有完成的行动项
```

```text
查找关于“产品发布”的会议，并根据转写整理一封跟进邮件
```

### 日程与待办

```text
查看我明天的日程安排，找出时间冲突并整理待办
```

```text
查看我本周剩余日程，帮我找一个两小时的空闲时段
```

```text
把明天下午三点的项目同步会改到四点，先让我确认修改内容
```

### 文件

```text
把我刚拖入对话的文件上传到 CUNEFLOW，并创建关联会议
```

```text
把我刚拖入对话的文件上传到 CUNEFLOW
```

```text
查找 CUNEFLOW 中最近上传的文件，并概括其中的主要内容
```

### CUNEFLOW 屏保生产

```text
根据我今天的日程制作一个 CUNEFLOW SE05 屏保
```

## 功能

- 查询会议、转写、AI 纪要和行动项
- 查询、创建和管理日程
- 查询、读取、创建和重命名 CUNEFLOW 文件
- 上传当前对话中明确附加的本地文件
- 制作、验证和发布 CUNEFLOW SE05 屏保

## 本地验证

需要 Node.js 18 或更高版本：

```bash
npm test
```

当前 `0.1.0` 版本连接 CUNEFLOW 测试环境 MCP，用于安装、授权和功能链路验证。
