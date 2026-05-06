# NovelForge 前端重设计 · 设计规格书

> 日期：2026-05-06
> 状态：已确认，待实现
> 上一版问题：CSS 变量替换 + 字体更换虽然技术正确，但"感觉不对"——所有页面同一张脸、交互全部是 CRUD 表单模式、缺少空间气质差异

## 1. 色彩系统 · 月下青砚

中性色全部 hue 245（冷蓝灰），强调色 hue 215（月光青蓝）。全部 oklch，不凭空写 hex。

```css
:root {
  --background: oklch(0.15 0.008 245);
  --foreground: oklch(0.85 0.005 245);
  --card: oklch(0.19 0.010 245);
  --card-foreground: oklch(0.85 0.005 245);
  --popover: oklch(0.21 0.010 245);
  --popover-foreground: oklch(0.85 0.005 245);
  --primary: oklch(0.65 0.06 215);
  --primary-foreground: oklch(0.12 0.005 245);
  --secondary: oklch(0.23 0.010 245);
  --secondary-foreground: oklch(0.82 0.005 245);
  --muted: oklch(0.22 0.008 245);
  --muted-foreground: oklch(0.55 0.010 245);
  --accent: oklch(0.28 0.015 250);
  --accent-foreground: oklch(0.88 0.005 245);
  --destructive: oklch(0.55 0.18 20);
  --border: oklch(0.26 0.010 245);
  --input: oklch(0.22 0.008 245);
  --ring: oklch(0.65 0.06 215);
  --radius: 0.5rem;
}
```

Archives 阅读区纸色（唯一额外 token）：`oklch(0.23 0.012 245)` —— 从 card(0.19) 提亮 0.04，同 hue。

**全局禁止**：radial-gradient 光晕、grain texture（仅 Archives 阅读区可用）、page-enter 动画。

**保留**：暖色滚动条（改冷调）、`::selection` 改为 primary 色。

## 2. 字体系统

```css
--font-serif-heading: 'Noto Serif SC', serif;   /* 标题 + Write prose + Archives 正文 */
--font-sans: 'Noto Sans SC', sans-serif;         /* UI 文字、标签、按钮、表单 */
--font-mono: 'JetBrains Mono', monospace;        /* 代码、文件名、技术数据 */
```

**使用纪律**：衬线不撒胡椒面。Write 的 prose 区和 Archives 的阅读区大量用衬线；其他界面（Dashboard、Outline、Settings）衬线仅用于页面主标题。

## 3. 全局共享组件

### PhaseProgress（6 阶段进度线）
- 6 个圆点连线，当前阶段亮 primary 色 + 微光
- 已完成阶段：`oklch(0.55 0.12 150)` 绿色圆点 + ✓
- 未激活：`oklch(0.30 0.005 245)` 空心圆
- 阶段名（中文）：初始化 → 设定 → 大纲 → 提示词 → 写作 → 存档
- 放在 ProjectNav 上方

### AiSuggestButton
- 样式：`border: 1px solid primary/40; bg: card; color: primary;` 12px 字体
- 悬停：border 提亮，bg 加 primary 微色调，文字提亮
- 生成中：spinner 动画 + "生成中..."
- 位置：表单字段同行右侧，不另起一行
- 后端暂缺的 API：按钮渲染但点击提示"即将上线"

### SegStepIndicator（Segment 步骤条）
- 竖向圆点连线，三种状态色：绿（完成）、primary 微光（进行中）、空心（待处理）
- 用于 Write 左侧和 Outline segment 列表

## 4. 中文标签全局替换

| 英文 | 中文 |
|------|------|
| Settings / Outline / Prompts / Write / Archives / Threads | 设定 / 大纲 / 提示词 / 写作 / 存档 / 线索 |
| World Setting / Writing Style / Anti-AI Rules / Hooks Board / Characters | 世界设定 / 写作风格 / 反AI规则 / 伏笔面板 / 角色管理 |
| Get Started / Sign In / Register | 开始写作 / 登录 / 注册 |
| My Projects / New Project | 我的小说 / 开始新小说 |
| Quality Check / Archive Chapter | 质量检查 / 存档本章 |

## 5. 页面设计

### 5.1 Dashboard（/dashboard）
**布局**：顶部"我的小说"标题 + "开始新小说"按钮 → 2 列项目卡片网格
**创建流程**：点击"开始新小说"→ 居中聚焦面板 → 书名（必填）+ 一句话梗概（选填）+ AI 建议书名按钮 → 创建
**项目卡片**：书名（衬线）+ 梗概 + 6 阶段 mini 圆点进度 + 章数/卷数 + 更新时间
**空态**："暂无小说"，居中衬线文字
**卡片末尾**：虚线快捷创建入口

