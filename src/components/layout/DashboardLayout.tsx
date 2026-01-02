import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/contexts/SettingsContext';
import { APP_VERSION } from '@/lib/version-generated';
import {
  Upload,
  CheckCircle,
  Database,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Percent,
  Wallet,
  GitCompareArrows,
  Network,
  Menu,
  ChevronDown,
  Settings as SettingsIcon,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Package,
  Coins,
  Boxes,
  PieChart,
  HeartPulse,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LoginButton } from '@/components/auth';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navGroups = [
  {
    title: '总览',
    items: [
      { id: 'overview', label: '总览', icon: LayoutDashboard },
      { id: 'financial-health', label: '财务健康', icon: HeartPulse },
    ]
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
    ]
  },
  {
    title: '账户管理',
    items: [
      { id: 'account', label: '账户总览', icon: Wallet },
      { id: 'account-detail', label: '账户详情', icon: Wallet },
    ]
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
    ]
  },
  {
    title: '系统',
    items: [
      { id: 'settings', label: '通用设置', icon: SettingsIcon },
      { id: 'ai-settings', label: 'AI设置', icon: Sparkles },
      { id: 'account-types', label: '账户设置', icon: CreditCard },
      { id: 'manage', label: '数据管理', icon: Database },
    ]
  },
];

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(navGroups.map(g => g.title));

  const toggleGroup = (title: string) => {
    setOpenGroups(prev =>
      prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex bg-card border-r border-border transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-14'
      )}>
        <div className="flex flex-col h-full">
          <div className={cn(
            "flex items-center h-14 border-b border-border shrink-0",
            sidebarOpen ? "px-3 justify-between" : "px-2 justify-center"
          )}>
            {sidebarOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                <img src="/logo/logo-64.png" alt="Logo" className="h-8 w-8 shrink-0" />
                <h1 className="text-base font-bold text-foreground whitespace-nowrap">{settings.siteName}</h1>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0 h-7 w-7"
            >
              <Menu className="h-3.5 w-3.5" />
            </Button>
          </div>

          <nav className={cn(
            "flex-1 overflow-y-auto min-h-0",
            sidebarOpen ? "px-2 py-2 space-y-1" : "py-2 space-y-0.5 mx-2"
          )}>
            {sidebarOpen ? (
              // 展开状态：带分组
              navGroups.map(group => (
                <Collapsible
                  key={group.title}
                  open={openGroups.includes(group.title)}
                  onOpenChange={() => toggleGroup(group.title)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-2 py-1.5 h-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      <span>{group.title}</span>
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200 shrink-0",
                        openGroups.includes(group.title) && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5">
                    {group.items.map(item => (
                      <Button
                        key={item.id}
                        variant={activeTab === item.id ? 'default' : 'ghost'}
                        className="w-full justify-start gap-2 px-2 h-9"
                        onClick={() => onTabChange(item.id)}
                        data-value={item.id}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{item.label}</span>
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              // 收缩状态：显示所有导航项
              navGroups.flatMap(group => group.items).map(item => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? 'default' : 'ghost'}
                  className="w-full justify-center px-1 h-9"
                  onClick={() => onTabChange(item.id)}
                  data-value={item.id}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                </Button>
              ))
            )}
          </nav>

          {sidebarOpen && (
            <div className="shrink-0 border-t border-border bg-card p-4 space-y-3">
              <LoginButton />
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <a
                  href="https://github.com/nocoo/noheir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  <p className="text-[10px] opacity-70">{APP_VERSION}</p>
                </a>
                <div className="flex justify-center gap-2 text-[10px] opacity-70">
                  <Link to="/terms" className="hover:text-primary transition-colors">服务条款</Link>
                  <span>•</span>
                  <Link to="/privacy" className="hover:text-primary transition-colors">隐私政策</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-14"
      )}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
