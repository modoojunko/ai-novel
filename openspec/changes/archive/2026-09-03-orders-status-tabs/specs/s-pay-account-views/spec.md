## ADDED Requirements

### Requirement: 我的订单列表按状态分版展示

我的订单页（/dashboard/orders）SHALL 以 tab 分版展示订单：全部｜待支付｜已完成｜退款｜已过期五版，默认选中**待支付**。状态归组：待支付=pending；已完成=paid+fulfilled；退款=refund_pending+refund_processing+refunded；已过期=closed（含手动取消支付与超时自动关单两个来源）；核对中（exception）不设专属 tab、仅「全部」可见。tab 词汇用 `.seg` 分段控件，设计事实源=docs/design-s/prototypes/orders.html（2026-09-02 tab 分版修订版）。

#### Scenario: 进页默认聚焦待支付

- **WHEN** 已登录用户进入我的订单页（URL 无 ?tab= 参数）
- **THEN** 默认选中「待支付」tab，仅展示等待支付订单，行内保留二维码有效期倒计时

#### Scenario: tab 与 URL 同步

- **WHEN** 用户切换任一 tab 后刷新页面或浏览器回退
- **THEN** 选中 tab 与列表按 ?tab= 参数还原；该参数只存组名（all/pending/done/refund/closed）

#### Scenario: 已完成含已支付与已到货

- **WHEN** 用户切到「已完成」tab
- **THEN** paid 与 fulfilled 两状态订单都展示，行内徽标维持交易状态词「已支付」

#### Scenario: 退款 tab 覆盖退款全程

- **WHEN** 用户切到「退款」tab
- **THEN** 退款中·冷静期、退款中、已退款三类订单都展示，行内保留预计退金额与划线原价

### Requirement: 订单分版列表的分页加载

各 tab SHALL 独立分页加载：列表尾展示「已显示 X 笔 · 共 Y 笔」，仍有下一页时提供「加载更多」按钮，点击追加同筛选下一页（按订单号去重）；已全部显示时按钮消失。某 tab 无订单时 SHALL 显示该类空态（没有X的订单 + 切回全部查看出口），MUST NOT 复用整页空态。

#### Scenario: 加载更多追加不重复

- **WHEN** 某 tab 共 45 笔、每页 20 笔，用户连续点击「加载更多」
- **THEN** 列表追加至 45 笔且无重复行，尾块显示「已显示 45 笔 · 共 45 笔」，按钮消失

#### Scenario: 某 tab 空态

- **WHEN** 选中 tab 下无任何订单
- **THEN** panel 内显示「没有X的订单」与「切回全部查看」链接，点链接切回「全部」tab

#### Scenario: 整页空态不被分版破坏

- **WHEN** 用户没有任何订单
- **THEN** 展示整页空态（还没有订单 + 去购买套餐出口），tab 条不渲染
