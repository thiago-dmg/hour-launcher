import type { Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceFetch } from "./sevenpace-rest-client.js";
import { activityTypeNameForEntry, buildWorkLogPayloads, type SevenPaceActivityTypeName } from "./worklog-payload.js";

type SevenPaceActivityTypesResponse = {
  enabled: boolean;
  activityTypes: Array<{ id: string; name: string }>;
  systemDefaultActivityTypeId?: string;
};

export async function createTimeEntries(page: Page, entries: PlannedEntry[]): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  const activityTypeIds = await resolveActivityTypeIds(frame, entries);

  for (const payload of buildWorkLogPayloads(entries, activityTypeIds)) {
    await sevenPaceFetch(frame, "workLogs", {
      method: "POST",
      body: payload
    });
  }
}

export async function updateTimeEntryWorkItem(page: Page, entryId: string, workItemId: number): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  await sevenPaceFetch(frame, `workLogs/${entryId}`, {
    method: "PATCH",
    body: { workItemId }
  });
}

async function resolveActivityTypeIds(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, entries: PlannedEntry[]): Promise<Partial<Record<SevenPaceActivityTypeName, string>>> {
  const requiredNames = new Set(entries.map((entry) => activityTypeNameForEntry(entry)));
  const response = await sevenPaceFetch<SevenPaceActivityTypesResponse>(frame, "activityTypes");
  const resolved: Partial<Record<SevenPaceActivityTypeName, string>> = {};

  for (const requiredName of requiredNames) {
    const activityType = response.activityTypes.find((candidate) => candidate.name === requiredName);
    if (!activityType) {
      throw new Error(`Activity Type nao encontrado no 7pace: ${requiredName}`);
    }

    resolved[requiredName] = activityType.id;
  }

  return resolved;
}
