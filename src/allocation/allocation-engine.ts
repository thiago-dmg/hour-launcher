import type { ActivityInput, HourLauncherConfig, PlannedEntry, WorkItemSummary } from "../types/domain.js";
import { mapOpexActivity } from "./opex-mapper.js";
import { sumMinutes } from "./time-math.js";

export type PlanDayInput = {
  date: string;
  activities: ActivityInput[];
  config: HourLauncherConfig;
  capexWorkItem: WorkItemSummary;
};

export type PlanDayWithCapexPoolInput = {
  date: string;
  activities: ActivityInput[];
  config: HourLauncherConfig;
  capexWorkItems: WorkItemSummary[];
  existingEntries: ExistingEntrySummary[];
};

export type DayPlan = {
  date: string;
  entries: PlannedEntry[];
  totalMinutes: number;
};

export type ExistingEntrySummary = {
  date?: string;
  workItemId: number;
  minutes: number;
  description?: string;
};

export type ApplyExistingEntriesInput = {
  plan: DayPlan;
  existingEntries: ExistingEntrySummary[];
  dailyTargetMinutes: number;
};

export function planDay(input: PlanDayInput): DayPlan {
  const entries: PlannedEntry[] = [
    {
      date: input.date,
      label: "Daily",
      workItemId: input.config.defaults.dailyWorkItemId,
      minutes: input.config.time.defaultDailyMinutes,
      description: "Daily",
      category: "OPEX",
      source: "daily"
    }
  ];

  for (const activity of input.activities) {
    const mapping = mapOpexActivity(activity, input.config);

    if (mapping.kind === "mapped") {
      entries.push({
        date: input.date,
        label: mapping.label,
        workItemId: mapping.workItemId,
        minutes: activity.minutes,
        description: activity.description,
        category: "OPEX",
        source: "activity"
      });
      continue;
    }

    entries.push({
      date: input.date,
      label: `US ${input.capexWorkItem.id}`,
      workItemId: input.capexWorkItem.id,
      minutes: activity.minutes,
      description: activity.description,
      category: "CAPEX",
      source: "activity"
    });
  }

  const usedMinutes = sumMinutes(entries);
  const remainder = input.config.time.dailyTargetMinutes - usedMinutes;

  if (remainder < 0) {
    throw new Error("As atividades excedem a meta diaria.");
  }

  if (remainder > 0) {
    entries.push({
      date: input.date,
      label: `US ${input.capexWorkItem.id}`,
      workItemId: input.capexWorkItem.id,
      minutes: remainder,
      description: input.capexWorkItem.title,
      category: "CAPEX",
      source: "remainder"
    });
  }

  const totalMinutes = sumMinutes(entries);
  if (totalMinutes !== input.config.time.dailyTargetMinutes) {
    throw new Error(`Total planejado invalido: ${totalMinutes}`);
  }

  return { date: input.date, entries, totalMinutes };
}

export function planDayWithCapexPool(input: PlanDayWithCapexPoolInput): DayPlan {
  const firstCapexWorkItem = input.capexWorkItems[0];
  if (!firstCapexWorkItem) {
    throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada.");
  }

  const fullPlan = planDay({
    date: input.date,
    activities: input.activities,
    config: input.config,
    capexWorkItem: firstCapexWorkItem
  });
  const remainingPlan = applyExistingEntriesToPlan({
    plan: fullPlan,
    existingEntries: input.existingEntries,
    dailyTargetMinutes: input.config.time.dailyTargetMinutes
  });

  let startMinutes = 10 * 60 + sumMinutes(input.existingEntries);

  return {
    ...remainingPlan,
    entries: remainingPlan.entries.map((entry) => {
      const entryStartMinutes = startMinutes;
      startMinutes += entry.minutes;

      if (entry.category !== "CAPEX" || sumMinutes(input.existingEntries.filter((existing) => existing.workItemId === entry.workItemId)) === 0) {
        return { ...entry, startMinutes: entryStartMinutes };
      }

      const nextCapexWorkItem = input.capexWorkItems.find((workItem) =>
        workItem.id !== entry.workItemId &&
        sumMinutes(input.existingEntries.filter((existing) => existing.workItemId === workItem.id)) === 0
      );

      if (!nextCapexWorkItem) {
        return { ...entry, startMinutes: entryStartMinutes };
      }

      return {
        ...entry,
        label: `US ${nextCapexWorkItem.id}`,
        workItemId: nextCapexWorkItem.id,
        description: nextCapexWorkItem.title,
        startMinutes: entryStartMinutes
      };
    })
  };
}

export function applyExistingEntriesToPlan(input: ApplyExistingEntriesInput): DayPlan {
  const existingTotalMinutes = sumMinutes(input.existingEntries);
  const remainingTargetMinutes = input.dailyTargetMinutes - existingTotalMinutes;

  if (remainingTargetMinutes < 0) {
    throw new Error(`Total ja lancado excede a meta diaria: ${existingTotalMinutes}`);
  }

  if (remainingTargetMinutes === 0) {
    return { date: input.plan.date, entries: [], totalMinutes: 0 };
  }

  const entries: PlannedEntry[] = [];
  let remainingToLaunch = remainingTargetMinutes;

  for (const plannedEntry of input.plan.entries.filter((entry) => entry.source !== "remainder")) {
    if (remainingToLaunch <= 0) {
      break;
    }

    const alreadyLoggedForWorkItem = sumMinutes(input.existingEntries.filter((entry) => entry.workItemId === plannedEntry.workItemId));
    const missingMinutes = Math.max(0, plannedEntry.minutes - alreadyLoggedForWorkItem);
    const minutesToLaunch = Math.min(missingMinutes, remainingToLaunch);

    if (minutesToLaunch <= 0) {
      continue;
    }

    entries.push({ ...plannedEntry, minutes: minutesToLaunch });
    remainingToLaunch -= minutesToLaunch;
  }

  if (remainingToLaunch > 0) {
    const remainderEntry = input.plan.entries.find((entry) => entry.source === "remainder");
    if (!remainderEntry) {
      throw new Error("Nao foi possivel encontrar uma entrada CAPEX para completar o restante do dia.");
    }

    entries.push({ ...remainderEntry, minutes: remainingToLaunch });
  }

  return { date: input.plan.date, entries, totalMinutes: sumMinutes(entries) };
}
