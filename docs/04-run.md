# 如何运行

## 环境要求

- Bun（推荐作为运行时与包管理器）
- Node.js 生态环境（Bun 已兼容）

## 安装依赖

```bash
bun install
```

## 环境变量

```bash
cp .env.example .env.local
```

`.env.local` 需要配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 启动开发服务器

```bash
bun run dev
```

访问 `http://localhost:7012` 查看应用。

下一步：了解如何测试 → [05-testing.md](./05-testing.md)
