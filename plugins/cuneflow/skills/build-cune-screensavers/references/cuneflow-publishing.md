# CUNEFLOW MCP publishing

Publish only a package that passed the bundled local `validate` command.

## Safe workflow

1. Call `prepare_local_screensaver_publish` with the absolute `.cunesaver` path and a stable `idempotencyKey`.
2. The local plugin upload helper computes size and MD5, creates a server upload session through the authenticated Remote MCP workflow, streams the original bytes directly to OSS, and calls `prepare_screensaver_publish`.
3. Present the returned operation (`CREATE` or `UPDATE`), package ID, name, version, schema version, dynamic source declarations, refresh settings, and previous revision when present.
4. Stop and wait for explicit user confirmation. Upload and prepare do not authorize publication.
5. After confirmation, call `apply_screensaver_publish` with the exact `sessionId` and `confirmationToken` returned by prepare.
6. Report the returned `screensaverId`, `revision`, and status.

Never call `create_screensaver_upload_session` manually when `prepare_local_screensaver_publish` is available. Never put package bytes or Base64 in MCP JSON. Reuse the same `idempotencyKey` when retrying the same local upload. If prepare reports `UPDATE`, make the replacement and revision change clear before asking for confirmation.

If authorization fails, use the current host's MCP connection or authorization interface to reconnect CUNEFLOW with `screensaver:write`. Do not require a plugin user to install or run `cuneflow-cli`.
