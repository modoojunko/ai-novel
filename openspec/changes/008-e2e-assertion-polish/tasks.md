# 008-e2e-assertion-polish — Tasks

## TE-01 重建 docker 栈 + 跑两条 flow spec
- [x] 实测定位根因：docker client-backend 跑旧 schema（无 volumes/chapters 表）→ 重建 `client-backend` + `client-frontend` 两镜像
- [x] `docker compose up -d` 后后端 lifespan 迁移旧 DB 成功（chapters/volumes 表就绪，启动 complete）
- [x] `free-writing-flow.spec.ts` 4/4 通过（建书直达、树 CRUD、实时字数/自动保存、免费归档不 500 + 树 📦）
- [x] `creation-flow.spec.ts` 5/5 通过（建书即进、简介门控、EmptyState 直写、设定 7 项确认、改名）

## TE-02 断言漂移打磨
- [x] 首轮失败（3/4）根因 = 旧后端端点不匹配，**非断言滞后**；重建后两条 spec 全绿，断言已反映 DB 树/archive sync 新行为，**无漂移需改**
- [x] E2E 后 config.json 恢复原会话（tier=trial modoojunko），DB 备份于 /tmp/novel-db-backup-*.db

## TE-03 全量回归
- [x] 后端 `pytest tests/` 313 passed
- [x] 前端 `tsc --noEmit` ✓ + `vitest` 44 passed + `npm run build` ✓
- [x] 两条 E2E flow spec 9/9 绿
- [x] `openspec validate 008-e2e-assertion-polish --type change` → valid
