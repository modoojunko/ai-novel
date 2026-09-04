# s-pay-landing-plans 任务

## 1. 前置核对

- [x] 1.1 核对 `e2e/mocks/api-handlers.ts` 的 /pay/skus mock 响应是否含 `tiers`（selling_points/is_planned）字段，缺则按生产 SkusView 形状补齐；跑 `npx playwright test landing.spec.ts` 记录改版前基线

## 2. landing 套餐区重写（PricingSection.vue）

- [x] 2.1 重写 `components/landing/PricingSection.vue`：时长 tab 主轴（包月默认+折扣徽标读 discount_display）× 免费/PRO/MAX 三档对比列（费用随 tab 联动、selling_points 渲染、空数组兜底、planned 预告卡），价格走 fmtPrice 单源；保留 mkt-* 营销皮与 AppButton/Ico 组件体系
- [x] 2.2 免费列按匿名态语义实现：标「免费」非「当前方案」，CTA「注册领取 7 天试用」→ /register；「最受欢迎」徽标挂 popular_sku 所属档列
- [x] 2.3 降级骨架：目录不可达/空目录时付费档渲染结构骨架（天数/设备数保留、价格留白、CTA 仍指 /pay），免费列照常；对照 spec「目录不可达降级」场景自测
- [x] 2.4 付费档购买入口跳 `/pay?period=<p>&tier=<t>` 带当前选中规格；验证：本地点选年度+PRO 跳转后 URL 参数正确

## 3. 收银台 URL 预选（CashierPage.vue 小改）

- [x] 3.1 CashierPage 挂载初始化读 `route.query` 的 period/tier：对目录校验（period 在在售集合、tier 在该时长下有可购 SKU）通过才采用，否则走现有默认推导；不监听路由变化、无参行为零改动
- [x] 3.2 验证三态：合法参数预选生效；非法参数（如 tier=max）回落包月+popular；直接开 /pay 与改前一致（对照收银台既有 e2e 全绿）

## 4. e2e 同批改写

- [x] 4.1 重写 landing.spec.ts 套餐区用例为新 IA 断言：默认态与 tab 切换联动、卖点渲染/兜底、planned 预告卡、免费列注册 CTA、最受欢迎徽标挂档列、带参跳转 URL 断言、降级骨架（停售/目录失败）
- [x] 4.2 清旧断言残留：grep landing.spec.ts 确认 `.mkt-plan`/`mkt-plan.pro`/「h3=年付」类旧 IA 断言为零；全套 `npx playwright test` 本机全量绿

## 5. 收口

- [x] 5.1 本机 vitest（若 PricingSection 相关单测存在）+ 前端 build 通过；push 后盯 CI，跨境超时按既定路线本机 tcb 部署兜底
- [x] 5.2 线上验证：landing 三档对比与 tab 联动正常、带参跳 /pay 预选生效、无参 /pay 行为不变；归档时 specs sync 两条 capability
