# s-pay-landing-plans 设计

## Context

- landing 套餐区现状：`components/landing/PricingSection.vue`（#246/#247 数据驱动化产物），旧 IA=试用+月/季/年平铺卡（`.mkt-plan`），已消费 `GET /pay/skus`（skus/popular_sku/purchase_enabled），但没用 #300 下发的 `tiers`（selling_points/is_planned）。
- 收银台参照物：`views/pay/CashierPage.vue` 态一（s-pay-plans-picker 落地），状态拆 `{period, selectedTier}` 二维，`fmtPrice`/`periodLabel` 是前端展示单源（`api/pay.ts`）。
- landing 是营销皮（mkt-* 类体系、AppButton/Ico 组件），收银台是 pay-* 独立布局——两套皮并存是既成事实，本次只采结构。
- e2e：landing.spec.ts 现断言旧 IA（`.mkt-plan` 数量、pro 卡 h3=年付、3 个 /pay 链接、停售骨架）；mock 在 `e2e/mocks/api-handlers.ts`。

## Goals / Non-Goals

**Goals:**
- landing 套餐区与收银台同 IA：时长 tab×三档对比、卖点、预告卡、降级口径对齐
- 选购意图延续：landing 选择经 URL 参数落到收银台选中态
- e2e 断言与 mock 同批对齐，不留旧 IA 断言

**Non-Goals:**
- 不改收银台既有 IA/八态分支（URL 预选除外）；不改 /pay/skus 契约；不做 campaigns；landing 其他区块不动
- 不统一两页样式皮（只对齐信息架构，不对齐视觉皮肤）

## Decisions

**D1 结构复用方式：PricingSection 自写 IA、不抽公共组件。**
备选是把「时长主轴×三档对比」抽成 CashierPage/PricingSection 共用组件。不抽的理由：两处皮不同（mkt-* vs pay-*）、交互终点不同（landing 跳转带参 vs 收银台就地购买条+协议弹窗），强行抽象会造出带两套插槽的参数化组件，复杂度高于两份 ~80 行模板。单源诉求（价格格式化、时长标签、目录解析）已在 `api/pay.ts` 层解决，重复的只是展示模板。若未来第三处出现同 IA，再抽不迟。

**D2 免费列语义：landing 匿名态=「免费」+注册导流，不复用收银台「当前方案」文案。**
「当前方案」在匿名语境是假承诺（访客没有当前方案）。试用 7 天卡退役，其注册导流职责（CTA→/register）与「7 天全功能」卖点并入免费列。

**D3 「最受欢迎」徽标：landing 保留、挂档列；收银台维持不展示。**
#300 对收银台的裁定是「人数统计规则未实现前不展示 pill 与人数」，属收银台购买语境（防误导付费决策）；landing 是营销语境，徽标本就随 popular_sku 单源走、已上线运行，保留挂到档列（而非旧版式的时长卡）。两页展示差异是有意的，记录于此。

**D4 跳转带参：query 参数 `period`+`tier`，收银台挂载时一次性读取校验。**
备选是 sessionStorage 传递——否，URL 参数可分享、可收藏、可回跳，且收银台已按公开目录校验选中态，校验逻辑现成。收银台只在挂载初始化时读一次参数（并入现有 loadSkus 后的默认档推导），不监听路由变化；参数校验失败走现有 ensureSelection 回落链，天然满足「非法回落、无参不变」。

**D5 降级骨架与收银台同口径但保留营销入口。**
目录不可达/空目录时：免费列照常（¥0+卖点兜底+注册 CTA），付费档渲染结构骨架（天数/设备数，价格留白「价格见收银台」），CTA 仍指 /pay。与收银台 FALLBACK_PAID 同构，文案按落地页语境微调。

## Risks / Trade-offs

- [两处模板并存，未来改 IA 要同步两地] → 单源兜底全在 api/pay.ts（fmtPrice/periodLabel/类型）；spec 侧 s-landing-pricing 与 s-pay-cashier 两条 requirement 互为镜像，归档时 spec diff 会提醒同步
- [带参跳转放大 URL 参数攻击面] → 参数仅用于预选展示，下单仍走 sku_key+服务端校验；非法参数只回落不报错，无注入面
- [landing e2e 断言大改，存在漏改旧断言风险] → 改版后 grep landing.spec.ts 内 `.mkt-plan`/`mkt-plan.pro` 残留为零作为验收项
- [mock 数据缺 tiers 字段致新 UI 拿不到卖点] → 实现时先核对 api-handlers.ts 的 skus 响应，缺则补 tiers（对齐生产 SkusView 形状）

## Migration Plan

纯前端：push main 自动部署，无 DDL、无数据迁移。回滚=revert 提交重新部署（/pay 不带参行为不变，回滚无耦合）。

## Open Questions

（无——徽标差异、免费列语义、传参方式均已按上述裁定落定，审批时可推翻重写对应 decision）
