try {
  console.log([
    "",
    "  CUNEFLOW CLI installed.",
    "",
    "  Next step (required):  cuneflow setup",
    "  It logs you in (opens the browser) and connects your AI clients",
    "  (Codex / Claude Code) automatically.",
    ""
  ].join("\n"));
} catch {
  // 安装提示失败不应导致 npm install 失败。
}
process.exit(0);
