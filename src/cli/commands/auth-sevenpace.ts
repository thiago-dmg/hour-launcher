import { Command } from "commander";
import { loadConfig } from "../../config/config-loader.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";

export function buildAuthSevenPaceCommand(): Command {
  return new Command("auth-sevenpace")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .action(async (options: { config: string }) => {
      const config = await loadConfig(options.config);
      const sevenPace = new SevenPacePlaywright({ ...config.sevenPace, headless: false });
      const context = await sevenPace.openContext();
      const page = await context.newPage();
      await page.goto(sevenPace.timesheetUrl());
      console.log("Conclua o login no navegador aberto. Pressione Ctrl+C quando terminar.");
      await page.waitForTimeout(10 * 60 * 1000);
      await context.close();
    });
}
