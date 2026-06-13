import { Command } from "commander";
import { businessDaysBetween, todayIsoLocal } from "../../allocation/date-range.js";
import { planDayWithCapexPool } from "../../allocation/allocation-engine.js";
import { sumMinutes } from "../../allocation/time-math.js";
import { findActiveAssignedUserStoriesFromBrowser, findChildTasksForUserStoriesFromBrowser } from "../../azure-devops/browser-work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { renderReview } from "../../review/review-renderer.js";
import { closeExistingSevenPaceProfileProcesses, SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { readEntriesForDate } from "../../sevenpace/time-entry-reader.js";
import { createTimeEntries } from "../../sevenpace/time-entry-writer.js";
import { writeRunLog } from "../../storage/run-log-store.js";
import type { WorkItemSummary } from "../../types/domain.js";
import { resolveConfiguredCapexWorkItem, type CapexOptions } from "../capex-work-item.js";

export function buildLaunchCommand(): Command {
  return new Command("launch")
    .requiredOption("--activities <path>", "Arquivo JSON com data inicial e atividades padrao")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--until <date>", "Data final inclusiva em YYYY-MM-DD", todayIsoLocal())
    .option("--capex-work-item-id <id>", "US principal para CAPEX, quando nao quiser usar descoberta automatica")
    .option("--capex-title <title>", "Titulo da US CAPEX manual")
    .option("--yes", "Executa sem pedir confirmacao interativa", false)
    .action(async (options: { activities: string; config: string; until: string; yes: boolean } & CapexOptions) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const dates = businessDaysBetween(activityFile.date, options.until);
      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const { context, page } = await sevenPace.openTimesheet(activityFile.date);
      let caughtError: unknown;

      try {
        const configuredCapex = resolveConfiguredCapexWorkItem(config, options);
        const capexWorkItems = configuredCapex ? [configuredCapex] : await findCapexWorkItems(page, config);
        const usedCapexWorkItemIds = new Set<number>();
        const capexWorkItemIds = new Set(capexWorkItems.map((workItem) => workItem.id));

        for (const date of dates) {
          const existingEntries = await readEntriesForDate(page, date);
          for (const existingEntry of existingEntries) {
            if (capexWorkItemIds.has(existingEntry.workItemId)) {
              usedCapexWorkItemIds.add(existingEntry.workItemId);
            }
          }

          const existingTotalMinutes = sumMinutes(existingEntries);

          if (existingTotalMinutes >= config.time.dailyTargetMinutes) {
            console.log(`${date}: ja possui 8h. Pulando.`);
            await writeRunLog({ date, entries: [], result: "skipped", finalTotalMinutes: existingTotalMinutes });
            continue;
          }

          const plan = planDayWithCapexPool({
            date,
            activities: activityFile.activities,
            config,
            capexWorkItems: selectUnusedCapexWorkItems(capexWorkItems, usedCapexWorkItemIds),
            existingEntries
          });

          console.log(renderReview(plan.date, plan.entries));

          if (plan.entries.length === 0) {
            console.log(`${date}: nada para fazer.`);
            await writeRunLog({ date, entries: [], result: "skipped", finalTotalMinutes: existingTotalMinutes });
            continue;
          }

          await createTimeEntries(page, plan.entries);
          for (const entry of plan.entries) {
            if (capexWorkItemIds.has(entry.workItemId)) {
              usedCapexWorkItemIds.add(entry.workItemId);
            }
          }

          const finalEntries = await readEntriesForDate(page, date);
          const finalTotalMinutes = sumMinutes(finalEntries);

          if (config.duplicatePolicy.validateFinalTotal && finalTotalMinutes !== config.time.dailyTargetMinutes) {
            throw new Error(`${date}: total final invalido no 7pace: ${finalTotalMinutes} minutos.`);
          }

          await writeRunLog({ date, entries: plan.entries, result: "written", finalTotalMinutes });
          console.log(`${date}: lancado e validado com 8h.`);
        }
      } catch (error) {
        caughtError = error;
        console.error("Erro real da automacao:", error instanceof Error ? error.message : String(error));
      } finally {
        await closeContextOrKillProfile(context);
      }

      if (caughtError) {
        throw caughtError;
      }
    });
}

export function selectUnusedCapexWorkItems(capexWorkItems: WorkItemSummary[], usedWorkItemIds: Set<number>): WorkItemSummary[] {
  const unused = capexWorkItems.filter((workItem) => !usedWorkItemIds.has(workItem.id));
  if (unused.length === 0) {
    throw new Error("Nao ha Tasks CAPEX livres suficientes para lancar sem repetir Task em dias diferentes.");
  }

  return unused;
}

async function findCapexWorkItems(page: Parameters<typeof findActiveAssignedUserStoriesFromBrowser>[0], config: Parameters<typeof findActiveAssignedUserStoriesFromBrowser>[1]): Promise<WorkItemSummary[]> {
  console.log("Buscando US CAPEX e Tasks filhas automaticamente pela sessao do navegador...");
  const userStories = await findActiveAssignedUserStoriesFromBrowser(page, config);

  if (userStories.length === 0) {
    throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada pela sessao do navegador.");
  }

  const tasks = await findChildTasksForUserStoriesFromBrowser(page, config, userStories);
  if (tasks.length === 0) {
    throw new Error(`Nenhuma Task filha foi encontrada nas US CAPEX ativas: ${userStories.map((item) => item.id).join(", ")}.`);
  }

  console.log(`Task CAPEX automatica: ${tasks[0].id} - ${tasks[0].title}`);
  return tasks;
}

async function closeContextOrKillProfile(context: Awaited<ReturnType<SevenPacePlaywright["openContext"]>>): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      context.close(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timeout ao fechar Chrome do 7pace.")), 5000);
      })
    ]);
  } catch {
    await closeExistingSevenPaceProfileProcesses();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
