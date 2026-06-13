import { describe, expect, test } from "vitest";
import { buildEntrySchedule, buildWorkItemOptionSelector, formatDateForSevenPace, validateFilledEntryForm } from "../../src/sevenpace/time-entry-writer.js";
import type { PlannedEntry } from "../../src/types/domain.js";

const entry: PlannedEntry = {
  date: "2026-06-10",
  label: "US 172980",
  workItemId: 172980,
  minutes: 450,
  description: "US 172980",
  category: "CAPEX",
  source: "remainder"
};

describe("validateFilledEntryForm", () => {
  test("fails before saving when a visible field did not keep the intended value", () => {
    expect(() =>
      validateFilledEntryForm(
        {
          workItem: "172980",
          date: "6/10/2026",
          duration: "",
          from: "10:30 AM",
          to: "6:00 PM",
          activityType: "Desenvolvimento",
          description: "US 172980"
        },
        entry,
        "Desenvolvimento"
      )
    ).toThrow("Duration nao foi preenchido");
  });

  test("accepts the expected values before save", () => {
    expect(() =>
      validateFilledEntryForm(
        {
          workItem: "US 172980",
          date: "6/10/2026",
          duration: "7:30",
          from: "10:30 AM",
          to: "6:00 PM",
          activityType: "Desenvolvimento",
          description: "US 172980"
        },
        entry,
        "Desenvolvimento"
      )
    ).not.toThrow();
  });
});

describe("7pace date and time formatting", () => {
  test("formats the activity file date for the 7pace date input", () => {
    expect(formatDateForSevenPace("2026-06-10")).toBe("6/10/2026");
  });

  test("schedules daily from 10:00 AM to 10:30 AM", () => {
    expect(buildEntrySchedule({ ...entry, source: "daily", minutes: 30 })).toEqual({
      from: "10:00 AM",
      to: "10:30 AM"
    });
  });

  test("schedules remainder work from 10:30 AM to 6:00 PM", () => {
    expect(buildEntrySchedule(entry)).toEqual({
      from: "10:30 AM",
      to: "6:00 PM"
    });
  });
});

describe("7pace work item autocomplete", () => {
  test("targets the autocomplete option by visible work item id", () => {
    expect(buildWorkItemOptionSelector(171055)).toContain(":has-text('#171055')");
  });
});
