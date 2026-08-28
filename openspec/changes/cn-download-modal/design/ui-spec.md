# ui-spec · 下载弹窗（Open Design v2）

## 设计规格声明（ui-design 技能强制段）

- **Purpose**：见 proposal；弹窗是版本解析与下载决策的同一现场，"所见版本 = 所下字节"。
- **Aesthetic Direction**：Editorial/refined——沿用项目既定 Open Design v2（宋体展示标题、青绿 oklch 点缀、纸白卡片浮层）。**品牌覆盖声明**：本设计系统为已批准约束，覆盖技能默认的字体/配色禁令；不引入任何新令牌、新色、新字体。
- **Color**：全部取自 `server/frontend/src/design/base.css`（--accent 青绿主操作 / --surface 卡片 / --fg·--muted 墨色两级 / --ok·--warn 语气）。
- **Typography**：--font-display Noto Serif SC 标题；--font-body 正文。
- **Layout**：居中 420px `.mcard` 浮层；卡内左对齐编辑式纵向排版；遮罩 `--fg` 45% 透明；入场沿用既有 fade+8px 上移动效。

## 交互时序

1. 访客点击 Hero 主按钮「免费下载」（未登录态唯一主操作）→ 弹窗**立即**打开。
2. 弹窗打开的同时同源 fetch `https://www.awesomenovel.com/download/latest.json`（`{"version":"x.y"}`）。
3. 返回后渲染：版本 pill + 两枚平台按钮（href = 版本常量模板拼接的静态托管直链）。
4. 用户在弹窗内点击平台按钮 → 直接下载。所见版本与所下文件名版本必然一致。
5. 页面副行不再展示版本号（版本承诺收敛到弹窗这一处，杜绝跨发版的文案漂移）。

## 三态规格

| 态 | 触发 | 表现 |
|---|---|---|
| 加载中 | 弹窗打开、fetch 未返回 | serif 标题「下载爱小说」+ LoadingSkeleton 双条占位（复用组件），通常一闪而过 |
| 成功 | fetch 返回 | 版本 pill（accent-soft 底/accent 字「最新版 v0.12」）+ 双平台按钮 + 首开提示 + 次级链 |
| 降级 | fetch 失败/超时 | 以代码兜底版本渲染同款内容，pill 换 warn 语气「未能获取最新版，当前 v0.11」——可下、不阻塞、不弹 toast |

## 文案（§13 口径）

- 标题：下载爱小说（serif）
- pill：`最新版 v{x}` / 降级 `未能获取最新版，当前 v{x}`
- 按钮动词起句：`下载 Windows 版`、`下载 macOS 版`
- 平台注脚：`安装包 .exe` / `磁盘镜像 .dmg`
- 首开提示（muted 小字）：`macOS 首次打开若提示无法验证开发者：右键 App → 「打开」`
- 次级链：`查看其他版本 →`（GitHub Releases 页）
- 无内部术语（CDN/latest.json/静态托管等一律不出现）。

## 无障碍与细节

- Esc / 点遮罩关闭；打开后焦点落主按钮；关闭后焦点还原触发按钮。
- 双平台按钮全宽等高（.btn-lg），Windows primary、macOS secondary（沿用既有权重语言）。
- 图标唯一来源：注册表 `P.download`，不新增 glyph。
- 实现后三态截图归档 change 目录 `screenshots/`（S端 免原型的对照证据，原型 HTML 同目录留档）。
