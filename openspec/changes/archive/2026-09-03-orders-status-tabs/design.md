## Context

设计事实源 docs/design-s/prototypes/orders.html（2026-09-02 tab 分版修订版，用户评审通过：默认待支付 + 「加载更多」机制拍板）。现状：前端 `apiPayOrders()` 一次拉 50 笔平铺；后端 `list_orders` 一次拉全量（page/page_size 注释为"预留"），无任何筛选参数。

## Goals / Non-Goals

- Goals：tab 五版分版（默认待支付）、服务端筛选 + 真分页、加载更多、URL 同步、tab 空态
- Non-Goals：不做经典页码分页；tab bar 不做数量角标（尾块只计当前 tab）；不改订单状态机、不新增状态；不动数据库 schema

## Decisions

### D1：筛选参数=原始状态白名单（逗号分隔），归组映射留在前端

API 保持"哑"：`status=paid,fulfilled`；五版→状态组的映射（`STATUS_GROUPS`）单源放 `api/pay.ts`。理由：后端不泄漏 UI 词汇，未来改归组不动契约。

### D2：分页=offset 分页（page/page_size）+ total

订单量为个人级（月付用户一年约 12 单），offset 足够；`total` 支撑「已显示 X/共 Y」。page_size 默认 20、上限 100。加载更多 = page++ 追加，追加前按 order_no 去重兜底。深翻页性能若未来成为问题再改 keyset（契约注释已留口）。

### D3：归组与「核对中」

exception 不入任何 tab 组，仅「全部」（不带 status 参数的查询）可见——罕见核对态不占 tab 位（用户拍板）。closed 的两个来源（超时自动关单/手动取消支付）同属「已过期」，行内副文案区分表述。

### D4：repo 双实现同改，pytest 双后端参数化

`OrderRepo.find_by_user` 的 statuses 筛选做成可选参数（不传=现状行为），新增 `count_by_user` 同口径计数；sqlite 与 pg_http 两条实现同步改。这是 s-pay-foundation 复盘（sqlite 全绿生产必炸 8 缺陷）的直接教训：契约测试必须双后端跑。

### D5：tab 态存 route query

`?tab=<group>`（all/pending/done/refund/closed），`router.replace` 同步（不进历史栈）；pending 为默认值时省略参数保持 URL 干净。刷新/回退由 query 还原。

### D6：pending 倒计时零改动

`remaining_pay_seconds` 已在列表 payload 且仅 pending 行返回；服务端筛选后待支付 tab 逐行仍带该字段，前端 mmss 倒计时逻辑不动。

### D7：tab 快速切换竞态

前端按 tab 会话令牌丢弃过期响应（切走后再返回的旧 fetch 不落 UI），与 order-detail 查单轮询同款手法。

## Risks / Trade-offs

- offset 深翻页：个人量级无感；trade-off 换来 total 计数的直接可用
- 两端发布中间态：后端先合（不带 status 行为=现状，向后兼容）、前端随后，任一组合可用

## Migration Plan

1. 后端合入：新参数全可选，存量调用零感知
2. 前端合入：tab 分版 + 加载更多切换到服务端筛选分页
3. 合并部署（CI 自动），pg_gate 启动自检照跑（无 DDL）

## Open Questions

无——默认待支付、加载更多、核对中仅入全部，均 2026-09-02 用户评审拍板。
