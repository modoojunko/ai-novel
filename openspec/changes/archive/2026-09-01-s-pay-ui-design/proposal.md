## Why

S端 扫码支付的实现 change（依据 `docs/prd/s-payment-explore.md`）正在等商户号凭据，但界面不依赖凭据——所有状态可用 mock 数据驱动。按本项目"设计文件化闭环"的既定路线（#178/#179），先把收银台/订单/退款的界面原型做出来：一是让实现期有可对照的设计事实源（S端 无像素 parity 门禁，原型+截图即其设计基准），二是让业务方（含财务手册口径）在写码前看到真实的资金界面长什么样，文案与折算展示可提前校准。

## What Changes

- 新增 **S端 原型目录 `docs/design-s/prototypes/`**（与 C端 `docs/design-c/prototypes/` 平行的设计资产，全入库；S端 无 baselines/parity 需求）
- 产出 4 个自包含原型 HTML（样式内联自 S端 base.css 同源段，词汇严格走 docs/ux 标准）：
  0. `console.html` —— 控制台首页与菜单框架（评审补入）：5 项导航终版、进行中事项横幅（被动提醒）、四快捷卡、试用临期转化态；激活码降级为套餐次入口
  0.5. `membership.html` —— 我的套餐（套餐对象总览，评审补入；显示已购套餐使用情况与历史）：当前档位（已激活行最高档归属）、时长构成时间线（已耗完/消耗中/已激活·排队中）、待激活囤单区块（不计时/不占额度/全额退/立即激活）、剩余合计+待激活计数、设备额度与已绑定设备、续费入口；免费/试用态

  1. `cashier.html` —— 购买收银台：套餐三档选择（价格×折扣展示）→ 微信二维码等待态（倒计时+"我已支付但未到账"出口）→ 支付成功态（"已到货，待激活"：立即激活主按钮 + 先存着次链接）→ 过期态（重新下单）+ **两类失败态**：下单失败（未扣款可重试）/ 支付核对中（资金在途，无重试防重复支付）；右上评审切换器（非基线元素）
  2. `orders.html` —— 我的订单（含各类状态订单）：订单行=纯交易口径（套餐名、金额、交易状态 pill：等待支付/已支付/退款族/核对中/已过期——权益状态与起止不进订单）+ 退款入口；空态
  3. `refund.html` —— 退款申请流：折算预览（"剩余 X 天 Y 小时，按规则预计退 ¥Z.ZZ"·秒级口径）→ 确认 → 处理中/成功态；含不可退（不足 1 分/已到期/超 1 年窗口）拒绝态文案
- `devices.html` —— 设备管理页（评审漏项审计补入）：额度头/设备行/解绑，实现期解绑须 in-app 确认
  0.9. `cashier.html` 增态〇「未登录」：登录卡+回跳购买上下文（漏项审计补入）
  1.0. `storymap.html` —— **购买旅程故事地图**（评审补入）：入口池（5 个入口）→ 主线 A-H 八阶段（每阶段=界面+状态+动作+去向）→ 四条典型路径（首购/囤货/续费/退款）+ 支付期分支一览
- 每个原型附登记注记（对应 C端 ADJUSTMENTS.md 机制，S端 首建 `prototypes/ADJUSTMENTS.md`）
- **范围外**：不动任何 `src/`（实现 change 消费这些原型）；不新增组件词汇（只组合现有 .panel/.pill/.notice/.btn/.seg 家族）；C端 到期提示条另行处理；管理面（ADMIN_TOKEN API）无界面不做原型

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——本 change 纯设计工件产出，不改任何 spec 行为；收银台/订单/退款的**行为** spec 由后续实现 change（s-wxpay-native 立项时）依据 `docs/prd/s-payment-explore.md` 声明。`.openspec.yaml` 已设 `skip_specs: true`。）

## Impact

- 新增目录 `docs/design-s/prototypes/`（3 个 HTML + ADJUSTMENTS.md + README）：文档资产，零代码影响
- 实现期消费方：`server/frontend`（Vue 收银台/订单页/退款流）与后续 C端 提示条参照
- 设计标准消费：docs/ux/design-language.html（§5 状态语言/§13 文案）、cross-end.html 词汇契约、S端 base.css 共享段取值

## Design Impact

- **受影响端**：S端（纯原型，暂不触 `src/`）
- **受影响屏/弹层清单**：收银台（新屏，四态）、订单列表（控制台新页/区块）、退款申请（页内流 + 确认弹层 .mcard）、下单前协议与退款政策确认（收银台内，勾选态）
- **对象状态（对照 §5）**：订单状态 pill——等待支付(pill-status 中性/warn)、已支付/已到账(pill-status ok)、已关闭(pill-tag)、退款中(pill-status warn)、已退款(pill-tag)、异常冻结(pill-status err)；提示条——支付等待 info、成功 ok、超时/失败 warn、不可退原因 err（各带可点出口）
- **是否触碰共享段**：否。原型只**消费**两端已同源的词汇（.panel/.pill/.notice/.btn/.seg/.mcard 族），不定义新共享类；若设计中发现必须新增词汇（如套餐卡 plan-card），走标准流程单列登记再议，不得私造
- **是否需要原型先行**：本 change 即原型先行本身——实现 change 的 tasks 将以这三个原型为设计事实源
- **设计工件由谁产出**：设计侧会话（本次），产出后实现侧自查对照
