import type { WorkItemSummary } from "../types/domain.js";
import { AzureDevOpsClient } from "./azure-devops-client.js";

type WiqlResponse = { workItems: Array<{ id: number }> };
type WorkItemsResponse = {
  value: Array<{
    id: number;
    fields: Record<string, unknown>;
  }>;
};

export class WorkItemService {
  constructor(private readonly client: AzureDevOpsClient) {}

  async findActiveAssignedUserStories(): Promise<WorkItemSummary[]> {
    const wiql = {
      query: `
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.AssignedTo] = @Me
          AND [System.WorkItemType] = 'User Story'
          AND [System.State] IN ('Active', 'Resolved', 'New')
        ORDER BY [System.ChangedDate] DESC
      `
    };

    const result = await this.client.post<WiqlResponse>("wit/wiql?api-version=7.1", wiql);
    const ids = result.workItems.map((item) => item.id);

    if (ids.length === 0) {
      return [];
    }

    const details = await this.client.get<WorkItemsResponse>(`wit/workitems?ids=${ids.join(",")}&api-version=7.1`);
    return details.value.map((item) => ({
      id: item.id,
      title: String(item.fields["System.Title"] ?? ""),
      state: String(item.fields["System.State"] ?? ""),
      assignedTo: formatAssignedTo(item.fields["System.AssignedTo"]),
      workItemType: String(item.fields["System.WorkItemType"] ?? "")
    }));
  }
}

function formatAssignedTo(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "displayName" in value) {
    return String((value as { displayName?: unknown }).displayName ?? "");
  }

  return String(value);
}
