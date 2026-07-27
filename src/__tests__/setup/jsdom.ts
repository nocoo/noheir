// Vitest setup for the jsdom project — registers Jest-DOM matchers
// so component tests can use `expect(el).toBeInTheDocument()`, etc.
// Business mocks belong in individual test files, not here.
import "@testing-library/jest-dom/vitest";

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
