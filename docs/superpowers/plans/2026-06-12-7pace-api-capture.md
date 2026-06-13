# 7pace API Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe command that captures the real 7pace internal write request while the user manually saves one time entry.

**Architecture:** Keep Playwright for authenticated browser context and network observation only. Persist sanitized write request metadata to `.runs/7pace-network-capture.json`; do not implement automatic POST writes until the captured contract is reviewed.

**Tech Stack:** TypeScript, Commander, Playwright, Vitest.

---

### File Structure

- Create `src/sevenpace/network-capture.ts`: captures and sanitizes relevant 7pace write requests from a Playwright `Page`.
- Create `src/cli/commands/capture-sevenpace.ts`: opens Monthly, starts capture, instructs the user to manually save one entry, writes capture JSON, and keeps/cleans browser context predictably.
- Modify `src/cli/index.ts`: registers `capture-sevenpace`.
- Modify `package.json`: adds `capture-sevenpace` npm script.
- Create `tests/sevenpace/network-capture.test.ts`: verifies filtering and sanitization.

### Task 1: Network Capture Unit

**Files:**
- Create: `src/sevenpace/network-capture.ts`
- Test: `tests/sevenpace/network-capture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sevenpace/network-capture.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { sanitizeCapturedRequest, shouldCaptureSevenPaceWrite } from "../../src/sevenpace/network-capture.js";

describe("network capture", () => {
  test("captures only 7pace write requests", () => {
    expect(shouldCaptureSevenPaceWrite("POST", "https://dotzmkt.timehub.7pace.com/api/timeentries")).toBe(true);
    expect(shouldCaptureSevenPaceWrite("PUT", "https://dotzmkt.timehub.7pace.com/api/timeentries/1")).toBe(true);
    expect(shouldCaptureSevenPaceWrite("GET", "https://dotzmkt.timehub.7pace.com/api/timeentries")).toBe(false);
    expect(shouldCaptureSevenPaceWrite("POST", "https://dotzmkt.visualstudio.com/_apis/wit/wiql")).toBe(false);
  });

  test("removes sensitive headers before persisting capture", () => {
    const result = sanitizeCapturedRequest({
      method: "POST",
      url: "https://dotzmkt.timehub.7pace.com/api/timeentries",
      headers: {
        authorization: "Bearer secret",
        cookie: "session=secret",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest"
      },
      postData: "{\"workItemId\":171055}"
    });

    expect(result.headers).toEqual({
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest"
    });
    expect(result.postData).toBe("{\"workItemId\":171055}");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/sevenpace/network-capture.test.ts
```

Expected: FAIL because `src/sevenpace/network-capture.ts` does not exist.

- [ ] **Step 3: Implement capture helpers**

Create `src/sevenpace/network-capture.ts`:

```ts
import type { Page, Request } from "@playwright/test";

export type CapturedSevenPaceRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  postData: string | null;
};

const sensitiveHeaderNames = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-tfs-fedauthredirect",
  "x-vss-userdata"
]);

export function shouldCaptureSevenPaceWrite(method: string, url: string): boolean {
  const normalizedMethod = method.toUpperCase();
  return ["POST", "PUT", "PATCH"].includes(normalizedMethod) && new URL(url).hostname.endsWith("timehub.7pace.com");
}

export function sanitizeCapturedRequest(request: CapturedSevenPaceRequest): CapturedSevenPaceRequest {
  return {
    ...request,
    headers: Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => !sensitiveHeaderNames.has(name.toLowerCase()))
    )
  };
}

export function attachSevenPaceCapture(page: Page): CapturedSevenPaceRequest[] {
  const captured: CapturedSevenPaceRequest[] = [];

  page.on("request", (request: Request) => {
    if (!shouldCaptureSevenPaceWrite(request.method(), request.url())) {
      return;
    }

    captured.push(sanitizeCapturedRequest({
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      postData: request.postData()
    }));
  });

  return captured;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- tests/sevenpace/network-capture.test.ts
```

Expected: PASS.

### Task 2: CLI Capture Command

**Files:**
- Create: `src/cli/commands/capture-sevenpace.ts`
- Modify: `src/cli/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement command**

Create `src/cli/commands/capture-sevenpace.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { Command } from "commander";
import { loadConfig } from "../../config/config-loader.js";
import { attachSevenPaceCapture } from "../../sevenpace/network-capture.js";
import { SevenPacePlaywright } from "../../sevenpace/sevenpace-playwright.js";

export function buildCaptureSevenPaceCommand(): Command {
  return new Command("capture-sevenpace")
    .option("--config <path>", "Arquivo de configuracao", "config/hour-launcher.json")
    .option("--out <path>", "Arquivo de captura", ".runs/7pace-network-capture.json")
    .action(async (options: { config: string; out: string }) => {
      const config = await loadConfig(options.config);
      const sevenPace = new SevenPacePlaywright(config.sevenPace);
      const today = new Date().toISOString().slice(0, 10);
      const { context, page } = await sevenPace.openTimesheet(today);
      const captured = attachSevenPaceCapture(page);

      console.log("Faca um lancamento manual de teste no 7pace e clique em Save.");
      console.log("Quando terminar, feche a janela do navegador para salvar a captura.");
      await page.waitForEvent("close", { timeout: 0 });

      await mkdir(".runs", { recursive: true });
      await writeFile(options.out, JSON.stringify({ capturedAt: new Date().toISOString(), requests: captured }, null, 2));
      await context.close().catch(() => undefined);
      console.log(`Captura salva em ${options.out}.`);
    });
}
```

- [ ] **Step 2: Register command**

Modify `src/cli/index.ts`:

```ts
import { buildCaptureSevenPaceCommand } from "./commands/capture-sevenpace.js";
```

Add the command to the program:

```ts
program.addCommand(buildCaptureSevenPaceCommand());
```

- [ ] **Step 3: Add npm script**

Modify `package.json` scripts:

```json
"capture-sevenpace": "tsx src/cli/index.ts capture-sevenpace"
```

- [ ] **Step 4: Run build and tests**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and TypeScript compiles.

### Task 3: Manual Capture Run

**Files:**
- Runtime output: `.runs/7pace-network-capture.json`

- [ ] **Step 1: Run capture**

Run:

```powershell
npm run capture-sevenpace
```

Expected: browser opens Monthly and terminal asks for one manual save.

- [ ] **Step 2: User performs one manual save**

In browser:

1. Select a safe date.
2. Click Add Time.
3. Fill a small test entry or reproduce a real intended entry.
4. Click Save.
5. Close the browser window.

- [ ] **Step 3: Inspect capture**

Run:

```powershell
Get-Content .runs/7pace-network-capture.json
```

Expected: JSON contains at least one POST/PUT/PATCH request to `timehub.7pace.com`, without `authorization` or `cookie` headers.

### Task 4: Stop Point Before API Writer

Do not implement automatic API writes until `.runs/7pace-network-capture.json` is reviewed. The next plan should map `PlannedEntry` to the captured payload and add tests for that mapping.
