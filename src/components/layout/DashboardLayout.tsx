import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/contexts/SettingsContext';
import { useThemedLogo } from '@/hooks/useThemedLogo';
import { APP_VERSION } from '@/lib/version-generated';
import {
  Database,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Percent,
  Wallet,
  GitCompareArrows,
  Network,
  ChevronUp,
  Settings as SettingsIcon,
  Target,
  Package,
  Coins,
  Boxes,
  PieChart,
  HeartPulse,
  Sparkles,
  CreditCard,
  Brain,
  PanelLeft,
  Search,
  Github,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { LoginButton } from '@/components/auth';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: '总览',
    items: [
      { id: 'overview', label: '总览', icon: LayoutDashboard },
      { id: 'financial-health', label: '财务健康', icon: HeartPulse },
      { id: 'ai-insight', label: 'AI洞察', icon: Brain },
    ],
  },
  {
    title: '现金流分析',
    items: [
      { id: 'savings', label: '储蓄率', icon: Percent },
      { id: 'freedom', label: '财务自由', icon: Target },
      { id: 'income', label: '收入分析', icon: TrendingUp },
      { id: 'expense', label: '支出分析', icon: TrendingDown },
      { id: 'flow', label: '流向分析', icon: Network },
      { id: 'compare', label: '时段对比', icon: GitCompareArrows },
    ],
  },
  {
    title: '账户管理',
    items: [
      { id: 'account', label: '账户总览', icon: Wallet },
      { id: 'account-detail', label: '账户详情', icon: Wallet },
    ],
  },
  {
    title: '存量资金管理',
    items: [
      { id: 'capital-dashboard', label: '资金总览', icon: LayoutDashboard },
      { id: 'capital-decisions', label: '资金决策', icon: Target },
      { id: 'warehouse', label: '仓库视图', icon: Boxes },
      { id: 'strategy-sunburst', label: '策略透视', icon: PieChart },
      { id: 'liquidity-ladder', label: '流动性梯队', icon: TrendingUp },
      { id: 'products', label: '产品表', icon: Package },
      { id: 'funds', label: '资金表', icon: Coins },
    ],
  },
  {
    title: '系统',
    items: [
      { id: 'settings', label: '通用设置', icon: SettingsIcon },
      { id: 'ai-settings', label: 'AI设置', icon: Sparkles },
      { id: 'account-types', label: '账户设置', icon: CreditCard },
      { id: 'manage', label: '数据管理', icon: Database },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

// ── Nav group section (expanded sidebar) ──

function NavGroupSection({
  group,
  activeTab,
  onTabChange,
}: {
  group: NavGroup;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="px-3 mt-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2.5">
          <span className="text-sm font-normal text-muted-foreground">
            {group.title}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <ChevronUp
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                !open && 'rotate-180',
              )}
              strokeWidth={1.5}
            />
          </span>
        </CollapsibleTrigger>
      </div>
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms ease-out',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 px-3">
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                data-value={item.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors',
                  activeTab === item.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <item.icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}

// ── Collapsed nav item with tooltip ──

function CollapsedNavItem({
  item,
  activeTab,
  onTabChange,
}: {
  item: NavItem;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={() => onTabChange(item.id)}
          data-value={item.id}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            activeTab === item.id
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <item.icon className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Main layout component ──

export function DashboardLayout({
  children,
  activeTab,
  onTabChange,
}: DashboardLayoutProps) {
  const { settings, updateTheme } = useSettings();
  const { logo64 } = useThemedLogo();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setSearchOpen(false);
      onTabChange(id);
    },
    [onTabChange],
  );

  const cycleTheme = useCallback(() => {
    const next = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    updateTheme(next);
  }, [settings.theme, updateTheme]);

  const ThemeIcon = settings.theme === 'dark' ? Moon : settings.theme === 'system' ? Monitor : Sun;

  // Close mobile sidebar on tab change
  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Shared sidebar content (expanded)
  const expandedSidebar = (
    <div className="flex h-screen w-[260px] flex-col">
      {/* Header */}
      <div className="px-3 h-14 flex items-center">
        <div className="flex w-full items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <img
              src={logo64}
              alt="Logo"
              className="h-5 w-5 shrink-0"
            />
            <span className="text-lg font-semibold text-foreground">
              {settings.siteName}
            </span>
          </div>
          <button
            onClick={() => {
              setCollapsed(true);
              setMobileOpen(false);
            }}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeft
              className="h-4 w-4"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </button>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-3 pb-1">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg bg-secondary px-3 py-1.5 transition-colors hover:bg-accent cursor-pointer"
        >
          <Search
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <span className="flex-1 text-left text-sm text-muted-foreground">
            搜索
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
            <kbd className="pointer-events-none hidden rounded-sm border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-1">
        {navGroups.map((group) => (
          <NavGroupSection
            key={group.title}
            group={group}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 space-y-2">
        <LoginButton />
        <div className="text-xs text-muted-foreground text-center">
          <a
            href="https://github.com/nocoo/noheir"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            <span className="text-[10px] opacity-70">{APP_VERSION}</span>
          </a>
          <span className="text-[10px] opacity-50 mx-1">·</span>
          <Link
            to="/terms"
            className="hover:text-primary transition-colors text-[10px] opacity-70"
          >
            服务条款
          </Link>
          <span className="text-[10px] opacity-50 mx-1">·</span>
          <Link
            to="/privacy"
            className="hover:text-primary transition-colors text-[10px] opacity-70"
          >
            隐私政策
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Skip to content (a11y) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        跳到主内容
      </a>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'sticky top-0 hidden lg:flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
      >
        {collapsed ? (
          /* Collapsed (icon-only) view */
          <div className="flex h-screen w-[68px] flex-col items-center">
            <div className="flex h-14 items-center justify-center">
              <img
                src={logo64}
                alt="Logo"
                className="h-5 w-5"
              />
            </div>

            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1"
            >
              <PanelLeft
                className="h-4 w-4"
                aria-hidden="true"
                strokeWidth={1.5}
              />
            </button>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSearchOpen(true)}
                  aria-label="搜索 (⌘K)"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
                >
                  <Search
                    className="h-4 w-4"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                搜索 (⌘K)
              </TooltipContent>
            </Tooltip>

            <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
              {allNavItems.map((item) => (
                <CollapsedNavItem
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                />
              ))}
            </nav>
          </div>
        ) : (
          expandedSidebar
        )}
      </aside>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[260px] bg-background lg:hidden">
            {expandedSidebar}
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <main
        id="main-content"
        className="flex-1 flex flex-col min-h-screen min-w-0"
      >
        {/* Header bar */}
        <header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="打开导航菜单"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors lg:hidden"
            >
              <PanelLeft
                className="h-5 w-5"
                aria-hidden="true"
                strokeWidth={1.5}
              />
            </button>
          </div>
          {/* Right toolbar */}
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/nocoo/noheir"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
            </a>
            <button
              onClick={cycleTheme}
              aria-label={`Toggle theme, currently ${settings.theme}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ThemeIcon className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Content area with basalt card container */}
        <div className="flex-1 px-2 pb-2 md:px-3 md:pb-3">
          <div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
            {children}
          </div>
        </div>
      </main>

      {/* ── Command palette (⌘K) ── */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="搜索页面..." />
        <CommandList>
          <CommandEmpty>没有找到结果</CommandEmpty>
          {navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item.id)}
                  className="gap-3 cursor-pointer"
                >
                  <item.icon
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
