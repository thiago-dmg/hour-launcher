import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HourLauncherConfig } from "../types/domain.js";

const execFileAsync = promisify(execFile);

export class AzureDevOpsClient {
  constructor(private readonly config: HourLauncherConfig["azureDevOps"]) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(this.apiUrl(path), {
      headers: await this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps GET falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async getProjectRelative<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.orgUrl}/${this.config.project}/${path}`, {
      headers: await this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps GET falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(this.apiUrl(path), {
      method: "POST",
      headers: {
        ...(await this.authHeaders()),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps POST falhou ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private apiUrl(path: string): string {
    return `${this.config.orgUrl}/${this.config.project}/_apis/${path}`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (this.config.authMethod === "pat") {
      const pat = process.env.AZURE_DEVOPS_PAT;
      if (!pat) {
        throw new Error("AZURE_DEVOPS_PAT nao configurado.");
      }
      return { Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}` };
    }

    const { stdout } = await execFileAsync("az", [
      "account",
      "get-access-token",
      "--resource",
      "499b84ac-1321-427f-aa17-267ca6975798",
      "--query",
      "accessToken",
      "-o",
      "tsv"
    ]);
    return { Authorization: `Bearer ${stdout.trim()}` };
  }
}
