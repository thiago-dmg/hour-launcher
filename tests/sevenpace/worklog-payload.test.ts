import { describe, expect, test } from "vitest";
import type { PlannedEntry } from "../../src/types/domain.js";
import { buildWorkLogPayloads } from "../../src/sevenpace/worklog-payload.js";

describe("buildWorkLogPayloads", () => {
  test("maps Daily to a 10:00 worklog with a 30 minute length", () => {
    const entries: PlannedEntry[] = [{
      date: "2026-06-10",
      label: "Daily",
      workItemId: 171055,
      minutes: 30,
      description: "Daily",
      category: "OPEX",
      source: "daily"
    }];

    expect(buildWorkLogPayloads(entries)).toEqual([{
      timestamp: "2026-06-10T10:00:00",
      length: 1800,
      workItemId: 171055,
      comment: "Daily"
    }]);
  });

  test("starts CAPEX immediately after Daily and converts minutes to seconds", () => {
    const entries: PlannedEntry[] = [
      {
        date: "2026-06-10",
        label: "Daily",
        workItemId: 171055,
        minutes: 30,
        description: "Daily",
        category: "OPEX",
        source: "daily"
      },
      {
        date: "2026-06-10",
        label: "US 173405",
        workItemId: 173405,
        minutes: 450,
        description: "CAPEX principal",
        category: "CAPEX",
        source: "remainder"
      }
    ];

    expect(buildWorkLogPayloads(entries)).toEqual([
      {
        timestamp: "2026-06-10T10:00:00",
        length: 1800,
        workItemId: 171055,
        comment: "Daily"
      },
      {
        timestamp: "2026-06-10T10:30:00",
        length: 27000,
        workItemId: 173405,
        comment: "CAPEX principal"
      }
    ]);
  });

  test("respects an explicit start minute when completing a partially logged day", () => {
    const entries: PlannedEntry[] = [{
      date: "2026-06-10",
      label: "US 173406",
      workItemId: 173406,
      minutes: 210,
      description: "Segunda US",
      category: "CAPEX",
      source: "remainder",
      startMinutes: 14 * 60 + 30
    }];

    expect(buildWorkLogPayloads(entries)).toEqual([{
      timestamp: "2026-06-10T14:30:00",
      length: 12600,
      workItemId: 173406,
      comment: "Segunda US"
    }]);
  });
});
