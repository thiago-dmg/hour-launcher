import { describe, expect, it } from "vitest";
import { mapOpexActivity } from "../../src/allocation/opex-mapper.js";
import type { HourLauncherConfig } from "../../src/types/domain.js";

const config = {
  opexRules: {
    reunioes: { label: "Reunioes", workItemId: 171054 },
    sustentacao: { label: "Sustentacao", featureId: 171057, createUserStory: true }
  }
} as HourLauncherConfig;

describe("opex-mapper", () => {
  it("mapeia atividade OPEX com US fixa", () => {
    expect(mapOpexActivity({ type: "reunioes", minutes: 30, description: "Sync" }, config)).toEqual({
      kind: "mapped",
      label: "Reunioes",
      workItemId: 171054
    });
  });

  it("usa workItemId informado quando a regra exige criacao futura de US", () => {
    expect(mapOpexActivity({ type: "sustentacao", minutes: 60, description: "Suporte", workItemId: 200001 }, config)).toEqual({
      kind: "mapped",
      label: "Sustentacao",
      workItemId: 200001
    });
  });

  it("falha quando regra exige criacao futura de US sem workItemId", () => {
    expect(() => mapOpexActivity({ type: "sustentacao", minutes: 60, description: "Suporte" }, config))
      .toThrow("exige um workItemId concreto");
  });

  it("retorna CAPEX para tipo nao configurado", () => {
    expect(mapOpexActivity({ type: "desenvolvimento", minutes: 60, description: "Dev" }, config)).toEqual({ kind: "capex" });
  });
});
