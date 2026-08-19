# CuneFlow screen data boundary

## Current capability

`.cunesaver` v1 packages local Web assets and renders one static frame. `.cunesaver` v2 implements three narrow device sources:

- `cuneflow.schedule.today`: today’s Schedule titles, time fields, and status.
- `cuneflow.library.continue_reading`: up to three recent reading titles, cached covers, file type, and progress.
- `cuneflow.meetings.recent`: up to three recent meeting titles and occurrence times.

Do not claim support for arbitrary calendars, arbitrary Library/Meeting fields, or arbitrary CuneFlow data.

Never use data from the authoring computer as a substitute for device data. In particular:

- Map “CuneFlow 日历”, “设备日历”, or a calendar requested for an SE05 screen to `cuneflow.schedule.today`, not macOS Calendar.
- Ask which calendar the user means when “我的日历” remains ambiguous.
- Do not open macOS Calendar, Google Calendar, local files, or unrelated integrations without an explicit request naming that source.
- Map “继续阅读”“最近读的书”“阅读进度” to `cuneflow.library.continue_reading`.
- Map “最近会议”“会议历史” to `cuneflow.meetings.recent` only when title and time are sufficient.
- Stop and explain the missing capability when summaries, todos, transcripts, recordings, handwriting, paths, URLs, identifiers, account data, tokens, or other undeclared fields are required.

## Static mock boundary

Use sample content only when the user explicitly asks for a visual mock or provides the exact content to freeze. Before building, state that:

- the values are static sample data;
- they will not follow device data changes;
- the SE05 will display the same values until a new package is rendered.

Do not label a mock as a dynamic or personalized screen.

## Implemented v2 capabilities

`cuneflow.schedule.today` can expose only requested subsets of `title`, `time_type`, `start_at`, `end_at`, and `status`. The device user controls a separate Schedule lock-screen switch. The Settings app reads and trims the data; the renderer never queries Calendar directly.

`cuneflow.library.continue_reading` can expose only requested subsets of `title`, `cover_asset`, `file_type`, and `progress`. `cover_asset` is a resized, one-render data image copied from an already cached cover; it is `null` when no safe cached cover exists. Paths, download URLs, server IDs, and sync state are never exposed.

`cuneflow.meetings.recent` can expose only requested subsets of `title` and `occurred_at`.

Each source has its own default-off SE05 lock-screen switch. One consent never authorizes another source. The Settings app reads and trims business data; the renderer never queries a business app directly.

The source-led contract and current implementation status live in `docs/product/cunesaver-v2-data-and-consumer-contract.md` in the SDK repository.
