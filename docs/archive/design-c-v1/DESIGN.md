# C端 设计词汇表（DESIGN.md）

> ⚠️ 本文件已整体归档（2026-08-27 起标准唯一住在 `docs/ux/design-language.html`）。
> 它描述的是 daisyUI 双主题 + lucide 时代的 v1 体系，与现行 oklch 单主题 +
> 图标注册表冲突，仅作考古用，任何现行判断不得引用本文件。

机器可读版在 `client/frontend/scripts/design-vocab.mjs`（lint 白名单）；两处同步修改。

## 色彩语义

只允许 daisyUI 语义色，**禁用原生编号色板**（stone-/amber-/gray-/slate-…）：

| 语义 | 用途 | novelforge（暖暗） | parchment（暖白） |
| --- | --- | --- | --- |
| `primary` | 主操作/强调 | #d4a373 琥珀 | #8b6914 深金 |
| `base-100/200/300` | 表面/面板/边框底 | 深褐梯度 | 米白梯度 |
| `base-content` | 正文 | #d4c9b8 | #3d352a |
| `success/warning/error/info` | 状态 | 柔和暖调 | 稍深同相 |


全局外壳（body 光晕/滚动条/selection/骨架屏）一律 `oklch(var(--p) / α)` 引主题 primary，
不写字面色值。

## 灰度档（opacity）

| 属性族 | 允许档位 | 语义 |
| --- | --- | --- |
| `text-*` | /30 /40 /60 /80 | 占位提示 / 弱说明 / 常规辅助 / 次正文 |
| `border-*` | /10 /20 /30 /40 /60 | 发丝线 / 弱分隔 / 常规边框 / 卡片边 / 强边 |
| `bg-*` | /5 /10 /20 · /60 /70 /80 | 浅色晕染（hover wash）· 表面混合 |
| `shadow-*` | /5 /10 /20 | 光晕阴影 |

档位外（/50 /70 /15 /25 /85…）在严格范围即违规。存量统计见 `design:lint` 输出。

## 字号档

标准阶梯用 tailwind 语义档（text-xs / sm / base / lg / 3xl…）；
任意值字号（text-[10px]、text-[11px]…）存量未定档——新设计**不得使用**，
确需时在登记簿登记（当前登记：无）。

## 任意值登记簿

| 类 | 用途 | 登记理由 |
| --- | --- | --- |
| `min-h-[100px]` | 书列表虚线卡最小高 | tailwind 3.4 无 100px 间距档 |

## 图标

lucide 系（`viewBox 0 0 24 24`、stroke 2、round cap/join、currentColor），
尺寸用 w-N/h-N 类。原型内联 SVG 与 lucide-react 渲染 DOM 保持几何一致。

## 书列表屏校准记录（PR B 已回填，2026-08-22）

应用侧 6 处档位校准，校准后 design:check 四场景（双主题 × books/empty）
**像素差异 0 px（0.0000%）**——原型与应用逐位一致：

- `text-base-content/50` → `/60`：卡片 meta（N章·更新于…）、更多操作按钮、卷/章统计行、ThemeToggle 文字
- `text-error/70` → `/80`：删除菜单项
- `hover:border-primary/20` → `/30`：卡片 hover 边
- `border-base-300/50` → `/40`：Footer 分隔线

附带排障经验（写进原型注释防回归）：原型 HTML 元素**之间不得有换行空白**——
JSX 剥离而 HTML 折叠成空格，横幅整行文字 + 按钮会平移 ~4px。
