import { chromium, type BrowserContext, type Frame, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HourLauncherConfig } from "../types/domain.js";
import { sevenPaceSelectors } from "./selectors.js";

const execFileAsync = promisify(execFile);
const sevenPaceProfilePath = ".auth/sevenpace-profile";

export class SevenPacePlaywright {
  constructor(private readonly config: HourLauncherConfig["sevenPace"]) {}

  async openContext(): Promise<BrowserContext> {
    try {
      return await this.launchContext();
    } catch (error) {
      if (isProfileAlreadyOpenError(error)) {
        console.log("Fechando janela anterior do Playwright/7pace que ficou aberta...");
        await closeExistingSevenPaceProfileProcesses();
        try {
          return await this.launchContext();
        } catch {
          throw new Error("Ja existe uma janela do Playwright/Chromium aberta com o perfil do 7pace. Feche essa janela antes de rodar o comando novamente.");
        }
      }

      throw error;
    }
  }

  private async launchContext(): Promise<BrowserContext> {
    return chromium.launchPersistentContext(sevenPaceProfilePath, {
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
    await page.waitForLoadState("load").catch(() => undefined);
    console.log(`URL final do 7pace: ${page.url()}`);

    await selectMonthlyDate(page, date);

    return { context, page };
  }

  timesheetUrl(): string {
    return this.config.timesheetUrl ?? `${this.config.baseUrl}/_apps/hub/7pace.Timetracker.Monthly`;
  }
}

function isProfileAlreadyOpenError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes("Abrindo em uma sess") ||
    error.message.includes("ProcessSingleton") ||
    error.message.includes("user data directory is already in use")
  );
}

export async function closeExistingSevenPaceProfileProcesses(): Promise<void> {
  const profileNeedle = "sevenpace-profile";
  const script = `
    Get-CimInstance Win32_Process |
      Where-Object { $_.CommandLine -like '*${profileNeedle}*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;

  await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => undefined);
}

async function selectMonthlyDate(page: Page, date: string): Promise<void> {
  const frame = page.frames().find((candidate) => candidate.url().includes("timehub.7pace.com"));
  if (!frame) {
    return;
  }

  await frame.locator(".month-selector-container-calendar-month").waitFor({ state: "visible", timeout: 30000 });
  await navigateMonthlyCalendarToDate(frame, date);

  const dayLocator = frame.locator(sevenPaceSelectors.monthlyDay(date)).filter({ visible: true }).first();
  await dayLocator.waitFor({ state: "visible", timeout: 10000 });
  await dayLocator.click();
  await frame.locator(sevenPaceSelectors.addEntryButton).filter({ visible: true }).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => undefined);
}

async function navigateMonthlyCalendarToDate(frame: Frame, date: string): Promise<void> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await frame.locator(sevenPaceSelectors.monthlyDay(date)).filter({ visible: true }).first().isVisible().catch(() => false)) {
      return;
    }

    const direction = await frame.evaluate(function findMonthlyDirection(targetDate) {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ];
      let titleElement: Element | undefined;
      const elements = Array.from(document.querySelectorAll("body *"));
      for (const element of elements) {
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const isVisible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        let isMonthTitle = false;
        for (const month of monthNames) {
          if (new RegExp(`^${month}, \\d{4}$`).test(text)) {
            isMonthTitle = true;
            break;
          }
        }

        if (isVisible && isMonthTitle) {
          titleElement = element;
          break;
        }
      }

      if (!titleElement) {
        return 0;
      }

      const targetDateParts = targetDate.split("-");
      const targetYear = Number(targetDateParts[0]);
      const targetMonth = Number(targetDateParts[1]);
      const currentParts = (titleElement.textContent ?? "").trim().split(",");
      const currentMonthName = currentParts[0].trim();
      const currentYearText = currentParts[1].trim();
      const currentMonth = monthNames.indexOf(currentMonthName) + 1;
      const currentYear = Number(currentYearText);
      const delta = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
      return Math.sign(delta);
    }, date);

    if (direction === 0) {
      break;
    }

    const clicked = await clickMonthlyArrow(frame, direction < 0 ? "previous" : "next");
    if (!clicked) {
      break;
    }

    await frame.page().waitForTimeout(700);
  }

  throw new Error(`Dia ${date} nao apareceu no calendario Monthly depois de navegar entre meses.`);
}

async function clickMonthlyArrow(frame: Frame, direction: "previous" | "next"): Promise<boolean> {
  return frame.evaluate(function clickVisibleMonthlyArrow(targetDirection) {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    let titleElement: Element | undefined;
    const elements = Array.from(document.querySelectorAll("body *"));
    for (const element of elements) {
      const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      let isMonthTitle = false;
      for (const month of monthNames) {
        if (new RegExp(`^${month}, \\d{4}$`).test(text)) {
          isMonthTitle = true;
          break;
        }
      }

      if (isVisible && isMonthTitle) {
        titleElement = element;
        break;
      }
    }

    if (!titleElement) {
      return false;
    }

    const titleRect = titleElement.getBoundingClientRect();
    let target: Element | undefined;
    let targetDistance = Number.POSITIVE_INFINITY;
    const candidates = Array.from(document.querySelectorAll("button, a, span, i, div"));
    for (const element of candidates) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      if (!isVisible) {
        continue;
      }

      const alignedWithTitle = Math.abs((rect.top + rect.bottom) / 2 - (titleRect.top + titleRect.bottom) / 2) < 45;
      const onCorrectSide = targetDirection === "previous" ? rect.right <= titleRect.left : rect.left >= titleRect.right;
      if (!alignedWithTitle || !onCorrectSide) {
        continue;
      }

      const distance = targetDirection === "previous" ? titleRect.left - rect.right : rect.left - titleRect.right;
      if (distance < targetDistance) {
        target = element;
        targetDistance = distance;
      }
    }

    if (!target) {
      return false;
    }

    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  }, direction);
}
