import { Command } from "commander";
import { planDay } from "../../allocation/allocation-engine.js";
import { AzureDevOpsClient } from "../../azure-devops/azure-devops-client.js";
import { WorkItemService } from "../../azure-devops/work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { renderReview } from "../../review/review-renderer.js";

export function buildPlanDayCommand(): Command {
  return new Command("plan-day")
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

      const plan = planDay({
        date: activityFile.date,
        activities: activityFile.activities,
        config,
        capexWorkItem
      });

      console.log(renderReview(plan.date, plan.entries));
    });
}
