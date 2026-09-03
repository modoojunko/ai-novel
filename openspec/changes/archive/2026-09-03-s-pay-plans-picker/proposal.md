# s-pay-plans-picker

## Why

收银台选套餐区现状是「档位 seg→时长卡」旧 IA，且档位权益文案硬编码在前端（CashierPage.vue 两处）——不符合未来免费/PRO/MAX 三档 × 月/季/年 时长的商品矩阵，也违背「改套餐不发版」的运营要求（价格已随 SKU 走，权益文案还写死）。09-03 已完成原型改版（docs/design-s/prototypes/cashier.html 态一，前端/后端双 agent 评审收官）与数据依赖盘点，本期落地一期：契约扩容 + 选套餐区新 IA。活动位（campaigns）为二期，本期不带。

## What Changes

- **GET /api/pay/skus 契约扩容**（只增不删，向后兼容）：
  - `tiers[]` 增 `selling_points`（解析既有 JSON 列，三档卖点单源）、`is_planned`（status=planned 预告档）；retired 档不返回
  - 档位级设备数本期不下发（`tiers.device_limit` 列不存在，零 DDL 裁定：免费列设备数前端固定兜底 1，见 design D6）；`skus.display_name` 同款裁定砍字段（列亦不存在，实施期核验）——时长名称由 period 映射前端单源（monthly/quarterly/yearly→包月/包季/包年），未来要改名再加列
  - planned 档进入返回（其 SKU 被 on_sale+tier status 过滤挡住），驱动「MAX 未上架」预告卡
  - `SkuRepo.find_on_sale` pg_http 分支补 tier status 过滤（现 sqlite 有、pg 无，双分支口径对齐）
- **CashierPage.vue 选套餐区按原型落地**：时长 tab 主轴（包月默认｜季度/年度带折扣徽标，徽标从 SKU 数据推导）+ 免费/PRO/MAX 三档对比列（费用随 tab 联动 + selling_points 渲染，空数组回退现硬编码文案）+ 点选选中 + 购买条/协议弹窗联动；「最受欢迎」pill 移至 PRO 档列，人数统计规则未实现前不展示 pill 与人数
- **价格展示单源**：卡面/购买条/弹窗统一格式化（分→元后去尾零：整元不带小数，非整元如 ¥310.2）
- 删除 CashierPage.vue:233-242 无事件的死档位 tab；所选档 is_live=false 或对应时长 SKU 缺失时回落默认档守卫
- 界面以鼠标点按为主，不做键盘适配（用户裁定，ADJUSTMENTS 09-03 已登记）
- **非目标**：campaigns 活动模型与活动位 UI（二期）、landing PricingSection 同 IA 采纳（独立 change）、任何 schema DDL（selling_points 列已存在；tier 级设备数列本期不建，免费列走前端兜底）、popular/buyers 服务端统计（未实现前前端不渲染 pill 与人数）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `s-payments`: ADDED「商品目录数据驱动三档矩阵」——/skus 返回 planned 档与 selling_points，前端零硬编码即可渲染档位×时长矩阵；discount_display 即时长 tab 徽标单源
- `s-pay-cashier`: ADDED「选套餐区时长主轴×三档对比」——时长 tab（包月默认、折扣徽标数据推导）、三档对比列（免费列不可选、点选选中、价格联动单源格式化）、非 live 档回落守卫、停售/空目录降级

## Impact

- **后端**：`server/app/interfaces/web_api/payments.py` GET /skus（tiers dict 两字段 selling_points/is_planned + planned/retired 过滤）；SkuRepo pg_http 分支补 tier status 过滤与 tier_key 富集（对齐 sqlite 分支，复审 P1：生产现所有 SKU tier_key 为端点默认值 "pro"）
- **前端**：`server/frontend/src/api/pay.ts`（TierItem/SkuItem 增字段）、`views/pay/CashierPage.vue` 选套餐区重写（状态拆 {period, selectedTier}）、`components/landing/PricingSection.vue` 不动
- **测试**：`server/tests/test_payments_api.py`（/skus 新字段与 planned 档）、S端 e2e mock（api-handlers.ts skus 响应同批）
- **文档**：backend-detail-design 附录 Z.2 SkusView、frontend-detail-design 收银台段落
- **部署**：push main 自动部署；契约只增不删，无兼容窗口需求
