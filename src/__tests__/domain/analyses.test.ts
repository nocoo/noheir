import { describe, expect, it } from "vitest";
import {
  buildAnalysisFilters,
  buildAnalysisInput,
  createAnalysisDraft,
  reportRevisionState,
  safeReportUrl,
} from "@/domain/analyses";
import type { Analysis } from "@/domain/api-contract";

describe("report editor and filters", () => {
  it("creates typed drafts and validates full period, currencies, evidence and integer revisions", () => {
    const draft = createAnalysisDraft(undefined, 4, "2026-10-20");
    expect(draft).toMatchObject({
      periodStart: "2026-10-20",
      periodEnd: "2026-10-20",
      currencies: ["CNY"],
      dataRevision: "4",
      evidence: "[]",
    });
    expect(buildAnalysisInput({ ...draft, title: " Cash ", markdown: "# Report" })).toMatchObject({
      title: "Cash",
      markdown: "# Report",
      dataRevision: 4,
      evidence: [],
    });
    for (const patch of [
      { title: "" },
      { evidence: "not json" },
      { evidence: "{}" },
      { periodEnd: "2026-01-01" },
      { currencies: [] },
      { dataRevision: "" },
      { dataRevision: "2.5" },
    ]) {
      expect(() => buildAnalysisInput({ ...draft, title: "Report", ...patch })).toThrow();
    }
    const report = {
      title: "Old",
      markdown: "Body",
      externalId: "ext1",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      currencies: ["USD"],
      dataRevision: 3,
      author: "Writer",
      model: "Model",
      evidence: [{ resource: "transactions", ids: ["t1"], dataRevision: 3 }],
    } as Analysis;
    expect(buildAnalysisInput(createAnalysisDraft(report, 4, "2026-10-20"))).toMatchObject(report);
    expect(
      buildAnalysisInput({ ...draft, title: "Report", author: " ", model: " ", externalId: " " }),
    ).toMatchObject({ author: null, model: null, externalId: null });
  });
  it("normalizes allowed filters only and drops old cursors for changed filters", () => {
    const filters = buildAnalysisFilters(
      new URLSearchParams(
        "q=+Cash+&currency=USD&startDate=2026-01-01&endDate=2026-12-31&cursor=abc&admin=true",
      ),
    );
    expect(Object.fromEntries(filters)).toEqual({
      q: "Cash",
      currency: "USD",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      cursor: "abc",
      limit: "50",
    });
    expect(
      buildAnalysisFilters(new URLSearchParams(), {
        q: "New",
        currency: "",
        startDate: "",
        endDate: "",
      }).has("cursor"),
    ).toBe(false);
    expect(() => buildAnalysisFilters(new URLSearchParams("currency=BOGUS"))).toThrow();
    expect(() =>
      buildAnalysisFilters(new URLSearchParams("startDate=2026-12-31&endDate=2026-01-01")),
    ).toThrow();
    expect(Object.fromEntries(buildAnalysisFilters(new URLSearchParams("q=+&currency=+")))).toEqual(
      { limit: "50" },
    );
  });
  it("shows revision claims honestly and rejects unsafe link protocols", () => {
    expect(reportRevisionState(3, 3)).toBe("current");
    expect(reportRevisionState(2, 3)).toBe("changed");
    expect(reportRevisionState(4, 3)).toBe("unverified");
    expect(reportRevisionState(2, undefined)).toBe("unverified");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,evil",
      "//tracker.test",
      "vbscript:evil",
      "file:///secret",
      "https://user:pass@example.test",
      "\\\\tracker.test",
      "https://[invalid",
      "relative",
      "https://example.test/a b",
    ])
      expect(safeReportUrl(url)).toBe("");
    for (const url of [
      "https://example.test/path",
      "http://example.test",
      "mailto:a@example.test",
      "/analyses/id",
      "#section",
    ])
      expect(safeReportUrl(url)).toBe(url);
  });
});
