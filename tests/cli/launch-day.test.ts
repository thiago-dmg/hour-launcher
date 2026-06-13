import { beforeEach, describe, expect, test, vi } from "vitest";

const closeContext = vi.fn();
const createTimeEntries = vi.fn();
const readEntriesForDate = vi.fn();
const writeRunLog = vi.fn();
const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("../../src/config/config-loader.js", () => ({
  loadConfig: vi.fn(async () => ({
    sevenPace: { baseUrl: "https://example.test", mode: "playwright", headless: false },
    time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
    defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
    duplicatePolicy: { sameDateSameWorkItem: "update", allowMultipleEntriesSameWorkItem: false, validateFinalTotal: true },
    azureDevOps: { orgUrl: "https://example.test", project: "Test", authMethod: "azure-cli", defaultTeam: null },
    opexRules: {}
  })),
  loadActivityFile: vi.fn(async () => ({ date: "2026-06-10", activities: [] }))
}));

vi.mock("../../src/cli/capex-work-item.js", () => ({
  resolveConfiguredCapexWorkItem: vi.fn(() => undefined)
}));

vi.mock("../../src/azure-devops/browser-work-item-service.js", () => ({
  findActiveAssignedUserStoriesFromBrowser: vi.fn(async () => [{
    id: 172980,
    title: "US 172980",
    state: "Active",
    workItemType: "User Story"
  }])
}));

vi.mock("../../src/allocation/allocation-engine.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/allocation/allocation-engine.js")>("../../src/allocation/allocation-engine.js");
  return {
    ...actual,
    planDay: vi.fn(() => ({
      date: "2026-06-10",
      entries: [
        {
          date: "2026-06-10",
          label: "US 172980",
          workItemId: 172980,
          minutes: 480,
          description: "US 172980",
          category: "CAPEX",
          source: "remainder"
        }
      ],
      totalMinutes: 480
    })),
    applyExistingEntriesToPlan: vi.fn(({ plan }) => plan)
  };
});

vi.mock("../../src/sevenpace/sevenpace-playwright.js", () => ({
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

vi.mock("../../src/review/review-renderer.js", () => ({
  renderReview: vi.fn(() => "review")
}));

describe("launch-day command", () => {
  beforeEach(() => {
    closeContext.mockClear();
    createTimeEntries.mockClear();
    readEntriesForDate.mockReset();
    writeRunLog.mockClear();
    consoleError.mockClear();
    readEntriesForDate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ workItemId: 172980, minutes: 480, description: "US 172980" }]);
  });

  test("writes entries in one REST batch and closes the browser context", async () => {
    const { buildLaunchDayCommand } = await import("../../src/cli/commands/launch-day.js");

    await buildLaunchDayCommand().parseAsync(["node", "test", "--activities", "config/activities.local.json", "--yes"]);

    expect(createTimeEntries).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  test("closes the browser context when launching fails", async () => {
    createTimeEntries.mockRejectedValueOnce(new Error("Duration nao foi preenchido"));
    const { buildLaunchDayCommand } = await import("../../src/cli/commands/launch-day.js");

    await expect(buildLaunchDayCommand().parseAsync(["node", "test", "--activities", "config/activities.local.json", "--yes"])).rejects.toThrow("Duration nao foi preenchido");

    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("Erro real da automacao:", "Duration nao foi preenchido");
  });
});
