import { describe, expect, it } from "bun:test";

describe("smoke", () => {
  it("should run bun test", () => {
    expect(1 + 1).toBe(2);
  });
});
