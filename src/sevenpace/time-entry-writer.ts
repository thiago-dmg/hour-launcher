import type { Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import type { ExistingTimeEntry } from "./time-entry-reader.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceSelectors } from "./selectors.js";

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  await frame.locator(sevenPaceSelectors.addEntryButton).first().click();
  await fillEntryForm(frame, entry);
}

export async function updateTimeEntry(page: Page, existing: ExistingTimeEntry, entry: PlannedEntry): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  const rowIndex = existing.id ? Number(existing.id) : 0;
  await frame.locator(sevenPaceSelectors.entryRow).nth(rowIndex).click();
  await fillEntryForm(frame, entry);
}

async function fillEntryForm(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, entry: PlannedEntry): Promise<void> {
  const workItemInput = frame.locator(sevenPaceSelectors.workItemInput).first();
  await workItemInput.fill(String(entry.workItemId));
  await workItemInput.press("Enter");

  const durationInput = frame.locator(sevenPaceSelectors.durationInput).first();
  await durationInput.fill(formatDurationForSevenPace(entry.minutes));

  await frame.locator(sevenPaceSelectors.descriptionInput).filter({ visible: true }).first().fill(entry.description);
  await frame.locator(sevenPaceSelectors.saveButton).last().click();
  await frame.page().waitForLoadState("networkidle");
}

function formatDurationForSevenPace(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
