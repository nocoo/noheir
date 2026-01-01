<div align="center">
  <img src="public/logo/logo-128.png" alt="Noheir Logo" width="128" height="128">
  <h1>Noheir (个人财务管理)</h1>
  <p>专业的个人财务管理工具，支持收支分析、储蓄率追踪、多账户管理、资产配置</p>
</div>

## 项目介绍

Noheir 是一款功能完整的个人财务管理系统，帮助你：
- 追踪日常收支，了解消费习惯
- 分析财务健康度，优化储蓄率
- 管理多账户资金，优化资产配置
- 可视化财务数据，洞察财务趋势

**核心特性：**

- 收支分析 | 收入/支出/转账多维度分析
- 储蓄率追踪 | 月度储蓄率趋势和目标管理
- 财务健康评估 | 综合财务健康度评分
- 资产管理 | 理财产品和资金单元管理
- 数据导入 | 支持 CSV/JSON 导入交易数据
- 多账户支持 | 支持多币种、多账户管理

## 技术栈

- 前端框架：React 18 + TypeScript
- 构建工具：Vite
- UI 组件：shadcn-ui (Radix UI)
- 样式方案：Tailwind CSS
- 图表库：Recharts + ECharts
- 状态管理：React Context + TanStack Query
- 路由：React Router
- 后端服务：Supabase (PostgreSQL + Auth + Storage)
- 身份认证：Google OAuth
- AI 助手：OpenAI 兼容 API (可选)

## 前置条件

在开始之前，你需要准备以下服务：

### 1. Node.js 环境

安装 Node.js 18+ 和 npm：

```bash
# 使用 nvm 安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 2. Supabase 项目

Supabase 提供数据库、身份认证和存储服务。

#### 2.1 创建项目

1. 访问 [supabase.com](https://supabase.com)
2. 注册并创建新项目
3. 记录以下信息（后续配置需要）：
   - Project URL
   - `anon` public key
   - Project Reference ID

#### 2.2 执行数据库迁移

```bash
# 安装 Supabase CLI（如果尚未安装）
npm install -g supabase

# 链接到你的项目
supabase link --project-ref <YOUR_PROJECT_REF>

# 推送数据库 schema
supabase db push
```

或者直接在 Supabase Dashboard 的 SQL Editor 中执行 `supabase/migrations/` 目录下的 SQL 文件。

#### 2.3 配置 Google OAuth

在 Supabase Dashboard 中配置 Google 认证：

1. 进入 **Authentication → Providers**
2. 启用 **Google** 提供商
3. 填写以下信息：
   - **Client ID**: 你的 Google OAuth Client ID（见下方）
   - **Client Secret**: 你的 Google OAuth Client Secret（见下方）
4. 保存配置

### 3. Google OAuth 应用

#### 3.1 创建 OAuth 2.0 凭据

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建新项目或选择现有项目
3. 进入 **APIs & Services → Credentials**
4. 点击 **Create Credentials → OAuth client ID**
5. 应用类型选择 **Web application**
6. 配置授权重定向 URI：
   ```
   https://<YOUR_SUPABASE_PROJECT_ID>.supabase.co/auth/v1/callback
   ```
7. 创建后记录 **Client ID** 和 **Client Secret**

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/noheir.git
cd noheir
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
# 复制模板
cp .env.example .env.local

# 编辑配置
nano .env.local
```

填写以下内容：

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

从 Supabase Dashboard → **Settings → API** 获取这些值。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:8080 查看应用。

## 部署指南

### 前端部署

#### Vercel (推荐)

1. 将项目推送到 GitHub
2. 访问 [vercel.com](https://vercel.com)
3. 导入你的 GitHub 仓库
4. 在环境变量中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点击 Deploy

#### Netlify

1. 将项目推送到 GitHub
2. 访问 [netlify.com](https://netlify.com)
3. 导入你的 GitHub 仓库
4. 构建命令：`npm run build`
5. 发布目录：`dist`
6. 在环境变量中添加 Supabase 配置

#### 自托管

```bash
# 构建生产版本
npm run build

# 使用任意静态文件服务器
# 例如使用 Python：
python -m http.server 8000 --directory dist
```

## 项目结构

```
noheir/
├── public/              # 静态资源
│   └── logo/           # Logo 图片
├── src/
│   ├── components/     # React 组件
│   │   ├── ui/        # shadcn-ui 基础组件
│   │   ├── dashboard/ # 仪表盘相关组件
│   │   ├── assets/    # 资产管理组件
│   │   └── auth/      # 认证组件
│   ├── contexts/      # React Context (Auth, Settings)
│   ├── hooks/         # 自定义 Hooks
│   ├── lib/           # 工具库
│   ├── pages/         # 页面组件
│   └── types/         # TypeScript 类型定义
├── supabase/
│   └── migrations/    # 数据库迁移文件
└── package.json
```

## 开发指南

### 添加新的页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/App.tsx` 添加路由
3. 在 `src/components/layout/DashboardLayout.tsx` 添加侧边栏入口

### 添加新的图表

项目使用统一的图表配置：

```tsx
import { xAxisStyle, yAxisStyle, gridStyle } from '@/lib/chart-config';
import { CurrencyTooltip } from '@/lib/chart-tooltip';

<XAxis {...xAxisStyle} />
<YAxis {...yAxisStyle} tickFormatter={formatCurrencyK} />
<CartesianGrid {...gridStyle} />
<Tooltip content={<CurrencyTooltip />} />
```

### 颜色使用规范

- UI 组件使用语义化 CSS 变量：`text-income` / `text-expense`
- 图表使用统一色板：`@/lib/colorPalette.ts`
- 避免硬编码颜色值

详见 [CLAUDE.md](./CLAUDE.md) 中的颜色系统规范。

### 金额格式化

```tsx
import { formatCurrencyFull, formatCurrencyK } from '@/lib/chart-config';

formatCurrencyFull(1234.5)  // "¥1,234.50"
formatCurrencyK(1234.5)     // "¥1.23k"
```

## 常见问题

### 登录后显示 "Access Denied"

检查 Supabase 的 Google OAuth 配置：
- Client ID 和 Client Secret 是否正确
- 授权重定向 URI 是否包含你的 Supabase 项目回调地址

### 数据无法保存

检查数据库 RLS 策略：
- 确保 migrations 已正确执行
- 在 Supabase Dashboard 检查表权限配置

### AI 聊天功能不可用

项目采用 BYOM (Bring Your Own Model) 方案，AI 助手需要用户自行配置：
1. 在设置中启用 AI 助手
2. 配置你的 AI API (支持 OpenAI 兼容接口)
3. API Key 仅存储在本地浏览器中，不会上传到服务器

## 贡献指南

欢迎提交 Issue 和 Pull Request！

在提交代码前，请确保：
- 通过 `npm run lint` 检查代码风格
- 遵守项目的颜色系统和金额格式化规范
- 在 CLAUDE.md 中有详细的开发规范

## 许可证

MIT License

## 联系方式

如有问题或建议，欢迎提交 Issue。
