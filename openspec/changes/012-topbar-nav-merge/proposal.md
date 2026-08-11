# 顶部导航布局收敛（012-topbar-nav-merge）

## Why

011 把工作台收敛为 3 label 后，顶部仍是两行（书名栏 + 3 label 导航行），且进入各视图后还有二级头部行，纵向堆叠冗余：

1. **顶栏两行**：`NovelBar`（书名/tier/删除）+ 3 label 导航行（编辑设定/编辑正文/预览小说），占两行高度。
2. **各视图二级头部行**：编辑正文 → 面包屑行 + 章选中时又一行子 label（正文/章纲/提示词）；编辑设定 → 「设定 + 返回正文」行；预览小说 → 「返回项目 + 归档 N章」行。用户反馈「点编辑设定、编辑正文下面又多了一行布局出来」。

## What Changes

3 label 导航**并入 NovelBar 标题行**（顶部只留一行 40px），各视图二级头部行一并化简：

1. **顶栏单行**：`[书名 ✎ [类型] │ 编辑设定 │ 编辑正文 │ 预览小说 │ 免费/PRO │ 🗑]`。书名 `flex-1 min-w-0` 截断让位（3 label 永不截断），3 label 跟随书名居左、档位+删除靠最右。
2. **TabProgressButton 视觉**：active 改中性药丸（`bg-base-300 text-base-content font-medium`），inactive 从 `text-base-content/30` 提亮到 `/60` + hover —— 「可点」暗示明确，primary 色留给 PRO badge 与主 CTA。
3. **Workbench 上下文行**：面包屑 + 章子 label（正文/章纲/提示词）+ 专注开关并为一行（36px），省 32px。
4. **AdvancedSettingsView 头部行删除**：「设定 + 返回正文」行退役（返回靠顶栏「编辑正文」label），删 `onBack` prop 与 `ArrowLeft`。
5. **ArchivePage 头部行删除**：「返回项目」退役（返回靠顶栏「编辑正文」label），`归档 (N章)` 下沉为内容标题；空态「回到正文」与阅读器内部导航保留（内容级导航）。

## Impact

- 前端修改：`NovelBar.tsx`（吸收 3 label + props）、`NovelWorkspace.tsx`（删 3-label 行 / 设定头部行 / onBack）、`Workbench.tsx`（面包屑+章子 label+专注并一行）、`ArchivePage.tsx`（删头部行）、`TabProgressButton.tsx`（active/inactive 样式）。
- 测试：`NovelWorkspace.test.tsx`（两处「返回正文」→「编辑正文」）、`e2e/free-writing-flow.spec.ts`（进设定断言改设定树）。
- 无后端改动；N14（免费零 phase-status 请求）不受影响——只搬 JSX 不动数据流。

## Rollout

1. `TabProgressButton` active/inactive 样式
2. `NovelBar` 吸收 3 label（左组 flex-1 布局）
3. `NovelWorkspace` 删 3-label 行 + 设定头部行 + `onBack`
4. `Workbench` 面包屑 + 章子 label + 专注并为一行
5. `ArchivePage` 删头部行，归档计数下沉
6. 测试同步
7. 回归：`tsc --noEmit` + `vitest run` + `npm run build` + E2E spec 编译
8. `openspec validate 012-topbar-nav-merge --type change`
