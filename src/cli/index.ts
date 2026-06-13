import { Command } from "commander";
import { buildAuthSevenPaceCommand } from "./commands/auth-sevenpace.js";
import { buildCaptureSevenPaceCommand } from "./commands/capture-sevenpace.js";
import { buildInitConfigCommand } from "./commands/init-config.js";
import { buildLaunchDayCommand } from "./commands/launch-day.js";
import { buildLaunchMissingDaysCommand } from "./commands/launch-missing-days.js";
import { buildPlanDayCommand } from "./commands/plan-day.js";
import { buildRepairCapexTaskTargetsCommand } from "./commands/repair-capex-task-targets.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildPlanDayCommand());
program.addCommand(buildLaunchDayCommand());
program.addCommand(buildLaunchMissingDaysCommand());
program.addCommand(buildCaptureSevenPaceCommand());
program.addCommand(buildAuthSevenPaceCommand());
program.addCommand(buildInitConfigCommand());
program.addCommand(buildRepairCapexTaskTargetsCommand());

await program.parseAsync(process.argv);
