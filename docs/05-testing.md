# 如何测试

## 代码规范检查

```bash
bunx eslint . --max-warnings=0
```

## 单元测试

```bash
bun test
```

## 覆盖率

```bash
bun test --coverage
```

## 覆盖率目标

- UT 覆盖率目标：**90%**

## 覆盖策略

- **高覆盖（80–95%）**：domain、viewmodel、关键 hooks
- **中覆盖（50–80%）**：contexts
- **低覆盖（按需）**：纯展示 UI、简单 wrapper

## E2E 测试

E2E 测试覆盖所有 48 个 Supabase API 场景，运行于本地 Docker Supabase 实例。

```bash
# 启动本地 Supabase
supabase start

# 仅运行 E2E
bun run test:e2e

# 仅运行 UT
bun run test:unit
```

详细测试计划与 API 覆盖矩阵见 [11-e2e-testing.md](./11-e2e-testing.md)。

## Git Hooks

| Hook | 执行内容 | 说明 |
|---|---|---|
| pre-commit | `bun run test:unit` | 快速反馈，每次 commit 前运行 |
| pre-push | `bun run test:unit && lint && test:e2e` | 推送前全量验证（E2E 需要 Docker） |

下一步：了解文档规范 → [06-docs-guidelines.md](./06-docs-guidelines.md)
