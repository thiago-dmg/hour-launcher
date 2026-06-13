import { describe, expect, test } from "vitest";
import { businessDaysBetween } from "../../src/allocation/date-range.js";

describe("businessDaysBetween", () => {
  test("returns weekdays for the last week of May 2026", () => {
    expect(businessDaysBetween("2026-05-25", "2026-05-31")).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29"
    ]);
  });

  test("returns weekdays from June 1 to June 12 2026", () => {
    expect(businessDaysBetween("2026-06-01", "2026-06-12")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12"
    ]);
  });
});
