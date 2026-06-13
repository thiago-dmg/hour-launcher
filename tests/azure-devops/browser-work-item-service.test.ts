import { describe, expect, test } from "vitest";
import { buildAssignedChildTasksWiql, buildAssignedUserStoriesWiql, chooseTaskDetails, extractChildWorkItemIds, sortWorkItemsByCreatedDate } from "../../src/azure-devops/browser-work-item-service.js";
import type { WorkItemSummary } from "../../src/types/domain.js";

describe("extractChildWorkItemIds", () => {
  test("extracts hierarchy forward child ids from Azure DevOps relations", () => {
    expect(extractChildWorkItemIds({
      relations: [
        { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/org/_apis/wit/workItems/1" },
        { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://dev.azure.com/org/_apis/wit/workItems/173502" },
        { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://dev.azure.com/org/_apis/wit/workItems/173503" }
      ]
    })).toEqual([173502, 173503]);
  });
});

describe("sortWorkItemsByCreatedDate", () => {
  test("sorts by created date and then id", () => {
    const tasks: WorkItemSummary[] = [
      { id: 173503, title: "Third", state: "Done", workItemType: "Task", createdDate: "2026-06-01T10:00:00Z" },
      { id: 173502, title: "Second", state: "Done", workItemType: "Task", createdDate: "2026-06-01T10:00:00Z" },
      { id: 173499, title: "First", state: "Done", workItemType: "Task", createdDate: "2026-05-30T10:00:00Z" }
    ];

    expect(sortWorkItemsByCreatedDate(tasks).map((task) => task.id)).toEqual([173499, 173502, 173503]);
  });
});

describe("buildAssignedChildTasksWiql", () => {
  test("filters child task ids by current user assignment", () => {
    expect(buildAssignedChildTasksWiql([173502, 173503])).toContain("[System.AssignedTo] = @Me");
    expect(buildAssignedChildTasksWiql([173502, 173503])).toContain("[System.Id] IN (173502, 173503)");
    expect(buildAssignedChildTasksWiql([173502, 173503])).toContain("[System.WorkItemType] = 'Task'");
  });
});

describe("buildAssignedUserStoriesWiql", () => {
  test("includes assigned user stories across board states instead of only active states", () => {
    const wiql = buildAssignedUserStoriesWiql();

    expect(wiql).toContain("[System.AssignedTo] = @Me");
    expect(wiql).toContain("[System.WorkItemType] = 'User Story'");
    expect(wiql).not.toContain("IN ('Active', 'Resolved', 'New')");
    expect(wiql).toContain("[System.State] <> 'Removed'");
  });
});

describe("chooseTaskDetails", () => {
  test("uses assigned tasks when Azure DevOps returns them", () => {
    expect(chooseTaskDetails([173502], [173501, 173502])).toEqual([173502]);
  });

  test("falls back to all child tasks when child tasks are not individually assigned", () => {
    expect(chooseTaskDetails([], [173501, 173502])).toEqual([173501, 173502]);
  });
});
