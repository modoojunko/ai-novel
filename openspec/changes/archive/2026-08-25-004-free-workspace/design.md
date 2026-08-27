# 004-free-workspace — Design

## 架构总览

```
NovelLayout (AuthGuard → LicenseProvider → ProjectShell → Outlet)   [change 003]
└── NovelWorkspace (路由 index, 四态视图机)
    ├── NovelBar              # 书名改名 + 类型 + 「高级配置 ▾」 + 归档 + 免费提示
    ├── ProContainer          # isFree ? null : <children>  (N14)
    │   └── ProPhaseSurface   # useNovelState + TabProgressButton + GateBanner + OnboardingCard
    ├── <div hidden={view!=='workbench'}> <Workbench/> </div>      # 常驻挂载
    ├── {view==='advanced-settings' && <AdvancedSettings/>}        # 懒挂载/离开卸载
    ├── {view==='advanced-outline' && <AdvancedOutline/>}
    ├── {view==='archives' && <ArchivesView/>}
    └── DeleteConfirmModal
```

- **Workbench 常驻**：`hidden` class 切换（display:none）保 prose 脏状态/光标。advanced/archives 用条件渲染（懒挂载 + 离开即卸载，FE P1-1）。
- **无 hook 条件调用**：`useNovelState` 收进 `ProPhaseSurface`（ProContainer 的 child），免费态整棵不挂载 → phase-status 零请求（4.1-8）。

## 数据流

- `useProject()`（ProjectShell）→ project 元信息（书名/类型/id）。
- `useTier()`（LicenseProvider）→ `{tier, isFree, isPro}` → ProContainer / NovelBar / TierGate。
- `useWorkbench(projectId)` → `{ project, volumes, selectedId, selectedRef, view, setView, expandedIds, onToggle, onSelectNode, createVolume, createChapter, renameNode, deleteNode, refresh, focusNode }`。
- 树源：优先 DB-backed `/volumes` 全量（change 005），未达时降级旧形状（`GET /volumes` list → 逐卷 `GET /volumes/{filename}`）。
- 树与选中态跨 workbench / advanced-outline 共享同一 `volumes` 数组（C3/R3）。
- `useChapterData(projectId, ref)` → 正文编辑保存；`BottomStatusBar` 与 `ChapterEditor` 共用。

## 关键实现点

### 1. useWorkbench 树降级（FE-07）
```ts
// 降级旧形状：GET /volumes → [{filename,name}]；逐卷 GET /volumes/{filename} → {chapters:[{chapter,title,word_count,status}]}
const loadVolumes = async () => {
  const list = await api.get(`/novels/${projectId}/volumes`);
  const vols = [];
  for (const v of list) {
    const data = await api.get(`/novels/${projectId}/volumes/${v.filename}`);
    vols.push({ name: v.name, chapters: data?.chapters || [] });
  }
  return vols;
};
```
- `has_prose` 缺失降级：`ch.word_count > 0 || !!ch.prose`（当前章恒显）。
- `focusNode(ref)`：解析 `ref`（`vol-{v}-ch-{c}`）→ setSelectedRef + 展开父卷 + setView('workbench')。

### 2. WritingTree 树节点（FE-11）
- 复用 `StructureTree`，nodes 由 `useWorkbench.volumes` 组装：卷节点 badge `N章`；章节点 badge = 有 prose 显示字数 / 空章「未写」灰字 / 归档 📦。
- 顶部常驻两按钮 → `createVolume` / `createChapter`。
- `StructureTree` 最小扩展：`onAddChild?: (node) => void`，卷节点 hover 渲染「+」行内新建。
- 重命名/删除：章 `PUT /chapters/{ref}`（改 title）`DELETE /chapters/{ref}`；卷 `PUT /volumes/{filename}`（改 title）`DELETE /volumes/{filename}`。

