import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";

// P3-C0 infra smoke: proves the .test.tsx → jsdom → RTL → user-event →
// jest-dom matcher stack is wired end-to-end. Not a feature test.
//
// If this breaks first, the test infrastructure regressed; fix that
// before debugging the failing component test.

function Counter() {
  const [n, setN] = React.useState(0);
  return (
    <div>
      <p data-testid="count">{n}</p>
      <button type="button" onClick={() => setN((x) => x + 1)}>
        increment
      </button>
    </div>
  );
}

describe("test infra smoke (P3-C0)", () => {
  test("render + jest-dom matcher", () => {
    render(<Counter />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  test("user-event click updates state", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole("button", { name: "increment" }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  test("user-event keyboard activates button", async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const btn = screen.getByRole("button", { name: "increment" });
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });
});
