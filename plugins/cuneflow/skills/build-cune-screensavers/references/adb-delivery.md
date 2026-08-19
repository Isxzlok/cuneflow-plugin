# SE05 ADB delivery

Run a non-mutating preview first:

```bash
python3 scripts/cunesaver.py push <package.cunesaver> --dry-run
```

For a real device, confirm `adb devices -l` lists the intended serial, then run:

```bash
python3 scripts/cunesaver.py push <package.cunesaver> --serial <ADB_SERIAL>
```

The command validates the local package, requires an SE05 marker from `ro.cune.ota.product=SE05`, `ro.eink.model=SE05`, or `ro.product.firmware=SE05_V_*`, uploads to a temporary name, compares the device-side SHA-256, and atomically renames the file. It then starts the Settings importer. Settings passes only that validated package to the normal-UID renderer through a signature-protected read-only cache provider, receives the rendered PNG through the matching provider, applies both sleep wallpapers, and reports `ready`.

The authoritative first-version inbox is `/sdcard/Download/CuneSaver`. Override it only when the installed Settings runtime and the delivery command are updated together:

```bash
python3 scripts/cunesaver.py push <package.cunesaver> --serial <ADB_SERIAL> --remote-dir <confirmed-path>
```

Use `--no-activate` only for upload diagnostics. A normal successful command proves byte delivery plus device-side import, first-frame rendering, and wallpaper registration. It still does not replace a visible lock-screen check on the physical e-ink panel.

The SE05 runtime requires both the updated Settings app and the platform-signed `CuneSaver Renderer`. The renderer must not request `MANAGE_EXTERNAL_STORAGE`, shared-storage read/write permissions, or `WRITE_SETTINGS`.
