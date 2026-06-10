import { AzureDevOpsClient } from "./azure-devops-client.js";

export type SprintSummary = {
  id: string;
  name: string;
  path: string;
};

type IterationsResponse = {
  value: Array<{
    id: string;
    name: string;
    path: string;
    attributes?: { timeFrame?: string };
  }>;
};

export class SprintService {
  constructor(private readonly client: AzureDevOpsClient, private readonly team: string | null) {}

  async getCurrentSprint(): Promise<SprintSummary | null> {
    const teamSegment = this.team ? `${encodeURIComponent(this.team)}/` : "";
    const result = await this.client.getProjectRelative<IterationsResponse>(`${teamSegment}_apis/work/teamsettings/iterations?api-version=7.1`);
    const current = result.value.find((iteration) => iteration.attributes?.timeFrame === "current");

    if (!current) {
      return null;
    }

    return { id: current.id, name: current.name, path: current.path };
  }
}
