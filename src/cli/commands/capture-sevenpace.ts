import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../../config/config-loader.js";
import { confirmReview } from "../../review/confirmation.js";
import { attachSevenPaceCapture } from "../../sevenpace/network-capture.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";

export function buildCaptureSevenPaceCommand(): Command {
  return new Command("capture-sevenpace")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--out <path>", "Arquivo de captura", ".runs/7pace-network-capture.json")
    .action(async (options: { config: string; out: string }) => {
      const config = await loadConfig(options.config);
      const sevenPace = new SevenPacePlaywright({ ...config.sevenPace, headless: false });
      const today = new Date().toISOString().slice(0, 10);
      const { context, page } = await sevenPace.openTimesheet(today);
      const captured = attachSevenPaceCapture(page);

      console.log("");
      console.log("Capture ligado.");
      console.log("No navegador, faca UM lancamento manual no 7pace e clique em Save.");
      console.log("Depois volte aqui e confirme para salvar a captura.");
      await confirmReview("Quando terminar o Save manual, digite S e pressione Enter: ");

      await mkdir(dirname(options.out), { recursive: true });
      await writeFile(options.out, JSON.stringify({ capturedAt: new Date().toISOString(), requests: captured }, null, 2));
      await context.close().catch(() => undefined);
      console.log(`Captura salva em ${options.out}. Requisicoes capturadas: ${captured.length}.`);
    });
}
