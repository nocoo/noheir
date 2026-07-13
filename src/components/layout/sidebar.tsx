"use client";

import { ChevronUp, LogOut, PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ALL_NAV_ITEMS, NAV_GROUPS, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";
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

// ── Sub-components ──

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
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="px-3 mt-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                !open && "rotate-180",
              )}
              strokeWidth={1.5}
            />
          </span>
        </CollapsibleTrigger>
      </div>
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease-out",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 px-3">
            {group.items.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={buildHrefWithYear(item.href, year)}
                  onClick={onNavigate}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 text-left">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}

// ── Main component ──

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

  // Mobile sidebar is always expanded
  const isCollapsed = mobile ? false : collapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        aria-label={mobile ? "主导航抽屉" : "主导航"}
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
          isCollapsed ? "w-[68px]" : "w-[260px]",
        )}
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
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
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={buildHrefWithYear(item.href, year)}
                        onClick={handleNavigate}
                        className={cn(
                          "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
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
            <div className="px-3 h-14 flex items-center">
              <div className="flex w-full items-center justify-between px-3">
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
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground font-mono">
                    v{pkg.version}
                  </span>
                </div>
                {!mobile && (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="收起侧边栏"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Navigation — grouped with collapsible sections */}
            <nav className="flex-1 overflow-y-auto pt-1">
              {NAV_GROUPS.map((group) => (
                <NavGroupSection
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  year={year}
                  onNavigate={handleNavigate}
                />
              ))}
            </nav>

            {/* User info + sign out */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  {userImage && <AvatarImage src={userImage} alt={userName} />}
                  <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                  {userEmail && (
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      aria-label="退出登录"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">退出登录</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
