import type { ActivityInput, HourLauncherConfig, PlannedEntry, WorkItemSummary } from "../types/domain.js";
import { mapOpexActivity } from "./opex-mapper.js";
import { sumMinutes } from "./time-math.js";

export type PlanDayInput = {
  date: string;
  activities: ActivityInput[];
  config: HourLauncherConfig;
  capexWorkItem: WorkItemSummary;
};

export type DayPlan = {
  date: string;
  entries: PlannedEntry[];
  totalMinutes: number;
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
