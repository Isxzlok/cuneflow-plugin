# CUNEFLOW Plugin

CUNEFLOW 的 Codex 与 Claude 插件。安装并授权后，可以通过自然语言查询会议、转写、纪要、行动项和日程，也可以把当前对话中附加的本地文件安全上传到 CUNEFLOW。

文件上传使用插件内置 Helper 将原始字节直接发送到 CUNEFLOW 返回的短时效预签名地址。文件内容不会进入 MCP JSON-RPC，也不要求用户安装 `cuneflow-cli`。

## 在 Codex 中安装

```bash
codex plugin marketplace add Isxzlok/cuneflow-plugin --ref main
codex plugin add cuneflow@cuneflow
```

安装后新建一个 Codex 任务，通过插件页面完成 CUNEFLOW 授权。可以使用以下请求进行验证：

```text
把我刚拖入对话的文件上传到 CUNEFLOW
```

```text
总结我最近一次会议并列出行动项
```

```text
查看我明天的日程安排
```

## 功能

- 查询会议、转写、AI 纪要和行动项
- 查询和管理日程
- 查询、读取、创建和重命名 CUNEFLOW 文件
- 上传当前对话中明确附加的本地文件
- 制作、验证和发布 CUNEFLOW SE05 屏保

## 本地验证

需要 Node.js 18 或更高版本：

```bash
npm test
```

当前 `0.1.0` 版本连接 CUNEFLOW 测试环境 MCP，用于安装、授权和功能链路验证。
