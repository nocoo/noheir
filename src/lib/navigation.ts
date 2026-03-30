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
    label: "Overview",
    defaultOpen: true,
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/financial-health", label: "Financial Health", icon: HeartPulse },
      { href: "/ai-insight", label: "AI Insight", icon: Brain },
    ],
  },
  {
    label: "Cash Flow",
    defaultOpen: true,
    items: [
      { href: "/savings", label: "Savings Rate", icon: PiggyBank },
      { href: "/freedom", label: "Financial Freedom", icon: Target },
      { href: "/income", label: "Income", icon: TrendingUp },
      { href: "/expense", label: "Expense", icon: TrendingDown },
      { href: "/flow", label: "Flow Analysis", icon: ArrowRightLeft },
      { href: "/compare", label: "Period Compare", icon: GitCompare },
    ],
  },
  {
    label: "Accounts",
    defaultOpen: true,
    items: [
      { href: "/account", label: "Account Overview", icon: Wallet },
      { href: "/account-detail", label: "Account Detail", icon: CreditCard },
    ],
  },
  {
    label: "Capital",
    defaultOpen: true,
    items: [
      { href: "/capital-dashboard", label: "Capital Dashboard", icon: BarChart3 },
      { href: "/capital-decisions", label: "Capital Decisions", icon: Lightbulb },
      { href: "/warehouse", label: "Warehouse", icon: Warehouse },
      { href: "/strategy", label: "Strategy View", icon: Layers },
      { href: "/liquidity", label: "Liquidity Ladder", icon: Droplets },
      { href: "/products", label: "Products", icon: Package },
      { href: "/funds", label: "Funds", icon: Coins },
    ],
  },
  {
    label: "System",
    defaultOpen: true,
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/ai-settings", label: "AI Settings", icon: Cpu },
      { href: "/account-types", label: "Account Types", icon: Tags },
      { href: "/manage", label: "Data Management", icon: Database },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
