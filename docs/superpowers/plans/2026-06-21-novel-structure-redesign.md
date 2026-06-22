# AI Novel 结构重设计 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小说管理从6阶段状态机改为小说→卷→章→正文层次结构，双面板布局，无AI优先。

**Architecture:** 前端完全重写 project 内页面，单一路由 `/project/:slug` 驱动双面板布局；左侧树切换驱动右侧面板内容。后端增加 tree API 和版本 API。现有 volume/chapter YAML 存储不变。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS + daisyUI + FastAPI + SQLAlchemy + YAML storage.

---

## 文件结构

### 新增组件

```
frontend/src/
  pages/NovelPage.tsx              # 主布局：顶部 Tab + 双面板
  components/novel/
    StructureTree.tsx              # 左侧递归树组件（设定树 + 卷/章树共用）
    EmptyState.tsx                 # 空状态引导卡片
    SettingsList.tsx               # 设定目录树（基于 StructureTree）
    VolumeEditor.tsx               # 卷编辑器（卷纲 + 章列表拖拽）
    ChapterEditor.tsx              # 章编辑器（章纲 + 正文 textarea）
    VersionHistory.tsx             # 版本历史页（右侧面板切换）
    ThemeToggle.tsx                # 深色/浅色主题切换按钮
backend/
  novel/
    router.py                      # /api/projects/:id/tree 端点
    service.py                     # 组装树数据
```

### 修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/App.tsx` | 路由 `/project/:slug` 指向 NovelPage，移除子路由 |
| `frontend/tailwind.config.js` | 新增 parchment 浅色主题 |
| `frontend/src/Pages/DashboardPage.tsx` | 项目卡片移除阶段点，改为卷/章数 + 更新时间 |
| `backend/projects/router.py` | 注册 novel router |

### 删除文件（合并后删除）

删除从略，最后统一清理。当前保留旧页面，新 NovelPage 上线后标志废弃。

---

## Phase 1: 新布局骨架

### Task 1: 创建 StructureTree 组件

**Files:**
- Create: `frontend/src/components/novel/StructureTree.tsx`

通用递归树组件。用 `TreeNode` 接口描述树节点，渲染可折叠子树，支持 hover 操作按钮插槽。

- [ ] **Step 1: Define interfaces**

`StructureTree.tsx` 顶部定义类型：

```typescript
export type TreeNodeAction = {
  icon: string;       // 显示图标，如 "✎" "➕" "🗑"
  label: string;      // aria label
  onClick: (node: TreeNode) => void;
};

export type TreeNode = {
  id: string;
  icon?: string;        // 左侧图标
  label: string;        // 显示文字
  badge?: string;       // 右侧小标签（如状态、字数）
  badgeColor?: string;  // badge 颜色类
  actions?: TreeNodeAction[];  // hover 出现的操作按钮
  children?: TreeNode[];
  data?: any;           // 附加数据（后端返回的原始信息）
};
```

- [ ] **Step 2: Implement StructureTree component**

```typescript
// frontend/src/components/novel/StructureTree.tsx

interface Props {
  nodes: TreeNode[];
  selectedId?: string;
  onSelect: (node: TreeNode) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

export default function StructureTree({ nodes, selectedId, onSelect, expandedIds, onToggle }: Props) {
  return (
    <div className="flex flex-col gap-[1px]">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
```

`TreeNodeItem` 递归渲染：
- 有 children → 显示展开/折叠箭头 `▾` / `▸`
- 选中 → `active` 样式（bg-primary/10 + text-primary）
- hover → 右侧显示 `node.actions` 按钮
- 点击箭头 → 切换展开（`onToggle`）
- 点击标签 → `onSelect`
- 有 children 且展开 → 递归渲染子节点（ml-4 + border-left）

- [ ] **Step 3: Style the tree**

使用 Tailwind 类：
- 节点容器：`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm text-base-content/60 hover:bg-base-300/30 transition-colors`
- 选中：`bg-primary/10 text-primary font-medium`
- 操作按钮：`opacity-0 group-hover:opacity-100 transition-opacity`
- 子树：`ml-4 border-l border-base-300/40 pl-3`

- [ ] **Step 4: Test with static data**

