import { AzureDevOpsClient } from "../azure-devops/azure-devops-client.js";
import { WorkItemService } from "../azure-devops/work-item-service.js";
import type { HourLauncherConfig, WorkItemSummary } from "../types/domain.js";

export type CapexOptions = {
  capexWorkItemId?: string;
  capexTitle?: string;
};

export async function resolveCapexWorkItem(config: HourLauncherConfig, options: CapexOptions): Promise<WorkItemSummary> {
  if (options.capexWorkItemId) {
    const id = Number(options.capexWorkItemId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`--capex-work-item-id invalido: ${options.capexWorkItemId}`);
    }

    return {
      id,
      title: options.capexTitle ?? `US ${id}`,
      state: "Manual",
      workItemType: "User Story"
    };
  }

  try {
    const workItems = await new WorkItemService(new AzureDevOpsClient(config.azureDevOps)).findActiveAssignedUserStories();
    const capexWorkItem = workItems[0];

    if (!capexWorkItem) {
      throw new Error("Nenhuma User Story CAPEX ativa atribuida ao usuario foi encontrada.");
    }

    return capexWorkItem;
  } catch (error) {
    if (isExecutableMissingError(error, "az")) {
      throw new Error(
        "Azure CLI nao encontrado no PATH. Instale o Azure CLI e rode 'az login', ou informe a US principal manualmente com --capex-work-item-id <ID>."
      );
    }

    throw error;
  }
}

function isExecutableMissingError(error: unknown, executable: string): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT"
    && "path" in error
    && (error as NodeJS.ErrnoException).path === executable;
}
