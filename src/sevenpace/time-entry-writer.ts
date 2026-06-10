import type { Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import { formatMinutes } from "../allocation/time-math.js";
import type { ExistingTimeEntry } from "./time-entry-reader.js";
import { sevenPaceSelectors } from "./selectors.js";

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  await page.locator(sevenPaceSelectors.addEntryButton).first().click();
  await fillEntryForm(page, entry);
}

export async function updateTimeEntry(page: Page, existing: ExistingTimeEntry, entry: PlannedEntry): Promise<void> {
  const rowIndex = existing.id ? Number(existing.id) : 0;
  await page.locator(sevenPaceSelectors.entryRow).nth(rowIndex).click();
  await fillEntryForm(page, entry);
}

async function fillEntryForm(page: Page, entry: PlannedEntry): Promise<void> {
  await page.locator(sevenPaceSelectors.workItemInput).first().fill(String(entry.workItemId));
  await page.keyboard.press("Enter");
  await page.locator(sevenPaceSelectors.durationInput).first().fill(formatMinutes(entry.minutes));
  await page.locator(sevenPaceSelectors.descriptionInput).first().fill(entry.description);
  await page.locator(sevenPaceSelectors.saveButton).first().click();
  await page.waitForLoadState("networkidle");
}