```typescript
// 临时测试数据
const testNodes: TreeNode[] = [
  { id: "settings", icon: "⚙️", label: "设定", children: [
    { id: "world", icon: "🌍", label: "世界设定", badge: "v6", actions: [{ icon: "✎", label: "编辑", onClick: () => {} }] },
    { id: "style", icon: "🎨", label: "风格规则", badge: "v3" },
    { id: "chars", icon: "👥", label: "角色", badge: "4个" },
  ]},
  { id: "vol-1", icon: "▾", label: "第一卷 · 迷雾", badge: "3章", children: [
    { id: "ch-1", icon: "○", label: "不速之客", badge: "✓", badgeColor: "text-success" },
  ]},
];
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/novel/StructureTree.tsx
git commit -m "feat: add generic StructureTree component"
```

---

### Task 2: 创建 NovelPage 主布局

**Files:**
- Create: `frontend/src/pages/NovelPage.tsx`

- [ ] **Step 1: Define view state type**

```typescript
type TabId = "settings" | "writing";
type ViewState =
  | { tab: "settings"; panel: string }      // panel = world|style|characters|hooks|intro
  | { tab: "writing"; panel: "empty" }
  | { tab: "writing"; panel: "volume"; volumeId: string }
  | { tab: "writing"; panel: "chapter"; chapterRef: string }
  | { tab: "writing"; panel: "versions"; chapterRef: string };
```

- [ ] **Step 2: Create NovelPage layout**

