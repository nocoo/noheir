// Category mapping types
export type CategoryMapping = Record<string, string[]>;

export interface ExpenseCategoryMapping {
  [primaryCategory: string]: string[];
}

export interface IncomeCategoryMapping {
  [primaryCategory: string]: string[];
}

export interface CategoryMappings {
  expense: ExpenseCategoryMapping;
  income: IncomeCategoryMapping;
}

// Default expense category mappings (secondary -> tertiary categories)
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryMapping = {
  "日常吃喝": [
    "吃饭",
    "外食",
    "外卖",
    "超市",
    "外购",
    "茶饮"
  ],
  "幸福家庭": [
    "浪漫晚餐",
    "二人日常",
    "商场购物",
    "爱情礼物",
    "鲜花仪式",
    "家庭基金",
    "车票酒店"
  ],
  "小吞金兽": [
    "日常消耗",
    "装备费用",
    "教育费用",
    "医院费用",
    "药物仪器"
  ],
  "生活品质": [
    "生活消耗",
    "家居用品",
    "家具家电",
    "软件硬件",
    "理容美发",
    "背包配饰",
    "衣着服饰"
  ],
  "娱乐社交": [
    "游山玩水",
    "运动健身",
    "电影演出",
    "慈善捐款",
    "亲情礼物",
    "红包礼金"
  ],
  "公共交通": [
    "公交地铁",
    "共享单车",
    "租车的士",
    "跨城交通"
  ],
  "交通工具": [
    "加油充电",
    "停车通行",
    "洗车费用",
    "汽车",
    "摩托车",
    "自行车",
    "违章罚款"
  ],
  "生活缴费": [
    "通信费",
    "水费",
    "电费",
    "燃气费",
    "快递费",
    "服务费"
  ],
  "健康管理": [
    "看病就医",
    "中西药品",
    "医疗器械",
    "保健品"
  ],
  "工作垫付": [
    "商务出行",
    "商务住宿",
    "商务餐饮"
  ],
  "大额支出": [
    "保险支出",
    "资产费用",
    "税收缴纳",
    "分期付款",
    "房贷房租"
  ],
  "系统支出": [
    "投资亏损",
    "手续费",
    "坏账支出",
    "对账支出",
    "债务利息支出",
    "报销支出",
    "债务本金支出",
    "利息支出",
    "物品购入"
  ]
};

// Default income category mappings (secondary -> tertiary categories)
export const DEFAULT_INCOME_CATEGORIES: IncomeCategoryMapping = {
  "薪资收入": [
    "工资",
    "补贴",
    "公积金",
    "医保",
    "报销"
  ],
  "资助收入": [
    "红包"
  ],
  "投资收入": [
    "房租收入",
    "理财收入",
    "保险理赔",
    "分红收入",
    "利息收入",
    "对账收入"
  ],
  "其他收入": [
    "税收退税",
    "资金清理",
    "红利利息",
    "债权本金收入",
    "债权利息",
    "物品售出",
    "退货退款",
    "优惠抵扣",
    "坏账收入",
    "群收款"
  ]
};

// Function to find secondary category from tertiary category
export function findSecondaryCategory(
  primaryCategory: string,
  tertiaryCategory: string,
  type: 'income' | 'expense'
): string | null {
  const mappings = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;

  for (const [secondary, tertiaries] of Object.entries(mappings)) {
    if (tertiaries.includes(tertiaryCategory)) {
      return secondary;
    }
  }

  return null;
}
