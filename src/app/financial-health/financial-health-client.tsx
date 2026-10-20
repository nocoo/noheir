import { LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { overlayPanelClass } from "@nocoo/basalt/components/overlay";
import {
  AlertCircle,
  CheckCircle2,
  HeartPulse,
  Info,
  PiggyBank,
  Shield,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import type { MonthlyData } from "@/domain/types";
import type { FinancialHealthResult } from "@/lib/financial-health-algorithm";
import { cn } from "@/lib/utils";

interface FinancialHealthClientProps {
  healthResult: FinancialHealthResult;
  monthlyData: MonthlyData[];
}

const gradeColors: Record<string, { text: string; bg: string; border: string }> = {
  "A+": {
    text: "text-basalt-primary",
    bg: "bg-basalt-primary/10",
    border: "border-basalt-primary",
  },
  A: { text: "text-basalt-primary", bg: "bg-basalt-primary/10", border: "border-basalt-primary" },
  B: { text: "text-chart-2", bg: "bg-chart-2/10", border: "border-chart-2" },
  C: { text: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-600" },
  D: {
    text: "text-basalt-destructive",
    bg: "bg-basalt-destructive/10",
    border: "border-basalt-destructive",
  },
};

const dimensionConfig = [
  { key: "growth" as const, name: "成长性", icon: TrendingUp, max: 20 },
  { key: "rigidity" as const, name: "刚性", icon: Shield, max: 25 },
  { key: "quality" as const, name: "质量", icon: Target, max: 15 },
  { key: "resilience" as const, name: "韧性", icon: Zap, max: 20 },
  { key: "savings" as const, name: "储蓄力", icon: PiggyBank, max: 20 },
];

function getStatusBadge(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return { label: "优秀", variant: "default" as const };
  if (pct >= 50) return { label: "一般", variant: "secondary" as const };
  return { label: "需改善", variant: "destructive" as const };
}

export function FinancialHealthClient({ healthResult, monthlyData }: FinancialHealthClientProps) {
  const { totalScore, maxScore, grade, dimensions } = healthResult;
  const colors = gradeColors[grade] ??
    gradeColors.D ?? {
      text: "text-basalt-destructive",
      bg: "bg-basalt-destructive/10",
      border: "border-basalt-destructive",
    };
  const scorePct = (totalScore / maxScore) * 100;

  const StatusIcon = scorePct >= 80 ? CheckCircle2 : scorePct >= 60 ? AlertCircle : XCircle;

  // Build radar chart data
  const radarData = dimensionConfig.map((dim) => ({
    dimension: dim.name,
    score: dimensions[dim.key].score,
    fullMark: dim.max,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">财务健康分析</h1>
          <p className="text-basalt-muted-foreground text-sm">5维度反脆弱评估体系</p>
        </div>
      </div>

      {/* Overall Score Card */}
      <LayerCard className={cn("border-2", colors.border)}>
        <LayerCard.Body className="min-h-0 flex-1 flex items-center gap-6 pt-6">
          <HeartPulse className={cn("size-12", colors.text)} />
          <div className="flex-1">
            <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-lg">
              综合评分
            </h3>
            <p className="text-sm text-basalt-muted-foreground">
              基于 {monthlyData.length} 个月数据评估
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusIcon className={cn("size-8", colors.text)} />
            <div className="text-right">
              <p className={cn("text-3xl font-bold", colors.text)}>
                {totalScore}
                <span className="text-basalt-muted-foreground text-lg font-normal">
                  /{maxScore}
                </span>
              </p>
              <Badge className={cn(colors.bg, colors.text, "border-transparent")}>
                等级 {grade}
              </Badge>
            </div>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Radar Chart */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
            财务健康雷达图
          </h3>
          <p className="text-sm text-basalt-muted-foreground">5维度综合评估，凹陷处代表短板</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 13, fontWeight: 500 }} />
                <PolarRadiusAxis angle={90} domain={[0, "auto"]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload as
                      | {
                          dimension: string;
                          score: number;
                          fullMark: number;
                        }
                      | undefined;
                    if (!data) return null;
                    return (
                      <div
                        className={overlayPanelClass(
                          "px-basalt-card-sm py-basalt-space-lg text-basalt-sm",
                        )}
                      >
                        <p className="font-medium">{data.dimension}</p>
                        <p className="text-basalt-muted-foreground">
                          {data.score} / {data.fullMark} 分
                        </p>
                      </div>
                    );
                  }}
                />
                <Radar
                  name="得分"
                  dataKey="score"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Dimension Detail Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dimensionConfig.map((dim) => {
          const result = dimensions[dim.key];
          const status = getStatusBadge(result.score, result.maxScore);
          const Icon = dim.icon;
          const pct = (result.score / result.maxScore) * 100;
          const interpretation = result.details.interpretation;
          const borderColor =
            pct >= 80
              ? "border-l-basalt-success"
              : pct >= 50
                ? "border-l-amber-500"
                : "border-l-basalt-destructive";
          const iconColor =
            pct >= 80
              ? "text-basalt-success"
              : pct >= 50
                ? "text-amber-500"
                : "text-basalt-destructive";

          return (
            <LayerCard key={dim.key} className={cn("border-l-4", borderColor)}>
              <LayerCard.Header className="items-stretch flex-col gap-1.5 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
                    <Icon className={cn("size-5", iconColor)} />
                    {dim.name}
                  </h3>
                  <span className="text-basalt-muted-foreground text-sm font-medium">
                    {result.score}/{result.maxScore}
                  </span>
                </div>
              </LayerCard.Header>
              <LayerCard.Body className="min-h-0 flex-1 space-y-3">
                <Progress value={pct} className="h-3" />
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="text-basalt-muted-foreground text-sm">{interpretation}</span>
                </div>
                <div className="flex items-start gap-2 rounded-md p-3">
                  <Info className="text-basalt-muted-foreground mt-0.5 size-4 shrink-0" />
                  <p className="text-basalt-muted-foreground text-xs">
                    {getRecommendation(dim.key, pct)}
                  </p>
                </div>
              </LayerCard.Body>
            </LayerCard>
          );
        })}
      </div>
    </div>
  );
}

function getRecommendation(
  dimension: (typeof dimensionConfig)[number]["key"],
  scorePct: number,
): string {
  if (scorePct >= 80) {
    const excellent: Record<string, string> = {
      growth: "收入增长势头良好，继续保持！",
      rigidity: "固定开支控制优秀，弹性空间充足。",
      quality: "收入来源多元化，抗风险能力强。",
      resilience: "现金流稳定，安全边际充足。",
      savings: "储蓄能力突出，财富积累良性循环。",
    };
    return excellent[dimension] ?? "";
  }
  if (scorePct >= 50) {
    const moderate: Record<string, string> = {
      growth: "收入增速尚可，但需关注支出增长趋势。",
      rigidity: "固定支出占比偏高，建议优化订阅和固定合同。",
      quality: "收入来源较集中，建议拓展副业或投资收入。",
      resilience: "偶有现金流压力，建议建立应急储备。",
      savings: "储蓄率一般，建议制定明确的储蓄目标。",
    };
    return moderate[dimension] ?? "";
  }
  const poor: Record<string, string> = {
    growth: "支出增长快于收入，需要调整消费结构。",
    rigidity: "固定开支占比过高，灵活度不足，建议重新审视必要支出。",
    quality: "收入过于依赖单一来源，风险较大。",
    resilience: "现金流波动大，多个月份出现赤字。",
    savings: "储蓄率过低或为负，建议优先保障基本储蓄。",
  };
  return poor[dimension] ?? "";
}
