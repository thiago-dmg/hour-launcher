import { beforeEach, describe, expect, test, vi } from "vitest";

const closeContext = vi.fn();
const createTimeEntries = vi.fn();
const readEntriesForDate = vi.fn();
const writeRunLog = vi.fn();

vi.mock("../../src/config/config-loader.js", () => ({
  loadConfig: vi.fn(async () => ({
    sevenPace: { baseUrl: "https://example.test", mode: "playwright", headless: false },
    time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
    defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
    duplicatePolicy: { sameDateSameWorkItem: "update", allowMultipleEntriesSameWorkItem: false, validateFinalTotal: true },
    azureDevOps: { orgUrl: "https://example.test", project: "Test", authMethod: "azure-cli", defaultTeam: null },
    opexRules: {}
  })),
  loadActivityFile: vi.fn(async () => ({ date: "2026-05-25", activities: [] }))
}));

vi.mock("../../src/azure-devops/browser-work-item-service.js", () => ({
  findChildTasksForUserStoriesFromBrowser: vi.fn(async () => [
    { id: 173502, title: "Task antiga", state: "Done", workItemType: "Task", parentId: 173405 },
    { id: 173503, title: "Task nova", state: "Done", workItemType: "Task", parentId: 173405 }
  ]),
  findActiveAssignedUserStoriesFromBrowser: vi.fn(async () => [
    { id: 173405, title: "Primeira US", state: "Active", workItemType: "User Story" },
    { id: 173406, title: "Segunda US", state: "Active", workItemType: "User Story" }
  ])
}));

vi.mock("../../src/sevenpace/sevenpace-playwright.js", () => ({
  closeExistingSevenPaceProfileProcesses: vi.fn(async () => undefined),
  SevenPacePlaywright: vi.fn().mockImplementation(() => ({
    openTimesheet: vi.fn(async () => ({
      context: { close: closeContext },
      page: { id: "page" }
    }))
  }))
}));

vi.mock("../../src/sevenpace/time-entry-reader.js", () => ({
  readEntriesForDate
}));

vi.mock("../../src/sevenpace/time-entry-writer.js", () => ({
  createTimeEntries
}));

vi.mock("../../src/storage/run-log-store.js", () => ({
  writeRunLog
}));

describe("launch-missing-days command", () => {
  const writtenDates = new Set<string>();

  beforeEach(() => {
    writtenDates.clear();
    closeContext.mockClear();
    createTimeEntries.mockClear();
    readEntriesForDate.mockReset();
    writeRunLog.mockClear();
    readEntriesForDate.mockImplementation(async (_page, date: string) => {
      if (date === "2026-05-25") {
        return [{ workItemId: 173405, minutes: 480, description: "Completo" }];
      }

      if (writtenDates.has(date)) {
        return [
          { workItemId: 171055, minutes: 30, description: "Daily" },
          { workItemId: 173405, minutes: 450, description: "Primeira US" }
        ];
      }

      return [];
    });
    createTimeEntries.mockImplementation(async (_page, entries: Array<{ date: string }>) => {
      writtenDates.add(entries[0].date);
    });
  });

  test("skips completed weekdays and launches missing weekdays through today", async () => {
    const { buildLaunchMissingDaysCommand } = await import("../../src/cli/commands/launch-missing-days.js");

    await buildLaunchMissingDaysCommand().parseAsync([
      "node",
      "test",
      "--activities",
      "config/activities.local.json",
      "--until",
      "2026-05-26",
      "--yes"
    ]);

    expect(readEntriesForDate).toHaveBeenCalledTimes(3);
    expect(readEntriesForDate).toHaveBeenNthCalledWith(1, { id: "page" }, "2026-05-25");
    expect(readEntriesForDate).toHaveBeenNthCalledWith(2, { id: "page" }, "2026-05-26");
    expect(readEntriesForDate).toHaveBeenNthCalledWith(3, { id: "page" }, "2026-05-26");
    expect(createTimeEntries).toHaveBeenCalledTimes(1);
    expect(createTimeEntries.mock.calls[0][1].map((entry: { workItemId: number; minutes: number }) => [entry.workItemId, entry.minutes])).toEqual([
      [171055, 30],
      [173502, 450]
    ]);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  test("does not reuse a CAPEX task that was already logged on a previous day", async () => {
    const { selectUnusedCapexWorkItems } = await import("../../src/cli/commands/launch-missing-days.js");

    expect(selectUnusedCapexWorkItems([
      { id: 173500, title: "Ja usada", state: "Done", workItemType: "Task" },
      { id: 173501, title: "Livre", state: "Done", workItemType: "Task" }
    ], new Set([173500])).map((item) => item.id)).toEqual([173501]);
  });
});
