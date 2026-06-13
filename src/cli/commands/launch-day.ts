import { Command } from "commander";
import { applyExistingEntriesToPlan, planDay } from "../../allocation/allocation-engine.js";
import { sumMinutes } from "../../allocation/time-math.js";
import { findActiveAssignedUserStoriesFromBrowser } from "../../azure-devops/browser-work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { confirmReview } from "../../review/confirmation.js";
import { renderReview } from "../../review/review-renderer.js";
import { closeExistingSevenPaceProfileProcesses, SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { readEntriesForDate } from "../../sevenpace/time-entry-reader.js";
import { createTimeEntries } from "../../sevenpace/time-entry-writer.js";
import { writeRunLog } from "../../storage/run-log-store.js";
import { resolveConfiguredCapexWorkItem, type CapexOptions } from "../capex-work-item.js";

export function buildLaunchDayCommand(): Command {
  return new Command("launch-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--capex-work-item-id <id>", "US principal para CAPEX, quando nao quiser usar descoberta automatica")
    .option("--capex-title <title>", "Titulo da US CAPEX manual")
    .option("--yes", "Executa sem pedir confirmacao interativa", false)
    .action(async (options: { activities: string; config: string; yes: boolean } & CapexOptions) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);

      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const { context, page } = await sevenPace.openTimesheet(activityFile.date);
      const capexWorkItem = resolveConfiguredCapexWorkItem(config, options) ?? (await findBrowserCapexWorkItem(page, config));
      const fullDayPlan = planDay({ date: activityFile.date, activities: activityFile.activities, config, capexWorkItem });
      let launchPlan = fullDayPlan;
      let caughtError: unknown;

      try {
        const existingEntries = await readEntriesForDate(page, fullDayPlan.date);
        launchPlan = applyExistingEntriesToPlan({
          plan: fullDayPlan,
          existingEntries,
          dailyTargetMinutes: config.time.dailyTargetMinutes
        });

        console.log(renderReview(launchPlan.date, launchPlan.entries));

        if (launchPlan.entries.length === 0) {
          console.log("Dia ja esta com 8h lancadas. Nada para fazer.");
          await writeRunLog({ date: launchPlan.date, entries: launchPlan.entries, result: "skipped", finalTotalMinutes: config.time.dailyTargetMinutes });
          return;
        }

        if (!options.yes && !(await confirmReview())) {
          await writeRunLog({ date: launchPlan.date, entries: launchPlan.entries, result: "failed", errorMessage: "Usuario cancelou a revisao." });
          console.log("Lancamento cancelado.");
          return;
        }

        await createTimeEntries(page, launchPlan.entries);

        const finalEntries = await readEntriesForDate(page, launchPlan.date);
        const finalTotalMinutes = sumMinutes(finalEntries);
        const expectedFinalTotalMinutes = sumMinutes(existingEntries) + launchPlan.totalMinutes;

        if (
          config.duplicatePolicy.validateFinalTotal &&
          finalTotalMinutes !== config.time.dailyTargetMinutes &&
          expectedFinalTotalMinutes !== config.time.dailyTargetMinutes
        ) {
          throw new Error(`Total final invalido no 7pace: ${finalTotalMinutes} minutos.`);
        }

        await writeRunLog({
          date: launchPlan.date,
          entries: launchPlan.entries,
          result: "written",
          finalTotalMinutes: finalTotalMinutes || expectedFinalTotalMinutes
        });
      } catch (error) {
        caughtError = error;
        console.error("Erro real da automacao:", error instanceof Error ? error.message : String(error));
        await writeRunLog({
          date: launchPlan.date,
          entries: launchPlan.entries,
          result: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      } finally {
        await closeContextOrKillProfile(context);
      }

      if (caughtError) {
        throw caughtError;
      }
    });
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

async function findBrowserCapexWorkItem(page: Awaited<ReturnType<SevenPacePlaywright["openTimesheet"]>>["page"], config: Awaited<ReturnType<typeof loadConfig>>) {
  console.log("Buscando US CAPEX automaticamente pela sessao do navegador...");
  const workItems = await findActiveAssignedUserStoriesFromBrowser(page, config);
  const capexWorkItem = workItems[0];

  if (!capexWorkItem) {
    throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada pela sessao do navegador.");
  }

  console.log(`US CAPEX automatica: ${capexWorkItem.id} - ${capexWorkItem.title}`);
  return capexWorkItem;
}
