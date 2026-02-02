# 开发规范

## 技术栈

- React 18 + TypeScript
- Vite + Bun
- Tailwind CSS + shadcn-ui
- Supabase（PostgreSQL + Auth）

## 提交规范

- 原子化提交：单一逻辑变更一个 commit
- 每个提交必须可回滚、可构建
- 修改行为或流程必须附带文档更新

## 结构约定

- 业务计算放在 `src/domain/`
- 页面派生逻辑放在 `src/viewmodels/`
- 组件仅负责展示与交互

下一步：了解数据与安全 → [08-data-and-security.md](./08-data-and-security.md)
