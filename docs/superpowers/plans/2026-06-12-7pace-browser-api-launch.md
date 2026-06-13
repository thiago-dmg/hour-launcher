# 7pace Browser API Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run launch-day -- --activities config/activities.local.json --yes` launch 7pace worklogs automatically through the 7pace REST API using the authenticated browser session.

**Architecture:** Keep Playwright only for authentication and frame access. Add a focused REST writer that runs `fetch` inside the 7pace frame and maps `PlannedEntry` values into `workLogs` payloads. Keep UI clicking out of the launch path.

**Tech Stack:** TypeScript, Playwright, Vitest, 7pace REST CRUD API v3.

---

### Task 1: API Payload Mapping

**Files:**
- Create: `src/sevenpace/worklog-payload.ts`
- Test: `tests/sevenpace/worklog-payload.test.ts`

- [ ] Write tests that verify Daily maps to `2026-06-10T10:00:00`, `length: 1800`, `workItemId: 171055`, `comment: "Daily"`.
- [ ] Write tests that verify the following CAPEX entry starts after Daily at `2026-06-10T10:30:00`, lasts `27000` seconds, and keeps its work item id.
- [ ] Implement `buildWorkLogPayloads(entries)` with deterministic sequential start times beginning at `10:00`.

### Task 2: Browser REST Client

**Files:**
- Create: `src/sevenpace/sevenpace-rest-client.ts`
- Test: `tests/sevenpace/sevenpace-rest-client.test.ts`

- [ ] Write tests for `buildSevenPaceRestUrl(origin, path, params)` returning `${origin}/api/rest/workLogs?api-version=3.0`.
- [ ] Write tests for response parsing: successful `{ data: ... }` returns data; non-2xx responses throw with status and body text.
- [ ] Implement `sevenPaceFetch(frame, path, options)` using `frame.evaluate` and `fetch(..., credentials: "include")`.

### Task 3: API Writer Integration

**Files:**
- Modify: `src/sevenpace/time-entry-writer.ts`
- Test: `tests/sevenpace/time-entry-writer.test.ts`

- [ ] Replace the default writer path with REST API calls.
- [ ] Keep the old UI writer unavailable from `launch-day`.
- [ ] Write tests that `createTimeEntries(page, entries)` calls the REST client once per payload in order.

### Task 4: Existing Entry Reader via API

**Files:**
- Modify: `src/sevenpace/time-entry-reader.ts`
- Test: `tests/sevenpace/time-entry-reader.test.ts`

- [ ] Add an API reader using `GET /workLogs` with `$fromTimestamp`, `$toTimestamp`, `$count`.
- [ ] Parse returned `length` seconds into minutes and `workItemId` into the existing summary shape.
- [ ] Keep a clear error when the REST endpoint rejects the browser session.

### Task 5: Launch Command Cleanup

**Files:**
- Modify: `src/cli/commands/launch-day.ts`
- Test: `tests/cli/launch-day.test.ts`

- [ ] Change the loop from `createTimeEntry(page, entry)` to `createTimeEntries(page, launchPlan.entries)`.
- [ ] Stop waiting forever for page close after success in non-headless mode; print that the browser can be reviewed and close the context.
- [ ] Preserve run logs and final total validation.

### Task 6: Verification

**Files:**
- No production file changes.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run a safe `GET /api/rest/me` probe through the browser session.
- [ ] Only after read probe succeeds, run `launch-day` once for the configured date.
