import type { Locator, Page } from "@playwright/test";
import type { PlannedEntry } from "../types/domain.js";
import type { ExistingTimeEntry } from "./time-entry-reader.js";
import { getSevenPaceFrame } from "./sevenpace-frame.js";
import { sevenPaceSelectors } from "./selectors.js";
import { sevenPaceFetch } from "./sevenpace-rest-client.js";
import { activityTypeNameForEntry, buildWorkLogPayloads, type SevenPaceActivityTypeName } from "./worklog-payload.js";

type EntryFormSnapshot = {
  workItem: string;
  date: string;
  duration: string;
  from: string;
  to: string;
  activityType: string;
  description: string;
};

type EntrySchedule = {
  from: string;
  to: string;
};

type SevenPaceActivityTypesResponse = {
  enabled: boolean;
  activityTypes: Array<{ id: string; name: string }>;
  systemDefaultActivityTypeId?: string;
};

export async function createTimeEntry(page: Page, entry: PlannedEntry): Promise<void> {
  await createTimeEntries(page, [entry]);
}

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

export async function updateTimeEntry(page: Page, existing: ExistingTimeEntry, entry: PlannedEntry): Promise<void> {
  await createTimeEntry(page, entry);
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

async function fillEntryForm(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, entry: PlannedEntry): Promise<void> {
  const workItemInput = frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).first();
  await selectWorkItem(frame, workItemInput, entry.workItemId);

  await setDateValue(frame, entry.date);
  await setInputValue(frame.locator(sevenPaceSelectors.durationInput).filter({ visible: true }).first(), formatDurationForSevenPace(entry.minutes));
  const schedule = buildEntrySchedule(entry);
  await setInputValue(frame.locator(sevenPaceSelectors.fromInput).filter({ visible: true }).first(), schedule.from);
  await setInputValue(frame.locator(sevenPaceSelectors.toInput).filter({ visible: true }).first(), schedule.to);
  const activityType = activityTypeForEntry(entry);
  await selectActivityType(frame, activityType);
  await frame.locator(sevenPaceSelectors.descriptionInput).filter({ visible: true }).first().fill(entry.description);
  validateFilledEntryForm(await readEntryFormSnapshot(frame), entry, activityType, schedule);
  await frame.locator(sevenPaceSelectors.saveButton).filter({ visible: true }).last().click();
  await frame.page().waitForLoadState("networkidle");
  await frame.page().waitForTimeout(1000);
}

async function openAddTimeForm(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, date: string): Promise<void> {
  const addButton = frame.locator(sevenPaceSelectors.addEntryButton).filter({ visible: true }).first();

  if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addButton.click();
    return;
  }

  const addText = frame.getByText(sevenPaceSelectors.addEntryText, { exact: false }).filter({ visible: true }).first();
  if (await addText.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addText.click();
    return;
  }

  const dayCell = frame.locator(sevenPaceSelectors.monthlyDay(date)).first();
  if (await dayCell.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dayCell.hover();
    const dayAdd = frame.locator(sevenPaceSelectors.monthlyDayAdd(date)).first();
    await dayAdd.click({ force: true });
    return;
  }

  throw new Error(`Botao Add Time nao apareceu para ${date} no Monthly. Verifique se a celula do dia existe e se a semana nao esta bloqueada.`);
}

