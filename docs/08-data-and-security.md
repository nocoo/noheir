# 数据与安全

## 数据层

- 交易数据、设置、资产产品与资金单元由 Supabase 管理
- 权限通过 RLS 策略限制到用户级别

## 安全原则

- `anon` 角色仅允许 schema 使用权限
- `authenticated` 角色通过 RLS 控制 CRUD
- 禁止在前端使用 `service_role` 密钥

## 环境变量

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

下一步：如果需要数据库细节，请补充新的 `docs/09-...` 文档并在 README 中注册。
