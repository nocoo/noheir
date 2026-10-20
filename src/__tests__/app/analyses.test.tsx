import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysesClient } from "@/app/analyses/analyses-client";
import { AnalysisDetail } from "@/app/analyses/analysis-detail";
import { AnalysisEditor } from "@/app/analyses/analysis-editor";
import { ReportMarkdown } from "@/components/report-markdown";
import type { Analysis } from "@/domain/api-contract";
import { financeApi } from "@/lib/finance-api";

vi.mock("@/lib/finance-api", () => ({
  financeApi: { createAnalysis: vi.fn(), updateAnalysis: vi.fn(), deleteAnalysis: vi.fn() },
}));
const report: Analysis = {
  id: "r1",
  title: "Cash report",
  markdown: "# Findings\n\nSafe **content**",
  periodStart: "2026-01-01",
  periodEnd: "2026-10-20",
  currencies: ["CNY"],
  externalId: "external1",
  evidence: [{ resource: "transactions", ids: ["t1"], dataRevision: 4 }],
  dataRevision: 4,
  createdBy: { kind: "apiKey", keyId: "k1" },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
  version: 2,
  author: "External writer",
  model: "Example model",
};
beforeEach(() => vi.resetAllMocks());
describe("private reports", () => {
  it("locks external identity and the edit version to the opened report snapshot", async () => {
    const user = userEvent.setup();
    const props = { currentRevision: 5, onSaved: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(
      <AnalysisEditor report={{ ...report, externalId: null }} {...props} />,
    );
    expect(screen.getByLabelText(/^外部标识/)).toBeDisabled();
    await user.clear(screen.getByLabelText("报告标题"));
    await user.type(screen.getByLabelText("报告标题"), "My draft");
    rerender(
      <AnalysisEditor report={{ ...report, version: 3, title: "External update" }} {...props} />,
    );
    vi.mocked(financeApi.updateAnalysis).mockRejectedValueOnce(new Error("Changed; review"));
    await user.click(screen.getByRole("button", { name: "保存报告" }));
    expect(financeApi.updateAnalysis).toHaveBeenCalledWith(
      "r1",
      2,
      expect.objectContaining({ title: "My draft", externalId: null }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Changed; review");
    expect(screen.getByLabelText("报告标题")).toHaveValue("My draft");
  });
  it("keeps deletion tied to the version shown when confirmation opened", async () => {
    const user = userEvent.setup();
    const props = { currentRevision: 5, onDeleted: vi.fn(), onSaved: vi.fn() };
    const { rerender } = render(
      <MemoryRouter>
        <AnalysisDetail report={report} {...props} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "删除报告" }));
    rerender(
      <MemoryRouter>
        <AnalysisDetail report={{ ...report, version: 3 }} {...props} />
      </MemoryRouter>,
    );
    vi.mocked(financeApi.deleteAnalysis).mockRejectedValueOnce(new Error("Changed; review"));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(financeApi.deleteAnalysis).toHaveBeenCalledWith("r1", 2);
  });
  it("renders Markdown without HTML, dangerous URLs or remote image requests", () => {
    const { container } = render(
      <ReportMarkdown
        markdown={
          '# Safe\n\n<script>alert(1)</script>\n\n<img src="https://tracker.test/pixel">\n\n![Tracking](https://tracker.test/pixel)\n\n[Bad](javascript:alert(1)) [Good](https://example.test)'
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "Safe" })).toBeInTheDocument();
    expect(container.querySelector("script, img, iframe")).toBeNull();
    expect(screen.queryByRole("link", { name: "Bad" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Good" })).toHaveAttribute(
      "href",
      "https://example.test",
    );
    expect(screen.getByRole("link", { name: "Good" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
  it("creates reports with typed metadata and preserves input after errors", async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    vi.mocked(financeApi.createAnalysis).mockRejectedValueOnce(new Error("Offline"));
    render(<AnalysisEditor currentRevision={4} onSaved={saved} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText("报告标题"), "Report");
    await user.type(screen.getByLabelText("Markdown 正文"), "# Results");
    await user.click(screen.getByRole("button", { name: "保存报告" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.getByLabelText("Markdown 正文")).toHaveValue("# Results");
    vi.mocked(financeApi.createAnalysis).mockResolvedValue({
      data: { id: "new", version: 1, affected: 1 },
      meta: { requestId: "req" },
    });
    await user.click(screen.getByRole("button", { name: "保存报告" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith("new"));
    expect(financeApi.createAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Report",
        dataRevision: 4,
        currencies: ["CNY"],
        evidence: [],
      }),
    );
  });
  it("uses loaded version when editing and rejects invalid evidence before mutation", async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    render(
      <AnalysisEditor report={report} currentRevision={5} onSaved={saved} onCancel={vi.fn()} />,
    );
    await user.clear(screen.getByLabelText("证据 JSON"));
    await user.type(screen.getByLabelText("证据 JSON"), "invalid");
    await user.click(screen.getByRole("button", { name: "保存报告" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("证据");
    expect(financeApi.updateAnalysis).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("证据 JSON"));
    await user.paste("[]");
    vi.mocked(financeApi.updateAnalysis).mockResolvedValue({
      data: { id: report.id, version: 3, affected: 1 },
      meta: { requestId: "req" },
    });
    await user.click(screen.getByRole("button", { name: "保存报告" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith("r1"));
    expect(financeApi.updateAnalysis).toHaveBeenCalledWith(
      "r1",
      2,
      expect.objectContaining({ dataRevision: 4, externalId: "external1" }),
    );
  });
  it("displays provenance, evidence and stale revision, confirming versioned deletion", async () => {
    const user = userEvent.setup();
    const deleted = vi.fn();
    render(
      <MemoryRouter>
        <AnalysisDetail report={report} currentRevision={5} onDeleted={deleted} onSaved={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/财务数据已变化/)).toBeInTheDocument();
    expect(screen.getByText(/k1/)).toBeInTheDocument();
    expect(screen.getByText(/未经验证/)).toBeInTheDocument();
    expect(screen.getByText(/t1/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除报告" }));
    expect(financeApi.deleteAnalysis).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    vi.mocked(financeApi.deleteAnalysis).mockRejectedValueOnce(new Error("Changed; reload"));
    await user.click(within(dialog).getByRole("button", { name: "确认删除" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Changed; reload");
    vi.mocked(financeApi.deleteAnalysis).mockResolvedValue({
      data: { id: "r1", version: 3, affected: 1 },
      meta: { requestId: "req" },
    });
    await user.click(within(dialog).getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(deleted).toHaveBeenCalled());
    expect(financeApi.deleteAnalysis).toHaveBeenLastCalledWith("r1", 2);
  });
  it("lists reports without inventing a total and binds next-page navigation to filters", () => {
    render(
      <MemoryRouter initialEntries={["/analyses?q=Cash"]}>
        <AnalysesClient
          result={{
            data: [report],
            meta: { requestId: "r", returned: 1, hasMore: true, nextCursor: "next" },
          }}
          currentRevision={5}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Cash report" })).toHaveAttribute(
      "href",
      "/analyses/r1",
    );
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
      "href",
      expect.stringContaining("cursor=next"),
    );
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
      "href",
      expect.stringContaining("q=Cash"),
    );
    expect(screen.getByText("本页 1 份报告")).toBeInTheDocument();
    expect(screen.getByLabelText("搜索标题")).toHaveValue("Cash");
  });
});
