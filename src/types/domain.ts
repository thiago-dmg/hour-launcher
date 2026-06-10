export type WorkItemId = number;

export type ActivityInput = {
  type: string;
  minutes: number;
  description: string;
  workItemId?: WorkItemId;
};

export type DayActivityFile = {
  date: string;
  activities: ActivityInput[];
};

export type OpexRule = {
  label: string;
  workItemId?: WorkItemId;
  featureId?: WorkItemId;
  createUserStory?: boolean;
};

export type HourLauncherConfig = {
  azureDevOps: {
    orgUrl: string;
    project: string;
    authMethod: "azure-cli" | "azure-identity" | "pat";
    defaultTeam: string | null;
  };
  sevenPace: {
    baseUrl: string;
    timesheetUrl?: string;
    mode: "playwright";
    headless: boolean;
  };
  time: {
    dailyTargetMinutes: number;
    defaultDailyMinutes: number;
    minimumEntryMinutes: number;
  };
  defaults: {
    dailyWorkItemId: WorkItemId;
    capexStrategy: "activeAssignedUserStory";
    capexWorkItemId?: WorkItemId | null;
  };
  opexRules: Record<string, OpexRule>;
  duplicatePolicy: {
    sameDateSameWorkItem: "update" | "skip" | "fail";
    allowMultipleEntriesSameWorkItem: boolean;
    validateFinalTotal: boolean;
  };
};

export type WorkItemSummary = {
  id: WorkItemId;
  title: string;
  state: string;
  assignedTo?: string;
  workItemType: string;
};

export type PlannedEntry = {
  date: string;
  label: string;
  workItemId: WorkItemId;
  minutes: number;
  description: string;
  category: "CAPEX" | "OPEX";
  source: "daily" | "activity" | "remainder";
};