async function selectWorkItem(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, workItemInput: Locator, workItemId: number): Promise<void> {
  await workItemInput.fill(String(workItemId));

  const option = frame.locator(buildWorkItemOptionSelector(workItemId)).filter({ visible: true }).first();
  await option.waitFor({ state: "visible", timeout: 10000 }).catch(async () => {
    const textOption = frame.getByText(`#${workItemId}`, { exact: false }).filter({ visible: true }).first();
    if ((await textOption.count()) === 0) {
      throw new Error(`Opcao do Work Item #${workItemId} nao apareceu no autocomplete do 7pace.`);
    }

    await textOption.click();
  });

  if ((await option.count()) > 0 && await option.isVisible()) {
    await option.click();
  }

  await frame.page().waitForTimeout(500);
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
  if ((await select.count()) === 0) {
    await selectCustomActivityType(frame, label);
    return;
  }

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

async function selectCustomActivityType(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, label: string): Promise<void> {
  const dropdown = frame.locator(sevenPaceSelectors.activityTypeDropdown).filter({ visible: true }).first();
  await dropdown.click();

  const option = frame.locator(sevenPaceSelectors.activityTypeOption(label)).filter({ visible: true }).first();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
  await frame.page().waitForTimeout(300);
}

async function readEntryFormSnapshot(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>): Promise<EntryFormSnapshot> {
  const workItemInput = frame.locator(sevenPaceSelectors.workItemInput).filter({ visible: true }).first();
  const datePicker = frame.locator(sevenPaceSelectors.datePicker).filter({ visible: true }).first();
  const durationInput = frame.locator(sevenPaceSelectors.durationInput).filter({ visible: true }).first();
  const fromInput = frame.locator(sevenPaceSelectors.fromInput).filter({ visible: true }).first();
  const toInput = frame.locator(sevenPaceSelectors.toInput).filter({ visible: true }).first();
  const activityTypeSelect = frame.locator(sevenPaceSelectors.activityTypeSelect).first();
  const descriptionInput = frame.locator(sevenPaceSelectors.descriptionInput).filter({ visible: true }).first();

  return {
    workItem: await workItemInput.inputValue().catch(() => ""),
    date: await datePicker.innerText().catch(() => ""),
    duration: await durationInput.inputValue().catch(() => ""),
    from: await fromInput.inputValue().catch(() => ""),
    to: await toInput.inputValue().catch(() => ""),
    activityType: await activityTypeSelect.evaluate((element) => {
      const select = element as HTMLSelectElement;
      return select.selectedOptions[0]?.textContent?.trim() ?? "";
    }).catch(async () => frame.locator(sevenPaceSelectors.activityTypeDropdown).filter({ visible: true }).first().innerText().catch(() => "")),
    description: await descriptionInput.inputValue().catch(() => "")
  };
}

export function validateFilledEntryForm(snapshot: EntryFormSnapshot, entry: PlannedEntry, expectedActivityType: string, expectedSchedule = buildEntrySchedule(entry)): void {
  if (!snapshot.workItem.trim()) {
    throw new Error(`Work Item nao foi preenchido para ${entry.workItemId}.`);
  }

  if (snapshot.date.trim() !== formatDateForSevenPace(entry.date)) {
    throw new Error(`Date nao foi preenchido corretamente para ${entry.workItemId}: esperado ${formatDateForSevenPace(entry.date)}, atual "${snapshot.date}".`);
  }

  if (snapshot.duration.trim() !== formatDurationForSevenPace(entry.minutes)) {
    throw new Error(`Duration nao foi preenchido corretamente para ${entry.workItemId}: esperado ${formatDurationForSevenPace(entry.minutes)}, atual "${snapshot.duration}".`);
  }

  if (snapshot.from.trim() !== expectedSchedule.from) {
    throw new Error(`From nao foi preenchido corretamente para ${entry.workItemId}: esperado ${expectedSchedule.from}, atual "${snapshot.from}".`);
  }

  if (snapshot.to.trim() !== expectedSchedule.to) {
    throw new Error(`To nao foi preenchido corretamente para ${entry.workItemId}: esperado ${expectedSchedule.to}, atual "${snapshot.to}".`);
  }

  if (snapshot.activityType.trim() !== expectedActivityType) {
    throw new Error(`Activity Type nao foi preenchido corretamente para ${entry.workItemId}: esperado ${expectedActivityType}, atual "${snapshot.activityType}".`);
  }

  if (snapshot.description.trim() !== entry.description) {
    throw new Error(`Description nao foi preenchido corretamente para ${entry.workItemId}: esperado "${entry.description}", atual "${snapshot.description}".`);
  }
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

export function formatDateForSevenPace(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

export function buildEntrySchedule(entry: PlannedEntry): EntrySchedule {
  const startMinutes = entry.source === "daily" ? 10 * 60 : 10 * 60 + 30;
  return {
    from: formatClockForSevenPace(startMinutes),
    to: formatClockForSevenPace(startMinutes + entry.minutes)
  };
}

export function buildWorkItemOptionSelector(workItemId: number): string {
  return [
    `[role='option']:has-text('#${workItemId}')`,
    `[role='treeitem']:has-text('#${workItemId}')`,
    `[role='row']:has-text('#${workItemId}')`,
    `.bolt-list-row:has-text('#${workItemId}')`,
    `.bolt-list-cell:has-text('#${workItemId}')`
  ].join(", ");
}

function formatClockForSevenPace(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  const minutePart = minutes === 0 ? "00" : String(minutes).padStart(2, "0");
  return `${hour12}:${minutePart} ${suffix}`;
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

async function setDateValue(frame: Awaited<ReturnType<typeof getSevenPaceFrame>>, date: string): Promise<void> {
  const formattedDate = formatDateForSevenPace(date);
  const datePicker = frame.locator(sevenPaceSelectors.datePicker).filter({ visible: true }).first();
  await datePicker.waitFor({ state: "visible", timeout: 10000 });

  if ((await datePicker.innerText()).trim() === formattedDate) {
    return;
  }

  await datePicker.press("Enter");
  const [, , day] = date.split("-").map(Number);
  let dayButton = frame.locator(datePickerDaySelector(day)).filter({ visible: true }).first();

  if ((await dayButton.count()) === 0) {
    await datePicker.click({ force: true });
    dayButton = frame.locator(datePickerDaySelector(day)).filter({ visible: true }).first();
  }

  await dayButton.waitFor({ state: "visible", timeout: 10000 });
  await dayButton.click();
  await frame.page().waitForTimeout(300);
}

function datePickerDaySelector(day: number): string {
  return `.ms-DatePicker button:has-text('${day}'), .ms-DatePicker-callout button:has-text('${day}'), [role='dialog'] button:has-text('${day}')`;
}
