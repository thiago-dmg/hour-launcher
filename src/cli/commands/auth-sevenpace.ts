import { Command } from "commander";
import { loadConfig } from "../../config/config-loader.js";
import { confirmReview } from "../../review/confirmation.js";
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
      console.log("");
      console.log("Este comando apenas prepara a sessao do navegador; ele nao lanca horas.");
      console.log("No navegador aberto, faca login se necessario e clique em 'Authorize' se o 7pace pedir autorizacao.");
      await confirmReview("Quando terminar a autorizacao, digite S e pressione Enter para fechar o navegador: ");
      await context.close();
    });
}
