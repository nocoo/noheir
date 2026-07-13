"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Heart,
  Sparkles,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Scale,
  ArrowLeftRight,
  CalendarDays,
  Building2,
  BarChart3,
  Gavel,
  Warehouse,
  Target,
  Droplets,
  Package,
  Landmark,
  Settings,
  Bot,
  CreditCard as AccountTypeIcon,
  Database,
  FileUp,
  Shield,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  // Dashboard
  { label: "总览", href: "/", icon: LayoutDashboard, group: "仪表盘" },
  { label: "财务健康", href: "/financial-health", icon: Heart, group: "仪表盘" },
  { label: "AI 洞察", href: "/ai-insight", icon: Sparkles, group: "仪表盘" },
  // Cash Flow
  { label: "收入分析", href: "/income", icon: TrendingUp, group: "现金流" },
  { label: "支出分析", href: "/expense", icon: TrendingDown, group: "现金流" },
  { label: "储蓄率", href: "/savings", icon: PiggyBank, group: "现金流" },
  { label: "财务自由", href: "/freedom", icon: Scale, group: "现金流" },
  { label: "资金流向", href: "/flow", icon: ArrowLeftRight, group: "现金流" },
  { label: "年度对比", href: "/compare", icon: CalendarDays, group: "现金流" },
  // Account
  { label: "账户分析", href: "/account", icon: Building2, group: "账户" },
  // Capital
  { label: "资本仪表盘", href: "/capital-dashboard", icon: BarChart3, group: "资本" },
  { label: "资本决策", href: "/capital-decisions", icon: Gavel, group: "资本" },
  { label: "资金仓库", href: "/warehouse", icon: Warehouse, group: "资本" },
  { label: "策略配置", href: "/strategy", icon: Target, group: "资本" },
  { label: "流动性阶梯", href: "/liquidity", icon: Droplets, group: "资本" },
  { label: "产品管理", href: "/products", icon: Package, group: "资本" },
  { label: "资本单位", href: "/funds", icon: Landmark, group: "资本" },
  // System
  { label: "系统设置", href: "/settings", icon: Settings, group: "系统" },
  { label: "AI 设置", href: "/ai-settings", icon: Bot, group: "系统" },
  { label: "账户类型", href: "/account-types", icon: AccountTypeIcon, group: "系统" },
  { label: "数据管理", href: "/manage", icon: Database, group: "系统" },
  { label: "数据导入", href: "/import", icon: FileUp, group: "系统" },
  { label: "数据质量", href: "/quality", icon: Shield, group: "系统" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Group items
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = acc[item.group] ?? [];
    group.push(item);
    acc[item.group] = group;
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="搜索页面或功能..." />
      <CommandList>
        <CommandEmpty>未找到匹配结果</CommandEmpty>
        {Object.entries(groups).map(([group, items], i) => (
          <div key={group}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <item.icon className="mr-2 size-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
