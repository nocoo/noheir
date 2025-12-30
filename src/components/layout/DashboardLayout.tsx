import { ReactNode, useState } from 'react';
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
    ]
  },
  {
    title: '现金流分析',
    items: [
      { id: 'savings', label: '储蓄率', icon: Percent },
      { id: 'freedom', label: '财务自由', icon: Target },
      { id: 'income', label: '收入分析', icon: TrendingUp },
      { id: 'expense', label: '支出分析', icon: TrendingDown },
      { id: 'transfer', label: '转账分析', icon: ArrowRightLeft },
      { id: 'account', label: '账户分析', icon: Wallet },
      { id: 'flow-income', label: '收入流向', icon: ArrowUpRight },
      { id: 'flow-expense', label: '支出流向', icon: ArrowDownRight },
      { id: 'compare', label: '时段对比', icon: GitCompareArrows },
    ]
  },
  {
    title: '存量资金管理',
    items: [
      { id: 'capital-dashboard', label: '资金总览', icon: LayoutDashboard },
      { id: 'warehouse', label: '仓库视图', icon: Boxes },
      { id: 'products', label: '产品表', icon: Package },
      { id: 'funds', label: '资金表', icon: Coins },
    ]
  },
  {
    title: '数据管理',
    items: [
      { id: 'manage', label: '数据管理', icon: Database },
      { id: 'import', label: '数据导入', icon: Upload },
    ]
  },
  {
    title: '系统',
    items: [
      { id: 'settings', label: '设置', icon: SettingsIcon },
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
        sidebarOpen ? 'w-64' : 'w-0'
      )}>
        <div className="flex flex-col h-full">
          <div className={cn(
            "flex items-center h-16 border-b border-border overflow-hidden shrink-0",
            sidebarOpen ? "px-2" : ""
          )}>
            <div className={cn(
              "flex items-center gap-3 overflow-hidden transition-all duration-300",
              sidebarOpen ? "flex-1 px-2 opacity-100" : "w-0 opacity-0"
            )}>
              <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-lg font-bold text-foreground whitespace-nowrap">{settings.siteName}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "shrink-0 transition-all duration-300",
                sidebarOpen ? "h-8 px-3" : ""
              )}
            >
              <Menu className={cn(
                sidebarOpen ? "h-4 w-4" : ""
              )} />
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto min-h-0">
            {navGroups.map(group => (
              <Collapsible
                key={group.title}
                open={openGroups.includes(group.title)}
                onOpenChange={() => toggleGroup(group.title)}
              >
                {sidebarOpen && (
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-3 py-2 h-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      <span>{group.title}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200 shrink-0",
                        openGroups.includes(group.title) && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent className="space-y-1">
                  {group.items.map(item => (
                    <Button
                      key={item.id}
                      variant={activeTab === item.id ? 'default' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 transition-all',
                        !sidebarOpen && 'justify-center px-2'
                      )}
                      onClick={() => onTabChange(item.id)}
                    >
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0",
                        activeTab === item.id ? "text-primary-foreground" : "text-muted-foreground"
                      )} />
                      {sidebarOpen && <span className="text-sm">{item.label}</span>}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </nav>

          {sidebarOpen && (
            <div className="shrink-0 border-t border-border bg-card p-4 space-y-3">
              <LoginButton />
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>{settings.siteName}</p>
                <p className="text-[10px] opacity-70">{APP_VERSION}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Desktop Sidebar Toggle (visible when sidebar is closed) */}
      {!sidebarOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-40 h-9 w-9"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-0"
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
