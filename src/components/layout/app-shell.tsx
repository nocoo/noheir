import { Button, ContentIsland } from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import {
  AppMain,
  AppSkipLink,
  AppShell as BasaltAppShell,
} from "@nocoo/basalt/components/app-shell";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nocoo/basalt/components/sheet";
import { Menu } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Outlet, useLoaderData, useLocation } from "react-router";
import { EnvironmentSwitch } from "@/components/environment-switch";
import { GithubIcon } from "@/components/icons/github-icon";
import { useIsMobile } from "@/hooks/use-mobile";
import { ALL_NAV_ITEMS, isNavItemActive, NAV_GROUPS } from "@/lib/navigation";
import { GlobalYearSelector } from "./global-year-selector";
import { HeaderTooltip, HexlyLink } from "./header-links";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { YearProvider } from "./year-context";

/**
 * Build breadcrumbs from pathname using navigation config
 */
function buildBreadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  // Find matching nav item
  const navItem = ALL_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));

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

function AppShellInner() {
  const isMobile = useIsMobile();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const pathname = location.pathname;

  // Close mobile sidebar on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger; body doesn't read its value
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile, setMobileOpen]);

  const breadcrumbsList = useMemo(
    () => [{ label: "首页", href: "/" }, ...buildBreadcrumbsFromPath(pathname)],
    [pathname],
  );

  return (
    <BasaltAppShell layout="workspace">
      <AppSkipLink>跳到主要内容</AppSkipLink>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-fit p-0 sm:p-0"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              mobileMenuTrigger.current?.focus();
            }}
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
          className="max-[360px]:h-auto max-[360px]:flex-wrap max-[360px]:py-basalt-space-sm"
          leading={
            isMobile ? (
              <HeaderTooltip label="打开导航">
                <Button
                  ref={mobileMenuTrigger}
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(true)}
                  aria-label="打开导航"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
                </Button>
              </HeaderTooltip>
            ) : null
          }
          breadcrumbs={isMobile ? [] : breadcrumbsList}
          actions={
            <>
              <EnvironmentSwitch />
              <Suspense>
                <GlobalYearSelector />
              </Suspense>
              <HeaderTooltip label="GitHub repository">
                <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
                  <a
                    href="https://github.com/nocoo/noheir"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub repository"
                  >
                    <GithubIcon
                      className="h-[18px] w-[18px]"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </a>
                </Button>
              </HeaderTooltip>
              <HexlyLink className="hidden md:inline-flex" />
              <ThemeToggle />
            </>
          }
        />

        {/* Floating island content area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-basalt-space-lg pb-basalt-space-lg">
          <ContentIsland key={pathname}>
            {[
              "/",
              "/income",
              "/expense",
              "/savings",
              "/compare",
              "/freedom",
              "/financial-health",
              "/account",
              "/account-detail",
              "/flow",
              "/funds",
              "/warehouse",
              "/capital-logs",
              "/capital-decisions",
              "/liquidity",
              "/strategy",
              "/plan/calendar",
              "/manage",
            ].includes(pathname) && (
              <p className="mb-3 text-sm text-basalt-muted-foreground">
                金额汇总币种：CNY（人民币）。不折算或合计其他币种；其他币种记录与编辑操作保留。
              </p>
            )}
            <Outlet />
          </ContentIsland>
        </div>
      </AppMain>
    </BasaltAppShell>
  );
}

export function AppShell() {
  const years = useLoaderData<number[]>();
  return (
    <SidebarProvider>
      <Suspense>
        <YearProvider years={years}>
          <AppShellInner />
        </YearProvider>
      </Suspense>
    </SidebarProvider>
  );
}
