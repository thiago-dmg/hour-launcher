import type { PlannedEntry } from "../types/domain.js";

export type SevenPaceWorkLogPayload = {
  timestamp: string;
  length: number;
  workItemId: number;
  comment: string;
  activityTypeId?: string;
};

const launchStartHour = 10;

export function buildWorkLogPayloads(entries: PlannedEntry[], activityTypeIds: Partial<Record<SevenPaceActivityTypeName, string>> = {}): SevenPaceWorkLogPayload[] {
  let cursorMinutes = launchStartHour * 60;

  return entries.map((entry) => {
    const startMinutes = entry.startMinutes ?? cursorMinutes;
    const timestamp = formatLocalTimestamp(entry.date, startMinutes);
    cursorMinutes = startMinutes + entry.minutes;
    const activityTypeId = activityTypeIds[activityTypeNameForEntry(entry)];

    return {
      timestamp,
      length: entry.minutes * 60,
      workItemId: entry.workItemId,
      comment: entry.description,
      ...(activityTypeId ? { activityTypeId } : {})
    };
  });
}

export type SevenPaceActivityTypeName = "Desenvolvimento" | "Rituais Scrum" | "Reunião" | "Operação";

export function activityTypeNameForEntry(entry: PlannedEntry): SevenPaceActivityTypeName {
  if (entry.source === "daily" || entry.label === "Daily" || entry.label.includes("Refinamento") || entry.label.includes("Planejamento")) {
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

function formatLocalTimestamp(date: string, minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return `${date}T${pad2(hours)}:${pad2(minutes)}:00`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
