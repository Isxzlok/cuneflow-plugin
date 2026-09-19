# CUNEFLOW MCP publishing

Publish only a package that passed the bundled local `validate` command and is at most 20 MiB. Use a stable package `id` for updates; show any previous revision returned by the server. Dynamic packages declare device sources; do not query cloud meetings or schedules to embed personal data in the package.

## Safe workflow

1. Resolve `../../scripts/attachment-helper.mjs` relative to the plugin's `skills/build-cune-screensavers/` directory.
2. Run `node <helper> inspect-screensaver <absolute-cunesaver-path>` and retain the returned name, size, and Base64 MD5 metadata. Do not place package bytes in model context or MCP JSON.
3. Call `create_screensaver_upload_session` with `fileName`, `sizeBytes`, `contentMd5`, and a stable `idempotencyKey`.
4. Run `node <helper> put-screensaver <absolute-cunesaver-path>` and pass the returned `uploadUrl`, `method`, `headers`, and the inspected file metadata as `expected` through standard input. Do not log or persist the full presigned URL.
5. Only after the Helper reports a successful PUT, call `prepare_screensaver_publish` with the returned `sessionId`.
6. Present the returned operation (`CREATE` or `UPDATE`), package ID, name, version, schema version, dynamic source declarations, refresh settings, and previous revision when present.
7. Stop and wait for explicit user confirmation. Upload and prepare do not authorize publication.
8. After confirmation, call `apply_screensaver_publish` with the exact `sessionId` and `confirmationToken` returned by prepare.
9. Report the returned `screensaverId`, `revision`, and status.

Never put package bytes or Base64 in MCP JSON. Reuse the same `idempotencyKey` when retrying the same local upload. If the Helper PUT fails, do not call prepare. If prepare reports `UPDATE`, make the replacement and revision change clear before asking for confirmation.

If authorization fails, use the current host's MCP connection or authorization interface to reconnect CUNEFLOW with `screensaver:write`. Do not require a plugin user to install or run `cuneflow-cli`.


## After publication

A successful apply stores the screen in the account; it does not prove device download or selection. Follow [device-use.md](device-use.md) for same-account sync, selection, and troubleshooting. In previews, use CUNEFLOW AI Notebook as the device name and omit internal `target` and `display_profile` values.

If the confirmation expires, prepare again and show the refreshed preview. On retries of the same apply, reuse its session and confirmation token; do not create a second upload merely because a response was lost.
