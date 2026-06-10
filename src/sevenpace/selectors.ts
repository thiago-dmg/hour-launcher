export const sevenPaceSelectors = {
  timeExplorerRoot: "[data-testid='time-explorer'], .time-explorer",
  addEntryButton: "button:has-text('Add'), button:has-text('New'), button:has-text('Adicionar')",
  workItemInput: "input[aria-label*='Work item'], input[placeholder*='work item'], input[placeholder*='item']",
  durationInput: "input[aria-label*='Duration'], input[placeholder*='Duration'], input[placeholder*='tempo']",
  descriptionInput: "textarea, input[aria-label*='Description'], input[placeholder*='Description']",
  saveButton: "button:has-text('Save'), button:has-text('Salvar')",
  entryRow: "[data-testid='time-entry-row'], .time-entry-row"
} as const;
