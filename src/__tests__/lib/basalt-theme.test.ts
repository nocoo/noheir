import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

describe("Basalt theme integration", () => {
  it.each([
    ["system", true, "dark"],
    ["system", false, "light"],
    [null, true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
  ])("hydrates %s with system dark=%s as %s before paint", (stored, dark, mode) => {
    const script = readFileSync("index.html", "utf8").match(/<script>(.*?)<\/script>/s)?.[1];
    if (!script) throw new Error("Theme bootstrap is missing");
    const classes = new Set<string>();
    const root = {
      dataset: {} as Record<string, string>,
      classList: {
        add: (name: string) => classes.add(name),
        toggle: (name: string, enabled: boolean) =>
          enabled ? classes.add(name) : classes.delete(name),
      },
    };
    runInNewContext(script, {
      localStorage: { getItem: (key: string) => (key === "theme" ? stored : "swapped") },
      matchMedia: () => ({ matches: dark }),
      document: { documentElement: root },
    });
    expect(classes.has(mode)).toBe(true);
    expect(root.dataset.mode).toBe(mode);
    expect(classes.has("color-scheme-swapped")).toBe(true);
  });

  it("does not maintain a second ordinary theme or suppress chart keyboard focus", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).not.toMatch(
      /--(?:color-)?(?:primary|background|foreground|card|secondary|muted|accent)(?:-foreground)?:/,
    );
    expect(css).not.toMatch(/outline:\s*none\s*!important/);
    expect(css).toContain('--basalt-font-sans: "Inter Variable"');
    expect(css).toContain('--basalt-font-display: "DM Sans Variable"');
  });
});
