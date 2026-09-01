# s-pay-wechat-gateway 设计

## 1. 依赖与签名方案

**官方 SDK vs 自实现**：采用微信支付官方 Python SDK `wechatpayv3`（pip 依赖，MIT）。理由：APIv3 签名（RSA-SHA256）、回调验签、AES-256-GCM 解密、平台证书/公钥轮换均为安全敏感样板，自实现易错且无收益；SDK 已覆盖 Native 下单/查单/关单/退款/账单全接口并内建回调验签解密工具。锁版本入 `requirements.txt`。

**微信支付公钥模式**（2024 后新商户默认，非平台证书模式）：商户平台已签发公钥（`wxpay_pub_key.pem` + `PUB_KEY_ID_0117…403`），SDK 初始化传公钥对，避免平台证书下载与轮换逻辑。

**私钥加载**：`WXPAY_PRIVATE_KEY_PATH` 指向挂载文件（容器内路径），启动时 `load_pem_private_key` 校验可解析；证书序列号与私钥配对性用「私钥对任意消息签名→公钥（从序列号对应商户证书提取）验签」的启动自检兜底（简化：序列号与私钥文件分离校验 + 首笔下单失败即暴露错配，PR 验收含 1 分钱单）。

## 2. WechatPayGateway 适配层

`infrastructure/payments/wechatpay.py`：`WechatPayGateway` 持有 SDK client，实现既有 6 方法协议，返回**归一化 dataclass**（与 Mock/Protocol 同形）——上层编排零改动：

| 协议方法 | 微信 API | 归一化要点 |
| --- | --- | --- |
| create_payment | POST /v3/pay/transactions/native | `code_url` 直传；业务错误（NO_AUTH/参数错）→ `PaymentResult(success=False, error_kind=…)`；超时 → prepay failed |
| query_payment | GET /v3/pay/transactions/out-trade-no | trade_state 归一：SUCCESS→SUCCESS、NOTPAY→NOTPAY、CLOSED→CLOSED、REVOKED/PAYERROR→PAYERROR、其他→UNKNOWN；带回 transaction_id/payer_openid |
| close_payment | POST …/close | 成功→success；订单已支付（RESOURCE_EXISTS/ORDER_CLOSED 冲突语义）→ already_paid=True |
| create_refund | POST /v3/refund/domestic/refunds | SUCCESS/PROCESSING→受理；NOT_ENOUGH→NOT_ENOUGH；带 wx_refund_id |
| query_refund | GET /v3/refund/domestic/refunds/{no} | 状态归一到 RefundStatus |
| download_bill | GET /v3/bill/trade-bills + 下载 URL | 解析 CSV（`^` 分隔，含表头行），归一 BillLine(out_trade_no/transaction_id/金额/状态/时间)；退款单走 trade-bills 的退款行（bill_fee 口径 C9 不冲减） |

错误语义集中在一个 `_map_error` 归一层，SDK 异常（HTTP 状态/微信 code）→ 领域可消化的结果对象——**不让 SDK 异常穿透进应用层**。

## 3. 回调端点

`interfaces/web_api/notify.py`：`POST /api/pay/notify`（无登录态、免前缀归一化——路径含 /api 直接命中）。流程：

1. `WechatPayGateway.verify_notify(headers, body)` → SDK 验签（公钥模式）+ 解密 resource → `(out_trade_no, transaction_id, trade_state, amount_total, payer_openid)` 或验证失败
2. 验签失败 → HTTP 401（微信会重试）；解析失败 → HTTP 400
3. 金额核对：`amount_total != order.amount_fen` → CAS pending→exception + `order.exception` 事件 + 告警，仍应答 SUCCESS（止重试，钱在微信侧人工处置）
4. 状态 SUCCESS → 复用 `fulfill_payment`（幂等，重放安全）→ 应答 SUCCESS
5. 订单不存在/终态 → 也应答 SUCCESS（防微信无限重试已终结单）
6. 退款结果回调（`refund` resource 类型）→ 转发 T3 同款 `complete_refund` 幂等推进

限流中间件白名单：notify 端点不限流（微信回调来源 IP 集中，且验签已是门）。

## 4. 注入与配置

`main.py` startup 三分支：mock→Mock（现状）；wxpay→构造 WechatPayGateway（`WXPAY_*` 缺一即 RuntimeError 列出缺失项；私钥文件读取+解析校验）；未知值→RuntimeError。`PAYMENTS_GATEWAY` 空串回落 mock（既有语义）。

配置全部环境变量（config.py），CI workflow envParams 补 `WXPAY_MCH_ID/WXPAY_APPID/WXPAY_CERT_SERIAL/WXPAY_PRIVATE_KEY_PATH/WXPAY_APIV3_KEY/WXPAY_PUB_KEY_ID/WXPAY_PUB_KEY_PATH/WXPAY_NOTIFY_URL` 八键（secrets 注入，未配空串时 wxpay 模式启动即 fail-fast——安全缺省）。私钥/公钥文件经 CI 生成为部署包内文件（secrets 值写文件，路径入 env）。

## 5. 测试策略

- **单测（固定向量，离线）**：回调验签（自构造 RSA 密钥对模拟微信签名，正/篡改/错公钥三态）、GCM 解密（正确/错 key）、金额不平→exception、重放幂等
- **契约**：WechatPayGateway 对 httpx MockTransport 跑与 Mock 同矩阵（下单成功/拒单/查单五态/关单已付/退款三态/账单解析）
- **端到端（sqlite）**：回调→发货→激活→退款回调全链（替换 D1 依赖）
- **验收（生产）**：rehearsal 白名单 + 1 分钱真实订单走 runbook 全链（含原路退回、商户平台账单 vs trade_events 人工核对、T4 首日真实对账）

## 6. 风险与边界

- **金额单位**：全链「分」；回调 `amount.total` 与订单 `amount_fen` 强一致校验是资金安全最后闸门
- **回调重试风暴**：微信 15s/15s/30s…衰减重试；所有路径应答规范 JSON 止重试
- **验签密钥轮换**：微信支付公钥有 ID 头校验（Wechatpay-Serial），ID 不匹配的回调按未验签拒绝——SDK 内建，轮换期新 ID 需更新 `WXPAY_PUB_KEY_ID`（运维 SOP）
- **时钟**：回调解密后以本地状态机为准，不信任报文时间字段
