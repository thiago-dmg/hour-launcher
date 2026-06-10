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
    for (const existingPage of context.pages()) {
      if (existingPage.url() !== "about:blank") {
        await existingPage.close().catch(() => undefined);
      }
    }

    const page = context.pages()[0] ?? await context.newPage();
    console.log(`Abrindo 7pace em: ${this.timesheetUrl()}`);
    await page.goto(this.timesheetUrl(), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    console.log(`URL final do 7pace: ${page.url()}`);

    const dateLocator = page.getByText(date, { exact: false }).first();
    if (await dateLocator.count()) {
      await dateLocator.click().catch(() => undefined);
    }

    return { context, page };
  }

  timesheetUrl(): string {
    return this.config.timesheetUrl ?? `${this.config.baseUrl}/_apps/hub/7pace.Timetracker.Monthly`;
  }
}
