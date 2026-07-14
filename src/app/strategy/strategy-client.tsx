"use client";

import { ResponsiveSunburst } from "@nivo/sunburst";
import { Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SunburstData } from "@/domain/assets/strategy-sunburst";
import { formatCurrencyFull } from "@/lib/chart-config";

interface StrategyClientProps {
  hierarchy: SunburstData;
  totalAmount: number;
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
                id="name"
                value="value"
                cornerRadius={2}
                borderColor="#fff"
                borderWidth={2}
                colors={{ scheme: "nivo" }}
                childColor={{ from: "color", modifiers: [["brighter", 0.15]] }}
                inheritColorFromParent
                enableArcLabels
                arcLabel={(d) => d.id.toString()}
                arcLabelsSkipAngle={12}
                arcLabelsTextColor={{ from: "color", modifiers: [["darker", 3]] }}
                animate
                motionConfig="gentle"
                tooltip={({ id, value }) => {
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
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{id}</div>
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
