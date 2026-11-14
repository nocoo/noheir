import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sidebar as BasaltSidebar,
  SidebarBrand,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarProvider,
  SidebarToggle,
  SidebarUser,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nocoo/basalt/components/tooltip";
import { type ReactNode, useCallback, useState } from "react";
import { useLocation } from "react-router";
import { EnvironmentSwitch } from "@/components/environment-switch";
import { useAuth } from "@/lib/auth-context";
import { ALL_NAV_ITEMS, isNavItemActive, NAV_GROUPS } from "@/lib/navigation";
import pkg from "../../../package.json";
import { useYear, YEAR_ENABLED_PATHS } from "./year-context";

const ACCESS_LOGOUT_URL = "/cdn-cgi/access/logout";
const SIDEBAR_COLLAPSED_KEY = "noheir:sidebar-collapsed";
type SidebarCollapsedPreference = "false" | "true";

function buildHrefWithYear(href: string, year: number): string {
  return YEAR_ENABLED_PATHS.has(href) ? `${href}?year=${year}` : href;
}

function usePersistedSidebarCollapsed(
  key: string,
  defaultValue: SidebarCollapsedPreference,
): [SidebarCollapsedPreference, (value: SidebarCollapsedPreference) => void] {
  const [stored, setStored] = useState<SidebarCollapsedPreference>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const value = localStorage.getItem(key);
      return value === "true" || value === "false" ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (next: SidebarCollapsedPreference) => {
      setStored(next);
      try {
        localStorage.setItem(key, next);
      } catch {}
    },
    [key],
  );

  return [stored, setValue];
}

export function PersistedSidebarProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_KEY, "false");
  const collapsed = stored === "true";
  const onCollapsedChange = useCallback(
    (next: boolean) => {
      setStored(next ? "true" : "false");
    },
    [setStored],
  );

  return (
    <SidebarProvider collapsed={collapsed} onCollapsedChange={onCollapsedChange} defaultWidth={260}>
      {children}
    </SidebarProvider>
  );
}

interface SidebarProps {
  ariaLabel: string;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  onDismiss?: () => void;
}

function NoheirSidebarBody({
  variant,
  onNavigate,
  onDismiss,
}: {
  variant?: SidebarProps["variant"];
  onNavigate?: () => void;
  onDismiss?: () => void;
}) {
  const { pathname } = useLocation();
  const { collapsed, peek, peeking } = useSidebar();
  const railCollapsed = collapsed && !(peek && peeking);
  const { year } = useYear();
  const { user } = useAuth();
  const userName = user?.name ?? "用户";
  const userEmail = user?.email ?? "";

  const avatar = (
    <Avatar>
      {user?.image && <AvatarImage src={user.image} alt={userName} />}
      <AvatarFallback>{userName[0] ?? "?"}</AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <SidebarHeader>
        <SidebarBrand
          logo={<img src="/logo-24.png" alt="" width={24} height={24} />}
          name="noheir"
          version={`v${pkg.version}`}
          action={
            variant === "mobile" ? (
              <SidebarToggle
                mode="dismiss"
                dismissLabel="关闭导航菜单"
                {...(onDismiss ? { onDismiss } : {})}
              />
            ) : (
              <SidebarToggle expandLabel="展开侧边栏" collapseLabel="收起侧边栏" />
            )
          }
        />
      </SidebarHeader>
      <SidebarNav aria-label="主导航链接">
        {railCollapsed
          ? ALL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <SidebarIconItem
                      href={buildHrefWithYear(item.href, year)}
                      active={active}
                      aria-label={item.label}
                      onClick={onNavigate}
                    >
                      <Icon strokeWidth={1.5} aria-hidden="true" />
                    </SidebarIconItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })
          : NAV_GROUPS.map((group) => (
              <SidebarGroup
                key={group.label}
                label={group.label}
                defaultOpen={group.defaultOpen ?? true}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <SidebarItem
                      key={item.href}
                      href={buildHrefWithYear(item.href, year)}
                      active={active}
                      onClick={onNavigate}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                    </SidebarItem>
                  );
                })}
              </SidebarGroup>
            ))}
      </SidebarNav>
      <SidebarFooter>
        {variant === "mobile" && (
          <div className="mb-basalt-space-lg">
            <EnvironmentSwitch />
          </div>
        )}
        <SidebarUser
          name={userName}
          email={userEmail || undefined}
          avatar={avatar}
          tooltip={userName}
          signOutHref={ACCESS_LOGOUT_URL}
          signOutLabel="退出登录"
        />
      </SidebarFooter>
    </>
  );
}

export function Sidebar({ ariaLabel, variant = "desktop", onNavigate, onDismiss }: SidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <BasaltSidebar aria-label={ariaLabel} resizable={false}>
        <NoheirSidebarBody
          variant={variant}
          {...(onNavigate ? { onNavigate } : {})}
          {...(onDismiss ? { onDismiss } : {})}
        />
      </BasaltSidebar>
    </TooltipProvider>
  );
}
