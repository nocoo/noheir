/**
 * Colored Badge Component
 *
 * 统一的彩色标签组件，基于20色哈希算法
 * 确保相同标签在所有页面显示相同颜色
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getLabelColorClasses, getTagColor, getUnitCodePrefix } from '@/lib/tagColors';

// ============================================================================
// TYPES
// ============================================================================

interface ColoredBadgeProps {
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'auto';
  className?: string;
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * 通用彩色标签（自动颜色）
 * 使用20色哈希算法，确保相同标签颜色一致
 */
export function ColoredBadge({ label, variant = 'auto', className }: ColoredBadgeProps) {
  const { bg, text } = getLabelColorClasses(label);

  return (
    <Badge
      variant="outline"
      className={cn(
        bg,
        text,
        'border-transparent font-normal',
        className
      )}
    >
      {label}
    </Badge>
  );
}

/**
 * 资金单元编号标签（基于首字母着色）
 * 例如：A01, A02 显示相同颜色
 */
export function UnitCodeBadge({ unitCode, className }: { unitCode: string; className?: string }) {
  const prefix = getUnitCodePrefix(unitCode);
  const { bg, text } = getLabelColorClasses(prefix);

  return (
    <Badge
      variant="outline"
      className={cn(
        bg,
        text,
        'border-transparent font-mono',
        className
      )}
    >
      {unitCode}
    </Badge>
  );
}

/**
 * 策略标签（自动颜色）
 */
export function StrategyBadge({ strategy, className }: { strategy: string; className?: string }) {
  return <ColoredBadge label={strategy} className={className} />;
}

/**
 * 战术标签（自动颜色）
 */
export function TacticsBadge({ tactics, className }: { tactics: string; className?: string }) {
  return <ColoredBadge label={tactics} className={className} />;
}

/**
 * 状态标签（自动颜色）
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <ColoredBadge label={status} className={className} />;
}

/**
 * 渠道标签（自动颜色）
 */
export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  return <ColoredBadge label={channel} className={className} />;
}

/**
 * 类别标签（自动颜色）
 */
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return <ColoredBadge label={category} className={className} />;
}
