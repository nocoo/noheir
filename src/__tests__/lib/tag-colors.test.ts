import { describe, expect, it } from "vitest";
import {
  getLabelColorClasses,
  getLabelColorHex,
  getTagColor,
  getUnitCodeColor,
  getUnitCodePrefix,
} from "@/lib/tag-colors";

describe("tag-colors", () => {
  it("returns consistent color for same label", () => {
    const c1 = getTagColor("工资");
    const c2 = getTagColor("工资");
    expect(c1).toBe(c2);
  });

  it("returns valid badge variant", () => {
    const variant = getTagColor("test");
    expect(["default", "secondary", "outline"]).toContain(variant);
  });

  it("returns hex color string", () => {
    const hex = getLabelColorHex("test");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns consistent hex for same label", () => {
    expect(getLabelColorHex("foo")).toBe(getLabelColorHex("foo"));
  });

  it("returns bg and text classes", () => {
    const classes = getLabelColorClasses("test");
    expect(classes.bg).toBeTruthy();
    expect(classes.text).toBeTruthy();
  });

  it("extracts unit code prefix", () => {
    expect(getUnitCodePrefix("A01")).toBe("A");
    expect(getUnitCodePrefix("")).toBe("Unknown");
  });

  it("returns unit code color based on prefix", () => {
    const variant = getUnitCodeColor("A01");
    expect(["default", "secondary", "outline"]).toContain(variant);
  });
});
