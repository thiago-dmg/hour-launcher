import type { Frame } from "@playwright/test";
import { getSevenPaceFrame } from "./sevenpace-frame.js";

export type SevenPaceFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
};

type BrowserFetchResult = {
  ok: boolean;
  status: number;
  text: string;
};

export async function sevenPaceFetch<T>(frame: Frame, path: string, options: SevenPaceFetchOptions = {}): Promise<T> {
  const page = frame.page();
  let result: BrowserFetchResult;

  try {
    result = await sevenPaceBrowserFetch(frame, path, options);
  } catch (error) {
    if (!isRecoverableFrameError(error)) {
      throw error;
    }

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    result = await sevenPaceBrowserFetch(await getSevenPaceFrame(page), path, options);
  }

  if (result.status === 401) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    result = await sevenPaceBrowserFetch(await getSevenPaceFrame(page), path, options);
  }

  return parseSevenPaceResponse<T>(result);
}

export function isRecoverableFrameError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes("Frame was detached") ||
    error.message.includes("Execution context was destroyed")
  );
}

async function sevenPaceBrowserFetch(frame: Frame, path: string, options: SevenPaceFetchOptions): Promise<BrowserFetchResult> {
  return frame.evaluate(
    async function sevenPaceBrowserFetch({ requestPath, requestOptions }) {
      const normalizedPath = requestPath.replace(/^\/+/, "");
      const url = new URL(`/api/rest/${normalizedPath}`, location.origin);
      url.searchParams.set("api-version", "3.0");
      for (const [name, value] of Object.entries(requestOptions.query ?? {})) {
        url.searchParams.set(name, value);
      }
      const storage: Record<string, string> = {};
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) {
          storage[key] = localStorage.getItem(key) ?? "";
        }
      }

      let token: string | undefined;
      let latestExpiry = 0;
      for (const key of Object.keys(storage)) {
        if (!key.includes("Timetracker:internal_access_token:") || key.includes("expires")) {
          continue;
        }

        const suffix = key.replace("Timetracker:internal_access_token:", "");
        const expiresAt = Date.parse(storage[`Timetracker:internal_access_token_expires_gmt:${suffix}`] ?? "");
        const isValid = Number.isFinite(expiresAt) ? expiresAt > Date.now() : true;
        if (!isValid || expiresAt < latestExpiry) {
          continue;
        }

        latestExpiry = Number.isFinite(expiresAt) ? expiresAt : Number.MAX_SAFE_INTEGER;
        token = storage[key];
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (requestOptions.body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url.toString(), {
        method: requestOptions.method ?? "GET",
        credentials: "include",
        headers,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
      });

      return { ok: response.ok, status: response.status, text: await response.text() };
    },
    { requestPath: path, requestOptions: options }
  );
}

export function buildSevenPaceRestUrl(origin: string, path: string, query: Record<string, string> = {}): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`/api/rest/${normalizedPath}`, origin);
  url.searchParams.set("api-version", "3.0");

  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  return url.toString();
}

export function parseSevenPaceResponse<T>(response: BrowserFetchResult): T {
  if (!response.ok) {
    throw new Error(`7pace REST API falhou ${response.status}: ${response.text}`);
  }

  const parsed = JSON.parse(response.text) as { data: T };
  return parsed.data;
}

export function selectSevenPaceInternalToken(storage: Record<string, string>, now = new Date()): string | undefined {
  let selectedToken: string | undefined;
  let selectedExpiry = 0;

  for (const [key, value] of Object.entries(storage)) {
    if (!key.includes("Timetracker:internal_access_token:") || key.includes("expires")) {
      continue;
    }

    const suffix = key.replace("Timetracker:internal_access_token:", "");
    const expiresAt = Date.parse(storage[`Timetracker:internal_access_token_expires_gmt:${suffix}`] ?? "");
    const hasExpiry = Number.isFinite(expiresAt);
    const isValid = hasExpiry ? expiresAt > now.getTime() : true;

    if (isValid && (!selectedToken || (hasExpiry ? expiresAt : Number.MAX_SAFE_INTEGER) > selectedExpiry)) {
      selectedToken = value;
      selectedExpiry = hasExpiry ? expiresAt : Number.MAX_SAFE_INTEGER;
    }
  }

  return selectedToken;
}
