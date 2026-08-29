# Tasks · c-bookshelf-states

## 1. 原型先行（硬前置）

- [ ] 1.1 `list.html` 原型对齐三态：empty 态改为三步引导（设计稿口径）、books 态顶部加 .resume 继续创作条、新增 quota 满额态（notice + 锁卡 + 锁定主按钮），ADJUSTMENTS 登记（验证：设计:check 基线重建后 books/empty/quota 全绿）
- [ ] 1.2 品牌 agent 评审意见吸收进设计稿与原型（验证：意见条目逐条落地或明确不采）

## 2. 实现

- [ ] 2.1 `list.css` 增 `.resume/.first-run/.lock-tile` 三组样式（逐字取设计稿，本地段非共享段）（验证：design:lint）
- [ ] 2.2 `NovelListPage.tsx` 三态渲染：.resume（updated_at 最大置顶直达）、首启三步引导（CTA 接 CreateProjectModal/ImportNovelModal）、满额 notice + 锁定主按钮（点击升级引导）+ 网格尾锁卡（验证：tsc）
- [ ] 2.3 文案数字对齐后端口径（免费 1 部）：首页注脚（已改）、满额 notice n/1（验证：grep 无「3 部」残留）

## 3. 门禁回归

- [ ] 3.1 `design:lint` + `design:cross` 零差异 + `tsc`（验证：三绿）
- [ ] 3.2 `design:check` books/empty/quota 全绿（验证：输出）
- [ ] 3.3 `vitest run` 全量 + 涉满额分流的既有 e2e 口径确认（验证：绿）
- [ ] 3.4 PR 入库
