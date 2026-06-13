import { describe, expect, test } from "vitest";
import { sevenPaceSelectors } from "../../src/sevenpace/selectors.js";

describe("sevenPaceSelectors", () => {
  test("finds the date input even when the 7pace field has no accessible date attributes", () => {
    expect(sevenPaceSelectors.datePicker).toContain(".add-time-date");
    expect(sevenPaceSelectors.datePicker).toContain("[role='combobox']");
  });

  test("supports the custom Type dropdown used by the 7pace form", () => {
    expect(sevenPaceSelectors.activityTypeDropdown).toContain("[Not Set]");
    expect(sevenPaceSelectors.activityTypeOption("Desenvolvimento")).toContain("Desenvolvimento");
  });

  test("supports the Monthly Add Time action when it is not rendered as a button", () => {
    expect(sevenPaceSelectors.addEntryButton).toContain("#btnAddCurrent");
  });

  test("targets a Monthly calendar day by date attributes", () => {
    expect(sevenPaceSelectors.monthlyDay("2026-05-25")).toBe(".month-calendar-column.selectable-day[data-y='2026'][data-m='5'][data-d='25']");
    expect(sevenPaceSelectors.monthlyDayAdd("2026-05-25")).toContain(".a-add");
  });
});
