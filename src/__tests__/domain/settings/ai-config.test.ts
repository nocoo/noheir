import { describe, expect, it } from "vitest";
import {
  PREDEFINED_AI_MODELS,
  PREDEFINED_AI_URLS,
  buildFinalConfig,
  isConfigComplete,
  isCustomOption,
} from "@/domain/settings/ai-config";

describe("ai-config domain", () => {
  it("detects custom option", () => {
    expect(isCustomOption("custom", PREDEFINED_AI_URLS)).toBe(true);
    expect(
      isCustomOption("https://api.openai.com/v1", PREDEFINED_AI_URLS),
    ).toBe(false);
    expect(isCustomOption("unknown", PREDEFINED_AI_MODELS)).toBe(true);
  });

  it("checks config completeness", () => {
    expect(
      isConfigComplete({ baseURL: "", modelName: "", apiKey: "" }),
    ).toBe(false);
    expect(
      isConfigComplete({ baseURL: "a", modelName: "b", apiKey: "c" }),
    ).toBe(true);
  });

  it("builds final config with trim", () => {
    expect(
      buildFinalConfig({ baseURL: " a ", modelName: " b ", apiKey: " c " }),
    ).toEqual({
      baseURL: "a",
      modelName: "b",
      apiKey: "c",
    });
  });
});
