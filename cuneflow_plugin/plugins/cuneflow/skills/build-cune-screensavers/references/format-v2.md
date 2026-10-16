# `.cunesaver` v2 device-data format

Use v2 only when the screen needs one or more supported device sources. The CUNEFLOW AI Notebook runtime still produces a static PNG, then regenerates it when a declared source changes, the date changes where applicable, the device boots, or the snapshot expires. Keep the manifest `target` as `SE05` and `display_profile` as `se05-portrait-v1` for compatibility, but do not show those internal values to users.

Combine the common source-project fields in [format-v1.md](format-v1.md) (`id`, `name`, `version`, `entrypoint`, `include`) with these v2 manifest values:

```json
{
  "schema_version": 2,
  "target": "SE05",
  "runtime": "web-snapshot",
  "display_profile": "se05-portrait-v1",
  "data": {
    "sources": [{
      "id": "cuneflow.schedule.today",
      "version": 1,
      "required": false,
      "fields": ["title", "time_type", "start_at", "end_at", "status"],
      "params": {"limit": 3, "status": "open", "order": "start_asc"}
    }]
  },
  "refresh": {
    "triggers": ["on_apply", "source_changed", "day_changed", "device_booted"],
    "max_staleness_seconds": 900
  },
  "privacy": {
    "lock_screen_visibility": "personal",
    "fallback": "empty_state"
  }
}
```

Additional source declarations:

```json
{"id":"cuneflow.library.continue_reading","version":1,"required":false,"fields":["title","cover_asset","file_type","progress"],"params":{"limit":1,"min_progress":0.01,"order":"last_opened_desc"}}
```

```json
{"id":"cuneflow.meetings.recent","version":1,"required":false,"fields":["title","occurred_at"],"params":{"limit":3,"order":"occurred_desc"}}
```

For Library or Meetings, replace the Schedule source declaration with the corresponding declaration above. Request multiple sources only when the user asks for them.

Current limits:

- The three source IDs above support version 1 only; duplicate source IDs are rejected.
- `limit` is 1-5; `status` is `open` or `all`; `order` is `start_asc`.
- Allowed fields are exactly those shown above or a subset of them.
- Schedule description, handwriting, internal IDs, account, token, sync state, file path, URL, and arbitrary provider access are rejected.
- Library `limit` is 1-3, `min_progress` is 0-1, and `order` is `last_opened_desc`.
- Meetings `limit` is 1-3 and `order` is `occurred_desc`.
- The current internal build grants the three supported local sources by default and does not show permission switches in CUNEFLOW AI Notebook screen-saver settings. State the requested lock-screen-visible fields, but do not tell the user to enable Schedule, Reading, or Meetings in Settings and do not request a separate authorization confirmation when the request already names those categories. The runtime contract retains `permission_denied` for future policy changes or an explicitly disabled internal switch; a required source then blocks selection/update.

Runtime data is delivered as `window.cuneSaverData` and followed by a `cunesaver:data-ready` event. Handle these source states:

- `ready`: render `items`, including an intentional empty state when the list is empty.
- `permission_denied`: render the declared empty/fallback state and report that the runtime policy denied this source. The current internal Settings page has no user-facing switch, so do not direct the tester to a control that is not shown.
- `unavailable`: use a neutral unavailable state and do not invent content.

After DOM changes and local assets are complete, call:

```js
window.CuneSaverRenderer.ready();
```

The renderer rejects v2 pages that do not signal readiness within five seconds.

While the device is awake, automatic refresh work is persisted and coalesced after `SCREEN_OFF` to avoid interrupting the foreground app. This is a snapshot refresh contract, not a continuously running clock.

On the current CUNEFLOW AI Notebook runtime, each data source is observed independently and only refreshes a selected screen that declares that source. A `source_changed` event whose trimmed visible data is unchanged finishes without starting the renderer or rewriting the wallpaper. `day_changed`, `device_booted`, and `max_staleness` still render even when business items are unchanged because the page may display the current date or time.
