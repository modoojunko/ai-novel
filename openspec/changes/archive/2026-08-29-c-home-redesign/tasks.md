# Tasks · c-home-redesign

## 1. 设计评审（本轮完成，停审批口）

- [x] 1.1 产出评审稿 `docs/design-c/prototypes/home.html`（先三变体，后扩六变体：玄墨/卷首/朱印/断章/悬丝/对仗，右下角切换器）（验证：浏览器/OpenDesign 渲染可切）
- [x] 1.2 CLAUDE.md §4 页面清单加行 + ADJUSTMENTS 登记条目 5（验证：登记可查）
- [x] 1.3 **用户拍板：变体 a 玄墨**，经四轮评审修订定稿——加品牌 lockup（AWESOME-NOVEL / 爱小说 v{ver}）三段式布局、slogan「人铸灵魂，AI 行笔墨」、底部改「直接开写/新手教程」路径卡、移除 hero 独立爱字图标、辅句「故事已经在脑子里了，现在给它第一行字。」

## 2. 实现（选定变体后）

- [x] 2.1 `landing.css` `.welcome` 段按玄墨定稿重写（三段式 + 微光 + fade-up + 路径卡）；`LandingPage.tsx` 同步；版本胶囊读 `/update-check` 的烘包版本（dev 构建隐藏）（验证：tsc + 与原型一致）
- [x] 2.2 `home.html` 头部标注「转正记录」；ADJUSTMENTS 回登定稿细节（验证：登记可查）
- [x] 2.3 门禁：`design:lint` + `design:cross` 零差异 + `tsc` + `design:check`（books/empty 2 passed 零波动）+ `vitest` 110/110（验证：五项全绿）
- [x] 2.4 PR 入库（设计稿 + 实现同 PR）——✅ #233 已合入 main（4883276）

