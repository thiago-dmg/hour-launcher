import { describe, expect, test, vi } from "vitest";
import { buildSevenPaceRestUrl, parseSevenPaceResponse, selectSevenPaceInternalToken, sevenPaceFetch } from "../../src/sevenpace/sevenpace-rest-client.js";

describe("buildSevenPaceRestUrl", () => {
  test("builds a 7pace REST URL with api-version 3.0", () => {
    expect(buildSevenPaceRestUrl("https://dotzmkt.timehub.7pace.com", "workLogs")).toBe(
      "https://dotzmkt.timehub.7pace.com/api/rest/workLogs?api-version=3.0"
    );
  });

  test("keeps extra query parameters", () => {
    expect(buildSevenPaceRestUrl("https://dotzmkt.timehub.7pace.com", "workLogs", { "$count": "10" })).toBe(
      "https://dotzmkt.timehub.7pace.com/api/rest/workLogs?api-version=3.0&%24count=10"
    );
  });
});

describe("parseSevenPaceResponse", () => {
  test("returns the data property from a successful response", () => {
    expect(parseSevenPaceResponse({ ok: true, status: 200, text: "{\"data\":{\"id\":\"abc\"}}" })).toEqual({ id: "abc" });
  });

  test("throws with status and body when the response fails", () => {
    expect(() => parseSevenPaceResponse({ ok: false, status: 401, text: "Unauthorized" })).toThrow(
      "7pace REST API falhou 401: Unauthorized"
    );
  });
});

describe("selectSevenPaceInternalToken", () => {
  test("selects the internal access token and ignores its expiration key", () => {
    expect(selectSevenPaceInternalToken({
      "Timetracker:internal_access_token_expires_gmt:org:user": "2026-06-12T20:00:00Z",
      "Timetracker:internal_access_token:org:user": "secret-token"
    }, new Date("2026-06-12T19:00:00Z"))).toBe("secret-token");
  });

  test("prefers a token whose paired expiration is still in the future", () => {
    expect(selectSevenPaceInternalToken({
      "Timetracker:internal_access_token_expires_gmt:org:old-user": "Fri, 12 Jun 2026 18:00:00 GMT",
      "Timetracker:internal_access_token:org:old-user": "expired-token",
      "Timetracker:internal_access_token_expires_gmt:org:new-user": "Fri, 12 Jun 2026 23:42:46 GMT",
      "Timetracker:internal_access_token:org:new-user": "valid-token"
    }, new Date("2026-06-12T22:15:00Z"))).toBe("valid-token");
  });
});

describe("sevenPaceFetch", () => {
  test("reloads the page once and retries when the internal token returns 401", async () => {
    const firstEvaluate = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: "{\"error\":\"Unauthorized\"}" });
    const secondEvaluate = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: "{\"data\":[{\"id\":\"ok\"}]}" });
    const reload = vi.fn(async () => undefined);
    const waitForLoadState = vi.fn(async () => undefined);
    const refreshedFrame = {
      url: () => "https://timehub.7pace.com/app",
      evaluate: secondEvaluate
    };
    const page = {
      reload,
      waitForLoadState,
      frames: () => [refreshedFrame],
      waitForTimeout: vi.fn(async () => undefined)
    };
    const frame = {
      evaluate: firstEvaluate,
      page: () => page
    };

    await expect(sevenPaceFetch(frame as never, "workLogs")).resolves.toEqual([{ id: "ok" }]);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(firstEvaluate).toHaveBeenCalledTimes(1);
    expect(secondEvaluate).toHaveBeenCalledTimes(1);
  });

  test("reacquires the 7pace iframe and retries when the frame is detached during a write", async () => {
    const firstEvaluate = vi.fn()
      .mockRejectedValueOnce(new Error("Frame was detached"));
    const secondEvaluate = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: "{\"data\":{\"id\":\"created\"}}" });
    const waitForLoadState = vi.fn(async () => undefined);
    const refreshedFrame = {
      url: () => "https://timehub.7pace.com/monthly",
      evaluate: secondEvaluate
    };
    const page = {
      waitForLoadState,
      frames: () => [refreshedFrame],
      waitForTimeout: vi.fn(async () => undefined)
    };
    const frame = {
      evaluate: firstEvaluate,
      page: () => page
    };

    await expect(sevenPaceFetch(frame as never, "workLogs", { method: "POST", body: { workItemId: 170031 } }))
      .resolves.toEqual({ id: "created" });

    expect(firstEvaluate).toHaveBeenCalledTimes(1);
    expect(secondEvaluate).toHaveBeenCalledTimes(1);
    expect(waitForLoadState).toHaveBeenCalled();
  });
});
