import {
  LayoutDashboard,
  HeartPulse,
  Brain,
  PiggyBank,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  GitCompare,
  Wallet,
  CreditCard,
  BarChart3,
  Lightbulb,
  Warehouse,
  Layers,
  Droplets,
  Package,
  Coins,
  Settings,
  Cpu,
  Tags,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "总览",
    defaultOpen: true,
    items: [
      { href: "/", label: "概览", icon: LayoutDashboard },
      { href: "/financial-health", label: "财务健康", icon: HeartPulse },
      { href: "/ai-insight", label: "AI 洞察", icon: Brain },
    ],
  },
  {
    label: "现金流",
    defaultOpen: true,
    items: [
      { href: "/savings", label: "储蓄率", icon: PiggyBank },
      { href: "/freedom", label: "财务自由", icon: Target },
      { href: "/income", label: "收入", icon: TrendingUp },
      { href: "/expense", label: "支出", icon: TrendingDown },
      { href: "/flow", label: "流向", icon: ArrowRightLeft },
      { href: "/compare", label: "对比", icon: GitCompare },
    ],
  },
  {
    label: "账户",
    defaultOpen: true,
    items: [
      { href: "/account", label: "总览", icon: Wallet },
      { href: "/account-detail", label: "明细", icon: CreditCard },
    ],
  },
  {
    label: "资产",
    defaultOpen: true,
    items: [
      { href: "/capital-dashboard", label: "资产盘", icon: BarChart3 },
      { href: "/capital-decisions", label: "决策", icon: Lightbulb },
      { href: "/warehouse", label: "仓库", icon: Warehouse },
      { href: "/strategy", label: "策略", icon: Layers },
      { href: "/liquidity", label: "流动阶梯", icon: Droplets },
      { href: "/products", label: "产品", icon: Package },
      { href: "/funds", label: "资金", icon: Coins },
    ],
  },
  {
    label: "系统",
    defaultOpen: true,
    items: [
      { href: "/settings", label: "设置", icon: Settings },
      { href: "/ai-settings", label: "AI 设置", icon: Cpu },
      { href: "/account-types", label: "账户类型", icon: Tags },
      { href: "/manage", label: "管理", icon: Database },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
