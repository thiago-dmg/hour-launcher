import type { ActivityInput, HourLauncherConfig, WorkItemId } from "../types/domain.js";

export type OpexMappingResult =
  | { kind: "mapped"; label: string; workItemId: WorkItemId }
  | { kind: "capex" };

export function mapOpexActivity(activity: ActivityInput, config: HourLauncherConfig): OpexMappingResult {
  const rule = config.opexRules[activity.type];

  if (!rule) {
    return { kind: "capex" };
  }

  if (rule.workItemId) {
    return { kind: "mapped", label: rule.label, workItemId: rule.workItemId };
  }

  if (activity.workItemId) {
    return { kind: "mapped", label: rule.label, workItemId: activity.workItemId };
  }

  throw new Error(`A atividade '${activity.type}' exige um workItemId concreto no MVP.`);
}
