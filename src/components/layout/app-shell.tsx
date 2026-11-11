import { ContentIsland, SidebarProvider } from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
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
import { TooltipProvider } from "@nocoo/basalt/components/tooltip";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Outlet, useLoaderData, useLocation } from "react-router";
import { EnvironmentSwitch } from "@/components/environment-switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { ALL_NAV_ITEMS, isNavItemActive, NAV_GROUPS } from "@/lib/navigation";
import { GlobalYearSelector } from "./global-year-selector";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";
import { PersistedSidebarProvider, Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { YearProvider } from "./year-context";

/**
 * Build breadcrumbs from pathname using navigation config
 */
function buildBreadcrumbsFromPath(pathname: string): { label: string; href?: string }[] {
  const navItem = ALL_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));

  if (!navItem || navItem.href === "/") {
    return [];
  }

  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.href === navItem.href));

  const crumbs: { label: string; href?: string }[] = [];

  if (group && group.label !== navItem.label) {
    crumbs.push({ label: group.label });
  }

  crumbs.push({ label: navItem.label });

  return crumbs;
}

function AppShellInner() {
  const isMobile = useIsMobile();
  const { mobileOpen, setMobileOpen } = useMobileNav();
  const menuButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const pathname = location.pathname;

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers close on route change
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
    <TooltipProvider delayDuration={0}>
      <BasaltAppShell layout="workspace">
        <AppSkipLink>跳到主要内容</AppSkipLink>

        {!isMobile && (
          <PersistedSidebarProvider>
            <Sidebar ariaLabel="主导航" />
          </PersistedSidebarProvider>
        )}

        {isMobile && (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent
              side="left"
              className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0 sm:max-w-[260px] sm:p-0"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                menuButton.current?.focus();
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>导航菜单</SheetTitle>
                <SheetDescription>浏览 noheir 页面</SheetDescription>
              </SheetHeader>
              <SidebarProvider collapsed={false} defaultWidth={260}>
                <Sidebar
                  ariaLabel="主导航抽屉"
                  variant="mobile"
                  onNavigate={() => setMobileOpen(false)}
                  onDismiss={() => setMobileOpen(false)}
                />
              </SidebarProvider>
            </SheetContent>
          </Sheet>
        )}

        <AppMain>
          <AppHeader
            leading={
              isMobile ? (
                <AppHeaderMenuButton
                  ref={menuButton}
                  label="打开导航"
                  onClick={() => setMobileOpen(true)}
                />
              ) : null
            }
            breadcrumbs={breadcrumbsList}
            breadcrumbsLabel="面包屑导航"
            actions={
              <>
                <EnvironmentSwitch />
                <Suspense>
                  <GlobalYearSelector />
                </Suspense>
                <ProjectLinks
                  github="nocoo/noheir"
                  hexly="noheir"
                  name="Noheir"
                  githubLabel="GitHub repository"
                  hexlyLabel="Noheir on hexly.ai"
                />
                <ThemeToggle />
              </>
            }
          />

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
    </TooltipProvider>
  );
}

export function AppShell() {
  const years = useLoaderData<number[]>();
  return (
    <MobileNavProvider>
      <Suspense>
        <YearProvider years={years}>
          <AppShellInner />
        </YearProvider>
      </Suspense>
    </MobileNavProvider>
  );
}
