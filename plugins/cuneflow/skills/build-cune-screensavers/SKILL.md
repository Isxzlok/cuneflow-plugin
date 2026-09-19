---
name: build-cune-screensavers
description: "Build, validate, publish, and deliver Web-based .cunesaver screensavers for CUNEFLOW AI Notebook. Use when creating Cune or CUNEFLOW sleep screens, lock-screen cards, static HTML packages, device-data screens, account publications, ADB deliveries, or device test kits. Supports v1 static snapshots and v2 Schedule, continue-reading, and recent-meeting data; never substitute authoring-machine data. Do not use for SE03."
---

# CUNEFLOW Screensaver Production

Create responsive, fully offline Web content for the device runtime described in handoff 0.4.0. Use account publishing for normal delivery; device firmware installation and ADB are separate developer workflows.

## Workflow

1. Decide whether the request is static or needs device data. Read [references/format-v1.md](references/format-v1.md) for static content; read [references/format-v2.md](references/format-v2.md) for Schedule, continue-reading, or recent-meeting data.
2. When a request mentions calendars, schedules, reading activity, meetings, todos, summaries, or other personal data, read [references/data-boundary.md](references/data-boundary.md) before choosing any tool or source.
3. Create a project directory with `cunesaver.json`, one HTML entrypoint, and only local resources. Avoid network URLs, remote fonts, analytics, and APIs because the device runtime must work offline.
4. Keep `target` exactly `SE05` for compatibility; use CUNEFLOW AI Notebook in user-facing explanations instead of internal target/display-profile identifiers. Use `runtime: web` for v1 or `runtime: web-snapshot` for v2. List every packaged file explicitly in `include`.
5. Resolve `scripts/cunesaver.py` relative to this Skill directory. Build with `python3 <skill-dir>/scripts/cunesaver.py build <project-dir> -o <name>.cunesaver`; use `python` instead of `python3` on Windows.
6. Validate with the same wrapper: `python3 <skill-dir>/scripts/cunesaver.py validate <name>.cunesaver`. Treat any validation failure as blocking.
7. When the user wants the screen available on their account devices, read [references/cuneflow-publishing.md](references/cuneflow-publishing.md). Use the plugin's bundled attachment Helper with the authenticated CUNEFLOW MCP upload and publish tools; do not require `cuneflow-cli` or a second MCP Server.
8. After publication, read [references/device-use.md](references/device-use.md) and guide the user through same-account sync and selection in Settings. For an explicit USB delivery request, read [references/adb-delivery.md](references/adb-delivery.md) first; the bundled legacy ADB command is not compatible with the new import states.
9. Only when the user requests device runtime installation or a developer test kit, read [references/testkit-delivery.md](references/testkit-delivery.md). Routine creation and account publication do not require APKs or USB debugging.

Before building v2, explain the selected data categories, lock-screen-visible fields, maximum item count, refresh triggers, and empty state. The 0.4.0 internal runtime allows the three supported sources by default and hides per-source switches. A request naming a category already supplies intent for that category; ask only when the source or fields are ambiguous. See [references/data-boundary.md](references/data-boundary.md) for the data boundary.

## Content rules

- Use viewport-relative or responsive layout; the first format version does not promise a fixed pixel size.
- Keep the entrypoint self-contained and load only paths declared by `include`.
- Design for a screen that may remain visible for a long time. Avoid rapidly flashing content and unnecessary continuous animation.
- Preserve the source project next to its built artifact; treat `.cunesaver` as generated output.
- Rebuild and validate after every source change. Do not hand-edit the ZIP container.
- For v2, render only fields present in `window.cuneSaverData`, handle `ready`, `permission_denied`, and `unavailable`, then call `CuneSaverRenderer.ready()` after the final DOM is stable.

## Delivery boundary

Separate package validation, account publication, device sync/import, user selection, and visible lock-screen acceptance. Device `added` means catalog import without changing the selection; `ready` means an already selected source was updated. Neither state proves the physical panel result. The sleep screen is a static rendered frame; Web animation does not continue while the device sleeps.

For CUNEFLOW account publishing, report local validation, server validation, user confirmation, and final publication as separate states. Never treat upload or prepare success as publication success.
