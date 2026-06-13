import { describe, expect, it } from "vitest";
import { applyExistingEntriesToPlan, planDay, planDayWithCapexPool } from "../../src/allocation/allocation-engine.js";
import type { HourLauncherConfig, WorkItemSummary } from "../../src/types/domain.js";

const config = {
  time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
  defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory" },
  opexRules: {
    reunioes: { label: "Reunioes", workItemId: 171054 }
  }
} as unknown as HourLauncherConfig;

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

  it("mantem apenas o restante quando a Daily ja existe", () => {
    const plan = planDay({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItem
    });

    const result = applyExistingEntriesToPlan({
      plan,
      existingEntries: [{ date: "2026-06-10", workItemId: 171055, minutes: 30, description: "Daily" }],
      dailyTargetMinutes: 480
    });

    expect(result.totalMinutes).toBe(450);
    expect(result.entries).toEqual([
      expect.objectContaining({ label: "US 172980", workItemId: 172980, minutes: 450, category: "CAPEX" })
    ]);
  });

  it("completa somente o saldo ate 8h quando ja existem horas manuais", () => {
    const plan = planDay({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItem
    });

    const result = applyExistingEntriesToPlan({
      plan,
      existingEntries: [
        { date: "2026-06-10", workItemId: 171055, minutes: 30, description: "Daily" },
        { date: "2026-06-10", workItemId: 999999, minutes: 120, description: "Lancamento manual" }
      ],
      dailyTargetMinutes: 480
    });

    expect(result.totalMinutes).toBe(330);
    expect(result.entries).toEqual([
      expect.objectContaining({ label: "US 172980", workItemId: 172980, minutes: 330, category: "CAPEX" })
    ]);
  });

  it("nao lanca nada quando o dia ja possui 8h", () => {
    const plan = planDay({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItem
    });

    const result = applyExistingEntriesToPlan({
      plan,
      existingEntries: [{ date: "2026-06-10", workItemId: 172980, minutes: 480, description: "Dia completo" }],
      dailyTargetMinutes: 480
    });

    expect(result.totalMinutes).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it("usa Daily e primeira US CAPEX em um dia vazio com pool de US", () => {
    const result = planDayWithCapexPool({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItems: [
        { id: 173405, title: "Primeira US", state: "Active", workItemType: "User Story" },
        { id: 173406, title: "Segunda US", state: "Active", workItemType: "User Story" }
      ],
      existingEntries: []
    });

    expect(result.entries.map((entry) => [entry.workItemId, entry.minutes])).toEqual([
      [171055, 30],
      [173405, 450]
    ]);
  });

  it("completa CAPEX restante com a proxima US quando a primeira ja tem horas parciais", () => {
    const result = planDayWithCapexPool({
      date: "2026-06-10",
      activities: [],
      config,
      capexWorkItems: [
        { id: 173405, title: "Primeira US", state: "Active", workItemType: "User Story" },
        { id: 173406, title: "Segunda US", state: "Active", workItemType: "User Story" }
      ],
      existingEntries: [
        { date: "2026-06-10", workItemId: 171055, minutes: 30, description: "Daily" },
        { date: "2026-06-10", workItemId: 173405, minutes: 240, description: "Primeira US" }
      ]
    });

    expect(result.entries.map((entry) => [entry.workItemId, entry.minutes])).toEqual([
      [173406, 210]
    ]);
    expect(result.entries[0].startMinutes).toBe(14 * 60 + 30);
  });
});
