"use client";

import { ContentIsland } from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import {
  AppMain,
  AppSkipLink,
  AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { GithubIcon } from "@/components/icons/github-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ALL_NAV_ITEMS, NAV_GROUPS } from "@/lib/navigation";
import { GlobalYearSelector } from "./global-year-selector";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { YearProvider } from "./year-context";

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger; body doesn't read its value
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

  const { crumbs, pageTitle } = useMemo(() => {
    const list = [{ label: "首页", href: "/" }, ...finalBreadcrumbs];
    if (list.length <= 1) {
      return { crumbs: [] as { label: string; href?: string }[], pageTitle: list[0]?.label ?? "首页" };
    }
    const last = list[list.length - 1];
    return {
      crumbs: list.slice(0, -1),
      pageTitle: last?.label ?? "",
    };
  }, [finalBreadcrumbs]);

  return (
    <BasaltAppShell>
      <AppSkipLink>跳到主要内容</AppSkipLink>

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

      <AppMain>
        {/* Header */}
        <AppHeader
          leading={
            isMobile ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="打开导航"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors"
              >
                <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
              </button>
            ) : null
          }
          breadcrumbs={crumbs}
          title={pageTitle}
          actions={
            <>
              <Suspense>
                <GlobalYearSelector />
              </Suspense>
              <a
                href="https://github.com/nocoo/noheir"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub repository"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors"
              >
                <GithubIcon className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
              </a>
              <ThemeToggle />
            </>
          }
        />

        {/* Floating island content area */}
        <div className="flex-1 min-h-0 px-2 pb-2 md:px-3 md:pb-3 flex flex-col">
          <ContentIsland className="flex-1 overflow-y-auto">{children}</ContentIsland>
        </div>
      </AppMain>
    </BasaltAppShell>
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
