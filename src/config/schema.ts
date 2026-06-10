import { z } from "zod";

export const configSchema = z.object({
  azureDevOps: z.object({
    orgUrl: z.string().url(),
    project: z.string().min(1),
    authMethod: z.enum(["azure-cli", "azure-identity", "pat"]),
    defaultTeam: z.string().min(1).nullable()
  }),
  sevenPace: z.object({
    baseUrl: z.string().url(),
    timesheetUrl: z.string().url().optional(),
    mode: z.literal("playwright"),
    headless: z.boolean()
  }),
  time: z.object({
    dailyTargetMinutes: z.number().int().positive(),
    defaultDailyMinutes: z.number().int().nonnegative(),
    minimumEntryMinutes: z.number().int().positive()
  }),
  defaults: z.object({
    dailyWorkItemId: z.number().int().positive(),
    capexStrategy: z.literal("activeAssignedUserStory")
  }),
  opexRules: z.record(z.object({
    label: z.string().min(1),
    workItemId: z.number().int().positive().optional(),
    featureId: z.number().int().positive().optional(),
    createUserStory: z.boolean().optional()
  })),
  duplicatePolicy: z.object({
    sameDateSameWorkItem: z.enum(["update", "skip", "fail"]),
    allowMultipleEntriesSameWorkItem: z.boolean(),
    validateFinalTotal: z.boolean()
  })
});

export const activityFileSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activities: z.array(z.object({
    type: z.string().min(1),
    minutes: z.number().int().positive(),
    description: z.string().min(1),
    workItemId: z.number().int().positive().optional()
  }))
});
