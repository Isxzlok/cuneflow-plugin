---
name: build-cune-screensavers
description: "Build, validate, publish, and deliver Web-based .cunesaver screensavers for Cune SE05. Use when creating Cune or CUNEFLOW sleep screens, lock-screen cards, static HTML packages, device-data screens, account publications, ADB deliveries, or SE05 test kits. Supports v1 static snapshots and v2 Schedule, continue-reading, and recent-meeting data; never substitute authoring-machine data. Do not use for SE03."
---

# CUNEFLOW Screensaver Production

Create responsive, fully offline Web content and use the bundled packaging script for deterministic builds, validation, and delivery.

## Workflow

1. Decide whether the request is static or needs device data. Read [references/format-v1.md](references/format-v1.md) for static content; read [references/format-v2.md](references/format-v2.md) for Schedule, continue-reading, or recent-meeting data.
2. When a request mentions calendars, schedules, reading activity, meetings, todos, summaries, or other personal data, read [references/data-boundary.md](references/data-boundary.md) before choosing any tool or source.
3. Create a project directory with `cunesaver.json`, one HTML entrypoint, and only local resources. Avoid network URLs, remote fonts, analytics, and APIs because the device runtime must work offline.
4. Keep `target` exactly `SE05`. Use `runtime: web` for v1 or `runtime: web-snapshot` for v2. List every packaged file explicitly in `include`.
5. Resolve `scripts/cunesaver.py` relative to this Skill directory. Build with `python3 <skill-dir>/scripts/cunesaver.py build <project-dir> -o <name>.cunesaver`; use `python` instead of `python3` on Windows.
6. Validate with the same wrapper: `python3 <skill-dir>/scripts/cunesaver.py validate <name>.cunesaver`. Treat any validation failure as blocking.
7. When the user wants the screen available on their account devices, read [references/cuneflow-publishing.md](references/cuneflow-publishing.md). Use the plugin's bundled attachment Helper with the authenticated CUNEFLOW MCP upload and publish tools; do not require `cuneflow-cli` or a second MCP Server.
8. For a connected device, read [references/adb-delivery.md](references/adb-delivery.md), then run the `push` command. Never use an emulator or a non-SE05 Android device as substitute proof.
9. When preparing a tester handoff, read [references/testkit-delivery.md](references/testkit-delivery.md), build the test kit, and verify it from a fresh extraction before sharing it.

Before building v2, state the selected source IDs, requested fields, maximum item count, refresh triggers, empty state, and the independent SE05 authorization switches the user must enable. If intent is ambiguous, ask instead of widening the data request.

## Content rules

- Use viewport-relative or responsive layout; the first format version does not promise a fixed pixel size.
- Keep the entrypoint self-contained and load only paths declared by `include`.
- Design for a screen that may remain visible for a long time. Avoid rapidly flashing content and unnecessary continuous animation.
- Preserve the source project next to its built artifact; treat `.cunesaver` as generated output.
- Rebuild and validate after every source change. Do not hand-edit the ZIP container.
- For v2, render only fields present in `window.cuneSaverData`, handle `ready`, `permission_denied`, and `unavailable`, then call `CuneSaverRenderer.ready()` after the final DOM is stable.

## Delivery boundary

Use `push --dry-run` while no SE05 is connected. A real push must pass model detection, device-side SHA-256 verification, device import, Web first-frame rendering, and the final `ready` state. Report package validation, device activation, and visible lock-screen acceptance separately. The sleep screen is a static rendered frame; Web animation does not continue while the e-ink device sleeps.

For CUNEFLOW account publishing, report local validation, server validation, user confirmation, and final publication as separate states. Never treat upload or prepare success as publication success.
