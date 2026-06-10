import { Command } from "commander";
import { decideDuplicateAction } from "../../allocation/duplicate-policy.js";
import { planDay } from "../../allocation/allocation-engine.js";
import { sumMinutes } from "../../allocation/time-math.js";
import { AzureDevOpsClient } from "../../azure-devops/azure-devops-client.js";
import { WorkItemService } from "../../azure-devops/work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { confirmReview } from "../../review/confirmation.js";
import { renderReview } from "../../review/review-renderer.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { readEntriesForDate } from "../../sevenpace/time-entry-reader.js";
import { createTimeEntry, updateTimeEntry } from "../../sevenpace/time-entry-writer.js";
import { writeRunLog } from "../../storage/run-log-store.js";

export function buildLaunchDayCommand(): Command {
  return new Command("launch-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .action(async (options: { activities: string; config: string }) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const workItems = await new WorkItemService(new AzureDevOpsClient(config.azureDevOps)).findActiveAssignedUserStories();
      const capexWorkItem = workItems[0];

      if (!capexWorkItem) {
        throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada.");
      }

      const plan = planDay({ date: activityFile.date, activities: activityFile.activities, config, capexWorkItem });
      console.log(renderReview(plan.date, plan.entries));

      if (!(await confirmReview())) {
        await writeRunLog({ date: plan.date, entries: plan.entries, result: "failed", errorMessage: "Usuario cancelou a revisao." });
        console.log("Lancamento cancelado.");
        return;
      }

      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const { context, page } = await sevenPace.openTimesheet(plan.date);

      try {
        const existingEntries = await readEntriesForDate(page, plan.date);
        for (const entry of plan.entries) {
          const matchingEntries = existingEntries.filter((existing) => existing.workItemId === entry.workItemId);
          const action = decideDuplicateAction({
            existingCount: matchingEntries.length,
            configuredAction: config.duplicatePolicy.sameDateSameWorkItem
          });

          if (action === "fail") {
            throw new Error(`Entrada duplicada ambigua para work item ${entry.workItemId}.`);
          }

          if (action === "skip") {
            continue;
          }

          if (action === "update") {
            await updateTimeEntry(page, matchingEntries[0], entry);
            continue;
          }

          await createTimeEntry(page, entry);
        }

        const finalEntries = await readEntriesForDate(page, plan.date);
        const finalTotalMinutes = sumMinutes(finalEntries);

        if (config.duplicatePolicy.validateFinalTotal && finalTotalMinutes !== config.time.dailyTargetMinutes) {
          throw new Error(`Total final invalido no 7pace: ${finalTotalMinutes} minutos.`);
        }

        await writeRunLog({ date: plan.date, entries: plan.entries, result: "written", finalTotalMinutes });
      } catch (error) {
        await writeRunLog({
          date: plan.date,
          entries: plan.entries,
          result: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        throw error;
      } finally {
        await context.close();
      }
    });
}
