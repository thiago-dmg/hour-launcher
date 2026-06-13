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
