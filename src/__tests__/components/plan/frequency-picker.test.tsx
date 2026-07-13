import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";

import {
  applyFrequencyChange,
  FrequencyPicker,
  type FrequencyValue,
} from "@/components/plan/frequency-picker";

const DEFAULT: FrequencyValue = {
  frequency: "daily",
  interval: 1,
  dayOfMonth: null,
  monthOfYear: null,
  weekday: null,
};

function Wrapper(props: {
  initial?: Partial<FrequencyValue>;
  onChange?: (v: FrequencyValue) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const [value, setValue] = React.useState<FrequencyValue>({
    ...DEFAULT,
    ...props.initial,
  });
  return (
    <FrequencyPicker
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
      disabled={props.disabled ?? false}
      {...(props.errors ? { errors: props.errors } : {})}
    />
  );
}

const FREQ_GROUP = () => screen.getByRole("radiogroup", { name: "频率" });
const FREQ_RADIOS = () => within(FREQ_GROUP()).getAllByRole("radio");
const INTERVAL = () => screen.getByLabelText("每隔") as HTMLInputElement;
const DAY = () => screen.queryByLabelText("日") as HTMLInputElement | null;
const MONTH = () => screen.queryByLabelText("月份") as HTMLInputElement | null;
const WEEKDAY_GROUP = () => screen.queryByRole("radiogroup", { name: "周几" });

describe("applyFrequencyChange (P3-C2)", () => {
  test("same frequency returns the same object reference (no-op)", () => {
    const prev: FrequencyValue = {
      frequency: "monthly",
      interval: 3,
      dayOfMonth: 15,
      monthOfYear: null,
      weekday: null,
    };
    expect(applyFrequencyChange(prev, "monthly")).toBe(prev);
  });

  test("daily clears all conditional fields", () => {
    const prev: FrequencyValue = {
      frequency: "yearly",
      interval: 2,
      dayOfMonth: 15,
      monthOfYear: 6,
      weekday: 3,
    };
    expect(applyFrequencyChange(prev, "daily")).toEqual({
      frequency: "daily",
      interval: 2,
      dayOfMonth: null,
      monthOfYear: null,
      weekday: null,
    });
  });

  test("monthly preserves dayOfMonth, clears monthOfYear + weekday", () => {
    const prev: FrequencyValue = {
      frequency: "yearly",
      interval: 1,
      dayOfMonth: 15,
      monthOfYear: 6,
      weekday: 3,
    };
    expect(applyFrequencyChange(prev, "monthly")).toEqual({
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 15,
      monthOfYear: null,
      weekday: null,
    });
  });

  test("yearly preserves both dayOfMonth and monthOfYear", () => {
    const prev: FrequencyValue = {
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 10,
      monthOfYear: null,
      weekday: 2,
    };
    const next = applyFrequencyChange(prev, "yearly");
    expect(next.dayOfMonth).toBe(10);
    expect(next.weekday).toBeNull();
  });

  test("weekly preserves weekday only", () => {
    const prev: FrequencyValue = {
      frequency: "monthly",
      interval: 1,
      dayOfMonth: 15,
      monthOfYear: null,
      weekday: 2,
    };
    expect(applyFrequencyChange(prev, "weekly")).toEqual({
      frequency: "weekly",
      interval: 1,
      dayOfMonth: null,
      monthOfYear: null,
      weekday: 2,
    });
  });

  test("interval is always preserved across frequency changes", () => {
    const prev: FrequencyValue = {
      frequency: "daily",
      interval: 7,
      dayOfMonth: null,
      monthOfYear: null,
      weekday: null,
    };
    expect(applyFrequencyChange(prev, "monthly").interval).toBe(7);
  });
});

describe("FrequencyPicker rendering (P3-C2)", () => {
  test("renders all 4 frequencies with Chinese labels", () => {
    render(<Wrapper />);
    const labels = FREQ_RADIOS().map((r) => r.getAttribute("aria-label"));
    expect(labels).toEqual(["每天", "每周", "每月", "每年"]);
  });

  test("initial value 'monthly' marks the monthly radio aria-checked", () => {
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: 15 }} />);
    const monthly = screen.getByRole("radio", { name: "每月" });
    expect(monthly).toHaveAttribute("aria-checked", "true");
    const checked = FREQ_RADIOS().filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  test("interval input is always present and shows current value", () => {
    render(<Wrapper initial={{ interval: 3 }} />);
    expect(INTERVAL()).toHaveValue(3);
  });

  test("unit label updates with frequency", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    expect(screen.getByText("天")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "每月" }));
    expect(screen.getByText("月")).toBeInTheDocument();
  });
});

