export type DuplicateAction = "create" | "update" | "skip" | "fail";

export function decideDuplicateAction(input: {
  existingCount: number;
  configuredAction: "update" | "skip" | "fail";
}): DuplicateAction {
  if (input.existingCount === 0) {
    return "create";
  }

  if (input.existingCount > 1) {
    return "fail";
  }

  return input.configuredAction;
}
