import { describe, expect, it } from "vitest";
import { planDay } from "../../src/allocation/allocation-engine.js";
import type { HourLauncherConfig, WorkItemSummary } from "../../src/types/domain.js";

const config = {
  time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
  defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
  opexRules: {
    reunioes: { label: "Reunioes", workItemId: 171054 }
  }
} as HourLauncherConfig;

const capexWorkItem: WorkItemSummary = {
  id: 172980,
  title: "Implementar feature principal",
  state: "Active",
  workItemType: "User Story"
};

describe("allocation-engine", () => {
  it("inclui Daily e coloca restante em CAPEX", () => {
    const result = planDay({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItem
    });

    expect(result.totalMinutes).toBe(480);
    expect(result.entries).toEqual([
      expect.objectContaining({ label: "Daily", workItemId: 171055, minutes: 30, category: "OPEX" }),
      expect.objectContaining({ label: "US 172980", workItemId: 172980, minutes: 450, category: "CAPEX" })
    ]);
  });

  it("compensa atividades OPEX removendo do CAPEX", () => {
    const result = planDay({
      date: "2026-06-10",
      activities: [{ type: "reunioes", minutes: 30, description: "Sync" }],
      config,
      capexWorkItem
    });

    expect(result.totalMinutes).toBe(480);
    expect(result.entries.map((entry) => [entry.label, entry.minutes])).toEqual([
      ["Daily", 30],
      ["Reunioes", 30],
      ["US 172980", 420]
    ]);
  });

  it("falha quando atividades excedem a meta", () => {
    expect(() => planDay({
      date: "2026-06-10",
      activities: [{ type: "reunioes", minutes: 480, description: "Dia inteiro" }],
      config,
      capexWorkItem
    })).toThrow("excedem a meta diaria");
  });
});
