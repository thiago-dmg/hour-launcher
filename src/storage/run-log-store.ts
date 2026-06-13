import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { PlannedEntry } from "../types/domain.js";

export type RunLog = {
  date: string;
  plannedHash: string;
  entries: PlannedEntry[];
  result: "planned" | "written" | "failed" | "skipped";
  finalTotalMinutes?: number;
  errorMessage?: string;
  createdAt: string;
};

export function hashEntries(entries: PlannedEntry[]): string {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export async function writeRunLog(log: Omit<RunLog, "plannedHash" | "createdAt">): Promise<string> {
  await mkdir(".runs", { recursive: true });
  const fullLog: RunLog = {
    ...log,
    plannedHash: hashEntries(log.entries),
    createdAt: new Date().toISOString()
  };
  const path = `.runs/${log.date}-${fullLog.plannedHash.slice(0, 8)}.json`;
  await writeFile(path, JSON.stringify(fullLog, null, 2), "utf8");
  return path;
}