describe("FrequencyPicker conditional fields (P3-C2)", () => {
  test("daily: no dayOfMonth, monthOfYear, or weekday field", () => {
    render(<Wrapper />);
    expect(DAY()).toBeNull();
    expect(MONTH()).toBeNull();
    expect(WEEKDAY_GROUP()).toBeNull();
  });

  test("weekly: weekday radiogroup with 7 options, no day/month", () => {
    render(<Wrapper initial={{ frequency: "weekly", weekday: 1 }} />);
    expect(DAY()).toBeNull();
    expect(MONTH()).toBeNull();
    const wg = WEEKDAY_GROUP();
    expect(wg).not.toBeNull();
    if (!wg) throw new Error("weekday group missing");
    const radios = within(wg).getAllByRole("radio");
    expect(radios).toHaveLength(7);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  test("monthly: dayOfMonth input present, no monthOfYear, no weekday", () => {
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: 5 }} />);
    expect(DAY()).toHaveValue(5);
    expect(MONTH()).toBeNull();
    expect(WEEKDAY_GROUP()).toBeNull();
  });

  test("yearly: both monthOfYear AND dayOfMonth present, no weekday", () => {
    render(<Wrapper initial={{ frequency: "yearly", monthOfYear: 6, dayOfMonth: 1 }} />);
    expect(MONTH()).toHaveValue(6);
    expect(DAY()).toHaveValue(1);
    expect(WEEKDAY_GROUP()).toBeNull();
  });
});

describe("FrequencyPicker frequency-switch reset semantics (P3-C2)", () => {
  test("switching daily → monthly shows empty dayOfMonth field, user fills it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "每月" }));
    expect(DAY()).toBeInTheDocument();
    expect(DAY()).toHaveValue(null);
    const dayInput = DAY();
    if (!dayInput) throw new Error("day input missing");
    await user.type(dayInput, "15");
    expect(DAY()).toHaveValue(15);
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last).toMatchObject({ frequency: "monthly", dayOfMonth: 15 });
  });

  test("switching weekly → monthly clears weekday in the emitted value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly", weekday: 3 }} onChange={onChange} />);
    expect(WEEKDAY_GROUP()).not.toBeNull();
    await user.click(screen.getByRole("radio", { name: "每月" }));
    const emitted = onChange.mock.calls[0]?.[0] as FrequencyValue | undefined;
    if (!emitted) throw new Error("no onChange call");
    expect(emitted.frequency).toBe("monthly");
    expect(emitted.weekday).toBeNull();
    expect(WEEKDAY_GROUP()).toBeNull();
  });

  test("switching yearly → monthly preserves dayOfMonth (still applies)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Wrapper
        initial={{ frequency: "yearly", monthOfYear: 6, dayOfMonth: 15 }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "每月" }));
    const emitted = onChange.mock.calls[0]?.[0] as FrequencyValue | undefined;
    if (!emitted) throw new Error("no onChange call");
    expect(emitted.dayOfMonth).toBe(15);
    expect(emitted.monthOfYear).toBeNull();
  });

  test("switching monthly → yearly preserves dayOfMonth, requires monthOfYear", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: 28 }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "每年" }));
    const emitted = onChange.mock.calls[0]?.[0] as FrequencyValue | undefined;
    if (!emitted) throw new Error("no onChange call");
    expect(emitted.dayOfMonth).toBe(28);
    expect(emitted.monthOfYear).toBeNull();
  });

  test("switching monthly → daily clears dayOfMonth", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: 15 }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "每天" }));
    const emitted = onChange.mock.calls[0]?.[0] as FrequencyValue | undefined;
    if (!emitted) throw new Error("no onChange call");
    expect(emitted.dayOfMonth).toBeNull();
  });
});

describe("FrequencyPicker interval input (P3-C2)", () => {
  test("typing a new interval emits the parsed integer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.clear(INTERVAL());
    await user.type(INTERVAL(), "5");
    expect(INTERVAL()).toHaveValue(5);
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.interval).toBe(5);
  });

  test("clearing interval falls back to 1 (never null) — domain says ≥ 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ interval: 3 }} onChange={onChange} />);
    await user.clear(INTERVAL());
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.interval).toBe(1);
  });
});

