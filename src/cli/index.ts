import { Command } from "commander";
import { buildInitConfigCommand } from "./commands/init-config.js";
import { buildLaunchCommand } from "./commands/launch.js";
import { buildRepairCommand } from "./commands/repair.js";

const program = new Command();

program
  .name("hour-launcher")
  .description("Automacao de lancamento de horas no Azure DevOps + 7pace")
  .version("0.1.0");

program.addCommand(buildLaunchCommand());
program.addCommand(buildInitConfigCommand());
program.addCommand(buildRepairCommand());

await program.parseAsync(process.argv);
