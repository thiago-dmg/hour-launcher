import { readFile } from "node:fs/promises";
import type { DayActivityFile, HourLauncherConfig } from "../types/domain.js";
import { activityFileSchema, configSchema } from "./schema.js";

async function readJson(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
}

export async function loadConfig(path = "config/hour-launcher.json"): Promise<HourLauncherConfig> {
  return configSchema.parse(await readJson(path)) as HourLauncherConfig;
}

export async function loadActivityFile(path: string): Promise<DayActivityFile> {
  return activityFileSchema.parse(await readJson(path)) as DayActivityFile;
}
