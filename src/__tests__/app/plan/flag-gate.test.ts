// Page-level test: while FEATURE_PLAN_CALENDAR=false the route MUST 404.
// We can't easily render the async Server Component here, but the page
// reads the flag directly; pin the flag value as the contract that
// drives `notFound()`. P3-C11 will flip the flag in a separate commit
// and this test (the false expectation) will fail by design, prompting
// the test to be updated alongside the flag flip.

import { describe, expect, test } from "vitest";
import { FEATURE_PLAN_CALENDAR } from "@/lib/navigation";

describe("FEATURE_PLAN_CALENDAR flag gate (P3-C9 / P3-C10)", () => {
  test("flag is false → both plan pages 404 via notFound()", () => {
    expect(FEATURE_PLAN_CALENDAR).toBe(false);
  });
});
