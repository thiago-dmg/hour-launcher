import { describe, expect, it } from "vitest";
import { formatMinutes, parseHourText, sumMinutes } from "../../src/allocation/time-math.js";

describe("time-math", () => {
  it("formata minutos como horas e minutos", () => {
    expect(formatMinutes(30)).toBe("0h30");
    expect(formatMinutes(480)).toBe("8h00");
    expect(formatMinutes(75)).toBe("1h15");
  });

  it("interpreta texto de horas", () => {
    expect(parseHourText("0h30")).toBe(30);
    expect(parseHourText("1h00")).toBe(60);
    expect(parseHourText("7h30")).toBe(450);
  });

  it("soma listas de minutos", () => {
    expect(sumMinutes([{ minutes: 30 }, { minutes: 60 }, { minutes: 390 }])).toBe(480);
  });
});
