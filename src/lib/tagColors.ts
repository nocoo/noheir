/**
 * Tag Color Utilities
 *
 * Provides stable, hash-based color assignment for labels
 * 统一的颜色系统，确保同一标签在所有页面显示相同颜色
 */

// ============================================================================
// COLOR PALETTE (20 colors)
// ============================================================================

export const TAG_COLORS = {
  // --- 核心财务状态 ---
  income: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-500/20"
  },
  expense: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-500/20"
  },

  // --- 通用色彩 (共18种) - 互换背景和文字颜色 ---
  slate:   { label: 'bg-slate-700 dark:bg-slate-300', text: 'text-slate-50 dark:text-slate-900' },
  red:     { label: 'bg-red-600 dark:bg-red-400', text: 'text-red-50 dark:text-red-950' },
  orange:  { label: 'bg-orange-600 dark:bg-orange-400', text: 'text-orange-50 dark:text-orange-950' },
  amber:   { label: 'bg-amber-600 dark:bg-amber-400', text: 'text-amber-50 dark:text-amber-950' },
  yellow:  { label: 'bg-yellow-600 dark:bg-yellow-400', text: 'text-yellow-50 dark:text-yellow-950' },
  lime:    { label: 'bg-lime-600 dark:bg-lime-400', text: 'text-lime-50 dark:text-lime-950' },
  green:   { label: 'bg-green-600 dark:bg-green-400', text: 'text-green-50 dark:text-green-950' },
  emerald: { label: 'bg-emerald-600 dark:bg-emerald-400', text: 'text-emerald-50 dark:text-emerald-950' },
  teal:    { label: 'bg-teal-600 dark:bg-teal-400', text: 'text-teal-50 dark:text-teal-950' },
  cyan:    { label: 'bg-cyan-600 dark:bg-cyan-400', text: 'text-cyan-50 dark:text-cyan-950' },
  sky:     { label: 'bg-sky-600 dark:bg-sky-400', text: 'text-sky-50 dark:text-sky-950' },
  blue:    { label: 'bg-blue-600 dark:bg-blue-400', text: 'text-blue-50 dark:text-blue-950' },
  indigo:  { label: 'bg-indigo-600 dark:bg-indigo-400', text: 'text-indigo-50 dark:text-indigo-950' },
  violet:  { label: 'bg-violet-600 dark:bg-violet-400', text: 'text-violet-50 dark:text-violet-950' },
  purple:  { label: 'bg-purple-600 dark:bg-purple-400', text: 'text-purple-50 dark:text-purple-950' },
  fuchsia: { label: 'bg-fuchsia-600 dark:bg-fuchsia-400', text: 'text-fuchsia-50 dark:text-fuchsia-950' },
  pink:    { label: 'bg-pink-600 dark:bg-pink-400', text: 'text-pink-50 dark:text-pink-950' },
  rose:    { label: 'bg-rose-600 dark:bg-rose-400', text: 'text-rose-50 dark:text-rose-950' },
} as const;

// Color array for hash-based selection (20 colors)
const COLOR_KEYS: (keyof typeof TAG_COLORS)[] = [
  'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose', 'income', 'expense'
];

// ============================================================================
// HASH FUNCTION
// ============================================================================

/**
 * Stable string hash function (DJB2 algorithm)
 * Same input always produces same output
 */
function stringHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return Math.abs(hash);
}

/**
 * Get color variant based on label name
 * Returns consistent color for same label
 */
export function getTagColor(label: string): 'default' | 'secondary' | 'outline' {
  const hash = stringHash(label);
  const index = hash % COLOR_KEYS.length;

  // Map colors to Badge variants
  const colorKey = COLOR_KEYS[index];

  // Warm colors (red, orange, amber, yellow) -> default
  if (['red', 'orange', 'amber', 'yellow', 'rose', 'expense'].includes(colorKey)) {
    return 'default';
  }

  // Cool colors (blue, cyan, sky, indigo, violet, purple) -> secondary
  if (['blue', 'cyan', 'sky', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'].includes(colorKey)) {
    return 'secondary';
  }

  // Neutral colors (slate, green, emerald, teal, lime) -> outline
  return 'outline';
}

/**
 * Get color classes for labels
 * Returns consistent bg/text classes for same label
 */
export function getLabelColorClasses(label: string): {
  bg: string;
  text: string;
} {
  const hash = stringHash(label);
  const index = hash % COLOR_KEYS.length;
  const colorKey = COLOR_KEYS[index];

  const color = TAG_COLORS[colorKey];

  // Handle special income/expense case
  if ('bg' in color && 'text' in color && 'border' in color) {
    return {
      bg: color.bg,
      text: color.text,
    };
  }

  // Handle regular color case (rename 'label' to 'bg')
  return {
    bg: color.label,
    text: color.text,
  };
}

/**
 * Get hex color for charts/libraries that need hex values
 * Returns consistent hex color for same label
 */
export function getLabelColorHex(label: string): string {
  const hash = stringHash(label);
  const index = hash % COLOR_KEYS.length;

  // Map color keys to hex values
  const colorHexMap: Record<string, string> = {
    slate: '#64748b',
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    lime: '#84cc16',
    green: '#22c55e',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    fuchsia: '#d946ef',
    pink: '#ec4899',
    rose: '#e11d48',
    income: '#059669',
    expense: '#e11d48',
  };

  return colorHexMap[COLOR_KEYS[index]] || '#6b7280';
}

/**
 * 提取资金单元编号首字母用于颜色映射
 * 例如：A01, A02 → "A", B01 → "B"
 */
export function getUnitCodePrefix(unitCode: string): string {
  if (!unitCode) return 'Unknown';
  return unitCode.charAt(0).toUpperCase();
}

/**
 * 获取资金单元编号的颜色（基于首字母）
 * 确保同一首字母的所有单元显示相同颜色
 */
export function getUnitCodeColor(unitCode: string): 'default' | 'secondary' | 'outline' {
  const prefix = getUnitCodePrefix(unitCode);
  return getTagColor(prefix);
}

/**
 * 获取资金单元编号的颜色类（基于首字母）
 */
export function getUnitCodeColorClasses(unitCode: string): {
  bg: string;
  text: string;
} {
  const prefix = getUnitCodePrefix(unitCode);
  return getLabelColorClasses(prefix);
}