### 5.2 Outline 编辑器（/project/[slug]/outline）
**布局**：左树右编辑，双区
**左侧树**：卷可展开折叠，章用圆点颜色表示状态（空心=outlining、半实心=confirmed、绿=archived）。卷旁有 [+ 章] 按钮
**右侧编辑**：默认只显示章标题 + 概要，各带 AI 按钮。高级字段（POV/Thread/StoryTime 等）收进"更多字段 ▸"折叠区（纯文字链接，无背景条）。Segments 用紧凑行内列表
**创建卷**：按钮 → 聚焦面板 → 填卷名 → 完成

### 5.3 写作台（/project/[slug]/write）
**布局**：三区——左卷章树(220px) | 中流式文档(flex) | 右面板(260px，按需滑入)
**左侧**：卷章树，当前章高亮 primary 左边线
**中间顶部**：章标题 + segment 进度圆点
**中间正文**：流式文档，segment 状态区分：
  - 已完成：无边框，纯衬线 prose
  - 生成中：primary 左边线 + 微光背景 + 闪烁光标 + [暂停]
  - 待生成：虚线左边 + 斜体占位 + [生成]
**右侧**：默认隐藏，点"质量检查"滑入。显示 6 项检查结果 + 存档/复制按钮

### 5.4 Archives 阅读页（/project/[slug]/archives）
**布局**：左卷章树 + 右阅读区
**右侧阅读区**：纸张色 `oklch(0.23 0.012 245)` + grain texture + 衬线正文 16px 行高 2 首行缩进 2em + 章末上/下章导航
**左侧树**：和 Write 相同的卷章树，点击切换阅读内容

### 5.5 Settings Hub + 子页
**Hub**：卡片网格，图标色 primary，hover ring 替代 shadow
**子页（world/style/anti-ai/hooks/characters）**：保持 SettingsForm 通用组件。标题旁预留 AI 建议按钮

### 5.6 Prompts（/project/[slug]/prompts）
保持现有三区布局。左侧章节列表改用卷章树组件。Prompt 内容查看区背景 muted。

### 5.7 Threads（/project/[slug]/threads）
保持展开折叠卡片。情绪温度标签配色：
- low: `oklch(0.65 0.06 215 / 20%)` 文字 `oklch(0.65 0.06 215)`
- medium: `oklch(0.55 0.05 195 / 20%)` 文字 `oklch(0.65 0.08 195)`
- high: `oklch(0.60 0.12 55 / 20%)` 文字 `oklch(0.70 0.15 55)`（暖调警告）
- climax: `oklch(0.55 0.18 20 / 20%)` 文字 `oklch(0.65 0.15 22)`

### 5.8 Landing（/）
非对称布局：大字左偏上 + CTA 左下 + 大面积留白 + 右下角中文诗句（muted 小号）。不加光晕。

### 5.9 Login / Register
居中卡片，边框改 shadow，标题衬线。

## 6. ProjectNav 升级

现有 tabs 上方加 PhaseProgress。Tabs 标签英文改中文。Active tab 的 primary 下划线保留。

## 7. AI 按钮位置清单

| 位置 | 功能 | 后端状态 |
|------|------|---------|
| Dashboard 创建面板 | AI 建议书名 | 待补 |
| Outline 章标题旁 | AI 建议标题 | 待补 |
| Outline 概要旁 | AI 展开概要 | 待补 |
| Settings 子页标题旁 | AI 展开设定 | 待补 |
| Prompts 视角转换 | ✅ | 已有 |
| Prompts 生成提示词 | ✅ | 已有 |
| Write 逐段生成 | SSE streaming | 已有 |
| Write 质量检查 | ✅ | 已有 |

## 8. 实现细节

- **创建面板（Dashboard / 创建卷）**：使用 shadcn Dialog 组件，居中弹出。非页面跳转。
- **写作台右侧面板**：使用 `useState` 控制显隐 + CSS `translateX` 过渡动画滑入滑出。不常驻。
- **Outline 高级字段折叠**：使用 `useState` + 条件渲染，不用 Accordion 组件。折叠触发器为纯文字链接。
- **Archives 阅读区 grain 纹理**：仅在阅读区容器使用 `::after` 伪元素 + SVG data URI，不影响左侧树。
- **sidebar token 值**：对于 shadcn sidebar 组件，sidebar 系列 token 在背景色基础上进一步降亮度。

## 9. 实现策略

选择 **Approach B：基础层 → 页面层**。

1. globals.css 全量替换为月下青砚色板
2. 三个共享组件（PhaseProgress、AiSuggestButton、SegStepIndicator）
3. ProjectNav 升级（进度线 + 中文标签）
4. 页面逐个落地：Dashboard → Outline → Write → Archives → 其他

## 10. 验证

1. `npm run dev` 启动，逐页检查色彩/字体/布局
2. `npx tsc --noEmit` 类型检查
3. `npm run build` 构建通过
4. 所有中文标签无遗漏
