import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { formatCurrencyFull } from "@/lib/chart-config";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SYSTEM_PROMPT = `你是一个专业的财务分析助手，帮助用户了解他们的财务状况。

## 回答结构

**第一部分：答案**
先用一句话或简短段落直接回答用户的问题，给出基本事实

**第二部分：关键发现（Bullet Point）**
• 关键发现1
• 关键发现2
• 关键发现3

**总结：** 一句话总结核心洞察

## 内容规范

1. **先回答问题，再做分析**：先给出用户问的具体数字/事实，然后再提供对比、趋势等洞察
2. **只回复关键信息和重要发现**，省略次要细节
3. **避免重复信息**：
   - 如果查询某一天/某月，不要在每条记录后重复日期
   - 统一在标题或开头说明时间范围
4. **突出对比和趋势**：同比/环比变化、异常值、占比等
5. **简洁有力**：每条 bullet point 尽量一行，最多两行

## 专业知识：资金单元番号

**什么是番号？**
- "番号"是资金单元的唯一编号（unit_code），用于标识和管理不同的资金池
- 格式：字母前缀 + 数字后缀，如 A01、B02、C05
- 用途：区分不同的投资策略单元（如：A01=养老年金，B01=美元资产）

**番号规则**：
- 字母前缀（A-Z）：代表不同的资金类别或策略组
- 数字后缀（01-99）：同类资金的序号
- 例如：A01、A02、A03 为同一类资金的不同单元

**如何搜索番号？**
当用户提到番号时（如"A01"、"番号A01"、"资金单元B02"），应：
1. 识别番号格式（字母+数字，如 A01、B02）
2. 使用 search_transactions_supabase 工具
3. 将番号作为 keyword 参数进行搜索
4. 查询该资金单元相关的所有交易记录

**番号搜索示例**：
- 用户："A01有多少钱？" → keyword="A01"
- 用户："番号B02的收益" → keyword="B02"
- 用户："资金C05的交易记录" → keyword="C05"

## 工具选择策略

- **本地数据搜索** (search_transactions): 适合查询当前加载年份的统计类问题
- **数据库搜索** (search_transactions_supabase): 适合关键词搜索、跨年查询、精确查找具体交易、番号查询

## 示例

### 示例 1：普通查询
用户："2024年8月餐饮支出多少？"

2024年8月餐饮支出 ¥2,345.67。

• 占当月总支出 28%
• 较7月增长 ¥234.56（+11%）
• 主要集中在周末外卖（¥1,200.00）

**总结：** 8月餐饮支出较高，主要因周末外卖增加

### 示例 2：番号查询
用户："A01番号有多少钱？"

A01资金单元总计 ¥100,000.00。

• 共 3 笔交易
• 最近一笔：2024-06-15 转入 ¥50,000.00
• 关联策略：远期理财

**总结：** A01为养老年金资金单元，目前处于已成立状态

## 可用工具

**统计类工具（使用本地缓存数据）**:
- get_financial_health: 获取整体财务状况
- get_monthly_summary: 获取月度收支汇总
- get_category_analysis: 按分类统计收入或支出
- search_transactions: 搜索当前已加载年份的交易记录

**搜索类工具（使用 Supabase 数据库）**:
- search_transactions_supabase: 模糊搜索交易记录，支持关键词、分类、时间、账户、标签、金额等多维度搜索
  - keyword: 在备注、分类、账户中模糊搜索（**番号查询必用此参数**）
  - categories: 按分类筛选（支持多个）
  - type: 收入/支出/转账
  - accounts: 按账户筛选（支持多个）
  - tags: 按标签筛选（支持多个）
  - startDate/endDate: 日期范围
  - minAmount/maxAmount: 金额范围
  - limit: 返回结果数量（默认50，最大500）
`;


