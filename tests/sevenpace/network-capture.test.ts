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
