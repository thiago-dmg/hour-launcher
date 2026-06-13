import { beforeEach, describe, expect, test, vi } from "vitest";

const sevenPaceFetch = vi.fn();
const frame = { url: () => "https://dotzmkt.timehub.7pace.com/monthly" };
const page = { frames: () => [frame] };

vi.mock("../../src/sevenpace/sevenpace-rest-client.js", () => ({
  sevenPaceFetch
}));

describe("readEntriesForDate", () => {
  beforeEach(() => {
    sevenPaceFetch.mockReset();
  });

  test("reads current user worklogs through the 7pace REST API", async () => {
    sevenPaceFetch.mockResolvedValueOnce([
      {
        id: "abc",
        timestamp: "2026-06-10T10:00:00",
        length: 1800,
        workItemId: 171055,
        comment: "Daily"
      },
      {
        id: "def",
        timestamp: "2026-06-10T10:30:00",
        length: 27000,
        workItemId: 173405,
        comment: "CAPEX"
      }
    ]);
    const { readEntriesForDate } = await import("../../src/sevenpace/time-entry-reader.js");

    await expect(readEntriesForDate(page as never, "2026-06-10")).resolves.toEqual([
      { id: "abc", date: "2026-06-10", workItemId: 171055, minutes: 30, description: "Daily", timestamp: "2026-06-10T10:00:00" },
      { id: "def", date: "2026-06-10", workItemId: 173405, minutes: 450, description: "CAPEX", timestamp: "2026-06-10T10:30:00" }
    ]);
    expect(sevenPaceFetch).toHaveBeenCalledWith(frame, "workLogs", {
      query: {
        "$fromTimestamp": "2026-06-10T00:00:00",
        "$toTimestamp": "2026-06-11T00:00:00",
        "$count": "500"
      }
    });
  });
});
