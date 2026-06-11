import type { PlannedEntry } from "../types/domain.js";
import { formatMinutes, sumMinutes } from "../allocation/time-math.js";

export function renderReview(date: string, entries: PlannedEntry[]): string {
  const lines = [`Data: ${date}`, ""];

  for (const entry of entries) {
    const target = entry.category === "CAPEX" ? "CAPEX" : `US ${entry.workItemId}`;
    lines.push(`${entry.label}: ${formatMinutes(entry.minutes)} -> ${target}`);
  }

  lines.push("");
  lines.push(`Total: ${formatMinutes(sumMinutes(entries))}`);

  return lines.join("\n");
}
