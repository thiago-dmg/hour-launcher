import type { Locator, Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import type { ExistingTimeEntry } from "./time-entry-reader.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceSelectors } from "./selectors.js";

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  await closeOpenAddTimeForm(frame);
  await frame.locator(sevenPaceSelectors.addEntryButton).first().click();
  await fillEntryForm(frame, entry);
}

export async function updateTimeEntry(page: Page, existing: ExistingTimeEntry, entry: PlannedEntry): Promise<void> {
  const frame = await getSevenPaceFrame(page);
  await closeOpenAddTimeForm(frame);
  const rowIndex = existing.id ? Number(existing.id) : 0;
  await frame.locator(sevenPaceSelectors.entryRow).nth(rowIndex).click();
  await fillEntryForm(frame, entry);
}

async function fillEntryForm(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, entry: PlannedEntry): Promise<void> {
  const workItemInput = frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).first();
  await workItemInput.fill(String(entry.workItemId));
  await frame.page().waitForTimeout(1000);
  await workItemInput.press("Enter");
  await frame.page().waitForTimeout(1000);

  await setInputValue(frame.locator(sevenPaceSelectors.durationInput).filter({ visible: true }).first(), formatDurationForSevenPace(entry.minutes));
  await selectActivityType(frame, activityTypeForEntry(entry));
  await frame.locator(sevenPaceSelectors.descriptionInput).filter({ visible: true }).first().fill(entry.description);
  await frame.locator(sevenPaceSelectors.saveButton).filter({ visible: true }).last().click();
  await frame.page().waitForLoadState("networkidle");
  await frame.page().waitForTimeout(1000);
}

async function closeOpenAddTimeForm(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>): Promise<void> {
  const hasOpenForm = (await frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).count()) > 0;
  if (!hasOpenForm) {
    return;
  }

  const closeButton = frame.locator("button[aria-label='Close'], button[title='Close']").filter({ visible: true }).last();
  if (await closeButton.count()) {
    await closeButton.click();
  } else {
    await frame.page().keyboard.press("Escape");
  }

  await frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).first().waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
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
    const win = selectElement.ownerDocument.defaultView as (Window & {
      jQuery?: (target: HTMLSelectElement) => { val(value: string): unknown; trigger(eventName: string): unknown };
    }) | null;

    if (win?.jQuery) {
      win.jQuery(selectElement).val(option.value);
      win.jQuery(selectElement).trigger("change");
    } else {
      selectElement.dispatchEvent(new Event("input", { bubbles: true }));
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, label);
}

function activityTypeForEntry(entry: PlannedEntry): string {
  if (entry.label === "Daily" || entry.label.includes("Refinamento") || entry.label.includes("Planejamento")) {
    return "Rituais Scrum";
  }

  if (entry.label.includes("Reunio") || entry.label.includes("Reuni")) {
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

async function setInputValue(locator: Locator, value: string): Promise<void> {
  await locator.click();
  await locator.fill(value);
  await locator.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }, value);
}
