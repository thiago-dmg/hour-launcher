export const sevenPaceSelectors = {
  timeExplorerRoot: "[data-testid='time-explorer'], .time-explorer",
  addEntryButton: "#btnAddCurrent, li.add-time-item:has-text('Add Time'), button:has-text('Add Time'), button:has-text('Add'), button:has-text('New'), button:has-text('Adicionar'), [role='button']:has-text('Add Time'), [role='button']:has-text('Add'), .add-time:has-text('Add Time')",
  addEntryText: "Add Time",
  monthlyDay: (date: string) => {
    const [year, month, day] = parseIsoDate(date);
    return `.month-calendar-column.selectable-day[data-y='${year}'][data-m='${month}'][data-d='${day}']`;
  },
  monthlyDayAdd: (date: string) => `${sevenPaceSelectors.monthlyDay(date)} .a-add, ${sevenPaceSelectors.monthlyDay(date)} .btn-add[title='Add']`,
  workItemInput: "input[placeholder*='Search work items'], input[aria-label*='Work item'], input[placeholder*='work item'], input[placeholder*='item']",
  datePicker: ".add-time-date [role='combobox']",
  durationInput: "input.timeframe-duration.is-timeEntry",
  fromInput: "input.timeframe-from.is-timeEntry",
  toInput: "input.timeframe-to.is-timeEntry",
  activityTypeSelect: "select.activity-type-select",
  activityTypeDropdown: ".add-time-activity-type-dropdown [role='combobox']:has-text('[Not Set]'), .add-time-activity-type-dropdown [role='combobox']:has-text('Desenvolvimento'), .add-time-activity-type-dropdown [role='combobox']:has-text('Rituais Scrum'), .add-time-activity-type-dropdown [role='combobox']:has-text('Operação'), .add-time-activity-type-dropdown [role='combobox']:has-text('Reunião')",
  activityTypeOption: (label: string) => `[role='option']:has-text('${label}'), [role='listbox'] [role='option']:has-text('${label}'), .ms-Dropdown-item:has-text('${label}'), .ms-Dropdown-items button:has-text('${label}')`,
  descriptionInput: "textarea[placeholder*='Add a comment'], textarea[aria-label*='Add a comment'], textarea.bolt-textfield-input, input[aria-label*='Description'], input[placeholder*='Description']",
  saveButton: "button:has-text('Save'), button:has-text('Salvar')",
  entryRow: "[data-testid='time-entry-row'], .time-entry-row, [role='row'], tr"
} as const;

function parseIsoDate(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}
