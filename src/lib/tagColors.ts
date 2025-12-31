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

  // --- 通用色彩 (共18种) ---
  slate:   { label: 'bg-slate-100 dark:bg-slate-700/30', text: 'text-slate-700 dark:text-slate-300' },
  red:     { label: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300' },
  orange:  { label: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300' },
  amber:   { label: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300' },
  yellow:  { label: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-200' },
  lime:    { label: 'bg-lime-50 dark:bg-lime-500/10', text: 'text-lime-700 dark:text-lime-300' },
  green:   { label: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-700 dark:text-green-300' },
  emerald: { label: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300' },
  teal:    { label: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300' },
  cyan:    { label: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300' },
  sky:     { label: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300' },
  blue:    { label: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300' },
  indigo:  { label: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300' },
  violet:  { label: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300' },
  purple:  { label: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300' },
  fuchsia: { label: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
  pink:    { label: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-700 dark:text-pink-300' },
  rose:    { label: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300' },
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
 * 提取资金单元番号首字母用于颜色映射
 * 例如：A01, A02 → "A", B01 → "B"
 */
export function getUnitCodePrefix(unitCode: string): string {
  if (!unitCode) return 'Unknown';
  return unitCode.charAt(0).toUpperCase();
}

/**
 * 获取资金单元番号的颜色（基于首字母）
 * 确保同一首字母的所有单元显示相同颜色
 */
export function getUnitCodeColor(unitCode: string): 'default' | 'secondary' | 'outline' {
  const prefix = getUnitCodePrefix(unitCode);
  return getTagColor(prefix);
}

/**
 * 获取资金单元番号的颜色类（基于首字母）
 */
export function getUnitCodeColorClasses(unitCode: string): {
  bg: string;
  text: string;
} {
  const prefix = getUnitCodePrefix(unitCode);
  return getLabelColorClasses(prefix);
}