describe("FrequencyPicker weekday selection (P3-C2)", () => {
  test("clicking a weekday emits the integer (0..6)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly" }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "周三" }));
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.weekday).toBe(3);
  });

  test("Sunday is weekday=0 (not 7) — pins ISO convention", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly" }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "周日" }));
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.weekday).toBe(0);
  });
});

describe("FrequencyPicker keyboard navigation (P3-C2)", () => {
  test("ArrowRight on the freq radiogroup moves focus AND selection", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const daily = screen.getByRole("radio", { name: "每天" });
    daily.focus();
    await user.keyboard("{ArrowRight}");
    const weekly = screen.getByRole("radio", { name: "每周" });
    expect(weekly).toHaveFocus();
    expect(weekly).toHaveAttribute("aria-checked", "true");
  });

  test("ArrowLeft wraps from index 0 to index 3", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const daily = screen.getByRole("radio", { name: "每天" });
    daily.focus();
    await user.keyboard("{ArrowLeft}");
    const yearly = screen.getByRole("radio", { name: "每年" });
    expect(yearly).toHaveFocus();
  });

  test("Home/End jump to first/last frequency", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={{ frequency: "monthly" }} />);
    screen.getByRole("radio", { name: "每月" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "每年" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "每天" })).toHaveFocus();
  });
});

describe("FrequencyPicker error display (P3-C2)", () => {
  test("interval error renders alert + aria-invalid", () => {
    render(<Wrapper errors={{ interval: "interval ≥ 1" }} />);
    expect(INTERVAL()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("interval ≥ 1");
  });

  test("dayOfMonth error only renders when monthly/yearly", () => {
    const { unmount } = render(
      <Wrapper initial={{ frequency: "daily" }} errors={{ dayOfMonth: "required" }} />,
    );
    expect(screen.queryByText("required")).toBeNull();
    unmount();
    render(
      <Wrapper
        initial={{ frequency: "monthly", dayOfMonth: null }}
        errors={{ dayOfMonth: "required" }}
      />,
    );
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(DAY()).toHaveAttribute("aria-invalid", "true");
  });

  test("weekday error renders inside weekly mode only", () => {
    const { unmount } = render(
      <Wrapper initial={{ frequency: "monthly" }} errors={{ weekday: "pick a day" }} />,
    );
    expect(screen.queryByText("pick a day")).toBeNull();
    unmount();
    render(<Wrapper initial={{ frequency: "weekly" }} errors={{ weekday: "pick a day" }} />);
    expect(screen.getByText("pick a day")).toBeInTheDocument();
    expect(WEEKDAY_GROUP()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("FrequencyPicker disabled (P3-C2)", () => {
  test("disabled: aria-disabled on group, interval input disabled, no onChange on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper disabled onChange={onChange} />);
    expect(FREQ_GROUP()).toHaveAttribute("aria-disabled", "true");
    expect(INTERVAL()).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "每月" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── P3-C2 fix: clamp out-of-range numeric input ──────────────────────

describe("FrequencyPicker input clamping (P3-C2 fix)", () => {
  test("interval typed as '0' emits 1 (domain min)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.clear(INTERVAL());
    await user.type(INTERVAL(), "0");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.interval).toBe(1);
  });

  test("interval typed as '-2' emits 1 (negative clamped)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.clear(INTERVAL());
    // userEvent.type sends each char; emit after "-" alone parses to 1,
    // then after "-2" still parses to 1 (truncated then clamped to ≥1).
    await user.type(INTERVAL(), "-2");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.interval).toBe(1);
  });

  test("interval typed as decimal '1.5' truncates to 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await user.clear(INTERVAL());
    await user.type(INTERVAL(), "1.5");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    // 1.5 truncates to 1 (still ≥ 1, valid).
    expect(last.interval).toBe(1);
  });

  test("month typed as '13' emits null (out of 1..12 range)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Wrapper
        initial={{ frequency: "yearly", monthOfYear: null, dayOfMonth: 1 }}
        onChange={onChange}
      />,
    );
    const month = MONTH();
    if (!month) throw new Error("month input missing");
    await user.type(month, "13");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.monthOfYear).toBeNull();
  });

  test("month typed as '0' emits null (below 1)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Wrapper
        initial={{ frequency: "yearly", monthOfYear: null, dayOfMonth: 1 }}
        onChange={onChange}
      />,
    );
    const month = MONTH();
    if (!month) throw new Error("month input missing");
    await user.type(month, "0");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.monthOfYear).toBeNull();
  });

  test("month typed valid '6' emits 6", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Wrapper
        initial={{ frequency: "yearly", monthOfYear: null, dayOfMonth: 1 }}
        onChange={onChange}
      />,
    );
    const month = MONTH();
    if (!month) throw new Error("month input missing");
    await user.type(month, "6");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.monthOfYear).toBe(6);
  });

  test("month cleared emits null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Wrapper
        initial={{ frequency: "yearly", monthOfYear: 6, dayOfMonth: 1 }}
        onChange={onChange}
      />,
    );
    const month = MONTH();
    if (!month) throw new Error("month input missing");
    await user.clear(month);
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.monthOfYear).toBeNull();
  });

  test("dayOfMonth typed as '32' emits null (above 31)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: null }} onChange={onChange} />);
    const day = DAY();
    if (!day) throw new Error("day input missing");
    await user.type(day, "32");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.dayOfMonth).toBeNull();
  });

  test("dayOfMonth typed as '0' emits null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: null }} onChange={onChange} />);
    const day = DAY();
    if (!day) throw new Error("day input missing");
    await user.type(day, "0");
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.dayOfMonth).toBeNull();
  });

  test("dayOfMonth cleared emits null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "monthly", dayOfMonth: 15 }} onChange={onChange} />);
    const day = DAY();
    if (!day) throw new Error("day input missing");
    await user.clear(day);
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.dayOfMonth).toBeNull();
  });
});

