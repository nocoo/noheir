# MVVM 规范

## 分层职责

- **View**：仅负责展示与交互，不做复杂计算
- **ViewModel**：处理状态、派生数据、交互逻辑
- **Domain**：纯函数/规则计算，可单测

## 代码约束

- 计算逻辑必须抽到 `src/domain/`
- 页面逻辑必须抽到 `src/viewmodels/`
- View 仅消费 ViewModel 输出

## 测试要求

- domain 与 viewmodel 必须有 UT
- 覆盖率目标 90%
