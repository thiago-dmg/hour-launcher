import { Command } from "commander";
import { planDay } from "../../allocation/allocation-engine.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { renderReview } from "../../review/review-renderer.js";
import { resolveCapexWorkItem, type CapexOptions } from "../capex-work-item.js";

export function buildPlanDayCommand(): Command {
  return new Command("plan-day")
    .requiredOption("--activities <path>", "Arquivo JSON com atividades do dia")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--capex-work-item-id <id>", "US principal para CAPEX, quando nao quiser usar descoberta automatica")
    .option("--capex-title <title>", "Titulo da US CAPEX manual")
    .action(async (options: { activities: string; config: string } & CapexOptions) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const capexWorkItem = await resolveCapexWorkItem(config, options);

      const plan = planDay({
        date: activityFile.date,
        activities: activityFile.activities,
        config,
        capexWorkItem
      });

      console.log(renderReview(plan.date, plan.entries));
    });
}
