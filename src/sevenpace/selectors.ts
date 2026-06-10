export const sevenPaceSelectors = {
  timeExplorerRoot: "[data-testid='time-explorer'], .time-explorer",
  addEntryButton: "button:has-text('Add Time'), button:has-text('Add'), button:has-text('New'), button:has-text('Adicionar')",
  workItemInput: "input[placeholder*='Search work items'], input[aria-label*='Work item'], input[placeholder*='work item'], input[placeholder*='item']",
  durationInput: "input.timeframe-duration.is-timeEntry, input[aria-label*='Duration'], input[placeholder*='Duration'], input[placeholder*='tempo']",
  descriptionInput: "textarea[placeholder*='Add a comment'], textarea[aria-label*='Add a comment'], textarea, input[aria-label*='Description'], input[placeholder*='Description']",
  saveButton: "button:has-text('Save'), button:has-text('Salvar')",
  entryRow: "[data-testid='time-entry-row'], .time-entry-row"
} as const;
