// Vitest setup for the jsdom project — registers Jest-DOM matchers
// so component tests can use `expect(el).toBeInTheDocument()`, etc.
// Business mocks belong in individual test files, not here.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom 30.1 keeps viewport focus after removing a focused node. Clear it after
// React/Radix unmount work so the next test's first focus cannot emit a Window
// blur that dismisses its newly opened menu. Use normal DOM focus/blur APIs.
afterEach(async () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  cleanup();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const focusReset = document.createElement("button");
  document.body.append(focusReset);
  focusReset.focus();
  focusReset.blur();
  focusReset.remove();
});

// jsdom ships no ResizeObserver; cmdk (Command/Combobox) constructs one on mount.
// Environment polyfill, not a business mock.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom implements no layout, so Element.scrollIntoView is absent; cmdk calls it
// when highlighting an item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
