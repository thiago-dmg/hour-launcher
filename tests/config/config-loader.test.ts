import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadActivityFile, loadConfig } from "../../src/config/config-loader.js";

describe("config-loader", () => {
  it("carrega configuracao valida", async () => {
    const dir = join(tmpdir(), `hour-launcher-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({
      azureDevOps: { orgUrl: "https://dev.azure.com/dotzmkt", project: "P", authMethod: "azure-cli", defaultTeam: null },
      sevenPace: { baseUrl: "https://dev.azure.com/dotzmkt", timesheetUrl: "https://dotzmkt.visualstudio.com/Tribos%20Dotz/_apps/hub/7pace.Timetracker.Monthly", mode: "playwright", headless: false },
      time: { dailyTargetMinutes: 480, defaultDailyMinutes: 30, minimumEntryMinutes: 15 },
      defaults: { dailyWorkItemId: 171055, capexStrategy: "activeAssignedUserStory", capexWorkItemId: 172980 },
      opexRules: { reunioes: { label: "Reunioes", workItemId: 171054 } },
      duplicatePolicy: { sameDateSameWorkItem: "update", allowMultipleEntriesSameWorkItem: false, validateFinalTotal: true }
    }));

    await expect(loadConfig(path)).resolves.toMatchObject({ azureDevOps: { project: "P" } });
    await rm(dir, { recursive: true, force: true });
  });

  it("carrega arquivo de atividades", async () => {
    const dir = join(tmpdir(), `hour-launcher-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "activities.json");
    await writeFile(path, JSON.stringify({ date: "2026-06-10", activities: [{ type: "reunioes", minutes: 30, description: "Sync" }] }));

    await expect(loadActivityFile(path)).resolves.toMatchObject({ date: "2026-06-10" });
    await rm(dir, { recursive: true, force: true });
  });

  it("mostra instrucao clara quando o config local nao existe", async () => {
    await expect(loadConfig("config/arquivo-inexistente.json")).rejects.toThrow("npm run init-config");
  });
});
