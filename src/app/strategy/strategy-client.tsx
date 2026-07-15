"use client";

import { ResponsiveSunburst } from "@nivo/sunburst";
import { Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SunburstData } from "@/domain/assets/strategy-sunburst";
import { formatCurrencyFull } from "@/lib/chart-config";
import {
  getCurrencyToken,
  resolveColor,
  shadeChartColor,
  stableHash,
  VIVID_COLOR_INDICES,
} from "@/lib/palette";

interface StrategyClientProps {
  hierarchy: SunburstData;
  totalAmount: number;
}

/**
 * Which chart-N slot to use for the strategy at the given palette index.
 * Cycles through VIVID_COLOR_INDICES (22 vivid slots, skipping the two gray
 * tones) so neighbouring strategies never land on the same slot even when the
 * tree grows past 22 strategies (unlikely but possible).
 */
function strategyToken(paletteIndex: number): string {
  const slot = VIVID_COLOR_INDICES[paletteIndex % VIVID_COLOR_INDICES.length];
  return `chart-${slot}`;
}

// Level 3 products share their parent strategy's chart-N token; nudge L by
// ±[3, 12] pts so sibling arcs stay visually distinct without escaping the
// strategy's colour family. Deterministic (hash-based), so the same product
// always renders the same shade across page loads.
function productShadeDelta(name: string): number {
  const h = stableHash(name);
  const magnitude = 3 + (h % 10); // 3–12
  const sign = (h >> 4) & 1 ? 1 : -1;
  return sign * magnitude;
}

/**
 * SVG fill for one sunburst arc:
 *   depth 1 (currency) → CURRENCY_TOKEN_MAP  (semantic: CNY red / USD blue / HKD amber)
 *   depth 2 (strategy) → chart-N picked from VIVID_COLOR_INDICES by the
 *                        strategy's global paletteIndex (assigned in
 *                        strategy-sunburst.ts). Independent from the depth-1
 *                        family, so the middle ring cycles hues rather than
 *                        inheriting the currency tint.
 *   depth 3 (product)  → parent strategy's chart-N, shaded by ±3–12 L points
 *                        via a hash of the product name.
 */
function colorForNode(node: {
  depth: number;
  data: SunburstData;
  parent?: { data: SunburstData };
}): string {
  if (node.depth === 1) {
    // depth-1 nodes carry the ISO currency code; the localised display label
    // lives on `name`. Palette look-up must key on the code, not the label,
    // or "人民币" falls through to hashToChartToken and picks a wrong hue.
    const code = node.data.currencyCode ?? node.data.name;
    return resolveColor(getCurrencyToken(code));
  }
  if (node.depth === 2) {
    const idx = node.data.paletteIndex ?? 0;
    return resolveColor(strategyToken(idx));
  }
  const parentIdx = node.parent?.data.paletteIndex ?? 0;
  return shadeChartColor(strategyToken(parentIdx), productShadeDelta(node.data.name));
}

export function StrategyClient({ hierarchy, totalAmount }: StrategyClientProps) {
  const hasData = (hierarchy.children?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="text-primary size-6" />
          策略透视
        </h1>
        <p className="text-muted-foreground text-sm">
          从币种 → 策略 → 产品的层级视角，识别集中度风险
          {totalAmount > 0 && ` · 总计 ${formatCurrencyFull(totalAmount)}`}
        </p>
      </div>

      {/* Sunburst Chart */}
      <Card>
        <CardHeader>
          <CardTitle>资产配置结构</CardTitle>
          <CardDescription>内圈币种 → 中圈策略 → 外圈产品</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[600px]">
            {hasData ? (
              <ResponsiveSunburst<SunburstData>
                data={hierarchy}
                id="id"
                value="value"
                cornerRadius={2}
                borderColor="#fff"
                borderWidth={2}
                colors={colorForNode}
                // Nivo defaults inheritColorFromParent to true, which
                // short-circuits our per-depth palette function for every
                // arc at depth > 1. Disable it so colorForNode drives ALL
                // three rings — otherwise every strategy and product just
                // inherits its currency's colour.
                inheritColorFromParent={false}
                enableArcLabels
                arcLabel={(d) => d.data.name}
                arcLabelsSkipAngle={12}
                arcLabelsTextColor={{ from: "color", modifiers: [["darker", 3]] }}
                animate
                motionConfig="gentle"
                tooltip={({ data, value }) => {
                  const percentage =
                    totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(2) : "0.00";
                  const formatted = value.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  return (
                    <div
                      style={{
                        background: "white",
                        padding: 8,
                        border: "1px solid #eee",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#333",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.name}</div>
                      <div style={{ color: "#666" }}>
                        金额: ¥{formatted}
                        <br />
                        占比: {percentage}%
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                暂无策略配置数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <h3 className="mb-2 font-semibold">💡 透视价值</h3>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li>• 识别单一渠道/产品过度集中</li>
              <li>• 评估美元资产配置占比</li>
              <li>• 检查各策略资金分布均衡性</li>
              <li>• 发现&ldquo;产品名称不同但实际同类&rdquo;的情况</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <h3 className="mb-2 font-semibold">📊 使用指南</h3>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li>
                • <strong>内圈</strong>: 币种分类 (人民币/美元/港币)
              </li>
              <li>
                • <strong>中圈</strong>: 投资策略
              </li>
              <li>
                • <strong>外圈</strong>: 具体产品
              </li>
              <li>
                • <strong>面积</strong>: 代表资金量大小
              </li>
              <li>• 悬停查看详细金额和占比</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
