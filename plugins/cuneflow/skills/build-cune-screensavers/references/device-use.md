# Account delivery to CUNEFLOW AI Notebook

These device behaviors follow the 0.4.0 handoff. Assume a compatible runtime is installed for normal use; device installation is a separate task.

## After successful publication

1. Tell the user the screen is published to their account, with its name and revision.
2. Have the device signed into the same CUNEFLOW account and connected to the network.
3. Open Settings → Screensaver (设置 → 屏保), or manually refresh that page to sync.
4. Select the new screen. New entries do not replace the current selection. Updates to the same screen are downloaded automatically; if that screen is selected, its current frame can update.
5. If verifying the full flow, have the user observe the physical e-ink panel in sleep. Account publication, catalog presence, and visible display are separate results.

## Sync and management

- Sync runs on login/boot, opening the screensaver page, manual refresh, network recovery, and account change. There is no fixed periodic background polling. Network retries back off through 5 seconds, 30 seconds, 2 minutes, and 10 minutes; manual refresh bypasses that wait.
- The device allows 10 custom screens, excluding its two built-in screens. Existing entries can still update at capacity. Do not describe this as a verified server-side quota.
- Deleting a cloud screen on a device permanently removes it from the account and affects all devices using that account. The device clears its local copy only after the server confirms deletion; on failure it retains the content and current display. Explain this scope before helping with deletion; a capacity error is not authorization to delete anything.
- Logout/account switching clears the previous account's cloud screens from that device, preserving locally imported screens. If the selected screen is removed, the device returns to the default. Returning to the account downloads its screens again without taking over the current selection.
- Devices share the account list but each device has its own selection.

For “published but missing”, check the account, connection, and a settings-page refresh first. For “listed but not showing”, check selection. For dynamic-data refresh expectations, read [format-v2.md](format-v2.md).
