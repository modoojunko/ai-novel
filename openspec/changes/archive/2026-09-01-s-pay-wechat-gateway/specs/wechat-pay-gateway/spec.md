# wechat-pay-gateway 能力增量

## ADDED Requirements

### Requirement: Native 扫码下单

系统通过微信支付 APIv3 Native 下单接口创建支付订单，返回二维码内容（code_url）；二维码内容仅由本地渲染（canvas/库生成图片），不得交予第三方服务生成或中转；微信侧返回业务错误时按可归类原因转为领域异常（下单失败可重试），网络超时标记 `prepay_status=failed` 且订单保持 pending 可重新下单。

#### Scenario: 下单成功返回二维码

- **WHEN** 以订单号、金额（分）、AppID、商户号调用 Native 下单且微信受理成功
- **THEN** 返回 `code_url`，订单附带 15 分钟有效期且下单请求携带 `time_expire` 与之对齐（微信侧原生截断支付窗口）；`notify_url` 指向生产回调端点

#### Scenario: 二维码本地渲染

- **WHEN** 收银台展示支付二维码
- **THEN** `code_url` 仅在前端本地生成二维码图片，不发生向第三方二维码服务的网络请求（支付凭证不外泄）

#### Scenario: 微信拒绝下单

- **WHEN** 微信返回业务失败（如参数/权限错误）
- **THEN** 不创建本地支付事实，订单保持 pending 且 `prepay_status=failed`，用户可重试重新下单

### Requirement: 支付回调验签与解密

系统提供 `POST /api/pay/notify` 回调端点（无登录态）。必须先验微信支付签名（Wechatpay-Signature 头，微信支付公钥），后用 APIv3 密钥 AES-256-GCM 解密报文资源；任一失败返回 HTTP 401/400 让微信重试。

#### Scenario: 验签失败拒绝处理

- **WHEN** 回调签名验签失败（伪造或公钥不匹配）
- **THEN** 返回失败应答且**不产生任何状态变化**、不发货

#### Scenario: 金额核对

- **WHEN** 回调解密后 `out_trade_no` 对应订单且 `amount.total` ≠ 订单 `amount_fen`
- **THEN** 订单转入 exception（金额不符冻结），记录审计事件，**绝不发货**，应答微信成功以止重试

#### Scenario: 支付成功幂等确认

- **WHEN** 回调解密后金额相符且交易状态为成功
- **THEN** 订单经 CAS 推进至发货（重复回调重放不产生第二次发货/第二行台账），应答 HTTP 200/204（官方 v3 规范：成功无需应答报文）

### Requirement: 回调缺失时查单兜底

系统保留主动查单路径：手动查单与 T1 超时扫描在微信侧确认支付成功时，推进与回调等价的发货流程（复用同一发货用例，天然幂等）。

#### Scenario: 回调未达但已付款

- **WHEN** 用户已付款但回调丢失/延迟，用户点击「我已支付」或超时扫描触发查单
- **THEN** 查单命中微信成功状态后完成发货，结果与回调路径一致

### Requirement: 关单

订单超时未支付关闭前必须先查单确认微信侧未支付，再调用微信关单；微信返回「订单已支付」（ORDERPAID）时转为复活发货路径而非关闭。

#### Scenario: 关单时发现已付

- **WHEN** T1 扫描对超时订单关单，微信返回已支付（或关单前查单已命中成功）
- **THEN** 订单不关闭，走复活发货（用户迟付不丢单）

### Requirement: 退款提交与结果跟进

退款经微信同笔原路退回：冷静期到点后以订单号作为退款单号提交微信；限频类失败（FREQUENCY_LIMITED 受理中）按官方建议以原退款单号间隔重试；账户余额不足（NOT_ENOUGH）不随时间自愈，转人工告警而非自动重试空转；退款结果以查询/回调为准推进订单至 refunded 并触发台账收回。

#### Scenario: 退款提交成功

- **WHEN** 冷静期到点提交且微信受理（PROCESSING/SUCCESS）
- **THEN** 订单进入 refund_processing，记录微信退款单号

#### Scenario: 退款到账确认

- **WHEN** 微信侧退款状态变为 SUCCESS（T3 查询或回调）
- **THEN** 订单转 refunded、权益收回、其他套餐不受影响；重复确认幂等

### Requirement: 对账账单下载

T4 日对账通过微信账单接口获取前一日支付与退款流水（两类账单分别申请下载），与内部账做三键比对（商户单号/交易单号/金额，金额字段单位为元须转分后比对）；下载文件经哈希校验完整性；下载失败重试后仍败记 error 并告警。

#### Scenario: 账单与内部账一致

- **WHEN** 拉取昨日支付与退款账单并与内部记录比对全部相符
- **THEN** 当日对账报告记 balanced

#### Scenario: 账单下载失败

- **WHEN** 账单接口连续重试后仍失败
- **THEN** 当日报告记 error 并经告警通道通知；历史日期可补跑重算

### Requirement: 网关注入与配置 fail-fast

服务启动按 `PAYMENTS_GATEWAY` 选择网关实现：`mock`（默认，含空串）装 Mock；`wxpay` 装 WechatPayGateway 且要求全部 `WXPAY_*` 配置齐备（`WXPAY_NOTIFY_URL` 须为 https 全路径、无查询参数、非本地/内网地址）；其他值或配置缺失拒绝启动。`PAYMENTS_GATEWAY=wxpay` 时 dev 注入端点（D1-D6）不注册。

#### Scenario: wxpay 配置齐备启动

- **WHEN** `PAYMENTS_GATEWAY=wxpay` 且商户号/证书序列号/私钥/APIv3 密钥/公钥/回调地址配置齐备且合规
- **THEN** 服务以真实网关启动，dev 注入端点不存在（404）

#### Scenario: wxpay 配置缺失拒绝启动

- **WHEN** `PAYMENTS_GATEWAY=wxpay` 但任一必需 `WXPAY_*` 配置缺失
- **THEN** 启动失败并明确报缺失项——绝不允许静默回落 Mock 处理真实付款

#### Scenario: 商户私钥文件校验

- **WHEN** 启动加载商户私钥文件
- **THEN** 私钥可解析且证书序列号与配置一致（不一致立即失败，防止错配商户）
