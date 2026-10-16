# CUNEFLOW MCP publishing

Publish only a package that passed the bundled local `validate` command and is at most 20 MiB. Use a stable package `id` for updates; show any previous revision returned by the server. Dynamic packages declare device sources; do not query cloud meetings or schedules to embed personal data in the package.

## Safe workflow

1. Call `prepare_local_screensaver_publish` with the absolute `.cunesaver` path and a stable `idempotencyKey`.
2. The local CLI tool computes size and MD5, creates a server upload session, streams the original bytes directly to OSS, and calls `prepare_screensaver_publish`.
3. Present the returned operation (`CREATE` or `UPDATE`), package ID, name, version, schema version, dynamic source declarations, refresh settings, and previous revision when present.
4. Stop and wait for explicit user confirmation. Upload and prepare do not authorize publication.
5. After confirmation, call `apply_screensaver_publish` with the exact `sessionId` and `confirmationToken` returned by prepare.
6. Report the returned `screensaverId`, `revision`, and status.

Never call `create_screensaver_upload_session` manually when `prepare_local_screensaver_publish` is available. Never put package bytes or Base64 in MCP JSON. Reuse the same `idempotencyKey` when retrying the same local upload. If prepare reports `UPDATE`, make the replacement and revision change clear before asking for confirmation.

If authorization fails, ask the user to run `cuneflow login` again so the token includes `screensaver:write`, then reconnect the MCP client.


## After publication

A successful apply stores the screen in the account; it does not prove device download or selection. Follow [device-use.md](device-use.md) for same-account sync, selection, and troubleshooting. In previews, use CUNEFLOW AI Notebook as the device name and omit internal `target` and `display_profile` values.

If the confirmation expires, prepare again and show the refreshed preview. On retries of the same apply, reuse its session and confirmation token; do not create a second upload merely because a response was lost.
