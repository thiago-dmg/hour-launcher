import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PlannedEntry } from "../../src/types/domain.js";

const sevenPaceFetch = vi.fn();
const frame = { url: () => "https://dotzmkt.timehub.7pace.com/monthly" };
const page = { frames: () => [frame] };

vi.mock("../../src/sevenpace/sevenpace-rest-client.js", () => ({
  sevenPaceFetch
}));

describe("createTimeEntries", () => {
  beforeEach(() => {
    sevenPaceFetch.mockReset();
    sevenPaceFetch
      .mockResolvedValueOnce({
        enabled: true,
        activityTypes: [
          { name: "Desenvolvimento", id: "dev-id" },
          { name: "Rituais Scrum", id: "scrum-id" }
        ],
        systemDefaultActivityTypeId: "dev-id"
      })
      .mockResolvedValue({ id: "created" });
  });

  test("creates worklogs through the 7pace REST API in order", async () => {
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
    const { createTimeEntries } = await import("../../src/sevenpace/time-entry-writer.js");

    await createTimeEntries(page as never, entries);

    expect(sevenPaceFetch).toHaveBeenCalledTimes(3);
    expect(sevenPaceFetch).toHaveBeenNthCalledWith(1, frame, "activityTypes");
    expect(sevenPaceFetch).toHaveBeenNthCalledWith(2, frame, "workLogs", {
      method: "POST",
      body: {
        timestamp: "2026-06-10T10:00:00",
        length: 1800,
        workItemId: 171055,
        comment: "Daily",
        activityTypeId: "scrum-id"
      }
    });
    expect(sevenPaceFetch).toHaveBeenNthCalledWith(3, frame, "workLogs", {
      method: "POST",
      body: {
        timestamp: "2026-06-10T10:30:00",
        length: 27000,
        workItemId: 173405,
        comment: "CAPEX principal",
        activityTypeId: "dev-id"
      }
    });
  });
});

describe("updateTimeEntryWorkItem", () => {
  beforeEach(() => {
    sevenPaceFetch.mockReset();
    sevenPaceFetch.mockResolvedValue({ id: "updated" });
  });

  test("patches only the work item id on an existing worklog", async () => {
    const { updateTimeEntryWorkItem } = await import("../../src/sevenpace/time-entry-writer.js");

    await updateTimeEntryWorkItem(page as never, "worklog-id", 173502);

    expect(sevenPaceFetch).toHaveBeenCalledWith(frame, "workLogs/worklog-id", {
      method: "PATCH",
      body: { workItemId: 173502 }
    });
  });
});