// Tool definitions for function calling
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_financial_health",
      description: "获取整体财务状况，包括总收入、总支出、结余和储蓄率",
      parameters: {
        type: "object" as const,
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_monthly_summary",
      description: "获取月度收支汇总数据，可按年份筛选",
      parameters: {
        type: "object" as const,
        properties: {
          year: {
            type: "number" as const,
            description: "年份，如 2024。不提供则使用当前选中年份"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_category_analysis",
      description: "按分类统计收入或支出，返回各分类的金额和占比",
      parameters: {
        type: "object" as const,
        properties: {
          type: {
            type: "string" as const,
            enum: ["income", "expense"],
            description: "统计类型：income（收入）或 expense（支出）"
          },
          topN: {
            type: "number" as const,
            description: "返回前 N 个分类，默认 5"
          }
        },
        required: ["type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_transactions",
      description: "搜索符合条件的交易记录（使用本地缓存数据）",
      parameters: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            description: "一级分类名称，如'餐饮'、'交通'"
          },
          startDate: {
            type: "string" as const,
            description: "开始日期，格式：YYYY-MM-DD"
          },
          endDate: {
            type: "string" as const,
            description: "结束日期，格式：YYYY-MM-DD"
          },
          minAmount: {
            type: "number" as const,
            description: "最小金额"
          },
          maxAmount: {
            type: "number" as const,
            description: "最大金额"
          },
          limit: {
            type: "number" as const,
            description: "返回结果数量限制，默认 10"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_transactions_supabase",
      description: "使用 Supabase 数据库模糊搜索交易记录，支持关键词搜索和多维度筛选。**重要：搜索资金单元番号时，使用 keyword 参数传入番号（如 'A01'、'B02'）**",
      parameters: {
        type: "object" as const,
        properties: {
          keyword: {
            type: "string" as const,
            description: "搜索关键词，在备注、分类、账户、标签中模糊匹配。**搜索番号时传入完整番号（如 'A01'、'B02'、'C05'）**"
          },
          categories: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "按一级分类筛选，如['餐饮', '交通']"
          },
          type: {
            type: "string" as const,
            enum: ["income", "expense", "transfer"],
            description: "交易类型：income（收入）、expense（支出）、transfer（转账）"
          },
          accounts: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "按账户筛选，如['招商银行', '支付宝']"
          },
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "按标签筛选，如['旅游', '餐饮']"
          },
          startDate: {
            type: "string" as const,
            description: "开始日期，格式：YYYY-MM-DD"
          },
          endDate: {
            type: "string" as const,
            description: "结束日期，格式：YYYY-MM-DD"
          },
          minAmount: {
            type: "number" as const,
            description: "最小金额"
          },
          maxAmount: {
            type: "number" as const,
            description: "最大金额"
          },
          limit: {
            type: "number" as const,
            description: "返回结果数量限制，默认 50，最大 500"
          }
        },
        required: []
      }
    }
  }
];

// Types for tool execution
interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

// Tool name to Chinese display name mapping
const TOOL_NAMES: Record<string, string> = {
  "get_financial_health": "财务健康概览",
  "get_monthly_summary": "月度收支汇总",
  "get_category_analysis": "分类统计分析",
  "search_transactions": "本地搜索交易记录",
  "search_transactions_supabase": "数据库模糊搜索"
};

