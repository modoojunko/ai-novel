# 008-e2e-assertion-polish — Design

## 架构总览

```
本地 Vite dev（当前源码）──/api 代理──▶ docker client-backend:8000（config.json 每请求读）
        ▲
E2E_BASE_URL=http://localhost:5176  playwright（free-writing-flow + creation-flow）
        └─ 写 .docker-data/client/config.json（tier=none/trial）→ 后端即时生效
```

- **实测修正：docker 栈是 sprint 前旧代码，必须整体重建 client 两镜像**。首轮以「本地 Vite dev + docker 旧后端」试跑，失败根因是 **docker client-backend 跑旧 schema**（`novel.db` 无 `volumes`/`chapters` 表，容器 09:46 构建早于 change 005/006）——新前端调 `POST /volumes/{ref}/chapters`/`GET /volumes` 命中旧端点，树渲染旧行为「第0卷/0章」、建章不达编辑器。E2E 目标栈（docker）必须全量当前代码。
- **执行路径**：`docker compose build client-backend client-frontend` → `docker compose up -d` → 后端启动 lifespan 迁移旧 DB（create_all + 幂等 backfill，全部 try/except 包裹，见 `main.py`，不崩容器）→ 跑 E2E（baseURL 默认 `http://localhost:5174`，即 docker nginx 当前 dist）。
- **鉴权**：spec 内 `sRegisterAndLogin`（S端 :19000 真实注册登录）→ 写 `.docker-data/client/config.json` + `localStorage.auth_token`；后端 `get_local_config()` **每请求读 config.json**（无缓存），tier 即时生效。
- **安全**：改 docker 栈前备份 `novel.db`（/tmp）+ `config.json`；E2E 的 try/finally 恢复 config.json，测试完核对。

## 关键实现点

### 1. TE-01 起 dev 并跑两条 flow spec

```bash
cd client/frontend
npx vite --port 5176 --strictPort &   # 后台 dev
E2E_BASE_URL=http://localhost:5176 npx playwright test e2e/free-writing-flow.spec.ts e2e/creation-flow.spec.ts
```

### 2. TE-02 断言打磨准则

- **只磨断言，不动业务代码**：若 E2E 失败是断言滞后于 DB 树/archive sync 新行为 → 改 spec 断言；若是真实业务缺陷 → 记录并**另立 change**，不混入 008。
- **unarchive「恢复」为 P2**：若归档阅读器入口稳定且一键可达，补一条 归档→恢复→树回非归档 往返断言；若需要多层导航（易 flaky）则不硬补，覆盖已在 `test_write_archive_meta_sync.py`（BE-05 后端往返）闭环。

### 3. TE-03 回归门禁

后端 `pytest tests/ -q`（313）→ 前端 `tsc --noEmit` + `vitest run`（44）+ `npm run build` → 两条 E2E 绿。

## 退役/删除

- 无（仅打磨 E2E 断言；不删 spec 用例，除非断言与当前产品行为相悖）。

## 测试

- 见 spec.md ADDED Requirements（免费主流程 / PRO 创建流程 / DB 树断言 / 回归收口）。

## 风险与取舍

- **E2E 依赖 docker 4 服务运行**：client-backend/server-backend 是后端真身；若 docker 栈未启动，E2E 不可跑（CI 场景由工作流负责起栈）。
- **免费限 1 部作品**：`free-writing-flow` 每测试独立注册免费用户，不受配额互扰。
- **Vite dev 与生产 nginx 差异**：仅代理差异，行为等价；若有差异暴露则如实记录。
