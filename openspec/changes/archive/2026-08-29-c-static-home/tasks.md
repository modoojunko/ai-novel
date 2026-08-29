# Tasks · c-static-home

## 1. 实施

- [x] 1.1 提交设计文档：docs/ux 裁定 v2（home.html 四态 + README + handoff），与本 change 同 PR 入库——✅ 随本 PR docs 提交入库（含 2026-08-29 规范治理遗留的五份规范块修订）
- [x] 1.2 `ADJUSTMENTS.md` 登记 `.welcome` 静态首页入口卡（C端 私有类，落 landing.css 本地段，非共享段；设计源 docs/ux/home.html home 态）——✅ 登记条目 4
- [x] 1.3 `landing.css` 整体重写：删全部 `mkt-*`，换 `.welcome` 入口卡样式（设计稿逐字 token）；登录页 `.auth-*` 段与 `.btn-lg/.btn-block` 原样保留（验证：grep mkt- 零命中 + tsc）——✅
- [x] 1.4 `LandingPage.tsx` 重写为 welcome 入口卡：方标 + 标题 + lead + 免费开始/我已有账号 + 免费注脚；删营销段落与自带导航页脚（验证：tsc；文案对照设计稿）——✅
- [x] 1.5 `App.tsx` 加 `HomeGate`：`isLoggedIn()` → `<Navigate to="/novels" replace>`，否则 LandingPage；`/` 路由挂 HomeGate（验证：tsc）——✅
- [x] 1.6 `Navbar` 删 `pathname === "/"` 让位；默认分支未登录变体（无导航/设置，登录 + 免费开始）（验证：tsc）——✅
- [x] 1.7 `Footer` 删 `pathname === "/"` 让位（保留 `/novel/` 让位）（验证：tsc）——✅
- [x] 1.8 `NovelListPage.upgradeBtn` 兜底 `Link to="/" scrollTo pricing` → `PORTAL_URL` 常量直连（验证：grep 无 scrollTo:"pricing" + tsc）——✅

## 2. 门禁回归

- [x] 2.1 静态门禁：`design:lint` + `design:cross` 零差异 + `tsc --noEmit`（验证：三命令全绿）——✅ lint exit 0 / cross 共享段零差异 / tsc 绿
- [x] 2.2 像素门禁：`design:check` 全场景零波动（落地页非 parity 对象）（验证：design:check 输出）——✅ books/empty 2 passed
- [x] 2.3 单测回归：`vitest run` 全量绿（验证：退出码 0）——✅ 110/110
- [x] 2.4 路由回归：grep e2e 无落地页依赖（已证实）；`mkt-*` 全站零残留（验证：grep 零命中）——✅
