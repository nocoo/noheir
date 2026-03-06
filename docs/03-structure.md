# 主要目录结构

```
noheir/
├── public/                # 静态资源
├── src/
│   ├── components/        # 业务与通用组件
│   ├── contexts/          # 全局上下文
│   ├── domain/            # 纯业务规则与计算
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具与核心逻辑
│   ├── pages/             # 页面级组件
│   ├── services/          # 数据服务
│   ├── types/             # 类型定义
│   ├── viewmodels/         # 视图模型与派生逻辑
│   └── main.tsx           # 应用入口
├── mcp/                   # MCP server（AI agent 数据接口）
├── supabase/              # 数据库迁移与 Supabase 配置
├── tests/                 # 单元测试 + E2E 测试
├── scripts/               # 开发辅助脚本
├── docs/                  # 项目文档
├── package.json
└── vite.config.ts
```

下一步：了解如何运行 → [04-run.md](./04-run.md)
