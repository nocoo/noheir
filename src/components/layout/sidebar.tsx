"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sidebar as BasaltSidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarNav,
  SidebarUser,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nocoo/basalt";
import { LogOut, PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ALL_NAV_ITEMS, isNavItemActive, NAV_GROUPS, type NavGroup } from "@/lib/navigation";
import pkg from "../../../package.json";
import { useSidebar } from "./sidebar-context";
import { useYear, YEAR_ENABLED_PATHS } from "./year-context";

/**
 * Build href with year param if the target path supports it
 */
function buildHrefWithYear(href: string, year: number): string {
  if (YEAR_ENABLED_PATHS.has(href)) {
    return `${href}?year=${year}`;
  }
  return href;
}

function NavGroupSection({
  group,
  pathname,
  year,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  year: number;
  onNavigate: () => void;
}) {
  return (
    <SidebarGroup label={group.label} defaultOpen={group.defaultOpen ?? true}>
      {group.items.map((item) => {
        const isActive = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={buildHrefWithYear(item.href, year)}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors ${
              isActive
                ? "bg-basalt-accent text-basalt-foreground"
                : "text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-left">{item.label}</span>
          </Link>
        );
      })}
    </SidebarGroup>
  );
}

interface SidebarProps {
  mobile?: boolean;
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle, setMobileOpen } = useSidebar();
  const { year } = useYear();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "用户";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image;
  const userInitial = userName[0] ?? "?";

  const handleNavigate = () => setMobileOpen(false);
  const handleSignOut = () => signOut({ callbackUrl: "/login" });

  const isCollapsed = mobile ? false : collapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <BasaltSidebar
        aria-label={mobile ? "主导航抽屉" : "主导航"}
        collapsed={isCollapsed}
        className={mobile ? "!w-[260px] !h-full" : undefined}
      >
        {isCollapsed ? (
          /* ── Collapsed (icon-only) view ── */
          <div className="flex h-screen w-[68px] flex-col items-center">
            {/* Logo */}
            <div className="flex h-14 w-full items-center justify-start pl-6 pr-3">
              {/* biome-ignore lint/performance/noImgElement: small static logo, no optimization needed */}
              <img src="/logo-24.png" alt="noheir" width={24} height={24} className="shrink-0" />
            </div>

            {/* Expand toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="展开侧边栏"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors mb-2"
                >
                  <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                展开侧边栏
              </TooltipContent>
            </Tooltip>

            {/* Navigation — flat icon list, no groups */}
            <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
              {ALL_NAV_ITEMS.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={buildHrefWithYear(item.href, year)}
                        onClick={handleNavigate}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? "bg-basalt-accent text-basalt-foreground"
                            : "text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>

            {/* User avatar */}
            <div className="py-3 flex justify-center w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label="退出登录"
                    className="cursor-pointer"
                  >
                    <Avatar className="h-9 w-9">
                      {userImage && <AvatarImage src={userImage} alt={userName} />}
                      <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {userName} &middot; 点击退出登录
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          /* ── Expanded view ── */
          <div className="flex h-screen w-[260px] flex-col">
            {/* Header: logo + collapse toggle */}
            <SidebarHeader>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* biome-ignore lint/performance/noImgElement: small static logo, no optimization needed */}
                  <img
                    src="/logo-24.png"
                    alt="noheir"
                    width={24}
                    height={24}
                    className="shrink-0"
                  />
                  <span className="text-lg font-bold tracking-tighter">noheir</span>
                  <span className="rounded-full bg-basalt-muted px-2 py-0.5 text-[10px] font-medium text-basalt-muted-foreground font-mono">
                    v{pkg.version}
                  </span>
                </div>
                {!mobile && (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="收起侧边栏"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-basalt-muted-foreground hover:text-basalt-foreground transition-colors"
                  >
                    <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </SidebarHeader>

            {/* Navigation — grouped with collapsible sections */}
            <SidebarNav>
              {NAV_GROUPS.map((group) => (
                <NavGroupSection
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  year={year}
                  onNavigate={handleNavigate}
                />
              ))}
            </SidebarNav>

            {/* User info + sign out */}
            <SidebarFooter>
              <SidebarUser
                name={userName}
                email={userEmail}
                avatar={
                  <Avatar className="h-9 w-9 shrink-0">
                    {userImage && <AvatarImage src={userImage} alt={userName} />}
                    <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
                  </Avatar>
                }
                action={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        aria-label="退出登录"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors shrink-0"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">退出登录</TooltipContent>
                  </Tooltip>
                }
              />
            </SidebarFooter>
          </div>
        )}
      </BasaltSidebar>
    </TooltipProvider>
  );
}
