import { chromium, type BrowserContext, type Page } from "@playwright/test";
import type { HourLauncherConfig } from "../types/domain.js";

export class SevenPacePlaywright {
  constructor(private readonly config: HourLauncherConfig["sevenPace"]) {}

  async openContext(): Promise<BrowserContext> {
    return chromium.launchPersistentContext(".auth/sevenpace-profile", {
      headless: this.config.headless,
      viewport: { width: 1440, height: 1000 }
    });
  }

  async openTimesheet(date: string): Promise<{ context: BrowserContext; page: Page }> {
    const context = await this.openContext();
    const page = await context.newPage();
    await page.goto(`${this.config.baseUrl}/_apps/hub/7pace.Timetracker.TimetrackerHub`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const dateLocator = page.getByText(date, { exact: false }).first();
    if (await dateLocator.count()) {
      await dateLocator.click().catch(() => undefined);
    }

    return { context, page };
  }
}
