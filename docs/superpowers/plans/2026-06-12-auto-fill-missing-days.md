# Auto Fill Missing Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a batch launch command that fills every missing weekday from the activities file start date through today.

**Architecture:** Extract date range generation into a small pure module. Reuse the existing browser-authenticated 7pace REST reader/writer and allocation logic per date. The batch command opens one browser context, discovers CAPEX work items once, then processes each weekday sequentially and skips days that already total 8h.

**Tech Stack:** TypeScript, Commander, Playwright, Vitest, existing 7pace REST adapter.

---

### Task 1: Date Range Helper

**Files:**
- Create: `src/allocation/date-range.ts`
- Test: `tests/allocation/date-range.test.ts`

- [ ] Add `businessDaysBetween(startDate, endDate)` that returns ISO weekdays inclusive.
- [ ] Verify May 25-31, 2026 returns May 25-29 and skips May 30-31.
- [ ] Verify June 1-12, 2026 returns June 1-5 and June 8-12.

### Task 2: Multi-CAPEX Planning

**Files:**
- Modify: `src/allocation/allocation-engine.ts`
- Test: `tests/allocation/allocation-engine.test.ts`

- [ ] Add `planDayWithCapexPool` that accepts active CAPEX work items.
- [ ] For a normal empty day, create Daily 30min and one CAPEX 450min.
- [ ] When existing entries already have 240min in first CAPEX work item, complete the remaining 210min with the next CAPEX work item.

### Task 3: Batch Command

**Files:**
- Create: `src/cli/commands/launch-missing-days.ts`
- Modify: `src/cli/index.ts`
- Modify: `package.json`
- Test: `tests/cli/launch-missing-days.test.ts`

- [ ] Add CLI `launch-missing-days --activities <path> --yes`.
- [ ] Read `activities.date` as the inclusive start date.
- [ ] Use today's local date as the inclusive end date by default.
- [ ] For each business day, read existing 7pace entries, skip when total is 480, plan missing entries, write with API, validate final total.
- [ ] Register package script `launch-missing-days`.

### Task 4: Verification

**Files:**
- No production file changes.

- [ ] Run focused tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the batch command once against the configured start date and verify it skips May 25 and writes/validates remaining weekdays.
