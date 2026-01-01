# 🔒 Supabase 安全审计报告

**项目**: finance-manager (ovglfjkumvzxyhklohst)
**审计日期**: 2025-01-01
**修复日期**: 2025-01-01
**当前状态**: ✅ **所有安全漏洞已修复**

---

## 执行摘要

发现 **3 个严重安全漏洞**，**已全部修复**。

| 严重性 | 数量 | 状态 |
|--------|------|------|
| 🔴 严重 | 3 | ✅ 已修复 |
| 🟡 中等 | 0 | ✅ 无 |
| 🟢 良好 | - | ✅ RLS 已正确启用 |

---

## ✅ 修复验证

**修复后当前状态** (2025-01-01 验证):

```sql
-- anon 角色权限 (✅ 正确)
GRANT USAGE ON SCHEMA "public" TO "anon";  -- 仅此一项
-- ❌ 无表权限
-- ❌ 无函数权限
-- ❌ 无序列权限

-- authenticated 角色权限 (✅ 正常)
-- ✅ 所有表: capital_units, financial_products, transactions, settings
-- ✅ 所有函数
-- ✅ 所有序列
-- ✅ RLS 策略: 15 policies
```

**详细修复日志**: `docs/SECURITY_FIX_URGENT.sql`

---

---

## 🔴 严重问题

### 1. `anon` 角色拥有过多表权限

**问题描述**:
```sql
GRANT ALL ON TABLE "public"."capital_units" TO "anon";
GRANT ALL ON TABLE "public"."financial_products" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "anon";
```

**风险**: 使用 anon key 的任何人（包括未认证用户）都可以：
- 插入虚假数据
- 修改现有记录
- 删除数据
- 读取所有数据

**影响**: 数据完整性、隐私泄露、数据丢失

**修复方案**:
```sql
-- 移除 anon 的所有表权限
REVOKE ALL ON TABLE "public"."capital_units" FROM "anon";
REVOKE ALL ON TABLE "public"."financial_products" FROM "anon";
REVOKE ALL ON TABLE "public"."transactions" FROM "anon";
REVOKE ALL ON TABLE "public"."settings" FROM "anon";
```

---

### 2. 默认权限配置不当

**问题描述**:
```sql
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  GRANT ALL ON TABLES TO "anon";
```

**风险**: 所有新建的表会自动开放给 `anon` 角色

**影响**: 未来创建的表也会存在安全漏洞

**修复方案**:
```sql
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM "anon";
```

---

### 3. `anon` 角色拥有函数权限

**问题描述**:
```sql
GRANT ALL ON FUNCTION "public"."get_units_with_products"() TO "anon";
```

**风险**: 未认证用户可以调用该函数获取资金单元和产品信息

**影响**: 敏感财务信息泄露

**修复方案**:
```sql
REVOKE ALL ON FUNCTION "public"."get_units_with_products"() FROM "anon";
```

---

## ✅ 安全配置正确项

### 1. Row Level Security (RLS) 已启用

所有 4 个表都启用了 RLS：

| 表 | RLS 状态 | 策略数量 |
|----|---------|---------|
| `capital_units` | ✅ 启用 | 4 (SELECT/INSERT/UPDATE/DELETE) |
| `financial_products` | ✅ 启用 | 4 (SELECT/INSERT/UPDATE/DELETE) |
| `transactions` | ✅ 启用 | 4 (SELECT/INSERT/UPDATE/DELETE) |
| `settings` | ✅ 启用 | 4 (SELECT/INSERT/UPDATE/DELETE) |

### 2. RLS 策略配置正确

所有策略都正确使用 `auth.uid()` 进行用户隔离：

```sql
-- 示例: transactions 表
CREATE POLICY "Users can view own transactions"
  ON "public"."transactions" FOR SELECT
  USING ("auth"."uid"() = "user_id");
```

---

## 🔧 修复步骤

### 方法 1: 在 Supabase Dashboard 执行

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `supabase/migrations/20250101000001_fix_security_grants.sql`

### 方法 2: 使用 Supabase CLI

```bash
# 推送到远程数据库
supabase db push
```

### 方法 3: 使用 psql

```bash
psql "$DATABASE_URL" -f supabase/migrations/20250101000001_fix_security_grants.sql
```

---

## 📋 修复后验证

执行以下查询验证修复是否成功：

```sql
-- 检查 anon 表权限 (应为 0 行)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public';

-- 检查 authenticated 表权限 (应显示所有表)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated' AND table_schema = 'public'
ORDER BY table_name;
```

---

## 🛡️ 安全最佳实践

### Supabase 角色说明

| 角色 | 说明 | 应有权限 |
|------|------|---------|
| `anon` | 未认证用户（使用 anon key） | 最小权限（通常只有 USAGE） |
| `authenticated` | 已登录用户 | 通过 RLS 控制的 CRUD 操作 |
| `service_role` | 后端服务（绕过 RLS） | 完全访问权限 |

### 权限配置原则

1. **`anon` 角色**:
   - ✅ USAGE on schema public
   - ❌ 不要授予表权限
   - ❌ 不要授予函数权限

2. **`authenticated` 角色**:
   - ✅ USAGE on schema public
   - ✅ 表权限（受 RLS 限制）
   - ✅ 函数权限（根据需要）

3. **`service_role` 角色**:
   - ✅ 所有权限
   - ⚠️ 永远不要在前端使用 service_role key

---

## 📚 参考资料

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Authorization](https://supabase.com/docs/guides/auth/authorization)
- [PostgreSQL GRANT Reference](https://www.postgresql.org/docs/current/sql-grant.html)

---

## ✍️ 修复文件

- `supabase/migrations/20250101000001_fix_security_grants.sql` - 安全修复 migration
- `supabase/migrations/20250101000000_initial_schema.sql` - 已更新（移除不安全的权限）
