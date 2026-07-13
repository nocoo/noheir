"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { YearProvider } from "./year-context";
import { ThemeToggle } from "./theme-toggle";
import { Breadcrumbs } from "./breadcrumbs";
import { GlobalYearSelector } from "./global-year-selector";
import { ALL_NAV_ITEMS, NAV_GROUPS } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

/**
 * Build breadcrumbs from pathname using navigation config
 */
function buildBreadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  // Find matching nav item
  const navItem = ALL_NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );

  if (!navItem || navItem.href === "/") {
    return []; // Home page, no extra breadcrumbs
  }

  // Find the group this item belongs to
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === navItem.href));

  const crumbs: { label: string; href?: string }[] = [];

  // Add group label if different from item label
  if (group && group.label !== navItem.label) {
    crumbs.push({ label: group.label });
  }

  // Add current page (no href = current page)
  crumbs.push({ label: navItem.label });

  return crumbs;
}

function AppShellInner({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode;
  breadcrumbs: { label: string; href?: string }[] | undefined;
}) {
  const isMobile = useIsMobile();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const autoBreadcrumbs = useMemo(() => buildBreadcrumbsFromPath(pathname), [pathname]);
  const finalBreadcrumbs = breadcrumbs ?? autoBreadcrumbs;

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[260px] p-0 sm:max-w-[260px]"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>导航菜单</SheetTitle>
              <SheetDescription>浏览 noheir 页面</SheetDescription>
            </SheetHeader>
            <Sidebar mobile />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex flex-1 flex-col min-h-screen min-w-0">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="打开导航"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
              </button>
            )}
            <Breadcrumbs items={[{ label: "首页", href: "/" }, ...finalBreadcrumbs]} />
          </div>
          <div className="flex items-center gap-1">
            <Suspense>
              <GlobalYearSelector />
            </Suspense>
            <a
              href="https://github.com/nocoo/noheir"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <GithubIcon className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
            </a>
            <ThemeToggle />
          </div>
        </header>

        {/* Floating island content area */}
        <div className="flex-1 px-2 pb-2 md:px-3 md:pb-3">
          <div className="h-full rounded-[var(--radius-card)] md:rounded-[var(--radius-island)] bg-card p-3 md:p-5 overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function AppShell({ children, breadcrumbs }: AppShellProps) {
  return (
    <SidebarProvider>
      <Suspense>
        <YearProvider>
          <AppShellInner breadcrumbs={breadcrumbs ?? undefined}>{children}</AppShellInner>
        </YearProvider>
      </Suspense>
    </SidebarProvider>
  );
}