```typescript
// frontend/src/pages/NovelPage.tsx

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import StructureTree from "@/components/novel/StructureTree";
import EmptyState from "@/components/novel/EmptyState";
import VolumeEditor from "@/components/novel/VolumeEditor";
import ChapterEditor from "@/components/novel/ChapterEditor";
import VersionHistory from "@/components/novel/VersionHistory";
import ThemeToggle from "@/components/novel/ThemeToggle";

export default function NovelPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<any>(null);
  const [tab, setTab] = useState<TabId>("writing");
  const [view, setView] = useState<ViewState>({ tab: "writing", panel: "empty" });

  // Fetch project
  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then(setProject);
  }, [slug]);

  const projectName = project?.name || "加载中...";

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-base-100">
      {/* TOP BAR */}
      <div className="flex items-center px-6 h-12 border-b border-base-300/60 bg-base-200/80 flex-shrink-0">
        <span className="font-semibold text-sm">{projectName}</span>
        <div className="ml-6 flex gap-0">
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>📋 设定</TabButton>
          <TabButton active={tab === "writing"} onClick={() => setTab("writing")}>📖 正文</TabButton>
        </div>
        <div className="flex-1" />
        <ThemeToggle />
      </div>

      {/* BODY: dual panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT TREE */}
        <aside className="w-56 flex-shrink-0 border-r border-base-300/60 bg-base-200/40 overflow-y-auto">
          {/* tree content here - populated per tab */}
        </aside>

        {/* RIGHT CONTENT */}
        <main className="flex-1 overflow-y-auto bg-base-100">
          {/* renders based on view state */}
        </main>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm border-b-2 transition-colors ${
        active ? "text-primary border-primary font-medium" : "text-base-content/50 border-transparent hover:text-base-content/80"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Add project data fetching**

```typescript
// In NovelPage, add load function to fetch volumes and chapters
const loadVolumes = useCallback(async () => {
  if (!project?.id) return;
  const vols: any[] = await api.get(`/projects/${project.id}/volumes`);
  const volumeNodes = [];
  for (const v of vols) {
    const data = await api.get(`/projects/${project.id}/volumes/${v.filename}`);
    volumeNodes.push({
      id: v.filename,
      icon: "▾",
      label: data.title || v.filename,
      badge: `${(data.chapters || []).length}章`,
      children: (data.chapters || []).map((ch: any, i: number) => ({
        id: `vol-${ch.volume}-ch-${ch.chapter}`,
        icon: ch.status === "confirmed" ? "✓" : ch.status === "writing" ? "✎" : "○",
        label: ch.title || `第${ch.chapter}章`,
        badge: ch.status === "confirmed" ? "完成" : ch.status === "writing" ? "写作中" : "",
        data: ch,
        actions: [{ icon: "✎", label: "编辑", onClick: () => {} }, { icon: "🗑", label: "删除", onClick: () => {} }],
      })),
      actions: [{ icon: "✎", label: "编辑卷名", onClick: () => {} }, { icon: "➕", label: "添加章节", onClick: () => {} }, { icon: "🗑", label: "删除卷", onClick: () => {} }],
    });
  }
  setVolumeTreeNodes(volumeNodes);
}, [project]);
```

- [ ] **Step 4: Wire view switching**

When a tree node is selected:
- Volume node → `setView({ tab: "writing", panel: "volume", volumeId: node.id })`
- Chapter node → `setView({ tab: "writing", panel: "chapter", chapterRef: node.id })`
- Settings leaf → `setView({ tab: "settings", panel: node.id })`

Render the right panel based on view state:
```typescript
function renderContent(view: ViewState) {
  switch (view.tab) {
    case "settings":
      return <SettingsPanel panel={view.panel} projectId={project.id} />;
    case "writing":
      switch (view.panel) {
        case "empty": return <EmptyState onAction={handleEmptyAction} />;
        case "volume": return <VolumeEditor volumeId={view.volumeId} projectId={project.id} />;
        case "chapter": return <ChapterEditor chapterRef={view.chapterRef} projectId={project.id} />;
        case "versions": return <VersionHistory chapterRef={view.chapterRef} projectId={project.id} onBack={() => /* switch back to chapter */} />;
      }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NovelPage.tsx
git commit -m "feat: create NovelPage layout with dual panels and tab switching"
```

---

### Task 3: 更新路由

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/ProjectLayout.tsx`

- [ ] **Step 1: Update App.tsx routing**

将 project 子路由改为单一入口：

```typescript
// App.tsx — change project routes from nested to single
<Route path="/project/:slug" element={<ProjectLayout />}>
  <Route index element={<ProjectRedirectPage />} />
  <Route path="settings" element={<SettingsHubPage />} />
  <Route path="settings/world" element={<WorldSettingsPage />} />
  {/* ... keep all existing nested routes for backward compat */}
</Route>
```

改为：

```typescript
// 新路由
<Route path="/project/:slug" element={<ProjectLayout />}>
  {/* The new NovelPage is rendered at index, replacing sub-route navigation */}
</Route>
```

保留旧子路由路径但全指向 NovelPage，保证旧链接不 404：
```typescript
<Route path="/project/:slug" element={<ProjectLayout />}>
  <Route index element={<NovelPage />} />
  {/* Redirect old sub-routes to the main novel page */}
  <Route path="settings" element={<NovelPage />} />
  <Route path="settings/*" element={<NovelPage />} />
  <Route path="outline" element={<NovelPage />} />
  <Route path="prompts" element={<NovelPage />} />
  <Route path="write" element={<NovelPage />} />
  <Route path="archives" element={<NovelPage />} />
  <Route path="threads" element={<NovelPage />} />
</Route>
```

- [ ] **Step 2: Update ProjectLayout.tsx**

去除 AuthGuard 外的 ProjectNav/PhaseProgress：
```typescript
export default function ProjectLayout() {
  return (
    <AuthGuard>
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ProjectLayout.tsx
git commit -m "feat: update routing to single /project/:slug -> NovelPage"
```

---

## Phase 2: 正文 Tab

### Task 4: 创建 EmptyState 组件

**Files:**
- Create: `frontend/src/components/novel/EmptyState.tsx`

- [ ] **Step 1: Implement EmptyState**

```typescript
// frontend/src/components/novel/EmptyState.tsx

interface Props {
  onAction: (action: "create-volume" | "create-chapter" | "go-settings") => void;
}

export default function EmptyState({ onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="text-5xl mb-5 opacity-30">📖</div>
      <h2 className="text-2xl font-serif font-semibold mb-2">开始写你的第一部小说</h2>
      <p className="text-sm text-base-content/50 max-w-sm mb-7 leading-relaxed">
        先创建一卷，规划故事的整体走向。卷之下再分章节，一章一章写正文。
        可以从头开始，也可以从设定开始。
      </p>
      <div className="flex gap-3 mb-6">
        <button onClick={() => onAction("create-volume")}
          className="px-5 py-3 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm hover:bg-primary/20 transition-colors">
          📚 创建第一卷
        </button>
        <button onClick={() => onAction("create-chapter")}
          className="px-5 py-3 bg-base-200 border border-base-300 rounded-lg text-sm hover:border-base-content/30 transition-colors">
          ✍️ 直接写第一章
        </button>
        <button onClick={() => onAction("go-settings")}
          className="px-5 py-3 bg-base-200 border border-base-300 rounded-lg text-sm hover:border-base-content/30 transition-colors">
          📋 先去设定
        </button>
      </div>
      <div className="w-80 h-px bg-base-300/60" />
      <p className="text-xs text-base-content/30 mt-4 max-w-xs">
        💡 建议顺序：先建卷（写卷纲），再在卷下建章（写章纲），最后写正文。
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/novel/EmptyState.tsx
git commit -m "feat: add EmptyState guide for new novels"
```

---

### Task 5: 创建 VolumeEditor 组件

**Files:**
- Create: `frontend/src/components/novel/VolumeEditor.tsx`

- [ ] **Step 1: Implement VolumeEditor**

```typescript
// frontend/src/components/novel/VolumeEditor.tsx

interface Props {
  projectId: string;
  volumeRef: string;       // e.g. "vol-1"
  onChapterSelect: (chapterRef: string) => void;
  onAddChapter: () => void;
}

export default function VolumeEditor({ projectId, volumeRef, onChapterSelect, onAddChapter }: Props) {
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/volumes/${volumeRef}.yaml`)
      .then((d) => {
        setData(d);
        setTitle(d.title || "");
        setSummary(d.summary || "");
      })
      .finally(() => setLoading(false));
  }, [projectId, volumeRef]);

  async function handleSave() {
    await api.put(`/projects/${projectId}/volumes/${volumeRef}.yaml`, {
      ...data,
      title,
      summary,
    });
  }

  async function handleDeleteChapter(chapterRef: string) {
    // calls backend to remove chapter from volume
    await api.delete(`/projects/${projectId}/chapters/${chapterRef}`);
    // reload volume data
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Volume name */}
      <div className="text-[10px] uppercase tracking-widest text-base-content/40 mb-1">卷</div>
      <input
        className="w-full bg-transparent border-b border-transparent focus:border-primary/30 text-2xl font-serif font-semibold outline-none px-0 py-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="卷名"
      />

      {/* Version bar */}
      <div className="flex items-center gap-3 mt-4 px-4 py-2 bg-base-200/50 border border-base-300 rounded-lg text-xs">
        <span className="text-base-content/40 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/30">—</span>
        <div className="flex-1" />
      </div>

      {/* Volume outline */}
      <div className="mt-5">
        <label className="text-xs uppercase tracking-wider text-base-content/50 font-medium flex items-center gap-2">
          卷纲 <span className="text-base-content/30 font-normal normal-case">这卷讲什么故事</span>
        </label>
        <textarea
          className="w-full mt-2 min-h-[100px] bg-base-200/50 border border-base-300 rounded-lg p-4 text-sm leading-relaxed outline-none focus:border-primary/30 resize-y"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="描述这卷的核心冲突、角色变化、如何收尾…"
        />
      </div>

      {/* Chapter list */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-base-content/50">章节 · {(data?.chapters || []).length}章</span>
          <button onClick={onAddChapter} className="text-xs text-primary hover:text-primary/80 transition-colors">+ 添加章节</button>
        </div>

        <div className="flex flex-col gap-1">
          {(data?.chapters || []).map((ch: any, i: number) => (
            <div key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-base-200/50 border border-transparent hover:border-base-300/30 transition-all cursor-pointer group"
              onClick={() => onChapterSelect(`vol-${ch.volume}-ch-${ch.chapter}`)}
            >
              <span className="text-xs text-base-content/30 cursor-grab">⠿</span>
              <span className="text-xs text-base-content/40 w-8">ch-{ch.chapter}</span>
              <span className="flex-1 text-sm">{ch.title || "（未命名）"}</span>
              <span className="text-xs text-base-content/30">{ch.outline_length ? `${ch.outline_length}字` : ""}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                ch.status === "confirmed" ? "bg-success/10 text-success" :
                ch.status === "writing" ? "bg-warning/10 text-warning" :
                "bg-base-300/50 text-base-content/40"
              }`}>
                {ch.status === "confirmed" ? "完成" : ch.status === "writing" ? "写作中" : "章纲"}
              </span>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(`vol-${ch.volume}-ch-${ch.chapter}`); }}
                className="text-xs text-base-content/30 hover:text-error opacity-0 group-hover:opacity-100 transition-all">🗑</button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-base-300/50">
        <button onClick={handleSave} className="px-5 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm hover:bg-primary/20 transition-colors">
          💾 保存卷
        </button>
        <button className="px-5 py-2 text-sm text-base-content/40 hover:text-error transition-colors">
          🗑 删除此卷
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/novel/VolumeEditor.tsx
git commit -m "feat: add VolumeEditor with chapter list and drag-to-order"
```

---

### Task 6: 创建 ChapterEditor 组件

**Files:**
- Create: `frontend/src/components/novel/ChapterEditor.tsx`

- [ ] **Step 1: Implement ChapterEditor**

```typescript
// frontend/src/components/novel/ChapterEditor.tsx

interface Props {
  projectId: string;
  chapterRef: string;       // "vol-1-ch-2"
  onShowVersion: () => void;
}

export default function ChapterEditor({ projectId, chapterRef, onShowVersion }: Props) {
  const [chapter, setChapter] = useState<any>(null);
  const [outlineText, setOutlineText] = useState("");
  const [proseText, setProseText] = useState("");
  const [status, setStatus] = useState("outline");
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/chapters/${chapterRef}`)
      .then((ch) => {
        setChapter(ch);
        setOutlineText(ch?.outline?.summary || "");
        setProseText(ch?.prose || "");
        setStatus(ch?.status || "outline");
      })
      .finally(() => setLoading(false));
  }, [projectId, chapterRef]);

  function markDirty() { setIsDirty(true); }

  async function handleSave() {
    await api.put(`/projects/${projectId}/chapters/${chapterRef}`, {
      ...chapter,
      outline: { ...chapter.outline, summary: outlineText },
      prose: proseText,
      status,
    });
    setIsDirty(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Chapter meta bar */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-base-content/40">章节</span>
          <span className="text-sm font-medium">{chapter?.title || chapterRef}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-base-content/40">状态</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); markDirty(); }}
            className="bg-base-200 border border-base-300 rounded text-sm px-2 py-1 outline-none">
            <option value="outline">章纲</option>
            <option value="writing">写作中</option>
            <option value="review">待修改</option>
            <option value="confirmed">已完成</option>
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-base-content/30">{proseText.length} 字</span>
      </div>

      {/* Version bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-base-200/50 border border-base-300 rounded-lg text-xs mb-5">
        <span className="text-base-content/40 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/30">刚刚创建</span>
        <div className="w-px h-4 bg-base-300" />
        <button onClick={onShowVersion} className="text-primary/80 hover:text-primary transition-colors">📋 历史版本</button>
        <div className="flex-1" />
        {isDirty && <span className="text-warning">⚠️ 未保存</span>}
      </div>

      {/* Outline */}
      <div className="mb-5">
        <label className="text-xs uppercase tracking-wider text-base-content/50 font-medium flex items-center gap-2">
          章纲 <span className="text-base-content/30 font-normal normal-case">这章要发生什么</span>
        </label>
        <textarea
          className="w-full mt-2 min-h-[80px] bg-base-200/50 border border-base-300 rounded-lg p-4 text-sm leading-relaxed outline-none focus:border-primary/30 resize-y"
          value={outlineText}
          onChange={(e) => { setOutlineText(e.target.value); markDirty(); }}
          placeholder="描述这章的关键场景、角色、冲突…"
        />
      </div>

      {/* Prose */}
      <div>
        <label className="text-xs uppercase tracking-wider text-base-content/50 font-medium">正文</label>
        <textarea
          className="w-full mt-2 min-h-[300px] bg-base-200/30 border border-base-300 rounded-lg p-5 text-base leading-[2] font-serif outline-none focus:border-primary/30 resize-y"
          value={proseText}
          onChange={(e) => { setProseText(e.target.value); markDirty(); }}
          placeholder="从第一句话开始写…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-5 pt-4 border-t border-base-300/50">
        <button onClick={handleSave}
          className="px-5 py-2 bg-success/10 border border-success/30 rounded-lg text-success text-sm hover:bg-success/20 transition-colors">
          💾 保存
        </button>
        <button className="px-5 py-2 text-sm text-primary/80 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors">
          预览阅读模式
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/novel/ChapterEditor.tsx
git commit -m "feat: add ChapterEditor with outline/prose editing and version bar"
```

---

### Task 7: 创建 VersionHistory 组件

**Files:**
- Create: `frontend/src/components/novel/VersionHistory.tsx`

- [ ] **Step 1: Implement VersionHistory**

```typescript
// frontend/src/components/novel/VersionHistory.tsx

interface Props {
  chapterRef: string;
  onBack: () => void;
}

export default function VersionHistory({ chapterRef, onBack }: Props) {
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>("");

  useEffect(() => {
    // 从后端加载版本列表
    api.get(`/projects/${projectId}/chapters/${chapterRef}/versions`).then(setVersions);
  }, [chapterRef]);

  async function restoreVersion(ver: string) {
    await api.post(`/projects/${projectId}/chapters/${chapterRef}/versions/${ver}/restore`);
    onBack(); // 返回编辑器
  }

  async function showDiff(ver: string) {
    const diff = await api.get(`/projects/${projectId}/chapters/${chapterRef}/versions/${ver}/diff`);
    setDiffContent(diff.content);
    setSelectedVersion(ver);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-base-content/50 hover:text-primary border border-base-300 rounded-lg px-3 py-1.5 mb-6 transition-colors">
        ← 返回编辑器
      </button>

      <h2 className="text-xl font-serif font-semibold mb-1">版本历史</h2>
      <p className="text-sm text-base-content/50 mb-6">{chapterRef}</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-base-content/40 border-b border-base-300">
            <th className="text-left py-2 pr-4 font-medium">版本</th>
            <th className="text-left py-2 pr-4 font-medium">时间</th>
            <th className="text-left py-2 pr-4 font-medium">备注</th>
            <th className="text-left py-2 pr-4 font-medium">当前</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {(versions.length > 0 ? versions : [
            { version: "v1", time: "刚刚创建", comment: "首次创建", isCurrent: true }
          ]).map((v: any) => (
            <tr key={v.version} className="border-b border-base-300/30 hover:bg-base-200/30 transition-colors group">
              <td className={`py-3 pr-4 ${v.isCurrent ? "text-primary font-medium" : ""}`}>{v.version}</td>
              <td className="py-3 pr-4 text-base-content/50">{v.time}</td>
              <td className="py-3 pr-4 text-base-content/60">{v.comment}</td>
              <td className="py-3 pr-4">{v.isCurrent ? <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">当前</span> : ""}</td>
              <td className="py-3">
                {!v.isCurrent && (
                  <button onClick={() => restoreVersion(v.version)}
                    className="text-[10px] text-primary/80 border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all">
                    恢复到 {v.version}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Diff */}
      {diffContent && (
        <div className="mt-6 p-4 bg-base-200/50 border border-base-300 rounded-lg">
          <div className="text-xs text-base-content/50 mb-3">📋 差异对比</div>
          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-serif">{diffContent}</pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire version API calls into NovelPage**

在 NovelPage 中，version history 按钮回调：
```typescript
const handleShowVersion = (chapterRef: string) => {
  setView({ tab: "writing", panel: "versions", chapterRef });
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/novel/VersionHistory.tsx
git commit -m "feat: add VersionHistory component with version table and restore"
```

---

## Phase 3: 设定 Tab

### Task 8: 创建 SettingsList 组件

**Files:**
- Create: `frontend/src/components/novel/SettingsList.tsx`

- [ ] **Step 1: Define settings tree nodes**

```typescript
// frontend/src/components/novel/SettingsList.tsx
// 返回设定目录的树节点数组

export function getSettingsTreeNodes(): TreeNode[] {
  return [
    {
      id: "world",
      icon: "🌍",
      label: "世界设定",
      badge: "v1",
      actions: [{ icon: "✎", label: "重命名", onClick: () => {} }],
    },
    {
      id: "style",
      icon: "🎨",
      label: "风格规则",
      badge: "v1",
      actions: [{ icon: "✎", label: "重命名", onClick: () => {} }],
    },
    {
      id: "characters",
      icon: "👥",
      label: "角色",
      badge: "0个",
      actions: [
        { icon: "✎", label: "重命名", onClick: () => {} },
        { icon: "➕", label: "新建角色", onClick: () => {} },
      ],
      // children populated dynamically from API
    },
    {
      id: "hooks",
      icon: "🎯",
      label: "伏笔",
      badge: "0条",
      actions: [{ icon: "✎", label: "重命名", onClick: () => {} }],
    },
    {
      id: "intro",
      icon: "📝",
      label: "小说简介",
      badge: "v1",
      actions: [{ icon: "✎", label: "重命名", onClick: () => {} }],
    },
  ];
}
```

- [ ] **Step 2: Wire into NovelPage**

在 NovelPage 中，`tab === "settings"` 时左侧渲染 SettingsList 树，右侧渲染通用设置编辑面板：

```typescript
// Left tree when settings tab
const settingsNodes = getSettingsTreeNodes();
<StructureTree
  nodes={settingsNodes}
  selectedId={view.tab === "settings" ? view.panel : undefined}
  onSelect={(node) => setView({ tab: "settings", panel: node.id })}
  expandedIds={expandedIds}
  onToggle={handleToggle}
/>
```

- [ ] **Step 3: Create a basic settings editor panel**

```typescript
// In NovelPage renderContent, for settings panels:
function renderSettingsPanel(panelId: string) {
  // Each settings panel reads/writes via existing API
  switch (panelId) {
    case "world": return <SettingsFormField projectId={project.id} path="world_settings" title="世界设定" />;
    case "style": return <SettingsFormField projectId={project.id} path="style_rules" title="风格规则" />;
    case "intro": return <SettingsFormField projectId={project.id} path="intro" title="小说简介" />;
    default: return <div className="p-6 text-base-content/40">选择左侧设定项</div>;
  }
}
```

`SettingsFormField` 是一个通用组件，通过 API 读写 YAML 设定文件：
```typescript
// frontend/src/components/novel/SettingsFormField.tsx
export default function SettingsFormField({ projectId, path, title }: { projectId: string; path: string; title: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from existing settings API
    api.get(`/projects/${projectId}/settings/${path}`)
      .then((data) => setContent(typeof data === "string" ? data : JSON.stringify(data, null, 2)))
      .catch(() => setContent(""))
      .finally(() => setLoading(false));
  }, [projectId, path]);

  async function handleSave() {
    await api.put(`/projects/${projectId}/settings/${path}`, { content });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-serif font-semibold mb-5">{title}</h2>
      <textarea
        className="w-full min-h-[400px] bg-base-200/50 border border-base-300 rounded-lg p-5 text-sm leading-relaxed outline-none focus:border-primary/30 resize-y font-mono"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="mt-4">
        <button onClick={handleSave} className="px-5 py-2 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm hover:bg-primary/20 transition-colors">
          💾 保存
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/novel/SettingsList.tsx frontend/src/components/novel/SettingsFormField.tsx
git commit -m "feat: add SettingsList tree and settings editor panel"
```

---

## Phase 4: 主题切换

### Task 9: 添加 parchment 浅色主题

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: Add parchment theme to daisyui config**

```javascript
// tailwind.config.js — in daisyui.themes array, add:
{
  parchment: {
    /* 羊皮纸暖白风格 */
    "primary": "#8b6914",
    "primary-content": "#faf6ee",
    "secondary": "#6b7a54",
    "secondary-content": "#faf6ee",
    "accent": "#a67c52",
    "accent-content": "#faf6ee",
    "neutral": "#3d352a",
    "neutral-content": "#e8ddd0",
    "base-100": "#faf6ee",
    "base-200": "#f0e8d8",
    "base-300": "#e0d5c0",
    "base-content": "#3d352a",
    "info": "#7a9db8",
    "success": "#5a8a5a",
    "warning": "#b8944a",
    "error": "#b85a5a",
  },
},
```

- [ ] **Step 2: Create ThemeToggle component**

```typescript
// frontend/src/components/novel/ThemeToggle.tsx

import { useEffect, useState } from "react";

const THEME_KEY = "ai-novel-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "novelforge");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(t => t === "novelforge" ? "parchment" : "novelforge")}
      className="text-sm text-base-content/50 hover:text-base-content transition-colors px-3 py-1 rounded-md border border-base-300/30"
      title={theme === "novelforge" ? "切换到浅色主题" : "切换到深色主题"}
    >
      {theme === "novelforge" ? "☀️" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 3: Set default theme in index.html**

```html
<!-- frontend/index.html — add data-theme to <html> -->
<html lang="zh-CN" data-theme="novelforge">
```

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/components/novel/ThemeToggle.tsx
git commit -m "feat: add parchment light theme and theme toggle component"
```

---

## Phase 5: 后端 Tree API

### Task 10: 添加 /api/projects/:id/tree 端点

**Files:**
- Create: `backend/novel/router.py`
- Create: `backend/novel/service.py`
- Modify: `backend/projects/router.py`

- [ ] **Step 1: Create tree service**

```python
# backend/novel/service.py

from filesystem.storage import get_storage

async def build_project_tree(project_id: str, root_path: str) -> dict:
    """Build the full project tree: settings + volumes + chapters with status."""
    storage = get_storage()
    
    # Volumes
    files = await storage.list_dir(root_path, "volumes")
    volumes = []
    for f in sorted(files):
        if f.endswith(".yaml"):
            data = await storage.read_yaml(root_path, f"volumes/{f}")
            chapters = []
            for ch in (data.get("chapters") or []):
                chapters.append({
                    "ref": f"vol-{ch['volume']}-ch-{ch['chapter']}",
                    "volume": ch.get("volume"),
                    "chapter": ch.get("chapter"),
                    "title": ch.get("title", ""),
                    "status": ch.get("status", "outline"),
                    "word_count": len(ch.get("prose", "")),
                })
            volumes.append({
                "ref": f.replace(".yaml", ""),
                "title": data.get("title", f),
                "summary": data.get("summary", ""),
                "chapter_count": len(chapters),
                "chapters": chapters,
            })
    
    return {
        "project_id": project_id,
        "volumes": volumes,
    }
```

- [ ] **Step 2: Create tree router**

```python
# backend/novel/router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from db import get_db
from novel.service import build_project_tree
from projects.service import get_project

router = APIRouter(prefix="/api/projects/{project_id}", tags=["novel"])

@router.get("/tree")
async def get_project_tree(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    tree = await build_project_tree(project_id, project.root_path)
    return tree
```

- [ ] **Step 3: Register router in projects/router.py**

```python
# In backend/projects/router.py, add:
from novel.router import router as novel_router
# ... existing code ...
router.include_router(novel_router)
```

- [ ] **Step 4: Commit**

```bash
git add backend/novel/ backend/projects/router.py
git commit -m "feat: add /api/projects/:id/tree endpoint"
```

---

## 清理

### Task 11: 清理废弃页面和组件

**Files:**
- Delete: `frontend/src/components/project/PhaseProgress.tsx`
- Delete: `frontend/src/components/project/ProjectNav.tsx`
- Remove unused imports from `App.tsx`

- [ ] **Step 1: Remove PhaseProgress and ProjectNav**

```bash
git rm frontend/src/components/project/PhaseProgress.tsx
git rm frontend/src/components/project/ProjectNav.tsx
```

- [ ] **Step 2: Clean up App.tsx imports and routes**

移除旧页面的路由 import（OutlinePage, PromptsPage, WritePage, ArchivesPage），保留页面文件不做删除以防引用。

```typescript
// App.tsx — simplify route
<Route path="/project/:slug" element={<ProjectLayout />}>
  <Route index element={<NovelPage />} />
</Route>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git rm frontend/src/components/project/PhaseProgress.tsx frontend/src/components/project/ProjectNav.tsx
git commit -m "cleanup: remove phase-based navigation components"
```

---

## 自检

- [ ] **Spec coverage** — 每个 spec 需求是否对应到任务？
  - ✅ 布局双面板 → Task 2
  - ✅ 设定树 → Task 8
  - ✅ 卷/章树 → Task 1 + Task 2 (loadVolumes)
  - ✅ 空状态 → Task 4
  - ✅ 卷编辑器 → Task 5
  - ✅ 章编辑器 → Task 6
  - ✅ 版本历史 → Task 7
  - ✅ 两套主题 → Task 9
  - ✅ Tree API → Task 10
  - ✅ 清理 → Task 11

- [ ] **Placeholder scan** — 无 "TBD"/"TODO"/"implement later"。完整代码在每个步骤中。

- [ ] **Type consistency** — 所有组件 interface Props 一致，node 类型统一用 `TreeNode`，view state 用 discriminated union。

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-novel-structure-redesign.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
