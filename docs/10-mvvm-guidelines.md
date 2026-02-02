# MVVM 设计与要求

本章节用于约束 MVVM 的设计落地方式，并指导渐进式重构与测试覆盖策略。

## 1. 设计要求与呈现形式

- View（视图层）
  - 只负责渲染与事件转发
  - 不直接访问数据源（Context/Hook/Service）
  - 不包含业务逻辑或副作用
- ViewModel（业务逻辑层）
  - 聚合数据、派生状态、处理校验、触发副作用
  - 统一输出供 View 使用的状态与动作
  - 允许注入依赖（便于 mock 与测试）
- Model/Domain（规则层）
  - 纯函数规则：校验、映射、统计、clamp、格式化
  - 不包含副作用、不依赖 UI
- Data/Service（数据层）
  - 数据获取与持久化（如 Supabase、localStorage）
  - 仅由 ViewModel 调用，避免 View 直连

目录建议：
- `src/viewmodels/*`
- `src/domain/*`
- `src/services/*` 或 `src/lib/*`

## 2. 如何进行重构与拆解

推荐顺序（先高收益、低风险）：

1) 选一个逻辑密集页面作为试点
- 抽出 `useXxxViewModel`
- 将纯逻辑迁到 `src/domain`

2) 逐步收敛 View
- View 只消费 ViewModel 输出
- View 不再直接调用 Context/Service

3) 固化接口与依赖注入
- ViewModel 对外暴露稳定的状态与 action
- 将外部依赖（Service/Toast）作为可注入项

4) 逐页推广
- 复用同样的拆分模板
- 避免跨层直接调用

注意：
- 避免一次性全量改造，保持原子化提交
- 不改变业务行为与 UI 表现

## 3. 代码覆盖率的具体要求

遵循“分层与类别”的覆盖率原则：

- **高覆盖（80–95%）**
  - Domain/规则层（校验、clamp、映射、统计）
  - ViewModel/业务逻辑层（派生、校验、保存、节流/防抖）
  - 关键 Hook（含副作用/数据合并/错误处理）
- **中等覆盖（50–80%）**
  - Context/状态容器（重点覆盖状态更新、持久化与同步）
- **低覆盖（可低于 50% 或按需）**
  - View/UI 层（仅关键交互冒烟）
  - 纯展示组件/简单 wrapper

目标：
- 全局 UT 覆盖率目标为 **90%**
- 优先保证 Domain 与 ViewModel 的高覆盖
