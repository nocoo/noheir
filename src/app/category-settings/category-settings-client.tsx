"use client";

import { Check, Save, Shield, Tags, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveActiveIncomeCategories,
  saveFixedExpenseCategories,
} from "@/app/actions/settings-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getExpenseTypeDescription,
  toggleFixedExpenseCategory,
} from "@/domain/settings/expense-categories";
import {
  getIncomeTypeDescription,
  toggleActiveIncomeCategory,
} from "@/domain/settings/income-categories";
import { cn } from "@/lib/utils";

interface CategorySettingsClientProps {
  incomeCategories: string[];
  expenseCategories: string[];
  activeIncomeCategories: string[];
  fixedExpenseCategories: string[];
}

export function CategorySettingsClient({
  incomeCategories,
  expenseCategories,
  activeIncomeCategories: initialActive,
  fixedExpenseCategories: initialFixed,
}: CategorySettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
      const [incomeResult, expenseResult] = await Promise.all([
        saveActiveIncomeCategories(activeIncome),
        saveFixedExpenseCategories(fixedExpense),
      ]);

      if (incomeResult.success && expenseResult.success) {
        toast.success("分类设置已保存");
        router.refresh();
      } else {
        const errorMsg = !incomeResult.success
          ? incomeResult.error
          : !expenseResult.success
            ? expenseResult.error
            : "未知错误";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Tags className="text-primary size-6" />
          分类设置
        </h1>
        <p className="text-muted-foreground text-sm">配置收入和支出分类的类型</p>
      </div>

      {/* Income Category Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="text-income size-5" />
            收入类型分类
          </CardTitle>
          <CardDescription>
            设置哪些收入分类为主动收入（需付出时间/劳动），默认所有收入为被动收入
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">主动收入分类</p>
              <p className="text-muted-foreground text-xs">
                已选择 {activeIncome.length} / {incomeCategories.length} 个分类
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIncomeSelector(!showIncomeSelector)}
            >
              {showIncomeSelector ? "收起" : "选择分类"}
            </Button>
          </div>

          {showIncomeSelector && (
            <div className="space-y-3 rounded-lg border p-4">
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {incomeCategories.map((category) => {
                    const isActive = activeIncome.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleToggleIncome(category)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted/50",
                          isActive && "border-income bg-income/10",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                            isActive ? "border-income bg-income" : "border-muted-foreground",
                          )}
                        >
                          {isActive && <Check className="text-income-foreground size-3" />}
                        </div>
                        <span className="truncate">{category}</span>
                      </button>
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

          <div className="bg-muted/50 space-y-1 rounded-lg p-3 text-sm">
            <p className="font-medium">收入类型说明</p>
            <ul className="text-muted-foreground space-y-1 pl-4">
              <li>
                • <span className="text-income font-medium">主动收入</span>：
                {getIncomeTypeDescription(true)}
              </li>
              <li>
                • <span className="text-muted-foreground font-medium">被动收入</span>：
                {getIncomeTypeDescription(false)}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Expense Category Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="text-expense size-5" />
            支出类型分类
          </CardTitle>
          <CardDescription>
            设置哪些支出分类为固定支出（每个月必须支付的钱），默认所有支出为弹性支出
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">固定支出分类</p>
              <p className="text-muted-foreground text-xs">
                已选择 {fixedExpense.length} / {expenseCategories.length} 个分类
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExpenseSelector(!showExpenseSelector)}
            >
              {showExpenseSelector ? "收起" : "选择分类"}
            </Button>
          </div>

          {showExpenseSelector && (
            <div className="space-y-3 rounded-lg border p-4">
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {expenseCategories.map((category) => {
                    const isFixed = fixedExpense.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => handleToggleExpense(category)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted/50",
                          isFixed && "border-expense bg-expense/10",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                            isFixed ? "border-expense bg-expense" : "border-muted-foreground",
                          )}
                        >
                          {isFixed && <Check className="text-expense-foreground size-3" />}
                        </div>
                        <span className="truncate">{category}</span>
                      </button>
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

          <div className="bg-muted/50 space-y-1 rounded-lg p-3 text-sm">
            <p className="font-medium">支出类型说明</p>
            <ul className="text-muted-foreground space-y-1 pl-4">
              <li>
                • <span className="text-expense font-medium">固定支出</span>：
                {getExpenseTypeDescription(true)}
              </li>
              <li>
                • <span className="text-muted-foreground font-medium">弹性支出</span>：
                {getExpenseTypeDescription(false)}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

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
