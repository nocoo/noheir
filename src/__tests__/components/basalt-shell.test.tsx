import { Link as BasaltLink } from "@nocoo/basalt/components/link";
import { useAccent } from "@nocoo/basalt/providers/accent";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { GlobalYearSelector } from "@/components/layout/global-year-selector";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { Providers } from "@/components/providers";

vi.mock("@/lib/auth-context", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { name: "Demo", email: "demo@example.test" }, logout: vi.fn() }),
}));
vi.mock("@/components/layout/year-context", () => ({
  YEAR_ENABLED_PATHS: new Set(["/income"]),
  useYear: () => ({ year: 2025, years: [2025, 2024], isYearEnabled: true, setYear: vi.fn() }),
}));

function renderShell(children: ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/income?year=2025"]}>
      <Providers>
        <SidebarProvider>{children}</SidebarProvider>
      </Providers>
    </MemoryRouter>,
  );
}

function AccentProbe() {
  return <output>{useAccent().accent}</output>;
}

describe("Basalt shell contract", () => {
  it("uses native navigation selection and keeps year-aware anchors in both rail modes", () => {
    const { container } = renderShell(<Sidebar />);
    const active = container.querySelector('a[aria-current="page"]');
    expect(active).toHaveAttribute("href", "/income?year=2025");
    expect(active?.closest("[data-basalt-hover-item]")).toHaveAttribute(
      "data-hover-selected",
      "true",
    );
    expect(container.querySelector('[class*="bg-basalt-accent"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));
    const collapsed = container.querySelector('a[aria-current="page"]');
    expect(collapsed).toHaveAttribute("href", "/income?year=2025");
    expect(collapsed).toHaveAccessibleName();
    expect(collapsed?.closest("[data-basalt-hover-item]")).toHaveAttribute(
      "data-hover-selected",
      "true",
    );
  });

  it("forwards link events, accessibility, target and ref through the router adapter", () => {
    const onClick = vi.fn((event) => event.preventDefault());
    const ref = createRef<HTMLAnchorElement>();
    renderShell(
      <BasaltLink href="/analyses" aria-label="Reports" target="_blank" ref={ref} onClick={onClick}>
        Open
      </BasaltLink>,
    );
    const link = screen.getByRole("link", { name: "Reports" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(ref.current).toBe(link);
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fixes the product accent to Basalt Blue despite a stored different accent", () => {
    localStorage.setItem("basalt-accent", "rose");
    renderShell(<AccentProbe />);
    expect(screen.getByRole("status")).toHaveTextContent("primary");
    localStorage.removeItem("basalt-accent");
  });

  it("uses a bounded native year selector and retains previous/next navigation", () => {
    renderShell(<GlobalYearSelector />);
    expect(screen.getByRole("combobox", { name: "财务年份" })).toHaveTextContent("2025");
    expect(screen.getByRole("button", { name: "下一年" })).toBeDisabled();
  });
});
