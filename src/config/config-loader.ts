import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import type { DayActivityFile, HourLauncherConfig } from "../types/domain.js";
import { activityFileSchema, configSchema } from "./schema.js";

async function readJson(path: string): Promise<unknown> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      throw new Error(`Arquivo nao encontrado: ${path}. Rode 'npm run init-config' para criar os arquivos locais a partir dos exemplos.`);
    }

    if (error instanceof SyntaxError) {
      throw new Error(`JSON invalido em ${path}: ${error.message}`);
    }

    throw error;
  }
}

export async function loadConfig(path = "config/hour-launcher.json"): Promise<HourLauncherConfig> {
  try {
    return configSchema.parse(await readJson(path)) as HourLauncherConfig;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Configuracao invalida em ${path}: ${error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    throw error;
  }
}

export async function loadActivityFile(path: string): Promise<DayActivityFile> {
  try {
    return activityFileSchema.parse(await readJson(path)) as DayActivityFile;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Arquivo de atividades invalido em ${path}: ${error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    throw error;
  }
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
