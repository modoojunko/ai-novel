# s-pay-plans-picker Design

## Context

原型已定稿：`docs/design-s/prototypes/cashier.html` 态一（09-03 改版，ADJUSTMENTS 同日登记 8 行；jsdom 冒烟 32/32）。双 agent 评审结论已并入范围：前端（鼠标点按裁定、价格单源、状态二维拆分、死 tab 清理、非 live 守卫）；后端（零硬编码盘点、契约只增不删、popular 规则未实现前不上）。命名已对齐 s-license-codes-field 终态词汇（tier/sku/code/fulfillment/license），本 change 不涉及 grant 词。campaigns 活动模型为二期，本设计不含。

## Goals / Non-Goals

**Goals**
- GET /skus 契约扩容（selling_points / is_planned），planned 档进目录
- CashierPage 选套餐区重写为时长主轴×三档对比，配置全数据驱动
- 价格/折扣/卖点展示单源；非 live 档、停售、空目录三重守卫

**Non-Goals**
- campaigns 表与活动位 UI（二期 change）
- landing PricingSection 同 IA（独立 change；其消费 popular_sku 注意 D5 漂移约束）
- 键盘可达性（用户裁定不做）；popular/buyers 服务端统计（未实现前不展示）
- 任何 DDL：selling_points 列三方（ORM/alembic/pg_schema）齐备；**tier 级设备数列与 skus.display_name 列均不存在且本期不建**（前者检视裁定、后者实施期核验同款裁定——时长名称 period 映射前端单源，未来要改名再加列）

## Decisions

### D1 状态拆二维：{period, selectedTier} + computed selector

现 CashierPage 以单个 selectedSku ref 为中心（默认选 popular SKU）。改为 `period ref('monthly')` + `selectedTier ref('pro')`，`selectedSku = computed(() => skus.find(s => s.tier_key === selectedTier && s.period === period))`。默认档取「popular_sku 所属 tier，回退 pro」；时长默认 monthly（用户裁定，替代原 popular 默认包年）。

### D2 planned 档放行进目录，SKU 双分支过滤口径对齐（检视 P0 修正）

tier 侧 `TierRepo.find_all()` 本就返回全量（含 planned/retired），**无需改**；改的是端点组装（现只输出 key/label/is_live）——输出 planned/retired 之外的全量并加 is_planned，端点层过滤 `status != 'retired'`。**真坑有二（同函数、同性质的双分支分叉）**：①`SkuRepo.find_on_sale` sqlite 分支有 `TierORM.status=='live'` 联表过滤，pg_http 分支（生产路径）只有 `on_sale:true` 无 tier 条件——planned 档 on_sale SKU 会泄入生产目录；②pg_http 分支不联表，返回行**无 tier_key**，端点 `s.get("tier_key","pro")` 把缺省静默默认成 "pro"——生产现所有 SKU 的 tier_key 都是硬编码 "pro"（本期单档数据掩盖，MAX 上架即错档，D1 的 computed selector 建立在该字段真实性上）。本 change 一并修：pg_http 分支补 tier status 过滤 + tier_key 富集（对齐 sqlite 分支，天然实现=取 live tier 行集→按 tier_id 过滤 skus→从 tier 行富集 tier_key），端点默认值 "pro" 改 "" 由前端守卫兜底；pytest 锁定「planned 档 on_sale SKU 不泄入」「popular_sku 不命中 planned」与 sort 序确定性。`endswith("yearly")` 的 popular 判定在本期 DB 数据下不翻车，但修好过滤是前置。

### D3 价格格式化单源

`api/pay.ts` 新导出 `fmtPrice(fen)`（分→元 toFixed(2) 后去尾零：¥30 / ¥310.2，与原型 fmt 及 PricingSection.yuan 逐字同口径），卡面/购买条/弹窗三处共用；**替换范围限 CashierPage 内部**——pay.ts 既有 fenToYuan/fenToYuanShort 被订单/退款/首页/landing 五文件消费，本期不动。

### D4 卖点与徽标前端零计算

selling_points 由端点 `json.loads` 后下发字符串数组；空数组时前端回退现硬编码文案（保底不空白）。时长 tab 徽标与卡面角标一律读 `discount_display`，前端不做 permille→文案换算（单源，避免两处口径漂移）。时长名称（包月/包季/包年）= 前端 period 常量映射单源（skus.display_name 列不存在已裁定砍字段）。

### D5 popular 规则维持现状但语义收窄

`popular_sku`（endswith("yearly") 硬编码）本期不动后端——仅用于默认档回退与（将来）pill；**人数与「最受欢迎」pill 本期一律不渲染**（≥50 人服务端规则未实现，展示即造假，ADJUSTMENTS 08-28 红线）。二期随 campaigns/popular 规则一并处理。**约束记账（检视 P1）：popular_sku 取 sort 序首个 endswith("yearly")，MAX 上架后可能漂移到 max-*-yearly，连带本 change 默认档与 landing「最受欢迎」pill——MAX 上架前必须把 popular_sku 改为显式配置（global_config），写进二期移交清单。**

### D6 免费列数据来源（检视修正）

免费列 = tiers 中 key='free' 行（若目录返回）+ 固定兜底；**档位级设备数本期不下发**（tiers.device_limit 列三方皆不存在，检视裁定不建列不加 DDL），免费列设备数固定展示 1 台。**「试用剩 N 天」：后端 get_skus 现状从不组装 current 态**（docstring 与 pay.ts 类型有、实现无）——本期不补实现，前端只留类型与隐藏分支，该行实际不出现；补 current 属二期。

## Risks / Trade-offs

- [planned 档进目录打破「目录=可购集」旧假设] → 消费方仅 CashierPage（grep 核实）+ 契约只增不删；e2e mock 同批更新
- [pg_http 与 sqlite 过滤口径分叉] → D2 显式对齐 + pytest 双实现锁定；pg_gate 启动自检不涉及本 change（零 DDL）
- [MAX 占位卖点经接口下发会被当真] → 二期运营定稿前，DB 中 MAX 档 selling_points 允许为空走前端兜底；定稿后改库即生效
- [e2e mock 双路由块] → api-handlers.ts 同一 handler 顺序 if 链中存在两个 /api/pay/skus 块：L502 先命中先 return（skusOverride 通道实际有效），L662 为不可达死代码——删死代码、单源收口到 override 块（tasks 3.1 首项；复审修正机理：非「后注册者生效」）
- [状态二维化回归] → e2e 选套餐主路径（默认选中/切 tab/切档/去支付弹窗）全量覆盖；jsdom 原型测试已锁定交互口径可对照
- [worktree 外部进程回退] → 编辑→验证→推送最小化 + 字节级校验（#285/#297 后成规）

## Migration Plan

单 PR：后端端点扩容 + 前端切换 + e2e/pytest 同批（契约只增不删、同仓同发，无 compat 窗口）→ CI → push main 自动部署 → 线上验证（/skus 新字段在位、收银台三档矩阵、planned 态演示走 DB 临时配置或 mock）→ 归档。回滚 revert 即回，无 schema 变更。

## Open Questions

（无——一期范围三项拍板均已在对话中落定：鼠标点按、包月默认、活动出本期。）
