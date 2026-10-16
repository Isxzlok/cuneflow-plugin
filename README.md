# CUNEFLOW CLI 与 Plugin

- [`cuneflow_cli/`](cuneflow_cli/README.md)：独立命令行工具，Node.js 20+。
- [`cuneflow_plugin/`](cuneflow_plugin/README.md)：Codex 与 Claude 插件。

## 分支

| 目标分支 | 来源分支 | 插件 MCP 环境 |
| --- | --- | --- |
| `main` | `play_java/main` | 正式环境 |
| `test` | `play_java/test` | 测试环境 |

CLI 默认连接正式环境，测试时显式设置 `CUNEFLOW_ENV=test`。

## 安装插件

```bash
codex plugin marketplace add Isxzlok/cuneflow-plugin --ref main
codex plugin add cuneflow@cuneflow
```

仓库根目录的 `.agents/plugins/marketplace.json` 指向 `cuneflow_plugin/plugins/cuneflow`。

## 本地验证

```bash
npm --prefix cuneflow_cli ci
npm run check
npm test
```

## 迁移来源

当前分支 `main` 的代码来自 `ZechenLiu001/cuneiform_backend` 的 `main` 分支，提交 `a288f3cbd6067519a1e26a0778fdc57e0e80e684`。

`plays-java/cuneflow-cli/` → `cuneflow_cli/`；`plays-java/cuneflow-plugin/` → `cuneflow_plugin/`。
迁移同步调整了安装文档、测试中的相邻目录路径及 CI 路径。保留目标仓库原有历史；原仓库代码保留。
