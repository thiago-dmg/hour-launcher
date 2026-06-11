import type { Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import type { ExistingTimeEntry } from "./time-entry-reader.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceSelectors } from "./selectors.js";

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  if (!(await isAddTimeFormOpen(frame))) {
    await frame.locator(sevenPaceSelectors.addEntryButton).first().click();
  }
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
  await frame.page().waitForTimeout(1000);
  await workItemInput.press("Enter");

  const durationInput = frame.locator(sevenPaceSelectors.durationInput).first();
  await durationInput.fill(formatDurationForSevenPace(entry.minutes));

  await selectActivityType(frame, activityTypeForEntry(entry));
  await frame.locator(sevenPaceSelectors.descriptionInput).filter({ visible: true }).first().fill(entry.description);
  await frame.locator(sevenPaceSelectors.saveButton).last().click();
  await frame.page().waitForLoadState("networkidle");
  await frame.page().waitForTimeout(1000);
}

async function isAddTimeFormOpen(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>): Promise<boolean> {
  return (await frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).count()) > 0;
}

async function selectActivityType(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, label: string): Promise<void> {
  const select = frame.locator(sevenPaceSelectors.activityTypeSelect).first();
  await select.waitFor({ state: "attached", timeout: 10000 });
  await frame.page().waitForTimeout(500);
  await select.evaluate((element, optionLabel) => {
    const selectElement = element as HTMLSelectElement;
    const option = Array.from(selectElement.options).find((candidate) => candidate.textContent?.trim() === optionLabel);
    if (!option) {
      throw new Error(`Activity Type nao encontrado: ${optionLabel}`);
    }

    selectElement.value = option.value;
    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
  }, label);
}

function activityTypeForEntry(entry: PlannedEntry): string {
  if (entry.label === "Daily" || entry.label.includes("Refinamento") || entry.label.includes("Planejamento")) {
    return "Rituais Scrum";
  }

  if (entry.label.includes("Reunio")) {
    return "Reunião";
  }

  if (entry.category === "CAPEX") {
    return "Desenvolvimento";
  }

  return "Operação";
}

function formatDurationForSevenPace(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
