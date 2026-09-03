## Context

`GET /api/pay/membership`（`server/app/interfaces/web_api/payments.py:410`）返回的是域对象 `License`（`app/domain/licensing/license.py`）经 `merge(codes)` 聚合出的视图，函数体内本就从 licensing 域取数——URI 名与对象名错位但实现已是 License 语义，故改名不涉及任何域逻辑、表结构、响应字段变化。消费面：仅 S端 前端 5 个文件 + e2e mock + 2 个 pytest 文件（09-02 全仓 grep 证实，C端 client/ 零引用）。前端与后端分属两个部署工位（novel-s-server 随 push main 自动部署；novel-s-web 随后手动/CI 上传），存在分钟级部署窗口。

## Goals / Non-Goals

**Goals**
- URI、代码符号、路由名、设计事实源文件名全部对齐域对象名 `license`，仓库内存量 membership 符号仅剩后端过渡别名一处
- 上线全程 `/api/pay/*` 与 `/dashboard/*` 对用户零 404（含部署窗口期）
- 响应体、视觉、UI 文案零变化——纯命名层改动

**Non-Goals**
- 激活链一物三名收敛（code/grant/entitlement），另立 change
- License 聚合逻辑、pending_count 统计口径等功能演进（`pending_count` 目前硬编码 0 是既有已知简化，不在本 change 修）
- openspec 归档历史记录改写

## Decisions

### D1 后端：硬切新路径 + 同函数双 decorator 过渡别名

```python
@r.get("/license")
@r.get("/membership")   # 过渡别名：线上前端包零引用后删除（见 tasks 收尾）
async def get_license(request, db):
```

- 备选一（永久双路径）：词汇永不干净，否
- 备选二（前端 fallback 兼容层）：把后端命名债搬进客户端，复杂化请求层，否
- 备选三（纯硬切零别名）：后端已上线新包而前端旧包仍在用户浏览器里打开着控制台时，我的套餐页请求 404；S端 e2e 全 mock 对真后端路由盲，测不出这类断链（#255 ruff 404 事故同型），否
- 双路径一行成本买确定性，别名删除有明确判据（线上前端 bundle grep `/pay/membership` = 0），不滞留

### D2 前端路由：`license` 路径由真身页占用，redirect 反转

老激活码规则 `{ path: 'license', redirect: membership }` 删除，原路径直接挂 `LicensePage`；新增 `{ path: 'membership', redirect: { name: 'license' } }` 接住上线后老书签。老激活码书签落到权益页语义连续（8.3 拆除激活码时其链接本就定向到套餐页），redirect 链不增长。备选（换新词避开老路径）会引入第四个词汇，否。

### D3 响应体零变化

字段名 tier/remaining_sec/remaining_desc/max_expires_at/pending_count 本无 membership 字样，动字段徒增改动面与回归风险。本 change 只动"名字的载体"（路径/函数/类型/组件/文件），不动"数据的形状"。

### D4 设计事实源同批更名

`docs/design-s/prototypes/membership.html` → `license.html`，ADJUSTMENTS.md 登记更名条目，console.html / storymap.html / README 引用同批 grep 更新；两份详设文档（backend-detail-design.md API 表、frontend-detail-design.md 页面名）同步。理由：原型是设计事实源，文档留旧名则错位词汇会从文档侧再入侵代码，改名初衷落空。

### D5 测试与门禁

- 后端：全量 pytest（deploy 门禁既有要求）；`test_payments_api.py:221` 换 `/api/pay/license`，`test_timezone_discipline.py:54` 同批；补一条别名 scenario 断言（两路径返回体一致）
- 前端：`vue-tsc --Emit`（符号改名类型即断）、playwright PR CI；`license-redirect.spec.ts` 断言反转为 `/dashboard/membership → /dashboard/license`，mock 层 `api-handlers.ts` 的路由串与 `TestMembership` 状态字段更名
- 验收 grep（排除 venv/node_modules/openspec 归档）：membership 残余 = 后端别名一行 + 归档目录

## Risks / Trade-offs

- [部署窗口期 404] → D1 双路径别名覆盖；后端先部署、前端随后上传的既有顺序不变
- [别名遗忘滞留成永久双路径] → tasks 收尾任务显式含"线上包 grep 零引用 → 删别名 → 复验"，且 spec 写明 MUST 移除
- [文档引用漏改致事实源分叉] → docs/design-s 全目录 grep membership 固化进任务清单
- [route name 改动漏更新 `router.push({ name })` 调用方] → 仓内 router-link/push 均用字符串路径而非 name（grep 证实），风险低；vue-tsc 兜不住字符串路径，靠 e2e 跳转断言覆盖

## Migration Plan

单 PR（后端+前端+测试+文档同批）→ CI 绿合并 → push main 自动部署后端（此刻双路径并存，新旧客户端均可用）→ 前端 novel-s-web 上传新包（全部指向 /license）→ 线上验证（`GET /api/pay/license` 200、`GET /api/pay/membership` 仍 200、浏览器访问 `/dashboard/membership` 落到 `/dashboard/license`）→ 收尾小 PR 删后端别名 → 归档。回滚：revert 即回，无 schema/数据迁移，无状态残留。

## Open Questions

（无——UI 文案保留已拍板；一物三名收敛明确出范围。）
