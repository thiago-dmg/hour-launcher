import type { Page } from "@playwright/test";
import type { HourLauncherConfig, WorkItemSummary } from "../types/domain.js";

type WiqlResponse = { workItems: Array<{ id: number }> };
type WorkItemsResponse = {
  value: Array<{
    id: number;
    fields: Record<string, unknown>;
    relations?: Array<{ rel?: string; url?: string }>;
  }>;
};

export async function findActiveAssignedUserStoriesFromBrowser(page: Page, config: HourLauncherConfig): Promise<WorkItemSummary[]> {
  const projectUrl = config.sevenPace.baseUrl;
  const wiql = {
    query: buildAssignedUserStoriesWiql()
  };

  const result = await browserFetch<WiqlResponse>(page, `${projectUrl}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    body: wiql
  });
  const ids = result.workItems.map((item) => item.id);

  if (ids.length === 0) {
    return [];
  }

  const details = await browserFetch<WorkItemsResponse>(page, `${projectUrl}/_apis/wit/workitems?ids=${ids.join(",")}&api-version=7.1`);
  return details.value.map((item) => ({
    id: item.id,
    title: String(item.fields["System.Title"] ?? ""),
    state: String(item.fields["System.State"] ?? ""),
    assignedTo: formatAssignedTo(item.fields["System.AssignedTo"]),
    workItemType: String(item.fields["System.WorkItemType"] ?? ""),
    createdDate: formatOptionalString(item.fields["System.CreatedDate"])
  }));
}

export function buildAssignedUserStoriesWiql(): string {
  return `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.AssignedTo] = @Me
      AND [System.WorkItemType] = 'User Story'
      AND [System.State] <> 'Removed'
      AND [System.State] <> 'Closed'
    ORDER BY [System.ChangedDate] DESC
  `;
}

export async function findChildTasksForUserStoriesFromBrowser(page: Page, config: HourLauncherConfig, userStories: WorkItemSummary[]): Promise<WorkItemSummary[]> {
  if (userStories.length === 0) {
    return [];
  }

  const projectUrl = config.sevenPace.baseUrl;
  const userStoryDetails = await browserFetch<WorkItemsResponse>(
    page,
    `${projectUrl}/_apis/wit/workitems?ids=${userStories.map((item) => item.id).join(",")}&$expand=Relations&api-version=7.1`
  );
  const childToParent = new Map<number, number>();

  for (const userStory of userStoryDetails.value) {
    for (const childId of extractChildWorkItemIds(userStory)) {
      childToParent.set(childId, userStory.id);
    }
  }

  const childIds = [...childToParent.keys()];
  if (childIds.length === 0) {
    return [];
  }

  const assignedTaskResult = await browserFetch<WiqlResponse>(page, `${projectUrl}/_apis/wit/wiql?api-version=7.1`, {
    method: "POST",
    body: { query: buildAssignedChildTasksWiql(childIds) }
  });
  const assignedTaskIds = assignedTaskResult.workItems.map((item) => item.id);
  const taskIds = chooseTaskDetails(assignedTaskIds, childIds);
  if (taskIds.length === 0) {
    return [];
  }

  const taskDetails = await browserFetch<WorkItemsResponse>(
    page,
    `${projectUrl}/_apis/wit/workitems?ids=${taskIds.join(",")}&api-version=7.1`
  );

  return sortWorkItemsByCreatedDate(taskDetails.value
    .filter((item) => String(item.fields["System.WorkItemType"] ?? "") === "Task")
    .map((item) => ({
      id: item.id,
      title: String(item.fields["System.Title"] ?? ""),
      state: String(item.fields["System.State"] ?? ""),
      assignedTo: formatAssignedTo(item.fields["System.AssignedTo"]),
      workItemType: String(item.fields["System.WorkItemType"] ?? ""),
      createdDate: formatOptionalString(item.fields["System.CreatedDate"]),
      parentId: childToParent.get(item.id)
    })));
}

export function buildAssignedChildTasksWiql(childIds: number[]): string {
  return `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.Id] IN (${childIds.join(", ")})
      AND [System.WorkItemType] = 'Task'
      AND [System.AssignedTo] = @Me
    ORDER BY [System.CreatedDate] ASC
  `;
}

export function chooseTaskDetails(assignedTaskIds: number[], childIds: number[]): number[] {
  return assignedTaskIds.length > 0 ? assignedTaskIds : childIds;
}

export function extractChildWorkItemIds(item: { relations?: Array<{ rel?: string; url?: string }> }): number[] {
  return (item.relations ?? [])
    .filter((relation) => relation.rel === "System.LinkTypes.Hierarchy-Forward")
    .map((relation) => Number(/\/workItems\/(\d+)$/i.exec(relation.url ?? "")?.[1]))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function sortWorkItemsByCreatedDate<T extends WorkItemSummary>(workItems: T[]): T[] {
  return [...workItems].sort((left, right) => {
    const leftTime = Date.parse(left.createdDate ?? "");
    const rightTime = Date.parse(right.createdDate ?? "");
    const normalizedLeftTime = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
    const normalizedRightTime = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;

    if (normalizedLeftTime !== normalizedRightTime) {
      return normalizedLeftTime - normalizedRightTime;
    }

    return left.id - right.id;
  });
}

async function browserFetch<T>(page: Page, url: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  return page.evaluate(
    async ({ requestUrl, requestOptions }) => {
      const response = await fetch(requestUrl, {
        method: requestOptions.method ?? "GET",
        credentials: "include",
        headers: requestOptions.body ? { "Content-Type": "application/json" } : undefined,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`Azure DevOps via navegador falhou ${response.status}: ${await response.text()}`);
      }

      return response.json();
    },
    { requestUrl: url, requestOptions: options }
  ) as Promise<T>;
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

function formatOptionalString(value: unknown): string | undefined {
  return value ? String(value) : undefined;
}
