# s-pay-plans-picker Tasks

## 1. 后端契约扩容（GET /pay/skus）

- [x] 1.1 tiers[] 增 `selling_points`（json.loads 解析，失败/空→[]）、`is_planned`（status==='planned'）；**不下发档位级 device_limit（列不存在，零 DDL）**；端点层过滤 status != 'retired'
- [x] 1.2 skus[] 既有字段语义逐一不变（对拍附录 Z.2；**display_name 实施期核验裁定砍字段——列不存在，时长名称 period 映射前端单源**）
- [x] 1.3 **SkuRepo.find_on_sale 双分支口径对齐（检视 P0 + 复审 P1）**：pg_http 分支补 tier status='live' 过滤 **+ tier_key 富集（对齐 sqlite 分支；端点默认值 "pro" 改 ""，前端守卫兜底——生产现所有 SKU tier_key 为硬默认）**；pytest 锁定「planned 档 on_sale SKU 不泄入目录」+「popular_sku 不命中 planned 档」+ popular 取 sort 序确定性
- [x] 1.4 pytest：新字段/类型、planned 档进目录且无 SKU、retired 档不返回、空 selling_points→[]、契约只增不删快照断言；`server/tests/test_payments_api.py` 同批（**fixture 扩数据：max planned 档 + retired 档 + planned 档 on_sale SKU 反例**）；**pg_http 分支用例落 `tests/unit/test_pg_http_repos.py`（现仅 codes 域有覆盖，防「sqlite 绿=以为双实现绿」）**——69 passed

## 2. 前端选套餐区重写（CashierPage.vue）

- [x] 2.1 `api/pay.ts`：TierItem 增 selling_points/is_planned；**新增导出 fmtPrice(fen)（去尾零口径）**；skus 响应类型同步
- [x] 2.2 状态拆二维：period ref（默认 monthly）+ selectedTier ref（默认 popular_sku 所属档回退 pro）+ selectedSku computed；删除 233-242 死档位 tab
- [x] 2.3 时长 tab 主轴：三 tab 由 period 集合驱动、包月默认、折扣徽标读 discount_display（同 period 多档不一致时取任一非空即可，本期数据一致；无则不挂）；视觉对齐原型（.tabs/.mini 口径），新样式仅用 base.css 令牌
- [x] 2.4 三档对比列：免费列（当前方案 tag/¥0/固定 1 台设备/卖点；**current 态后端本期不下发——「试用剩 N 天」只留隐藏分支不接数据**）+ 付费档列（价格/划线价/折扣角标/天数/设备数/卖点）+ selectedTier 选中态；点选切换（鼠标点按，不做键盘适配）
- [x] 2.5 卖点渲染单源：selling_points 非空用接口值，空数组回退现硬编码文案（免费/PRO 兜底=UpgradeModal 事实源；MAX 兜底=占位稿）
- [x] 2.6 价格格式化单源：卡面/购买条/协议弹窗三处统一走 2.1 的 fmtPrice；**替换范围限 CashierPage 内部，fenToYuan/fenToYuanShort 五文件消费方不动**
- [x] 2.7 购买条、协议弹窗与 **waiting 态金额提示（现 L312 selectedPrice）**联动：已选名（档·时长（N 天））/应付/已省（无折扣隐藏）随 {period, selectedTier} 联动
- [x] 2.8 守卫：所选档 is_live=false 或 selectedSku undefined → 回落推荐档；**引入 stores/session isLoggedIn 拆两分支**——未登录（!purchase_enabled && !isLoggedIn）=登录态、已登录停售（!purchase_enabled && isLoggedIn）=停售态（现 L212 两分支混用）；目录拉取失败/空 → 降级骨架（价格留白）
- [x] 2.9 人数与「最受欢迎」pill 一律不渲染（服务端规则未实现前展示即造假）——vue-tsc 0 错 + build 绿 + design-lint 仅存量红（site-beian.ts emoji 主树同报）

## 3. e2e 与对照

- [x] 3.1 **api-handlers.ts 两个 /api/pay/skus 路由块去重合并（检视 P0，先做）**：单源收口到支持 skusOverride 的块（删 L661 死代码，其折扣文案已漂移「9 折」）；随后 mock 数据补全——free tier 行、selling_points（空/非空各一档）、planned 档；**新增 skusGate 失败注入口（照 codesGate 先例）**；landing.spec.ts:79 的 setSkus mock 兼容无需改（Record 透传、landing 不读新字段）
- [x] 3.2 e2e 主路径 spec：默认选中/切 tab 联动/切档/免费列不可选/预告卡不可选/停售与未登录两分支（**实测裁定：/pay 本就 requiresAuth，未登录走守卫重定向 /login?redirect=/pay，页内态〇为防御性兜底**）/目录失败降级/去支付弹窗金额一致；「所选档被下架回落」用 skusOverride（popular 指向 planned 档 SKU）验证
- [x] 3.3 实现截图 vs 原型 cashier.html 态一对照（cashier-impl-monthly/yearly.png 入 evidence/，四项结构核对通过：tab 居中默认包月/三列对比/MAX 虚线预告/购买条联动）
- [x] 3.4 本机全量 pytest（69 绿）+ S端 e2e（166 绿，worktree 内跑）

## 4. 文档与收尾

- [x] 4.1 backend-detail-design 附录 Z.2/Z.4 SkusView 对齐实现并扩容两字段（selling_points/is_planned）与 planned/retired 语义（含砍字段裁定注记）；frontend-detail-design §3.1.2 选套餐区重写为新 IA+实现事实；同批清 proposal/design 残留措辞（复审 P2：device_limit 概览行、字段计数）
- [ ] 4.2 部署后线上验证：/skus 线上响应含新字段、收银台三档矩阵渲染、金额与收银台单一致；**前置种子（生产 PG 手工执行，pg_gate 口径）：`INSERT INTO tiers (key, display_name, rank, status) VALUES ('max', 'MAX', 30, 'planned')`——无此行 MAX 预告卡不出现、三档矩阵退化为两列；可选同批给 pro 行 UPDATE selling_points 下发卖点**
- [ ] 4.3 二期移交清单：campaigns 表设计/sku_keys 引用/服务端算价/popular≥50 规则与 popular_sku 显式配置化（MAX 上架前必改，防漂移连带 landing）/current 态实现/landing 同 IA——写入归档总结，不在本 change 展开
