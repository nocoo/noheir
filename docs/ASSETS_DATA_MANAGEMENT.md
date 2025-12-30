# 资产数据统一管理方案

## 设计理念

**核心原则**：在整个应用中维护一份数据源，所有页面共享相同的数据和缓存。

## 架构设计

```
App
└── AssetsDataProvider (Context)
    ├── React Query Cache (统一缓存)
    │   ├── products (5分钟缓存)
    │   ├── units (自动缓存)
    │   └── dashboard (自动缓存)
    └── 各页面组件
        ├── ProductsLibrary → useProductsData()
        ├── CapitalUnitsManager → useUnitsData()
        ├── CapitalDashboard → useAssetsData()
        └── WarehouseView → useUnitsData()
```

## 使用方法

### 1. 在 App.tsx 中包裹 Provider

```tsx
import { AssetsDataProvider } from '@/contexts/AssetsDataContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <AssetsDataProvider> {/* 👈 添加这里 */}
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AssetsDataProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### 2. 在组件中使用

#### 方式A：使用完整数据

```tsx
import { useAssetsData } from '@/contexts/AssetsDataContext';

function MyComponent() {
  const { products, units, isLoading, isReady } = useAssetsData();

  if (isLoading) return <div>加载中...</div>;
  if (!isReady) return <div>数据未就绪</div>;

  return (
    <div>
      <p>产品数：{products?.length}</p>
      <p>资金单元数：{units?.length}</p>
    </div>
  );
}
```

#### 方式B：使用部分数据

```tsx
import { useProductsData } from '@/contexts/AssetsDataContext';

function ProductsList() {
  const { products, isLoading } = useProductsData();

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      {products?.map(p => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  );
}
```

#### 方式C：继续使用现有 Hooks（兼容）

```tsx
// 旧代码仍然可以工作
import { useProducts, useUnitsDisplay } from '@/hooks/useAssets';

function LegacyComponent() {
  const { data: products } = useProducts();
  const { data: units } = useUnitsDisplay();

  // ...
}
```

## 优势

### 1. **数据一致性**
- ✅ 所有页面看到的是同一份数据
- ✅ 修改后自动同步到所有页面
- ✅ React Query 自动处理缓存失效

### 2. **性能优化**
- ✅ 只请求一次数据，全局共享
- ✅ 5分钟缓存时间，减少网络请求
- ✅ 自动去重相同请求

### 3. **代码简洁**
- ✅ 不需要在每个组件中写重复的 hooks
- ✅ 统一的加载状态管理
- ✅ 类型安全

### 4. **易于维护**
- ✅ 集中的数据获取逻辑
- ✅ 统一的错误处理
- ✅ 方便添加全局刷新等功能

## 数据更新策略

### 自动失效（React Query）

```tsx
// 在 mutation 成功后自动刷新
const createMutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    // React Query 会自动使缓存失效
    // 所有使用该数据的组件都会自动更新
  },
});
```

### 手动刷新

```tsx
const { refetch } = useAssetsData();

// 刷新所有数据
await refetch();
```

## 迁移指南

### 阶段1：添加 Provider（非破坏性）

1. 在 `App.tsx` 中添加 `AssetsDataProvider`
2. 不需要修改任何现有组件
3. 所有功能继续正常工作

### 阶段2：逐步迁移（可选）

1. 新组件优先使用 `useAssetsData()`
2. 旧组件保持不变，继续使用 `useProducts()` 等
3. 渐进式迁移，无风险

### 阶段3：完全迁移（可选）

1. 将所有组件迁移到 `useAssetsData()`
2. 移除旧的 hooks 调用
3. 简化代码

## 实现细节

### 缓存配置

```tsx
// Products - 5分钟缓存
useQuery({
  queryKey: ['assets', 'products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000,
});

// Units - 自动缓存
useQuery({
  queryKey: ['assets', 'units', 'display'],
  queryFn: fetchUnitsDisplay,
  // 默认 staleTime: 0，会自动重新获取
});

// Dashboard - 自动缓存
useQuery({
  queryKey: ['assets', 'capitalOverview'],
  queryFn: fetchCapitalOverview,
});
```

### Query Keys

```tsx
export const assetQueryKeys = {
  allProducts: ['assets', 'products'],
  product: (id: string) => ['assets', 'products', id],
  allUnits: ['assets', 'units'],
  unitsDisplay: ['assets', 'units', 'display'],
  capitalOverview: ['assets', 'capitalOverview'],
};
```

## 常见问题

### Q: 会影响现有代码吗？
A: 不会。这是纯添加的方案，不修改任何现有代码。

### Q: 性能会变差吗？
A: 不会。React Query 会自动缓存和去重，性能反而更好。

### Q: 必须迁移所有组件吗？
A: 不必须。可以逐步迁移，新旧代码可以共存。

### Q: 数据会过期吗？
A: Products 缓存5分钟，Units 和 Dashboard 每次访问时会自动检查更新。

## 未来扩展

可以轻松添加：

```tsx
// 全局刷新按钮
function RefreshButton() {
  const { refetch, isLoading } = useAssetsData();
  return <Button onClick={refetch} disabled={isLoading}>刷新</Button>;
}

// 数据统计
function DataStats() {
  const { products, units } = useAssetsData();
  return <div>共 {products?.length} 个产品，{units?.length} 个单元</div>;
}

// 自动刷新
useEffect(() => {
  const interval = setInterval(() => {
    refetch();
  }, 60000); // 每分钟刷新
  return () => clearInterval(interval);
}, [refetch]);
```
