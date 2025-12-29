import { ReactNode, useState } from 'react';
import {
  Upload,
  CheckCircle,
  Database,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Percent,
  Wallet,
  GitCompareArrows,
  Network,
  Menu,
  X,
  ChevronDown,
  Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navGroups = [
  {
    title: '数据管理',
    items: [
      { id: 'manage', label: '数据管理', icon: Database },
      { id: 'import', label: '数据导入', icon: Upload },
    ]
  },
  {
    title: '分析概览',
    items: [
      { id: 'overview', label: '总览', icon: LayoutDashboard },
    ]
  },
  {
    title: '详细分析',
    items: [
      { id: 'income', label: '收入分析', icon: TrendingUp },
      { id: 'expense', label: '支出分析', icon: TrendingDown },
      { id: 'savings', label: '储蓄率', icon: Percent },
      { id: 'account', label: '账户分析', icon: Wallet },
      { id: 'flow', label: '资金流向', icon: Network },
    ]
  },
  {
    title: '对比分析',
    items: [
      { id: 'compare', label: '时段对比', icon: GitCompareArrows },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(navGroups.map(g => g.title));

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => 
      prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title]
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-0 lg:w-16'
      )}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {sidebarOpen && (
            <h1 className="text-lg font-bold text-foreground">财务管理</h1>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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
                    className="w-full justify-between px-3 py-2 h-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {group.title}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
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
                      'w-full justify-start gap-3 transition-all hover:text-foreground',
                      !sidebarOpen && 'lg:justify-center lg:px-2'
                    )}
                    onClick={() => onTabChange(item.id)}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 shrink-0",
                      activeTab === item.id ? "text-primary-foreground" : "text-primary"
                    )} />
                    {sidebarOpen && <span className="text-sm">{item.label}</span>}
                  </Button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>

        <div className={cn(
          'p-4 border-t border-border',
          !sidebarOpen && 'hidden lg:block'
        )}>
          {sidebarOpen && (
            <p className="text-xs text-muted-foreground text-center">
              个人财务信息管理系统
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
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
