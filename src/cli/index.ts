import { Command } from "commander";
import { buildAuthSevenPaceCommand } from "./commands/auth-sevenpace.js";
import { buildPlanDayCommand } from "./commands/plan-day.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildPlanDayCommand());
program.addCommand(buildAuthSevenPaceCommand());

await program.parseAsync(process.argv);
