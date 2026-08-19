# `.cunesaver` v2 device-data format

Use v2 only when the screen needs one or more supported device sources. The SE05 runtime still produces a static PNG, then regenerates it when a declared source changes, the date changes where applicable, the device boots, or the snapshot expires.

Start from `examples/schedule-today`. Required manifest values:

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

Start Library and Meeting screens from `examples/continue-reading` and `examples/recent-meetings`.

Current limits:

- The three source IDs above support version 1 only; duplicate source IDs are rejected.
- `limit` is 1-5; `status` is `open` or `all`; `order` is `start_asc`.
- Allowed fields are exactly those shown above or a subset of them.
- Schedule description, handwriting, internal IDs, account, token, sync state, file path, URL, and arbitrary provider access are rejected.
- Library `limit` is 1-3, `min_progress` is 0-1, and `order` is `last_opened_desc`.
- Meetings `limit` is 1-3 and `order` is `occurred_desc`.
- The user must enable each requested source separately in SE05 screen-saver settings. A non-required source returns `permission_denied`; a required source blocks activation.

Runtime data is delivered as `window.cuneSaverData` and followed by a `cunesaver:data-ready` event. Handle these source states:

- `ready`: render `items`, including an intentional empty state when the list is empty.
- `permission_denied`: explain which matching source access can be enabled in Settings.
- `unavailable`: use a neutral unavailable state and do not invent content.

After DOM changes and local assets are complete, call:

```js
window.CuneSaverRenderer.ready();
```

The renderer rejects v2 pages that do not signal readiness within five seconds.
