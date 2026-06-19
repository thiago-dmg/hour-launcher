import { Command } from "commander";
import { businessDaysBetween, todayIsoLocal } from "../../allocation/date-range.js";
import { filterExcludedUserStories, findActiveAssignedUserStoriesFromBrowser, findChildTasksForUserStoriesFromBrowser } from "../../azure-devops/browser-work-item-service.js";
import { loadActivityFile, loadConfig } from "../../config/config-loader.js";
import { closeExistingSevenPaceProfileProcesses, SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";
import { readEntriesForDate, type ExistingTimeEntry } from "../../sevenpace/time-entry-reader.js";
import { updateTimeEntryWorkItem } from "../../sevenpace/time-entry-writer.js";
import type { WorkItemSummary } from "../../types/domain.js";
import { collectWorkItemIds } from "./launch.js";

type CapexTaskRepairAction = {
  entryId: string;
  fromWorkItemId: number;
  toWorkItemId: number;
  date: string;
};

export function buildRepairCommand(): Command {
  return new Command("repair")
    .requiredOption("--activities <path>", "Arquivo JSON com data inicial")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--until <date>", "Data final inclusiva em YYYY-MM-DD", todayIsoLocal())
    .option("--exclude-user-story-id <id>", "Ignora uma US e todas as suas Tasks filhas. Pode repetir ou usar virgula.", collectWorkItemIds, [])
    .option("--yes", "Executa sem pedir confirmacao interativa", false)
    .action(async (options: { activities: string; config: string; until: string; yes: boolean; excludeUserStoryId: number[] }) => {
      const config = await loadConfig(options.config);
      const activityFile = await loadActivityFile(options.activities);
      const dates = businessDaysBetween(activityFile.date, options.until);
      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const { context, page } = await sevenPace.openTimesheet(activityFile.date);
      let caughtError: unknown;

      try {
        console.log("Buscando US CAPEX e Tasks filhas automaticamente pela sessao do navegador...");
        const userStories = filterExcludedUserStories(await findActiveAssignedUserStoriesFromBrowser(page, config), options.excludeUserStoryId);
        const tasks = await findChildTasksForUserStoriesFromBrowser(page, config, userStories);
        const userStoryIds = new Set(userStories.map((item) => item.id));
        const entries: ExistingTimeEntry[] = [];

        if (tasks.length === 0) {
          throw new Error(`Nenhuma Task filha foi encontrada nas US CAPEX ativas: ${[...userStoryIds].join(", ")}.`);
        }

        for (const date of dates) {
          entries.push(...await readEntriesForDate(page, date));
        }

        const actions = buildCapexTaskRepairActions({
          entries,
          tasks,
          userStoryIds,
          dailyWorkItemId: config.defaults.dailyWorkItemId
        });

        if (actions.length === 0) {
          console.log("Nenhum CAPEX em US pai ou Task repetida para reparar.");
        }

        for (const action of actions) {
          await updateTimeEntryWorkItem(page, action.entryId, action.toWorkItemId);
          console.log(`${action.date}: worklog ${action.entryId} movido de ${action.fromWorkItemId} para Task ${action.toWorkItemId}.`);
        }
      } catch (error) {
        caughtError = error;
        console.error("Erro real da automacao:", error instanceof Error ? error.message : String(error));
      } finally {
        await closeContextOrKillProfile(context);
      }

      if (caughtError) {
        throw caughtError;
      }
    });
}

export function buildCapexTaskRepairActions(options: {
  entries: ExistingTimeEntry[];
  tasks: WorkItemSummary[];
  userStoryIds: Set<number>;
  dailyWorkItemId: number;
}): CapexTaskRepairAction[] {
  const taskById = new Map(options.tasks.map((task) => [task.id, task]));
  const usedTaskIds = new Set<number>();
  const actions: CapexTaskRepairAction[] = [];
  const sortedEntries = [...options.entries].sort(compareEntriesByDate);

  for (const entry of sortedEntries) {
    if (!entry.id || entry.workItemId === options.dailyWorkItemId) {
      continue;
    }

    const existingTask = taskById.get(entry.workItemId);
    if (existingTask) {
      if (usedTaskIds.has(entry.workItemId)) {
        const replacement = pickUnusedTaskForParent(options.tasks, existingTask.parentId, usedTaskIds);
        actions.push({
          entryId: entry.id,
          fromWorkItemId: entry.workItemId,
          toWorkItemId: replacement.id,
          date: entry.date
        });
        usedTaskIds.add(replacement.id);
      } else {
        usedTaskIds.add(entry.workItemId);
      }

      continue;
    }

    if (options.userStoryIds.has(entry.workItemId)) {
      const replacement = pickUnusedTaskForParent(options.tasks, entry.workItemId, usedTaskIds);
      actions.push({
        entryId: entry.id,
        fromWorkItemId: entry.workItemId,
        toWorkItemId: replacement.id,
        date: entry.date
      });
      usedTaskIds.add(replacement.id);
    }
  }

  return actions;
}

export function pickUnusedTaskForParent(tasks: WorkItemSummary[], parentId: number | undefined, usedTaskIds: Set<number>): WorkItemSummary {
  if (tasks.length === 0) {
    throw new Error("Nenhuma Task filha disponivel para reparar os lancamentos CAPEX.");
  }

  const parentTasks = typeof parentId === "number" ? tasks.filter((task) => task.parentId === parentId) : [];
  const candidate = parentTasks.find((task) => !usedTaskIds.has(task.id))
    ?? tasks.find((task) => !usedTaskIds.has(task.id));
  if (!candidate) {
    throw new Error("nao ha Tasks CAPEX livres suficientes para reparar sem repetir Task em dias diferentes.");
  }

  return candidate;
}

function compareEntriesByDate(left: ExistingTimeEntry, right: ExistingTimeEntry): number {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  return (left.timestamp ?? "").localeCompare(right.timestamp ?? "");
}

async function closeContextOrKillProfile(context: Awaited<ReturnType<SevenPacePlaywright["openContext"]>>): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      context.close(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timeout ao fechar Chrome do 7pace.")), 5000);
      })
    ]);
  } catch {
    await closeExistingSevenPaceProfileProcesses();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
