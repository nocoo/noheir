import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Sidebar as BasaltSidebar,
  Button,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarNav,
  SidebarUser,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nocoo/basalt";
import { EditableNavItem } from "@nocoo/basalt/components/editable-nav-item";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@nocoo/basalt/components/navigation-menu";
import { LogOut, PanelLeft } from "lucide-react";
import { Link, useLocation } from "react-router";
import { GithubIcon } from "@/components/icons/github-icon";
import { useAuth } from "@/lib/auth-context";
import { ALL_NAV_ITEMS, isNavItemActive, NAV_GROUPS } from "@/lib/navigation";
import pkg from "../../../package.json";
import { HexlyLink } from "./header-links";
import { useSidebar } from "./sidebar-context";
import { useYear, YEAR_ENABLED_PATHS } from "./year-context";

function buildHrefWithYear(href: string, year: number): string {
  return YEAR_ENABLED_PATHS.has(href) ? `${href}?year=${year}` : href;
}

export function Sidebar({ mobile = false }: { mobile?: boolean }) {
  const { pathname } = useLocation();
  const { collapsed, toggle, setMobileOpen } = useSidebar();
  const { year } = useYear();
  const { user, logout } = useAuth();
  const isCollapsed = !mobile && collapsed;
  const userName = user?.name ?? "用户";
  const handleNavigate = () => setMobileOpen(false);
  const avatar = (
    <Avatar>
      {user?.image && <AvatarImage src={user.image} alt={userName} />}
      <AvatarFallback>{userName[0] ?? "?"}</AvatarFallback>
    </Avatar>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <BasaltSidebar aria-label={mobile ? "主导航抽屉" : "主导航"} collapsed={isCollapsed}>
        <SidebarHeader className="gap-0">
          <div className="flex w-[calc(var(--basalt-size-rail)-2*var(--basalt-space-nav-inset))] shrink-0 justify-center">
            <img src="/logo-24.png" alt="noheir" width={24} height={24} />
          </div>
          {!isCollapsed && (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="font-semibold tracking-tight">noheir</span>
                <Badge variant="secondary" className="font-mono">
                  v{pkg.version}
                </Badge>
              </div>
              {!mobile && (
                <Button variant="ghost" size="icon" onClick={toggle} aria-label="收起侧边栏">
                  <PanelLeft aria-hidden="true" strokeWidth={1.5} />
                </Button>
              )}
            </>
          )}
        </SidebarHeader>

        {isCollapsed ? (
          <>
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarIconItem onClick={toggle} aria-label="展开侧边栏">
                    <PanelLeft aria-hidden="true" strokeWidth={1.5} />
                  </SidebarIconItem>
                </TooltipTrigger>
                <TooltipContent side="right">展开侧边栏</TooltipContent>
              </Tooltip>
            </div>
            <NavigationMenu
              orientation="vertical"
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
            >
              <NavigationMenuList className="items-center">
                {ALL_NAV_ITEMS.map((item) => (
                  <NavigationMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavigationMenuLink
                          asChild
                          active={isNavItemActive(pathname, item.href)}
                          className="w-basalt-control justify-center"
                        >
                          <Link
                            to={buildHrefWithYear(item.href, year)}
                            onClick={handleNavigate}
                            aria-label={item.label}
                          >
                            <item.icon aria-hidden="true" strokeWidth={1.5} />
                          </Link>
                        </NavigationMenuLink>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </>
        ) : (
          <SidebarNav>
            {NAV_GROUPS.map((group) => (
              <SidebarGroup
                key={group.label}
                label={group.label}
                defaultOpen={group.defaultOpen ?? true}
              >
                {group.items.map((item) => (
                  <EditableNavItem
                    key={item.href}
                    label={item.label}
                    href={buildHrefWithYear(item.href, year)}
                    selected={isNavItemActive(pathname, item.href)}
                    icon={<item.icon strokeWidth={1.5} />}
                    onSelect={handleNavigate}
                  />
                ))}
              </SidebarGroup>
            ))}
          </SidebarNav>
        )}

        <SidebarFooter>
          {mobile && (
            <div className="flex items-center gap-basalt-space-sm">
              <Button variant="ghost" asChild>
                <a href="https://github.com/nocoo/noheir" target="_blank" rel="noopener noreferrer">
                  <GithubIcon aria-hidden="true" strokeWidth={1.5} />
                  GitHub
                </a>
              </Button>
              <HexlyLink />
            </div>
          )}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={logout} aria-label="退出登录">
                  {avatar}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{userName} · 退出登录</TooltipContent>
            </Tooltip>
          ) : (
            <SidebarUser
              name={userName}
              email={user?.email ?? ""}
              avatar={avatar}
              action={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={logout} aria-label="退出登录">
                      <LogOut aria-hidden="true" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">退出登录</TooltipContent>
                </Tooltip>
              }
            />
          )}
        </SidebarFooter>
      </BasaltSidebar>
    </TooltipProvider>
  );
}
