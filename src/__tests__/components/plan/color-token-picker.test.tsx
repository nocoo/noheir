import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";

import { ColorTokenPicker } from "@/components/plan/color-token-picker";
import { CHART_TOKENS } from "@/lib/palette";

function Wrapper(props: {
  initial?: string | null;
  onChange?: (t: string) => void;
  disabled?: boolean;
  tokens?: readonly string[];
}) {
  const [value, setValue] = React.useState<string | null>(props.initial ?? null);
  return (
    <ColorTokenPicker
      value={value}
      onChange={(t) => {
        setValue(t);
        props.onChange?.(t);
      }}
      disabled={props.disabled ?? false}
      {...(props.tokens ? { tokens: props.tokens } : {})}
    />
  );
}

const ALL_RADIOS = () => screen.getAllByRole("radio");

describe("ColorTokenPicker (P3-C1)", () => {
  // ── Rendering ─────────────────────────────────────────────────────

  test("renders all 24 chart tokens by default", () => {
    render(<Wrapper />);
    const group = screen.getByRole("radiogroup", { name: "选择颜色" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(24);
    // Verify the data-token attribute matches the closed set.
    const tokens = radios.map((r) => r.getAttribute("data-token"));
    expect(tokens).toEqual([...CHART_TOKENS]);
  });

  test("each swatch has a human-readable aria-label, not the raw token", () => {
    render(<Wrapper />);
    // chart-1 = Sky. Screen readers should hear "Sky".
    expect(screen.getByRole("radio", { name: "Sky" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Blue" })).toBeInTheDocument();
    // Bare "chart-1" should NOT be the accessible name.
    expect(screen.queryByRole("radio", { name: "chart-1" })).toBeNull();
  });

  test("uses CSS variable for each swatch background", () => {
    render(<Wrapper />);
    const sky = screen.getByRole("radio", { name: "Sky" });
    expect(sky).toHaveStyle({ backgroundColor: "hsl(var(--chart-1))" });
  });

  // ── Closed-set guard ──────────────────────────────────────────────

  test("drops any caller-supplied token outside the closed set", () => {
    // Mix legal + illegal; only legal should render.
    render(<Wrapper tokens={["chart-1", "ff0000", "chart-2", "rgb(0,0,0)", "chart-25"]} />);
    const radios = ALL_RADIOS();
    expect(radios.map((r) => r.getAttribute("data-token"))).toEqual(["chart-1", "chart-2"]);
  });

  // ── Selection ─────────────────────────────────────────────────────

  test("click selects a token and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("chart-2");
    expect(screen.getByRole("radio", { name: "Teal" })).toHaveAttribute("aria-checked", "true");
  });

  test("only the selected swatch has aria-checked=true", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole("radio", { name: "Rose" }));
    const checked = ALL_RADIOS().filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName("Rose");
  });

  test("initial value renders aria-checked=true and Check icon visible", () => {
    render(<Wrapper initial="chart-9" />);
    const red = screen.getByRole("radio", { name: "Red" });
    expect(red).toHaveAttribute("aria-checked", "true");
    // Check icon is an SVG inside the selected swatch.
    expect(red.querySelector("svg")).not.toBeNull();
    // Unselected swatch has no SVG.
    const sky = screen.getByRole("radio", { name: "Sky" });
    expect(sky.querySelector("svg")).toBeNull();
  });

  // ── Tab-stop semantics (radiogroup pattern) ──────────────────────

  test("exactly one swatch is in the tab order (initial value's index)", () => {
    render(<Wrapper initial="chart-5" />);
    const tabbable = ALL_RADIOS().filter((r) => r.getAttribute("tabIndex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("Lime");
  });

  test("when nothing is selected, the first swatch holds the tab stop", () => {
    render(<Wrapper />);
    const tabbable = ALL_RADIOS().filter((r) => r.getAttribute("tabIndex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("Sky");
  });

  // ── Keyboard navigation ───────────────────────────────────────────

  test("ArrowRight moves focus AND selection to the next swatch", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="chart-1" />);
    screen.getByRole("radio", { name: "Sky" }).focus();
    await user.keyboard("{ArrowRight}");
    const teal = screen.getByRole("radio", { name: "Teal" });
    expect(teal).toHaveFocus();
    expect(teal).toHaveAttribute("aria-checked", "true");
  });

  test("ArrowLeft from index 0 wraps to index 23", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="chart-1" />);
    screen.getByRole("radio", { name: "Sky" }).focus();
    await user.keyboard("{ArrowLeft}");
    const blue = screen.getByRole("radio", { name: "Blue" });
    expect(blue).toHaveFocus();
    expect(blue).toHaveAttribute("aria-checked", "true");
  });

  test("ArrowDown moves down one row (6 columns)", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="chart-1" />);
    screen.getByRole("radio", { name: "Sky" }).focus();
    await user.keyboard("{ArrowDown}");
    const seven = screen.getByRole("radio", { name: "Orange" }); // chart-7
    expect(seven).toHaveFocus();
  });

  test("ArrowUp from top row jumps to bottom row same column", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="chart-1" />);
    screen.getByRole("radio", { name: "Sky" }).focus();
    await user.keyboard("{ArrowUp}");
    // chart-1 (col 0, row 0) → last-row col 0 = chart-19 (Olive).
    const olive = screen.getByRole("radio", { name: "Olive" });
    expect(olive).toHaveFocus();
  });

  test("Home/End jump to first/last", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial="chart-10" />);
    screen.getByRole("radio", { name: "Rose" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Blue" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Sky" })).toHaveFocus();
  });

  test("Enter / Space on a focused swatch keeps it selected (no toggle)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    const sky = screen.getByRole("radio", { name: "Sky" });
    sky.focus();
    await user.keyboard("{Enter}");
    // Native <button> click fires on Enter. Should call onChange once.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("chart-1");
  });

  test("unrelated key press does NOT change focus or selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial="chart-5" onChange={onChange} />);
    const lime = screen.getByRole("radio", { name: "Lime" });
    lime.focus();
    await user.keyboard("a");
    expect(lime).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  // ── Disabled state ────────────────────────────────────────────────

  test("disabled: clicks do not fire onChange and group is aria-disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper disabled onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("radio", { name: "Sky" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("disabled: every swatch has tabIndex=-1 (out of tab order)", () => {
    render(<Wrapper disabled />);
    const tabbable = ALL_RADIOS().filter((r) => r.getAttribute("tabIndex") !== "-1");
    expect(tabbable).toHaveLength(0);
  });

  test("disabled: keyboard nav does not fire onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial="chart-1" disabled onChange={onChange} />);
    // Programmatic focus to bypass disabled (sanity).
    const sky = screen.getByRole("radio", { name: "Sky" });
    sky.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
