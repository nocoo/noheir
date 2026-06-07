// Vitest setup for the jsdom project — registers Jest-DOM matchers
// so component tests can use `expect(el).toBeInTheDocument()`, etc.
// Business mocks belong in individual test files, not here.
import "@testing-library/jest-dom/vitest";
