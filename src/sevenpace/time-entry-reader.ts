import type { Page } from "@playwright/test";
import type { WorkItemId } from "../types/domain.js";
import { parseHourText } from "../allocation/time-math.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceSelectors } from "./selectors.js";

export type ExistingTimeEntry = {
  id?: string;
  date: string;
  workItemId: WorkItemId;
  minutes: number;
  description: string;
};

export async function readEntriesForDate(page: Page, date: string): Promise<ExistingTimeEntry[]> {
  const frame = await getSevenPaceFrame(page);
  const rows = frame.locator(sevenPaceSelectors.entryRow);
  const count = await rows.count();
  const entries: ExistingTimeEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const text = await row.innerText();
    const workItemMatch = /#?(\d{5,})/.exec(text);
    if (!workItemMatch) {
      continue;
    }

    entries.push({
      id: String(index),
      date,
      workItemId: Number(workItemMatch[1]),
      minutes: parseDurationFromText(text),
      description: text
    });
  }

  return entries;
}

function parseDurationFromText(text: string): number {
  const compactMatch = /(\d+)h([0-5]\d)/i.exec(text);
  if (compactMatch) {
    return parseHourText(`${compactMatch[1]}h${compactMatch[2]}`);
  }

  const colonMatch = /\b(\d{1,2}):([0-5]\d)\b/.exec(text);
  if (colonMatch) {
    return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
  }

  return 0;
}
