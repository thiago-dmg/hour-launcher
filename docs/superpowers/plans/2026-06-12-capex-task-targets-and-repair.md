# CAPEX Task Targets and Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use child Tasks, not parent User Stories, as CAPEX 7pace targets and repair existing US-targeted worklogs.

**Architecture:** Extend the browser-authenticated Azure DevOps service to fetch child Tasks for active assigned User Stories ordered by CreatedDate. Feed that Task list into the existing planning pool. Add 7pace PATCH support and a repair command that updates CAPEX worklogs whose work item is a parent US to the next eligible child Task.

**Tech Stack:** TypeScript, Commander, Playwright browser fetch, 7pace REST API v3, Vitest.

---

### Task 1: Discover Child Tasks

**Files:**
- Modify: `src/azure-devops/browser-work-item-service.ts`
- Test: `tests/azure-devops/browser-work-item-service.test.ts`

- [ ] Add pure helpers to extract child IDs from expanded work item relations.
- [ ] Add pure helper to sort Tasks by `System.CreatedDate`, then by id.
- [ ] Add `findChildTasksForUserStoriesFromBrowser(page, config, userStories)`.

### Task 2: Use Tasks in Batch Planning

**Files:**
- Modify: `src/cli/commands/launch-missing-days.ts`
- Test: `tests/cli/launch-missing-days.test.ts`

- [ ] Change CAPEX pool to child Tasks from active User Stories.
- [ ] Keep manual `--capex-work-item-id` as fallback.
- [ ] Fail clearly when no child Task is found.

### Task 3: Patch 7pace Worklogs

**Files:**
- Modify: `src/sevenpace/time-entry-reader.ts`
- Modify: `src/sevenpace/time-entry-writer.ts`
- Test: `tests/sevenpace/time-entry-api-writer.test.ts`

- [ ] Include timestamp in `ExistingTimeEntry`.
- [ ] Add `updateTimeEntryWorkItem(page, entryId, workItemId)` using `PATCH workLogs/{id}`.

### Task 4: Repair Command

**Files:**
- Create: `src/cli/commands/repair-capex-task-targets.ts`
- Modify: `src/cli/index.ts`
- Modify: `package.json`
- Test: `tests/cli/repair-capex-task-targets.test.ts`

- [ ] Add `repair-capex-task-targets --activities <path> --yes`.
- [ ] Generate business days from activity start date through today.
- [ ] For each CAPEX worklog targeting a parent US, patch it to the next child Task.
- [ ] Keep Daily entries untouched.

### Task 5: Verification

**Files:**
- No production file changes.

- [ ] Run focused tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run repair command once and then re-run it to verify idempotency.
