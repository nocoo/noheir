import type { createNativeFixture } from "./test-fixture.ts";
import { TEST_USERS } from "./test-fixture.ts";

export const CATALOG_VERSION = 1;
export const DEMO_ANCHOR = "2026-09-28T12:00:00+08:00";
export const fixtureId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function seedDemo(fixture: Awaited<ReturnType<typeof createNativeFixture>>) {
  await fixture.assertMarker();
  const { db } = fixture;
  await db.exec("CREATE TABLE IF NOT EXISTS _demo_catalog (version INTEGER, anchor TEXT)");
  if (await db.prepare("SELECT version FROM _demo_catalog").first()) return;
  const owner = TEST_USERS[0];
  const statements = [];
  const insert = (table: string, row: Record<string, string | number | null | undefined>) => {
    const keys = Object.keys(row);
    statements.push(
      db
        .prepare(
          `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        )
        .bind(...Object.values(row)),
    );
  };
  statements.push(
    db
      .prepare("UPDATE users SET name = ?, image = ? WHERE id = ?")
      .bind("林晓 · 演示账户", "/demo/avatar.svg", owner),
  );
  for (const year of [2024, 2025, 2026]) {
    for (let month = 1; month <= (year === 2026 ? 9 : 12); month++) {
      const date = `${year}-${String(month).padStart(2, "0")}-15`;
      const rows = [
        [
          "income",
          "职业收入",
          "工资",
          "月度薪酬",
          2850000 + (year - 2024) * 120000 + month * 5000,
          "工资账户",
          "稳定收入",
        ],
        ["income", "投资收入", "利息", "存款收益", 42000 + month * 1100, "储蓄账户", "被动收入"],
        ["expense", "居住", "固定支出", "房屋租金", 620000, "工资账户", "必要支出"],
        ["expense", "餐饮", "日常消费", "三餐与咖啡", 138000 + month * 1700, "日常钱包", "生活"],
        ["expense", "交通", "通勤", "地铁与骑行", 26000 + month * 700, "日常钱包", "低碳"],
        ["expense", "文化", "订阅", "阅读会员", 6800, "日常钱包", "成长"],
        [
          "expense",
          "旅行",
          "休闲",
          "山海旅行计划",
          month % 3 === 0 ? 248000 : 32000,
          "旅行账户",
          "旅行",
        ],
        ["expense", "医疗", "保障", "健康保险", 35000, "工资账户", "保障"],
      ] as const;
      for (const [index, row] of rows.entries()) {
        const [type, primary, secondary, tertiary, amount, account, tag] = row;
        insert("transactions", {
          id: fixtureId(year * 10000 + month * 100 + index),
          user_id: owner,
          date,
          year,
          month,
          day: 15,
          type,
          primary_category: primary,
          secondary_category: secondary,
          tertiary_category: tertiary,
          amount_cents: amount,
          account,
          currency: "人民币",
          tags: JSON.stringify([tag, "合成演示"]),
          note: `${tertiary} · 合成数据，不对应真实财务记录`,
        });
      }
      for (const [i, account] of ["工资账户", "日常钱包"].entries()) {
        insert("transfers", {
          id: fixtureId(year * 10000 + month * 100 + 50 + i),
          user_id: owner,
          date,
          year,
          month,
          day: 15,
          account,
          primary_category: "账户调拨",
          secondary_category: "转账",
          transaction_type: i ? "转入" : "转出",
          inflow_amount_cents: i ? 250000 : 0,
          outflow_amount_cents: i ? 0 : 250000,
          currency: "人民币",
          tags: '["合成演示"]',
          note: "日常预算调拨",
        });
      }
    }
  }
  const strategies = [
    "远期理财",
    "美元资产",
    "36存单",
    "长期理财",
    "短期理财",
    "中期理财",
    "进攻计划",
    "麻麻理财",
  ];
  const tactics = [
    "养老年金",
    "个人养老金",
    "定期存款",
    "理财产品",
    "现金产品",
    "债券基金",
    "偏股基金",
    "稳健理财",
    "增额寿险",
    "货币基金",
    "混债基金",
    "现金管理",
  ];
  const names = [
    "松林养老年金",
    "晨光养老金",
    "海岸三年存单",
    "远山稳健组合",
    "溪流现金管理",
    "青禾债券篮子",
    "星河成长基金",
    "晴空稳健精选",
    "长青保障计划",
    "晨露货币组合",
    "银杏混合债券",
    "潮汐循环理财",
  ];
  for (let i = 0; i < names.length; i++) {
    const product = fixtureId(1000 + i);
    const unit = fixtureId(2000 + i);
    const amount = (i + 2) * 1000000;
    const status = i === 8 ? "计划中" : i === 9 ? "筹集中" : i === 10 ? "已归档" : "已成立";
    insert("financial_products", {
      id: product,
      user_id: owner,
      name: names[i],
      code: `DEMO-${i + 1}`,
      channel: i % 2 ? "合成银行·青禾" : "合成银行·山海",
      category: tactics[i],
      currency: i === 1 ? "USD" : i === 7 ? "HKD" : "CNY",
      lock_period_days: i === 0 ? 0 : i === 2 ? 365 : 30,
      annual_return_rate: 1.8 + i * 0.35,
      is_archived: i === 10 ? 1 : 0,
      open_days: i === 11 ? 7 : null,
      cycle_days: i === 11 ? 30 : null,
    });
    insert("capital_units", {
      id: unit,
      user_id: owner,
      unit_code: `DEMO-${String(i + 1).padStart(2, "0")}`,
      amount_cents: amount,
      currency: i === 1 ? "USD" : i === 7 ? "HKD" : "CNY",
      status,
      strategy: strategies[i % strategies.length],
      tactics: tactics[i],
      product_id: product,
      start_date: "2026-09-01",
      note: "合成资产 · 可正常编辑、赎回及查看历史",
      available_date_override: i === 3 ? "2026-09-30" : null,
    });
    if (status === "已成立" && i !== 6) {
      insert("contribution_logs", {
        id: fixtureId(3000 + i),
        user_id: owner,
        unit_id: unit,
        product_id: product,
        product_name: names[i],
        operation_type: "invest",
        amount_cents: amount,
        balance_after_cents: amount,
        operation_date: i === 0 ? "2026-06-01" : "2026-09-01",
        source: "manual",
        note: "初始投资",
        created_at: 1788192000000,
        updated_at: 1788192000000,
      });
    }
  }
  for (const [i, operation] of ["withdraw", "adjust"].entries()) {
    insert("contribution_logs", {
      id: fixtureId(3100 + i),
      user_id: owner,
      unit_id: fixtureId(2000),
      product_id: fixtureId(1000),
      product_name: names[0],
      operation_type: operation,
      amount_cents: 10000,
      balance_after_cents: 2000000,
      pnl_cents: i ? -500 : 800,
      operation_date: "2026-09-20",
      source: i ? "mcp" : "manual",
      note: "已撤销的操作示例，可恢复",
      deleted_at: 1790000000000,
      created_at: 1790000000000,
      updated_at: 1790000000000,
    });
  }
  for (const [i, name] of ["居住与保障", "生活与出行", "订阅与成长", "旅行与休闲"].entries()) {
    insert("expense_categories", {
      id: fixtureId(4000 + i),
      user_id: owner,
      name,
      color_token: `chart-${i * 4 + 1}`,
      sort_order: i,
    });
  }
  for (const [i, frequency] of [
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "monthly",
    "monthly",
  ].entries()) {
    const status = i === 4 ? "paused" : i === 5 ? "ended" : "active";
    insert("recurring_expenses", {
      id: fixtureId(5000 + i),
      user_id: owner,
      name: [
        "通勤预算",
        "周末采购",
        "房屋租金",
        "健康保险续保",
        "暂停的健身课程",
        "已结束的语言课程",
      ][i],
      category_id: fixtureId(4000 + (i % 4)),
      amount_cents: [2400, 36000, 620000, 420000, 19900, 39900][i],
      currency: "CNY",
      account: "工资账户",
      frequency,
      interval: 1,
      day_of_month: frequency === "monthly" || frequency === "yearly" ? 28 : null,
      month_of_year: frequency === "yearly" ? 9 : null,
      weekday: frequency === "weekly" ? 6 : null,
      start_date: "2026-01-01",
      end_date: status === "ended" ? "2026-08-31" : null,
      status,
      ended_at: status === "ended" ? "2026-08-31T00:00:00.000Z" : null,
      note: "合成计划，可编辑、暂停、恢复及结束",
    });
  }
  insert("settings", {
    owner_id: owner,
    site_name: "山海生活账本",
    settings: JSON.stringify({
      savings_rate_target: 55,
      expected_return_rate: 3,
      min_return_rate: 1.5,
      max_return_rate: 6,
      active_income_categories: ["职业收入"],
      fixed_expense_categories: ["居住", "医疗"],
      account_types: [{ accountName: "工资账户", accountType: "cash" }],
      balance_anchors: [],
      ai_config: {
        enabled: false,
        baseURL: "https://example.invalid/v1",
        modelName: "synthetic-preview",
        apiKey: "",
      },
    }),
  });
  insert("_demo_catalog", { version: CATALOG_VERSION, anchor: DEMO_ANCHOR });
  await fixture.assertMarker();
  await db.batch(statements);
}
