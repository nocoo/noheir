import { Button, Checkbox, Label, LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { ScrollArea } from "@nocoo/basalt/components/scroll-area";
import { toast } from "@nocoo/basalt/components/toast";
import { Save, Shield, Tags, TrendingUp } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { useRevalidator } from "react-router";
import { saveFinancialPreferences } from "@/app/actions/settings-actions";
import { FinancialSnapshotNotice } from "@/components/shared/financial-snapshot-notice";
import {
  getExpenseTypeDescription,
  toggleFixedExpenseCategory,
} from "@/domain/settings/expense-categories";
import {
  getIncomeTypeDescription,
  toggleActiveIncomeCategory,
} from "@/domain/settings/income-categories";

interface CategorySettingsClientProps {
  incomeCategories: string[];
  version: number;
  expenseCategories: string[];
  activeIncomeCategories: string[];
  fixedExpenseCategories: string[];
}

export function CategorySettingsClient({
  incomeCategories,
  version,
  expenseCategories,
  activeIncomeCategories: initialActive,
  fixedExpenseCategories: initialFixed,
}: CategorySettingsClientProps) {
  const revalidator = useRevalidator();
  const selectionId = useId();
  const [isPending, startTransition] = useTransition();
  const [baseVersion, setBaseVersion] = useState(version);

  const [activeIncome, setActiveIncome] = useState<string[]>(initialActive);
  const [fixedExpense, setFixedExpense] = useState<string[]>(initialFixed);
  const [showIncomeSelector, setShowIncomeSelector] = useState(false);
  const [showExpenseSelector, setShowExpenseSelector] = useState(false);

  const handleToggleIncome = (category: string) => {
    setActiveIncome((prev) => toggleActiveIncomeCategory(prev, category));
  };

  const handleToggleExpense = (category: string) => {
    setFixedExpense((prev) => toggleFixedExpenseCategory(prev, category));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveFinancialPreferences(
        { activeIncomeCategories: activeIncome, fixedExpenseCategories: fixedExpense },
        baseVersion,
      );
      if (result.success) {
        toast.success("分类设置已保存");
        revalidator.revalidate();
      } else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-6">
      <FinancialSnapshotNotice
        changed={baseVersion !== version}
        onReset={() => {
          setActiveIncome(initialActive);
          setFixedExpense(initialFixed);
          setBaseVersion(version);
        }}
      />
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Tags className="text-basalt-primary size-6" />
          分类设置
        </h1>
        <p className="text-basalt-muted-foreground text-sm">配置收入和支出分类的类型</p>
      </div>

      {/* Income Category Settings */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
            <TrendingUp className="text-income size-5" />
            收入类型分类
          </h3>
          <p className="text-sm text-basalt-muted-foreground">
            设置哪些收入分类为主动收入（需付出时间/劳动），默认所有收入为被动收入
          </p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">主动收入分类</p>
              <p className="text-basalt-muted-foreground text-xs">
                已选择 {activeIncome.length} / {incomeCategories.length} 个分类
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={showIncomeSelector}
              onClick={() => setShowIncomeSelector(!showIncomeSelector)}
            >
              {showIncomeSelector ? "收起" : "选择分类"}
            </Button>
          </div>

          {showIncomeSelector && (
            <div className="space-y-3 rounded-lg border p-4">
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {incomeCategories.map((category, index) => {
                    const isActive = activeIncome.includes(category);
                    return (
                      <Label
                        key={category}
                        htmlFor={`${selectionId}-income-${index}`}
                        className="flex min-w-0 items-center gap-2 p-2 font-normal"
                      >
                        <Checkbox
                          id={`${selectionId}-income-${index}`}
                          checked={isActive}
                          onCheckedChange={() => handleToggleIncome(category)}
                        />
                        <span className="truncate">{category}</span>
                      </Label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeIncome.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeIncome.slice(0, 8).map((category) => (
                <Badge key={category} variant="default" className="gap-1">
                  <TrendingUp className="size-3" />
                  {category}
                </Badge>
              ))}
              {activeIncome.length > 8 && (
                <Badge variant="secondary">+{activeIncome.length - 8} 更多</Badge>
              )}
            </div>
          )}

          <div className="space-y-1 rounded-lg p-3 text-sm">
            <p className="font-medium">收入类型说明</p>
            <ul className="text-basalt-muted-foreground space-y-1 pl-4">
              <li>
                • <span className="text-income font-medium">主动收入</span>：
                {getIncomeTypeDescription(true)}
              </li>
              <li>
                • <span className="text-basalt-muted-foreground font-medium">被动收入</span>：
                {getIncomeTypeDescription(false)}
              </li>
            </ul>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Expense Category Settings */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2 text-base">
            <Shield className="text-expense size-5" />
            支出类型分类
          </h3>
          <p className="text-sm text-basalt-muted-foreground">
            设置哪些支出分类为固定支出（每个月必须支付的钱），默认所有支出为弹性支出
          </p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">固定支出分类</p>
              <p className="text-basalt-muted-foreground text-xs">
                已选择 {fixedExpense.length} / {expenseCategories.length} 个分类
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={showExpenseSelector}
              onClick={() => setShowExpenseSelector(!showExpenseSelector)}
            >
              {showExpenseSelector ? "收起" : "选择分类"}
            </Button>
          </div>

          {showExpenseSelector && (
            <div className="space-y-3 rounded-lg border p-4">
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {expenseCategories.map((category, index) => {
                    const isFixed = fixedExpense.includes(category);
                    return (
                      <Label
                        key={category}
                        htmlFor={`${selectionId}-expense-${index}`}
                        className="flex min-w-0 items-center gap-2 p-2 font-normal"
                      >
                        <Checkbox
                          id={`${selectionId}-expense-${index}`}
                          checked={isFixed}
                          onCheckedChange={() => handleToggleExpense(category)}
                        />
                        <span className="truncate">{category}</span>
                      </Label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {fixedExpense.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fixedExpense.slice(0, 8).map((category) => (
                <Badge key={category} variant="default" className="gap-1">
                  <Shield className="size-3" />
                  {category}
                </Badge>
              ))}
              {fixedExpense.length > 8 && (
                <Badge variant="secondary">+{fixedExpense.length - 8} 更多</Badge>
              )}
            </div>
          )}

          <div className="space-y-1 rounded-lg p-3 text-sm">
            <p className="font-medium">支出类型说明</p>
            <ul className="text-basalt-muted-foreground space-y-1 pl-4">
              <li>
                • <span className="text-expense font-medium">固定支出</span>：
                {getExpenseTypeDescription(true)}
              </li>
              <li>
                • <span className="text-basalt-muted-foreground font-medium">弹性支出</span>：
                {getExpenseTypeDescription(false)}
              </li>
            </ul>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
