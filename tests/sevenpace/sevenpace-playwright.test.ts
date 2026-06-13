import { describe, expect, test } from "vitest";
import { SevenPacePlaywright } from "../../src/sevenpace/sevenpace-playwright.js";
import type { HourLauncherConfig } from "../../src/types/domain.js";

describe("SevenPacePlaywright", () => {
  test("uses the Monthly hub by default", () => {
    const sevenPace = new SevenPacePlaywright({
      baseUrl: "https://dotzmkt.visualstudio.com/Tribos%20Dotz",
      mode: "playwright",
      headless: false
    });

    expect(sevenPace.timesheetUrl()).toBe("https://dotzmkt.visualstudio.com/Tribos%20Dotz/_apps/hub/7pace.Timetracker.Monthly");
  });

  test("local config points to the Monthly hub", async () => {
    const { loadConfig } = await import("../../src/config/config-loader.js");
    const config = await loadConfig("config/hour-launcher.json");

    expect(config.sevenPace.timesheetUrl).toContain("7pace.Timetracker.Monthly");
  });
});
