import { constants } from "node:fs";
import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Command } from "commander";

const filesToCreate = [
  {
    source: "config/hour-launcher.example.json",
    target: "config/hour-launcher.json"
  },
  {
    source: "config/activities.example.json",
    target: "config/activities.local.json"
  }
];

export function buildInitConfigCommand(): Command {
  return new Command("init-config")
    .description("Cria arquivos locais de configuracao a partir dos exemplos")
    .option("--force", "Sobrescreve arquivos locais existentes", false)
    .action(async (options: { force: boolean }) => {
      for (const file of filesToCreate) {
        await copyExample(file.source, file.target, options.force);
      }
    });
}

async function copyExample(source: string, target: string, force: boolean): Promise<void> {
  const exists = await fileExists(target);
  if (exists && !force) {
    console.log(`Mantido: ${target} ja existe.`);
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`Criado: ${target}`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
