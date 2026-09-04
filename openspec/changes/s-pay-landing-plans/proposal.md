# s-pay-landing-plans

## Why

#300（s-pay-plans-picker）给收银台立了「时长主轴×三档对比」新 IA，但当时明确把 landing PricingSection 划为非目标（「同 IA 采纳（独立 change）」）。现在营销页套餐区还是 8 月底旧版式（试用+月/季/年 平铺卡）：没有时长 tab、没有免费/PRO/MAX 三档对比与卖点、没有 planned 预告卡——访客在落地页看到的商品呈现与进入收银台后看到的不一致，且 MAX 档预告（营销素材）在 landing 完全缺失。数据端同源（GET /pay/skus），纯前端版式债。

## What Changes

- **PricingSection.vue 按收银台新 IA 重写**：时长 tab 主轴（包月默认｜折扣徽标读 discount_display 单源）+ 免费/PRO/MAX 三档对比列（费用随 tab 联动 + selling_points 渲染，空数组回退兜底文案）+ planned 档「即将推出」预告卡 + 目录不可达/空目录降级骨架（与收银台同口径：结构事实保留、价格留白）；保留 landing 营销皮（mkt-* 体系），只采结构不搬样式
- **免费列语义按落地页场景改写**：landing 访客是匿名态，免费列不标「当前方案」（那是收银台登录态语境），改标「免费」+ CTA「注册领取 7 天试用」（沿用现 trial 卡的注册导流职责，试用权益文案并入免费列卖点）
- **「最受欢迎」徽标保留在 landing**：挂在 popular_sku 所属档列（数据单源不变）；与收银台的差异记录于 design（收银台按 #300 裁定等人数统计实现前不展示 pill，landing 是营销页、徽标本就随数据走，不属同一裁定范围）
- **选中规格跳转带参**：landing 点付费档 CTA 跳 `/pay?period=<p>&tier=<t>`，收银台挂载时读 URL 参数预选（校验失败回落现有默认逻辑）；不带参/直接访问 /pay 行为完全不变
- **e2e 同批改写**：landing.spec.ts 套餐区用例从「.mkt-plan 平铺卡」改断言新 IA（tab 切换联动/预告卡/降级/带参跳转），mock 数据补 tiers 字段
- **非目标**：不碰 CashierPage 选套餐区既有 IA 与八态分支（仅加 URL 预选一处）；不动 GET /pay/skus 契约（只增不删原则下的纯消费方）；不做 campaigns 活动位（二期）；landing 其他区块（hero/features/faq 等）不动

## Capabilities

### New Capabilities

- `s-landing-pricing`: 营销页套餐区块（landing #pricing）的界面侧行为契约——时长主轴×三档对比 IA、匿名态免费列语义、预告卡与降级、跳转收银台带参

### Modified Capabilities

- `s-pay-cashier`: ADDED「URL 参数预选套餐」——/pay 支持 period/tier 查询参数初始化选中态，非法或缺省回落现有默认（包月+popular 档）；不带参行为不变

## Impact

- **前端**：`server/frontend/src/components/landing/PricingSection.vue` 重写（消费 SkusView.tiers/skus/popular_sku，复用 fmtPrice/periodLabel 单源）；`server/frontend/src/views/pay/CashierPage.vue` 挂载时读 route.query 预选（一处小改）
- **后端**：零改动（契约已就绪：#300 已下发 tiers.selling_points/is_planned）
- **测试**：`server/frontend/e2e/tests/landing.spec.ts` 套餐区用例重写 + `e2e/mocks/api-handlers.ts` skus 响应补 tiers（若无）；收银台既有 e2e 不动（无参行为不变）
- **部署**：push main 自动部署；纯前端，无 DDL、无兼容窗口
