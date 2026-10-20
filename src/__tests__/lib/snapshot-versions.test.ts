import { describe, expect, it } from "vitest";
import { toDomainContributionLog, toDomainProduct, toDomainUnit } from "@/lib/capital-mappers";
import { toCategory, toRecurrenceRule } from "@/lib/recurring-expense/mappers";

describe("read snapshot version propagation", () => {
  it("preserves server versions in capital edit snapshots, without defaulting missing versions", () => {
    expect(toDomainProduct({ id: "p", version: 7 }).version).toBe(7);
    expect(toDomainUnit({ id: "u", version: 8 }).version).toBe(8);
    expect(toDomainContributionLog({ id: "l", version: 9 }).version).toBe(9);
    expect(Number.isNaN(toDomainProduct({ id: "p" }).version)).toBe(true);
  });
  it("preserves recurring/category versions", () => {
    expect(
      toRecurrenceRule({ id: "r", version: 4, frequency: "monthly", status: "active" } as never)
        .version,
    ).toBe(4);
    expect(toCategory({ id: "c", version: 5 } as never).version).toBe(5);
  });
});
