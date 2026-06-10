import { describe, expect, it } from "vitest";
import { decideDuplicateAction } from "../../src/allocation/duplicate-policy.js";

describe("duplicate-policy", () => {
  it("cria quando nao ha entrada existente", () => {
    expect(decideDuplicateAction({ existingCount: 0, configuredAction: "update" })).toBe("create");
  });

  it("atualiza quando existe uma entrada e politica e update", () => {
    expect(decideDuplicateAction({ existingCount: 1, configuredAction: "update" })).toBe("update");
  });

  it("falha quando existem multiplas entradas ambiguas", () => {
    expect(decideDuplicateAction({ existingCount: 2, configuredAction: "update" })).toBe("fail");
  });
});
