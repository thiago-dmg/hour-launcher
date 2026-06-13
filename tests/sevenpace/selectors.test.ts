import { describe, expect, test } from "vitest";
import { sevenPaceSelectors } from "../../src/sevenpace/selectors.js";

describe("sevenPaceSelectors", () => {
  test("targets a day cell on the monthly calendar", () => {
    expect(sevenPaceSelectors.monthlyDay("2026-05-25")).toBe(".month-calendar-column.selectable-day[data-y='2026'][data-m='5'][data-d='25']");
  });

  test("targets the visible Add Time action for review mode", () => {
    expect(sevenPaceSelectors.addEntryButton).toContain("Add Time");
  });
});
