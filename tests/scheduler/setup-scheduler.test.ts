import { describe, expect, test } from "vitest";
import { buildCronBlock, buildLaunchCommand, buildWindowsSchedulerCommand } from "../../scripts/setup-scheduler.js";

describe("setup scheduler", () => {
  test("builds the launch command from the project root", () => {
    expect(buildLaunchCommand("/repo/hour launcher")).toBe("cd \"/repo/hour launcher\" && npm run launch -- --activities config/activities.local.json --yes");
  });

  test("builds a weekday cron block for macOS and Linux", () => {
    const block = buildCronBlock({
      projectRoot: "/repo/hour launcher",
      hour: 18,
      minute: 10,
      taskName: "Hour Launcher Daily"
    });

    expect(block).toContain("# BEGIN Hour Launcher Daily");
    expect(block).toContain("10 18 * * 1-5 cd \"/repo/hour launcher\" && npm run launch -- --activities config/activities.local.json --yes");
    expect(block).toContain("# END Hour Launcher Daily");
  });

  test("builds a Windows scheduled task command", () => {
    const command = buildWindowsSchedulerCommand({
      projectRoot: "C:\\Users\\thiagomaia\\Documents\\hour launcher",
      hour: 18,
      minute: 10,
      taskName: "Hour Launcher Daily"
    });

    expect(command).toContain("Register-ScheduledTask");
    expect(command).toContain("New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At 18:10");
    expect(command).toContain("-WorkingDirectory 'C:\\Users\\thiagomaia\\Documents\\hour launcher'");
    expect(command).toContain("npm run launch -- --activities config/activities.local.json --yes");
  });
});
