import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeysClient } from "@/app/api-keys/api-keys-client";
import type { ApiKeyInfo } from "@/domain/api-contract";
import { financeApi } from "@/lib/finance-api";

vi.mock("@/lib/finance-api", () => ({ financeApi: { createKey: vi.fn(), revokeKey: vi.fn() } }));
const key: ApiKeyInfo = {
  id: "k1",
  label: "Reports",
  prefix: "nhk_prefix",
  scopes: ["analyses:write"],
  createdAt: "2026-10-01T00:00:00Z",
  expiresAt: "2099-10-01T00:00:00Z",
  revokedAt: null,
  lastUsedAt: null,
};
beforeEach(() => vi.resetAllMocks());
describe("human API key management", () => {
  it("shows a secret once, copies only on demand and never persists it", async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    vi.mocked(financeApi.createKey).mockResolvedValue({
      data: { ...key, token: "nhk_secret_once" },
      meta: { requestId: "r" },
    });
    const { unmount } = render(<ApiKeysClient initialKeys={[]} />);
    await user.type(screen.getByLabelText("密钥名称"), "Reports");
    await user.click(screen.getByRole("button", { name: "创建密钥" }));
    expect(await screen.findByText("nhk_secret_once")).toBeInTheDocument();
    expect(copy).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "复制密钥" }));
    expect(copy).toHaveBeenCalledWith("nhk_secret_once");
    expect(localStorage.getItem("api-key")).toBeNull();
    await user.click(screen.getByRole("button", { name: "我已保存，关闭密钥" }));
    expect(screen.queryByText("nhk_secret_once")).not.toBeInTheDocument();
    expect(screen.getByText("nhk_prefix")).toBeInTheDocument();
    unmount();
    render(<ApiKeysClient initialKeys={[key]} />);
    expect(screen.queryByText("nhk_secret_once")).not.toBeInTheDocument();
  });
  it("rejects empty grants/expiry, exposes issuance errors and resets no grants silently", async () => {
    const user = userEvent.setup();
    render(<ApiKeysClient initialKeys={[]} />);
    await user.type(screen.getByLabelText("密钥名称"), "Reports");
    await user.clear(screen.getByLabelText("有效天数"));
    await user.click(screen.getByRole("button", { name: "创建密钥" }));
    expect(financeApi.createKey).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("有效天数"), "90");
    vi.mocked(financeApi.createKey).mockRejectedValue(new Error("Service unavailable"));
    await user.click(screen.getByRole("button", { name: "创建密钥" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
  });
  it("requires revoke confirmation, reports failure and renders revoked/expired metadata", async () => {
    const user = userEvent.setup();
    render(
      <ApiKeysClient
        initialKeys={[
          key,
          { ...key, id: "k2", label: "Expired", expiresAt: "2020-01-01T00:00:00Z" },
          { ...key, id: "k3", label: "Revoked", revokedAt: "2026-10-01T00:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("已过期")).toBeInTheDocument();
    expect(screen.getByText("已撤销")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤销 Reports" }));
    expect(financeApi.revokeKey).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    vi.mocked(financeApi.revokeKey).mockRejectedValueOnce(new Error("Offline"));
    await user.click(within(dialog).getByRole("button", { name: "确认撤销" }));
    expect(await screen.findByText("Offline")).toBeInTheDocument();
    vi.mocked(financeApi.revokeKey).mockResolvedValue({
      data: { id: "k1", version: 1, affected: 1 },
      meta: { requestId: "r" },
    });
    await user.click(within(dialog).getByRole("button", { name: "确认撤销" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(financeApi.revokeKey).toHaveBeenLastCalledWith("k1");
    expect(screen.queryByRole("button", { name: "撤销 Reports" })).not.toBeInTheDocument();
  });
  it("keeps copy failures visible and the unsaved secret available", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    vi.mocked(financeApi.createKey).mockResolvedValue({
      data: { ...key, token: "nhk_copy" },
      meta: { requestId: "r" },
    });
    render(<ApiKeysClient initialKeys={[]} />);
    await user.type(screen.getByLabelText("密钥名称"), "Reports");
    await user.click(screen.getByRole("button", { name: "创建密钥" }));
    await user.click(await screen.findByRole("button", { name: "复制密钥" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Denied");
    expect(screen.getByText("nhk_copy")).toBeInTheDocument();
  });
});