### 3. useChapterData 保存（FE-13）
```ts
// 优先 PUT .../prose（后端 #12）；未就位 try/catch 降级 PUT /chapters/{ref} 全量
const doSave = async () => {
  setSaveState('autosaving');
  try {
    try {
      await api.put(`/novels/${pid}/chapters/${ref}/prose`, { prose });
    } catch {
      await api.put(`/novels/${pid}/chapters/${ref}`, { ...chapter, prose, outline: {...chapter.outline, summary}, status });
    }
    setInitial(prose, summary, status); setSaveState('saved');
  } catch { setSaveState('failed'); }
};
```
- 防抖 1500ms（`setTimeout` + cleanup），`useEffect([prose, summary, status, isDirty])`。
- 卸载/切章 flush：`useEffect(() => () => { if (isDirtyRef.current) void doSave(); }, [ref])`。
- `countChars` 复用 ChapterEditor 现有实现（去空白中文字符数，B5 同口径）。
- `targetWords` localStorage key：`target-words-{projectId}-{ref}`。

### 4. ChapterEditor 改造（FE-12）
- 抽走 AI 相关 state/handler 到 `if (isPro)` 分支或保留组件内但渲染挂 `<TierGate feature="ai-generate">`。
- 正文 textarea + 章纲 + 状态 + 归档保留；`ChapterEditorHandle` 保留（AI 方法免费态 no-op）。
- `onAIStateChange` prop 在 NovelWorkspace/Workbench 免费态不接线（RightToolbar 链路随 ProContainer 裁掉）。

### 5. NovelBar 改名（FE-08）
- 复用 NovelPage `saveName` 逻辑（L553–569，`nameSavedRef` 防双保存）→ `api.renameNovel`。
- 「高级配置 ▾」= `menu` 下拉两枚按钮 → `setView('advanced-settings')` / `setView('advanced-outline')`。
- 免费提示：`tier==='none'` → `免费 · 完整人工写作（限 1 部作品）`。

### 6. ProContainer（FE-05）
```tsx
export default function ProContainer({ children }: { children: ReactNode }) {
  const { isFree } = useTier();
  if (isFree) return null;
  return <>{children}</>;
}
```
- `ProPhaseSurface`（新，ProContainer 内部）调用 `useNovelState(id)` + 渲染 TABS/TabProgressButton/GateBanner/OnboardingCard。

### 7. 路由收敛（FE-06）
```tsx
<Route path="/novel/:id" element={<NovelLayout />}>
  <Route index element={<NovelWorkspace />} />
</Route>
```
删除 10 条死子路由 `Navigate to=".."`。

## 退役文件
- `pages/NovelPage.tsx`：删除（逻辑迁入 NovelWorkspace / Workbench / NovelBar / useWorkbench）。
- 保留：`TabProgressButton` / `GateBanner` / `OnboardingCard` / `useNovelState`（ProContainer 内复用）。
- `App.tsx` 引用 NovelPage 的 import 移除。

## 测试

- TE-16（NovelWorkspace 四态）：默认 workbench；切走再回 prose 不丢；advanced 懒挂载离开卸载。用 `@testing-library/react` render + `TestTierProvider`。
- TE-28（WritingTree）：常驻「+新建卷/章」；新章即达编辑器；空章「未写」弱化不硬过滤；hover 配置/重命名/删除；字数/归档徽标。mock `api`（vi.doMock）。
- TE-29（两态渲染）：免费态无 phase-status 请求、无 GateBanner/OnboardingCard；PRO 态渲染。
- TE-17 / FE-34（E2E）：`e2e/free-writing-flow.spec.ts`，沿用 `creation-flow.spec.ts` 基建 + `helpers.ts url()`。后端 mock（`SERVER_API_BASE`）。断言：建书即写 → 树 CRUD → 新建章即达编辑器 → 自动保存 → 字数/进度 → 归档只读 → 无 AI 字段/提示词 → 免费直呼 AI 端点 403 → 免费归档不 500。

## 风险与取舍

- **降级树**：change 005 未达时用旧 `/volumes` 形状；005 落地后 useWorkbench 的 `has_prose` 读取自动切到 DB 全量字段（`??` 兜底，无感）。
- **AdvancedSettings/AdvancedOutline 视图**：P0 用现有 `SettingsFormField` + 设定树 / `OutlineOverview` 壳承载，`TierField` 锁定 AI 字段；完整 P2 视图（N12/N15 重映射）后续 change。
- **focusMode 提升**：从 ChapterEditor 内部提到 Workbench 级（C6 专注态隐藏左树 + 工具栏，保留面包屑 + 状态栏）。
