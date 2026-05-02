import { describe, expect, it } from "vitest";
import {
  countSelectedInGroup,
  toggleAllInGroup,
  toggleCategory,
} from "@/domain/settings/categories";

describe("categories domain", () => {
  it("toggles a single category", () => {
    expect(toggleCategory(["a"], "a")).toEqual([]);
    expect(toggleCategory(["a"], "b")).toEqual(["a", "b"]);
  });

  it("toggles all categories in group", () => {
    expect(toggleAllInGroup(["a"], ["a", "b"])).toEqual(["a", "b"]);
    expect(toggleAllInGroup(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("counts selected in group", () => {
    expect(countSelectedInGroup(["a", "c"], ["a", "b", "c"])).toBe(2);
  });
});
