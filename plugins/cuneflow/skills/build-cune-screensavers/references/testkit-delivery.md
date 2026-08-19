# SE05 internal test kit

Build a test kit only from the platform-signed Settings and CuneSaver Renderer APKs that passed the current SE05 runtime build.

```bash
python3 scripts/build_testkit.py \
  --settings-apk <setting-platform-signed.apk> \
  --renderer-apk <cunesaver-renderer-platform-signed.apk> \
  --reading-apk <reading-platform-signed.apk> \
  --cuneiform-apk <cuneiform-platform-signed.apk>
```

The builder must block delivery when:

- either APK is missing or cannot be verified by `apksigner`;
- any of the four APK signing certificate digests differ;
- application IDs differ from `com.wisky.setting.se01` and `com.cune.screensaver.renderer`;
- the renderer requests shared-storage, all-files, network, or system-settings write permissions.
- the bundled `build-cune-screensavers` Skill is missing its `SKILL.md`, agent metadata, or CLI wrapper.

Before sharing the ZIP:

1. Extract it into a fresh temporary directory.
2. Confirm `checksums.txt` passes.
3. Run the bundled `tools/cunesaver.pyz validate` on the sample package.
4. Run the bundled `push --dry-run` path.
5. Confirm all five scripts expose working `--help` output and retain executable bits.
6. Confirm `skills/build-cune-screensavers/` exists, passes Skill validation, and its CLI wrapper can validate the sample from the extracted kit.

Give testers the ZIP, not the repository or build worktree. Creators install the bundled Skill with `bin/install-skill.sh`; device-only testers may skip it. Tell testers to run `bin/install-runtime.sh` once, then use `bin/push-screensaver.sh`. `bin/install-data-providers.sh` is a separate, explicit business-app update and must never run implicitly. Keep visible e-ink panel acceptance separate from the CLI `ready` result because an asleep SE05 returns a black Android framebuffer screenshot.
