# USB delivery for developers

Normal account delivery uses [cuneflow-publishing.md](cuneflow-publishing.md). Read this branch only for an explicit ADB/USB request.

## Tool compatibility

The bundled `scripts/cunesaver.pyz` supports v1/v2 build and validation, but its legacy ADB polling accepts only `ready`. Runtime 0.4.0 returns `added` for a newly imported screen, so the legacy push can time out after a successful import. Use the device team's complete 0.4.0 test kit and its `bin/push-screensaver.sh` for real USB delivery. Do not retry a legacy timeout blindly or describe it as a failed import without checking the device catalog.

The bundled `push --dry-run` remains suitable for local package/path inspection without connecting a device. Its `activate` output is a legacy field, not evidence of selection. The bundled tool has `--no-activate`; the newer SDK uses `--no-import` with that compatibility alias. Inspect the selected tool's help before using version-specific flags.

## Device result

The updated delivery tool verifies the supported device model, local package, device SHA-256, import, rendering, and catalog registration. The normal inbox is `/sdcard/Download/CuneSaver`; change it only with a matching runtime contract.

- `added`: imported into Settings; the current selection is unchanged. The user selects it in 设置 → 屏保.
- `ready`: the imported source was already selected and its current frame was updated.
- Upload-only success proves byte delivery, not import or rendering.

The renderer uses a private virtual display and does not depend on the physical screen being lit. Neither CLI success state is physical e-ink acceptance. Keep device identification internal and refer to CUNEFLOW AI Notebook in user-facing explanations.