// ── P3-C2 fix: weekday radiogroup keyboard semantics ────────────────

describe("FrequencyPicker weekday keyboard (P3-C2 fix)", () => {
  function weekdayRadios(): HTMLElement[] {
    const wg = WEEKDAY_GROUP();
    if (!wg) throw new Error("weekday group missing");
    return within(wg).getAllByRole("radio");
  }

  test("exactly one weekday radio is in the tab order (selected one)", () => {
    render(<Wrapper initial={{ frequency: "weekly", weekday: 3 }} />);
    const tabbable = weekdayRadios().filter((r) => r.getAttribute("tabIndex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("周三");
  });

  test("when weekday is null, Sunday (index 0) holds the tab stop", () => {
    render(<Wrapper initial={{ frequency: "weekly" }} />);
    const tabbable = weekdayRadios().filter((r) => r.getAttribute("tabIndex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName("周日");
  });

  test("ArrowRight moves focus AND selection to the next weekday", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly", weekday: 1 }} onChange={onChange} />);
    const monday = screen.getByRole("radio", { name: "周一" });
    monday.focus();
    await user.keyboard("{ArrowRight}");
    const tuesday = screen.getByRole("radio", { name: "周二" });
    expect(tuesday).toHaveFocus();
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.weekday).toBe(2);
  });

  test("ArrowLeft wraps from Sunday (0) to Saturday (6)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly", weekday: 0 }} onChange={onChange} />);
    screen.getByRole("radio", { name: "周日" }).focus();
    await user.keyboard("{ArrowLeft}");
    const sat = screen.getByRole("radio", { name: "周六" });
    expect(sat).toHaveFocus();
    const last = onChange.mock.calls.at(-1)?.[0] as FrequencyValue | undefined;
    if (!last) throw new Error("no call");
    expect(last.weekday).toBe(6);
  });

  test("Home/End jump to Sunday/Saturday", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={{ frequency: "weekly", weekday: 3 }} />);
    screen.getByRole("radio", { name: "周三" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "周六" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "周日" })).toHaveFocus();
  });

  test("disabled: every weekday radio has tabIndex=-1 and arrow keys are no-op", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Wrapper initial={{ frequency: "weekly", weekday: 2 }} disabled onChange={onChange} />);
    const tabbable = weekdayRadios().filter((r) => r.getAttribute("tabIndex") !== "-1");
    expect(tabbable).toHaveLength(0);
    screen.getByRole("radio", { name: "周二" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
