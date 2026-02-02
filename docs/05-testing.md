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

下一步：了解文档规范 → [06-docs-guidelines.md](./06-docs-guidelines.md)
