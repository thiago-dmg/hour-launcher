import type { Page } from "@playwright/test";
import type { WorkItemId } from "../types/domain.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceFetch } from "./sevenpace-rest-client.js";

export type ExistingTimeEntry = {
  id?: string;
  date: string;
  workItemId: WorkItemId;
  minutes: number;
  description: string;
  timestamp?: string;
};

type SevenPaceWorkLog = {
  id?: string;
  timestamp?: string;
  length: number;
  workItemId: number | null;
  comment?: string;
};

export async function readEntriesForDate(page: Page, date: string): Promise<ExistingTimeEntry[]> {
  const frame = await getSevenPaceFrame(page);
  const workLogs = await sevenPaceFetch<SevenPaceWorkLog[]>(frame, "workLogs", {
    query: {
      "$fromTimestamp": `${date}T00:00:00`,
      "$toTimestamp": `${nextDate(date)}T00:00:00`,
      "$count": "500"
    }
  });

  return workLogs
    .filter((workLog) => typeof workLog.workItemId === "number")
    .map((workLog) => ({
      id: workLog.id,
      date,
      workItemId: workLog.workItemId as number,
      minutes: Math.round(workLog.length / 60),
      description: workLog.comment ?? "",
      timestamp: workLog.timestamp
    }));
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}
