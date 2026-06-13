# 7pace Browser-Authenticated API Design

## Goal

Replace fragile 7pace UI clicking with a browser-authenticated 7pace REST API adapter.

The browser remains useful for login and visual review, but the final write path must send HTTP requests with structured payloads derived from `PlannedEntry`. The normal user flow must not ask for manual capture or manual time entry.

## Approach

1. Open the authenticated 7pace Monthly page with the existing Playwright profile.
2. Locate the `timehub.7pace.com` frame and call the official 7pace REST CRUD API from that frame with `credentials: "include"`.
3. Use `GET /api/rest/me` as a safe session probe.
4. Use `GET /api/rest/workLogs` to read existing entries.
5. Use `POST /api/rest/workLogs?api-version=3.0` to create each missing entry.

## Boundaries

- The launch command generates hours automatically.
- The launch command must not require the user to click fields, select dates, open a plus button, or save a manual modal.
- The writer should be explicit and fail closed if REST authentication or required fields are missing.
- `launch-day` should not silently fall back to UI writes after an API failure.
- Work item IDs are still supplied by the existing allocation flow:
  - Daily: configured `defaults.dailyWorkItemId`.
  - CAPEX: automatically discovered active assigned User Story.

## Data Flow

`activities.local.json` -> allocation plan -> `PlannedEntry[]` -> API payload mapper -> 7pace internal write endpoint.

The mapper is responsible for:

- date
- duration in seconds
- start timestamp
- work item id
- comment
- activity type

For the default full-day plan, Daily starts at `10:00` and lasts `30` minutes. Remaining entries start after Daily, so the default CAPEX entry is `10:30` to `18:00`. The user's arrival time of `09:00` is not a worklog entry; it is only the anchor for the business day.

## Safety

The implementation must not persist cookies, bearer tokens, or browser session headers. The optional capture command can remain as a diagnostic tool, but it is not part of the normal launch flow.
