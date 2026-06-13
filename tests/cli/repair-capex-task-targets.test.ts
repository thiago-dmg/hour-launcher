import { beforeEach, describe, expect, test, vi } from "vitest";

const closeContext = vi.fn();
const readEntriesForDate = vi.fn();
const updateTimeEntryWorkItem = vi.fn();

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
  findActiveAssignedUserStoriesFromBrowser: vi.fn(async () => [
    { id: 173405, title: "US", state: "Active", workItemType: "User Story" }
  ]),
  findChildTasksForUserStoriesFromBrowser: vi.fn(async () => [
    { id: 173502, title: "Task antiga", state: "Done", workItemType: "Task", parentId: 173405 }
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
  updateTimeEntryWorkItem
}));

describe("repair-capex-task-targets command", () => {
  beforeEach(() => {
    closeContext.mockClear();
    readEntriesForDate.mockReset();
    updateTimeEntryWorkItem.mockClear();
    readEntriesForDate.mockResolvedValue([
      { id: "daily-id", date: "2026-05-25", workItemId: 171055, minutes: 30, description: "Daily" },
      { id: "capex-id", date: "2026-05-25", workItemId: 173405, minutes: 450, description: "US" }
    ]);
  });

  test("patches US-targeted CAPEX worklogs to child Tasks", async () => {
    const { buildRepairCapexTaskTargetsCommand } = await import("../../src/cli/commands/repair-capex-task-targets.js");

    await buildRepairCapexTaskTargetsCommand().parseAsync([
      "node",
      "test",
      "--activities",
      "config/activities.local.json",
      "--until",
      "2026-05-25",
      "--yes"
    ]);

    expect(updateTimeEntryWorkItem).toHaveBeenCalledTimes(1);
    expect(updateTimeEntryWorkItem).toHaveBeenCalledWith({ id: "page" }, "capex-id", 173502);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  test("moves duplicated Task worklogs to unused child Tasks", async () => {
    const { buildCapexTaskRepairActions } = await import("../../src/cli/commands/repair-capex-task-targets.js");

    expect(buildCapexTaskRepairActions({
      entries: [
        { id: "may-27", date: "2026-05-27", workItemId: 173500, minutes: 450, description: "CAPEX" },
        { id: "jun-10", date: "2026-06-10", workItemId: 173500, minutes: 450, description: "CAPEX" }
      ],
      tasks: [
        { id: 173500, title: "Task usada", state: "Done", workItemType: "Task", parentId: 173405 },
        { id: 173501, title: "Task livre", state: "Done", workItemType: "Task", parentId: 173405 }
      ],
      userStoryIds: new Set([173405]),
      dailyWorkItemId: 171055
    })).toEqual([
      { entryId: "jun-10", fromWorkItemId: 173500, toWorkItemId: 173501, date: "2026-06-10" }
    ]);
  });

  test("prefers child Tasks from the same parent US being repaired", async () => {
    const { pickUnusedTaskForParent } = await import("../../src/cli/commands/repair-capex-task-targets.js");

    expect(pickUnusedTaskForParent([
      { id: 172192, title: "Other US Task", state: "Done", workItemType: "Task", parentId: 171873 },
      { id: 173499, title: "Same US Task", state: "Done", workItemType: "Task", parentId: 173405 }
    ], 173405, new Set()).id).toBe(173499);
  });

  test("falls back to another user-owned Task when the same parent US has no unused Tasks", async () => {
    const { pickUnusedTaskForParent } = await import("../../src/cli/commands/repair-capex-task-targets.js");

    expect(pickUnusedTaskForParent([
      { id: 172192, title: "Same US already used", state: "Done", workItemType: "Task", parentId: 171873 },
      { id: 173499, title: "Other US free", state: "Done", workItemType: "Task", parentId: 173405 }
    ], 171873, new Set([172192])).id).toBe(173499);
  });

  test("fails before patching when there are not enough unused Tasks", async () => {
    const { buildCapexTaskRepairActions } = await import("../../src/cli/commands/repair-capex-task-targets.js");

    expect(() => buildCapexTaskRepairActions({
      entries: [
        { id: "first", date: "2026-05-27", workItemId: 173500, minutes: 450, description: "CAPEX" },
        { id: "duplicate", date: "2026-06-10", workItemId: 173500, minutes: 450, description: "CAPEX" }
      ],
      tasks: [
        { id: 173500, title: "Task usada", state: "Done", workItemType: "Task", parentId: 173405 }
      ],
      userStoryIds: new Set([173405]),
      dailyWorkItemId: 171055
    })).toThrow("nao ha Tasks CAPEX livres suficientes");
  });
});
