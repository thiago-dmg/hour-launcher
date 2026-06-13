import { Command } from "commander";
import { planDay } from "../../allocation/allocation-engine.js";
import { findActiveAssignedUserStoriesFromBrowser } from "../../azure-devops/browser-work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { renderReview } from "../../review/review-renderer.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { resolveConfiguredCapexWorkItem, type CapexOptions } from "../capex-work-item.js";

export function buildPlanDayCommand(): Command {
  return new Command("plan-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--capex-work-item-id <id>", "US principal para CAPEX, quando nao quiser usar descoberta automatica")
    .option("--capex-title <title>", "Titulo da US CAPEX manual")
    .action(async (options: { activities: string; config: string } & CapexOptions) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      let capexWorkItem = resolveConfiguredCapexWorkItem(config, options);
      let context: Awaited<ReturnType<SevenPacePlaywright["openContext"]>> | undefined;

      try {
        if (!capexWorkItem) {
          console.log("Buscando US CAPEX automaticamente pela sessao do navegador...");
          const sevenPace = new SevenPacePlaywright(config.sevenPace);
          const opened = await sevenPace.openTimesheet(activityFile.date);
          context = opened.context;
          capexWorkItem = (await findActiveAssignedUserStoriesFromBrowser(opened.page, config))[0];

          if (!capexWorkItem) {
            throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada pela sessao do navegador.");
          }

          console.log(`US CAPEX automatica: ${capexWorkItem.id} - ${capexWorkItem.title}`);
        }

        const plan = planDay({
          date: activityFile.date,
          activities: activityFile.activities,
          config,
          capexWorkItem
        });

        console.log(renderReview(plan.date, plan.entries));
      } finally {
        await context?.close();
      }
    });
}
