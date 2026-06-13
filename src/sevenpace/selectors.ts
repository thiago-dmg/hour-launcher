export const sevenPaceSelectors = {
  addEntryButton: "#btnAddCurrent, li.add-time-item:has-text('Add Time'), button:has-text('Add Time'), [role='button']:has-text('Add Time')",
  monthlyDay: (date: string) => {
    const [year, month, day] = parseIsoDate(date);
    return `.month-calendar-column.selectable-day[data-y='${year}'][data-m='${month}'][data-d='${day}']`;
  }
} as const;

function parseIsoDate(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}
