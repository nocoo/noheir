import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { deleteMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/expense-category-actions", () => ({
  // CategoryForm consumes these directly; we don't exercise create/update
  // here (covered in P3-C3 tests). Stub them as no-ops.
  createExpenseCategory: vi.fn(),
  updateExpenseCategory: vi.fn(),
  deleteExpenseCategory: deleteMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { CategoriesClient } from "@/app/plan/categories/categories-client";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CategoriesClient render (P3-C9)", () => {
  test("empty state when categories list is empty", () => {
    render(<CategoriesClient categories={[]} usage={{}} />);
    expect(screen.getByTestId("categories-empty")).toBeInTheDocument();
  });

  test("renders one row per category with color chip + name + usage hint", () => {
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "房贷", colorToken: "chart-9", sortOrder: 0 },
          { id: "c2", name: "订阅", colorToken: "chart-1", sortOrder: 1 },
        ]}
        usage={{ c1: 3 }}
      />,
    );
    const list = screen.getByRole("list", { name: "分类列表" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("房贷")).toBeInTheDocument();
    expect(screen.getByText("订阅")).toBeInTheDocument();
    expect(screen.getByText("3 条规则使用")).toBeInTheDocument();
    expect(screen.getByText("未被规则使用")).toBeInTheDocument();
    expect(screen.getByTestId("cat-color-c1")).toHaveStyle({
      backgroundColor: "hsl(var(--chart-9))",
    });
  });

  test("category with off-palette colorToken renders fallback color", () => {
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "bad", colorToken: "rebeccapurple", sortOrder: 0 },
        ]}
        usage={{}}
      />,
    );
    expect(
      screen.getByTestId("cat-color-c1").style.backgroundColor,
    ).toContain("muted-foreground");
  });
});

describe("CategoriesClient create dialog (P3-C9)", () => {
  test("clicking 新建分类 opens the create dialog", async () => {
    const user = userEvent.setup();
    render(<CategoriesClient categories={[]} usage={{}} />);
    await user.click(screen.getByTestId("open-create"));
    expect(
      await screen.findByRole("dialog", { name: "新建分类" }),
    ).toBeInTheDocument();
  });

  test("empty-state CTA opens the create dialog too", async () => {
    const user = userEvent.setup();
    render(<CategoriesClient categories={[]} usage={{}} />);
    await user.click(
      screen.getByRole("button", { name: /创建第一个分类/ }),
    );
    expect(
      await screen.findByRole("dialog", { name: "新建分类" }),
    ).toBeInTheDocument();
  });
});

describe("CategoriesClient edit dialog (P3-C9)", () => {
  test("clicking the row edit button opens edit dialog with prefilled form", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "房贷", colorToken: "chart-9", sortOrder: 3 },
        ]}
        usage={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "编辑 房贷" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑分类" });
    expect(
      within(dialog).getByRole("form", { name: "编辑分类" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("分类名")).toHaveValue("房贷");
  });
});

describe("CategoriesClient delete confirm (P3-C9)", () => {
  test("delete with usage > 0 shows warning copy about rules becoming 未分类", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "房贷", colorToken: "chart-9", sortOrder: 0 },
        ]}
        usage={{ c1: 5 }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "删除 房贷" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/5 条规则正在使用/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/规则本身不会被删除/),
    ).toBeInTheDocument();
  });

  test("delete with usage = 0 shows the plain confirm copy", async () => {
    const user = userEvent.setup();
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "空分类", colorToken: "chart-1", sortOrder: 0 },
        ]}
        usage={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "删除 空分类" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("此操作不可撤销。", { exact: false })).toBeInTheDocument();
  });

  test("confirming delete calls deleteExpenseCategory and toasts success", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "x", colorToken: "chart-1", sortOrder: 0 },
        ]}
        usage={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "删除 x" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /确认删除/ }));
    expect(deleteMock).toHaveBeenCalledWith("c1");
    expect(toastSuccess).toHaveBeenCalledWith("分类已删除");
  });

  test("delete failure surfaces via toast.error and keeps dialog open", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValueOnce({ success: false, error: "无法删除" });
    render(
      <CategoriesClient
        categories={[
          { id: "c1", name: "x", colorToken: "chart-1", sortOrder: 0 },
        ]}
        usage={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "删除 x" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /确认删除/ }));
    expect(toastError).toHaveBeenCalledWith("无法删除");
  });
});
