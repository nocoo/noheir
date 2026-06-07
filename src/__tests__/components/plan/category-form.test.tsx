import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { createMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/expense-category-actions", () => ({
  createExpenseCategory: createMock,
  updateExpenseCategory: updateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

import { CategoryForm } from "@/components/plan/category-form";

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CategoryForm rendering (P3-C3)", () => {
  test("create mode: empty name, default color chart-1, default sort 0", () => {
    render(<CategoryForm />);
    expect(screen.getByRole("form", { name: "新建分类" })).toBeInTheDocument();
    expect(screen.getByLabelText("分类名")).toHaveValue("");
    // First swatch (chart-1 = Sky) is selected by default.
    expect(screen.getByRole("radio", { name: "Sky" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("排序")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "创建" })).toBeInTheDocument();
  });

  test("edit mode: prefilled from initial, button reads 保存", () => {
    render(
      <CategoryForm
        initial={{ id: "cat-1", name: "房贷", colorToken: "chart-9", sortOrder: 3 }}
      />,
    );
    expect(screen.getByRole("form", { name: "编辑分类" })).toBeInTheDocument();
    expect(screen.getByLabelText("分类名")).toHaveValue("房贷");
    expect(screen.getByRole("radio", { name: "Red" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("排序")).toHaveValue(3);
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
  });

  test("edit mode with illegal initial colorToken falls back to default", () => {
    render(
      <CategoryForm
        initial={{ id: "cat-1", name: "x", colorToken: "rebeccapurple" }}
      />,
    );
    // Default = chart-1 = Sky.
    expect(screen.getByRole("radio", { name: "Sky" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("CategoryForm submit — create (P3-C3)", () => {
  test("happy path: createExpenseCategory called, toast.success, onSuccess receives new id", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "new-id" } });
    render(<CategoryForm onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText("分类名"), "保险");
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      name: "保险",
      colorToken: "chart-2",
      sortOrder: 0,
    });
    expect(toastSuccess).toHaveBeenCalledWith("分类已创建");
    expect(onSuccess).toHaveBeenCalledWith({ id: "new-id" });
    expect(toastError).not.toHaveBeenCalled();
  });

  test("name trimmed before submit", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "x" } });
    render(<CategoryForm />);
    await user.type(screen.getByLabelText("分类名"), "  房租  ");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "房租" }),
    );
  });

  test("worker error surfaces in inline error and toast", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({
      success: false,
      error: "分类名已存在",
    });
    render(<CategoryForm />);
    await user.type(screen.getByLabelText("分类名"), "房贷");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(toastError).toHaveBeenCalledWith("分类名已存在");
    expect(screen.getByRole("alert")).toHaveTextContent("分类名已存在");
  });
});

describe("CategoryForm submit — edit (P3-C3)", () => {
  test("update payload includes only edited fields' final values", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    updateMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CategoryForm
        initial={{ id: "cat-9", name: "old", colorToken: "chart-9", sortOrder: 0 }}
        onSuccess={onSuccess}
      />,
    );
    const nameInput = screen.getByLabelText("分类名");
    await user.clear(nameInput);
    await user.type(nameInput, "new");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith("cat-9", {
      name: "new",
      colorToken: "chart-9",
      sortOrder: 0,
    });
    expect(toastSuccess).toHaveBeenCalledWith("分类已更新");
    // onSuccess receives the existing id in edit mode.
    expect(onSuccess).toHaveBeenCalledWith({ id: "cat-9" });
  });

  test("createExpenseCategory is NOT called in edit mode", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValueOnce({ success: true, data: undefined });
    render(
      <CategoryForm
        initial={{ id: "cat-1", name: "x", colorToken: "chart-1" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(updateMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("CategoryForm client-side validation (P3-C3)", () => {
  test("empty name → inline error, Server Action not called", async () => {
    const user = userEvent.setup();
    render(<CategoryForm />);
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请填写分类名");
    expect(createMock).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("whitespace-only name → still rejected", async () => {
    const user = userEvent.setup();
    render(<CategoryForm />);
    await user.type(screen.getByLabelText("分类名"), "   ");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请填写分类名");
    expect(createMock).not.toHaveBeenCalled();
  });

  test("changing a field after error clears the matching error", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce({ success: true, data: { id: "x" } });
    render(<CategoryForm />);
    // Trigger empty-name error first.
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请填写分类名");
    // Now selecting a color should clear color error (none here, but no-op safe).
    // Fix the actual problem and resubmit.
    await user.type(screen.getByLabelText("分类名"), "ok");
    await user.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CategoryForm pending state (P3-C3)", () => {
  test("during transition the submit button shows 保存中... and is disabled", async () => {
    const user = userEvent.setup();
    let resolve: ((v: { success: boolean; data: { id: string } }) => void) | null = null;
    const pending = new Promise<{ success: boolean; data: { id: string } }>((r) => {
      resolve = r;
    });
    createMock.mockReturnValueOnce(pending);
    render(<CategoryForm />);
    await user.type(screen.getByLabelText("分类名"), "abc");
    await user.click(screen.getByRole("button", { name: "创建" }));
    // Button is now in pending state.
    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
    expect(screen.getByLabelText("分类名")).toBeDisabled();
    // Resolve so React state settles before unmount.
    if (resolve) (resolve as (v: { success: boolean; data: { id: string } }) => void)({ success: true, data: { id: "x" } });
    await screen.findByRole("button", { name: "创建" });
  });
});

describe("CategoryForm cancel (P3-C3)", () => {
  test("cancel button calls onCancel without submitting", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CategoryForm onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  test("no cancel button when onCancel is not provided", () => {
    render(<CategoryForm />);
    expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
  });
});