export function ChatBubble() {
  const { user } = useAuth();
  const { settings } = useSettings();

  // Get financial data
  const {
    allTransactions,
    monthlyData,
    categoryData,
    totalIncome,
    totalExpense,
    balance,
    selectedYear,
    availableYears,
    storedYearsData,
    isLoading: dataLoading
  } = useTransactions();

  const [isOpen, setIsOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string; toolCalls?: ToolCall[] }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [executingTool, setExecutingTool] = useState<string | null>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isOpen]);

  // Check all conditions AFTER hooks (React Hooks rules)
  const shouldRender = settings.aiConfig.enabled
    && settings.aiConfig.apiKey
    && settings.aiConfig.baseURL
    && settings.aiConfig.modelName
    && user
    && !dataLoading
    && selectedYear
    && storedYearsData.length > 0;

  if (!shouldRender) {
    return null;
  }

  // Execute tool calls with local data (no Supabase queries)
  const executeTool = async (toolCall: ToolCall): Promise<string> => {
    const { name, arguments: argsStr } = toolCall.function;
    const args = JSON.parse(argsStr);

    console.log(`🔧 [Tool Execution Started] ${name}`, { args });

    try {
      let result: string;
      switch (name) {
        case "get_financial_health": {
          const savingsRate = totalIncome > 0
            ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1)
            : "0.0";

          result = JSON.stringify({
            totalIncome: formatCurrencyFull(totalIncome),
            totalExpense: formatCurrencyFull(totalExpense),
            balance: formatCurrencyFull(balance),
            savingsRate: `${savingsRate}%`,
            selectedYear,
            availableYears
          });
          break;
        }

        case "get_monthly_summary": {
          const year = args.year ?? selectedYear;
          const yearData = storedYearsData.find(d => d.year === year);

          if (!yearData) {
            result = JSON.stringify({ error: `没有找到 ${year} 年的数据` });
            break;
          }

          const months = ['一月', '二月', '三月', '四月', '五月', '六月',
                          '七月', '八月', '九月', '十月', '十一月', '十二月'];

          const summary = months.map((month, idx) => {
            const monthTx = yearData.transactions.filter(t => t.month === idx + 1);
            const income = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            return {
              month,
              income: formatCurrencyFull(income),
              expense: formatCurrencyFull(expense),
              balance: formatCurrencyFull(income - expense)
            };
          }).filter(m => m.income !== "¥0.00" || m.expense !== "¥0.00");

          result = JSON.stringify({ year, summary });
          break;
        }

        case "get_category_analysis": {
          const type = args.type;
          const topN = args.topN ?? 5;

          const year = selectedYear;
          const yearData = storedYearsData.find(d => d.year === year);

          if (!yearData) {
            result = JSON.stringify({ error: `没有找到 ${year} 年的数据` });
            break;
          }

          const typeTx = yearData.transactions.filter(t => t.type === type);
          const total = typeTx.reduce((sum, t) => sum + t.amount, 0);

          const categoryMap = new Map<string, number>();
          typeTx.forEach(t => {
            categoryMap.set(t.primaryCategory, (categoryMap.get(t.primaryCategory) || 0) + t.amount);
          });

          const categories = Array.from(categoryMap.entries())
            .map(([category, amount]) => ({
              category,
              amount: formatCurrencyFull(amount),
              percentage: total > 0 ? ((amount / total) * 100).toFixed(1) + "%" : "0%"
            }))
            .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
            .slice(0, topN);

          result = JSON.stringify({ type, year, categories });
          break;
        }

        case "search_transactions": {
          const { category, startDate, endDate, minAmount, maxAmount, limit = 10 } = args;

          let results = allTransactions;

          if (category) {
            results = results.filter(t => t.primaryCategory === category);
          }
          if (startDate) {
            results = results.filter(t => t.date >= startDate);
          }
          if (endDate) {
            results = results.filter(t => t.date <= endDate);
          }
          if (minAmount !== undefined) {
            results = results.filter(t => t.amount >= minAmount);
          }
          if (maxAmount !== undefined) {
            results = results.filter(t => t.amount <= maxAmount);
          }

          results = results.slice(0, limit);

          const formatted = results.map(t => ({
            date: t.date,
            category: t.primaryCategory,
            amount: formatCurrencyFull(t.amount),
            type: t.type === 'income' ? '收入' : t.type === 'expense' ? '支出' : '转账',
            account: t.account,
            description: t.description || ''
          }));

          result = JSON.stringify({
            total: results.length,
            transactions: formatted
          });
          break;
        }

        case "search_transactions_supabase": {
          // Input validation and sanitization
          const {
            keyword = null,
            categories = null,
            type = null,
            accounts = null,
            tags = null,
            startDate = null,
            endDate = null,
            minAmount = null,
            maxAmount = null,
            limit = 50
          } = args;

          // Validate and sanitize inputs
          const sanitizedLimit = Math.min(Math.max(1, Number(limit) || 50), 500);

          // Validate date format (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (startDate && !dateRegex.test(startDate)) {
            result = JSON.stringify({ error: "开始日期格式错误，应为 YYYY-MM-DD" });
            break;
          }
          if (endDate && !dateRegex.test(endDate)) {
            result = JSON.stringify({ error: "结束日期格式错误，应为 YYYY-MM-DD" });
            break;
          }

          // Validate type enum
          const validTypes = ['income', 'expense', 'transfer'];
          if (type && !validTypes.includes(type)) {
            result = JSON.stringify({ error: `交易类型错误，应为: ${validTypes.join(', ')}` });
            break;
          }

          // Sanitize keyword (prevent SQL injection - though RPC handles this, we still validate)
          const sanitizedKeyword = keyword ? String(keyword).trim().slice(0, 200) : null;

          try {
            const { data: searchResults, error } = await supabase.rpc('search_transactions_fuzzy', {
              p_keyword: sanitizedKeyword,
              p_categories: categories,
              p_type: type,
              p_accounts: accounts,
              p_tags: tags,
              p_start_date: startDate,
              p_end_date: endDate,
              p_min_amount: minAmount,
              p_max_amount: maxAmount,
              p_limit: sanitizedLimit,
              p_offset: 0
            });

            if (error) {
              console.error('Supabase RPC error:', error);
              result = JSON.stringify({ error: `搜索失败: ${error.message}` });
              break;
            }

            const formatted = searchResults?.map(t => ({
              date: t.date,
              category: t.primary_category,
              subCategory: t.secondary_category,
              amount: formatCurrencyFull(Number(t.amount)),
              type: t.type === 'income' ? '收入' : t.type === 'expense' ? '支出' : '转账',
              account: t.account,
              currency: t.currency,
              tags: t.tags,
              note: t.note,
              matchedField: t.matched_field
            })) || [];

            result = JSON.stringify({
              total: formatted.length,
              limit: sanitizedLimit,
              transactions: formatted
            });
          } catch (e: any) {
            result = JSON.stringify({ error: `搜索异常: ${e.message}` });
          }
          break;
        }

        default:
          result = JSON.stringify({ error: `未知工具: ${name}` });
          break;
      }

      console.log(`✅ [Tool Execution Completed] ${name}`, { result });
      return result;
    } catch (e: any) {
      console.error(`❌ [Tool Execution Failed] ${name}`, { error: e.message });
      return JSON.stringify({ error: e.message || "工具执行失败" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: "user" as const, content: input };
    console.log(`💬 [User Message]`, { content: input });
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      // Build messages array for API
      const apiMessages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: input }
      ];

      // First API call with tools
      const response = await fetch(`${settings.aiConfig.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.aiConfig.modelName,
          stream: true,
          messages: apiMessages,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Create assistant message
      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      // Parse the stream and collect tool_calls
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Accumulated data for tool_calls
      let accumulatedToolCalls: Map<number, any> = new Map();
      let currentContent = "";

      while (true) {
        const { done, value } = await reader?.read() ?? { done: true, value: undefined };
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            // Handle content
            if (delta?.content) {
              currentContent += delta.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: currentContent } : msg
                )
              );
            }

            // Handle tool_calls (streamed)
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index;
                if (!accumulatedToolCalls.has(index)) {
                  accumulatedToolCalls.set(index, {
                    id: toolCall.id,
                    type: toolCall.type || "function",
                    function: {
                      name: toolCall.function?.name || "",
                      arguments: toolCall.function?.arguments || ""
                    }
                  });
                } else {
                  const existing = accumulatedToolCalls.get(index)!;
                  if (toolCall.function?.name) {
                    existing.function.name += toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    existing.function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // Check if we have tool_calls to execute
      if (accumulatedToolCalls.size > 0) {
        const toolCallsArray = Array.from(accumulatedToolCalls.values());
        console.log(`🔍 [Tool Calls Detected] Found ${toolCallsArray.length} tool call(s)`, toolCallsArray);

        // Remove the intermediate assistant message (we'll show the final one)
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));

        // Set executing tool state for UI display
        const toolNames = toolCallsArray.map(tc => TOOL_NAMES[tc.function.name] || tc.function.name);
        setExecutingTool(toolNames.join(" + "));

        // Execute all tools
        console.log(`⚙️ [Executing Tools] Starting tool execution...`);
        const toolMessages: ToolMessage[] = [];
        for (const toolCall of toolCallsArray) {
          const result = await executeTool(toolCall);
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result
          });
        }
        console.log(`⚙️ [Executing Tools] Completed, making second API call...`);

        // Make second API call with tool results
        const secondResponse = await fetch(`${settings.aiConfig.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.aiConfig.modelName,
            stream: true,
            messages: [
              ...apiMessages,
              { role: "assistant", content: currentContent, tool_calls: toolCallsArray },
              ...toolMessages
            ],
            temperature: 0.7,
          }),
        });

        if (!secondResponse.ok) {
          throw new Error(`HTTP ${secondResponse.status}: ${await secondResponse.text()}`);
        }

        // Create new assistant message for final response
        const finalAssistantId = (Date.now() + 2).toString();
        setMessages((prev) => [...prev, { id: finalAssistantId, role: "assistant", content: "" }]);

        // Parse final response stream
        const reader2 = secondResponse.body?.getReader();
        let buffer2 = "";
        let finalContent = "";

        while (true) {
          const { done, value } = await reader2?.read() ?? { done: true, value: undefined };
          if (done) break;

          buffer2 += decoder.decode(value, { stream: true });
          const lines = buffer2.split("\n");
          buffer2 = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                finalContent += content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === finalAssistantId ? { ...msg, content: finalContent } : msg
                  )
                );
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }

        // Log final AI response after tool execution
        console.log(`📝 [Final AI Response]:`, finalContent);
      }

      // No tool_calls - AI responded directly
      if (accumulatedToolCalls.size === 0) {
        console.log(`💡 [Direct Response] No tool calls detected, AI responded directly`);
        console.log(`📝 [AI Response Content]:`, currentContent);
      }
    } catch (err: any) {
      setError(err.message || "请求失败");
    } finally {
      setIsLoading(false);
      setExecutingTool(null);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <Card className="w-[380px] h-[520px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
          <CardHeader className="p-4 border-b bg-muted/40 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold">AI助手</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden min-h-0">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="p-4 flex flex-col gap-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>你好！有什么可以帮助你的吗？</p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2 w-full",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] px-4 py-2.5 rounded-2xl break-words text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {m.role === "assistant" ? (
                        m.content ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-2 pl-4 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 pl-4 space-y-1 list-decimal">{children}</ol>,
                              li: ({ children }) => <li>{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                              code: ({ className, children, ...props }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs" {...props}>{children}</code>
                                ) : (
                                  <code className="block bg-muted-foreground/10 p-2 rounded text-xs overflow-x-auto" {...props}>{children}</code>
                                );
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        ) : (
                          <span className="opacity-50">...</span>
                        )
                      ) : (
                        m.content || <span className="opacity-50">...</span>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && messages.filter(m => m.role === "assistant").length === 0 && !executingTool && (
                  <div className="flex gap-2">
                    <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}

                {executingTool && (
                  <div className="flex gap-2 items-center text-sm text-muted-foreground bg-muted/50 px-4 py-2.5 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在调用 <span className="font-medium text-foreground">{executingTool}</span> 工具...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="break-words">{error}</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input?.trim()} className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>
    </div>
  );
}
