# Device runtime test kit

Use this reference only when the user requests firmware/runtime installation or device-level testing. Screen creation and account publication use the plugin's bundled packager and MCP; they do not require this kit.

Obtain the device team's complete `cune-screensaver-se05-testkit-0.4.0` ZIP and its published SHA-256. The handoff Skill directory alone contains neither APKs nor a standalone replacement SDK. Verify the ZIP hash and extracted checksums before running its scripts.

1. Connect and unlock a supported CUNEFLOW AI Notebook with USB debugging enabled.
2. Run the kit's `bin/preflight.sh`, and explain its failures/warnings before modifying the device.
3. For a full runtime install, explain the four app updates (Settings, Renderer, Reading, Cuneiform) and use `bin/install-for-test.sh` within the user's authorized scope. Preserve app data using replacement installs. Static-only installations may use `bin/install-runtime.sh`.
4. For data-backed samples, state the source and exact lock-screen-visible fields. The current internal runtime hides source switches and grants its supported sources by default; the user's request for a category supplies intent for that category.
5. Push the requested sample using `bin/push-screensaver.sh`. Interpret `added` and `ready` as described in [adb-delivery.md](adb-delivery.md), and use `bin/diagnose.sh` for failures.
6. Verify the physical panel in normal and USB-charging sleep. For dynamic refresh regression, check that foreground use is not interrupted and pending updates render after screen-off.

Charging-overlay acceptance additionally requires visible attach, in-place update, detach, and re-attach. A temporary framework mount is not proof of OTA/reboot persistence. Keep these device-team acceptance checks separate from account publication; do not repeat another device's handoff results as evidence for this test device.
