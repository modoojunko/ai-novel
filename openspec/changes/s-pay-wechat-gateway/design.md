# s-pay-wechat-gateway 设计

## 1. 依赖与签名方案

**社区 SDK vs 自实现**：采用社区 SDK `wechatpayv3`（minibear2021/wechatpayv3，pip 依赖，MIT；微信开发者社区推荐，**非微信支付官方出品**——官方无同名 Python SDK）。理由：APIv3 签名（RSA-SHA256）、回调验签、AES-256-GCM 解密、公钥轮换均为安全敏感样板，自实现易错且无收益；该 SDK 覆盖 Native 下单/查单/关单/退款/账单全接口并内建回调验签解密工具，且支持公钥模式初始化（public_key/public_key_id）。锁版本入 `requirements.txt`；接入前过一遍所选版本的供应链审计（PyPI 发布记录 + 依赖树）。

**微信支付公钥模式**（2024 后新商户默认，非平台证书模式）：商户平台已签发公钥（`wxpay_pub_key.pem` + `PUB_KEY_ID_0117…403`），SDK 初始化传公钥对，避免平台证书下载与轮换逻辑。

**私钥加载**：`WXPAY_PRIVATE_KEY_PATH` 指向挂载文件（容器内路径），启动时 `load_pem_private_key` 校验可解析；证书序列号与私钥配对性用「私钥对任意消息签名→公钥（从序列号对应商户证书提取）验签」的启动自检兜底（简化：序列号与私钥文件分离校验 + 首笔下单失败即暴露错配，PR 验收含 1 分钱单）。

## 2. WechatPayGateway 适配层

`infrastructure/payments/wechatpay.py`：`WechatPayGateway` 持有 SDK client，实现既有 6 方法协议，返回**归一化 dataclass**（与 Mock/Protocol 同形）——上层编排零改动：

| 协议方法 | 微信 API | 归一化要点 |
| --- | --- | --- |
| create_payment | POST /v3/pay/transactions/native | 请求带 `time_expire`（RFC3339）与本地 15 分钟 TTL 对齐——微信侧原生截断支付窗口，消除「本地已过期、关单未执行前用户仍可付款」竞态；`code_url` 直传；业务错误（NO_AUTH/参数错）→ `PaymentResult(success=False, error_kind=…)`；超时 → prepay failed |
| query_payment | GET /v3/pay/transactions/out-trade-no | trade_state 归一：SUCCESS→SUCCESS、NOTPAY→NOTPAY、CLOSED→CLOSED、REFUND→REFUND（转入退款，显式归一防对账误判 UNKNOWN）、REVOKED/PAYERROR→PAYERROR、其他→UNKNOWN；带回 transaction_id/payer_openid |
| close_payment | POST …/close | **先查单确认未付再关单**（官方建议，查询接口使用时机明文「调用关单或撤销接口之前，需确认支付状态」）；关单成功→success；**403 `ORDERPAID`（订单已支付，无法关闭）→ already_paid=True**（官方原话「请当作已支付的正常交易」）；**订单已关闭类返回（V2 ORDERCLOSED，V3 同语义）→ 幂等成功**，重试场景不告警。边界：**下单后 5 分钟内不可关单**（官方最短间隔）——TTL 15 分钟天然满足，若未来调短 TTL 必须保持 ≥5min；RESOURCE_EXISTS 不是关单错误码 |
| create_refund | POST /v3/refund/domestic/refunds | SUCCESS/PROCESSING→**受理**（受理≠成功，结果以查询/回调推进）；带 wx_refund_id。错误分类：`NOT_ENOUGH`（账户余额不足，不自愈）→转人工告警、T3 不自动重试空转；`FREQUENCY_LIMITED`（受理中）与 `ORDER_NOT_READY`（订单处理中）→按官方建议**原退款单号**间隔重试（勿换单号）；`USER_ACCOUNT_ABNORMAL`（用户账号注销）→转人工告警；其余资金类错误同转告警 |
| query_refund | GET /v3/refund/domestic/refunds/{no} | 状态归一到 RefundStatus（SUCCESS/PROCESSING/CLOSED/ABNORMAL 四态全覆盖） |
| download_bill | GET /v3/bill/tradebill（**单数**）→ download_url → GET 下载 | **两张账单分下**：`bill_type=ALL`（支付流水）+ `bill_type=REFUND`（退款流水）——退款明细不混在 ALL 里；CSV **逗号分隔**、每字段前置 `` ` `` 反引号（防科学计数法，解析时剥掉）；**金额列单位为元（2 位小数）→ 归一时 ×100 转分**；download_url 仅 **5 分钟有效**需即取即下；下载后 SHA1 与申请接口返回的 hash_digest 比对（官方建议，防传输损坏）；账单次日 10 点后生成、仅近三个月可取 |

错误语义集中在一个 `_map_error` 归一层，SDK 异常（HTTP 状态/微信 code）→ 领域可消化的结果对象——**不让 SDK 异常穿透进应用层**。批量扫描（T1/T3）对微信侧调用加限速与退避：下单/关单 429 即退避重试；退款申请成功后限频宽松（150QPS）但失败仅 6QPS，退款查询官方建议「间隔 1 分钟起步、超 5 分钟逐步衰减」——T3 遵此节奏。币种全程 CNY only（amount.currency 固定 CNY；对账时校验账单币种列）。

### 2.1 前端二维码本地渲染（安全红线）

`code_url` 即支付凭证，**禁止交给任何第三方服务生成二维码**。现状 CashierPage 把 code_url 拼进 `api.qrserver.com` 的图片 URL——等于把支付指令发给第三方（可被记录/关联，返回图片可被篡改换码）。本 change 一并改为本地渲染：前端引入 `qrcode`（npm）绘制 canvas，删除 qrserver 外呼。此为 P1 验收项。

## 3. 回调端点

`interfaces/web_api/notify.py`：`POST /api/pay/notify`（无登录态、免前缀归一化——路径含 /api 直接命中）。流程：

1. `WechatPayGateway.verify_notify(headers, body)` → SDK 验签（公钥模式）+ 解密 resource → 按 `event_type` 分流：`TRANSACTION.SUCCESS` 解出 `(out_trade_no, transaction_id, trade_state, amount_total, payer_openid)`；`REFUND.*` 解出 `(out_refund_no, refund_id, refund_status, amount.refund)`——两类回调 resource 字段结构不同，各自归一，不共用解密出参
2. 验签失败 → HTTP 401 + `{"code":"FAIL","message":"…"}`（微信会重试）；解析失败 → HTTP 400。**签名以 `WECHATPAY/SIGNTEST/` 开头的是微信官方验签探测流量**：同样按验签失败拒绝，但豁免告警（否则每天误报刷屏）
3. 金额核对：`amount_total != order.amount_fen` → CAS pending→exception + `order.exception` 事件 + 告警，仍应答成功（止重试，钱在微信侧人工处置）。核对只用 `amount.total`，**绝不用 `payer_total`**（用户用券实付小于订单金额，属正常差异）
4. 状态 SUCCESS → 复用 `fulfill_payment`（幂等，重放安全）
5. 订单不存在/终态 → 也应答成功（防微信无限重试已终结单）
6. 退款结果回调（REFUND.SUCCESS/ABNORMAL/CLOSED）→ 转发 T3 同款 `complete_refund` 幂等推进（退款回调发往申请退款时的 notify_url，与支付回调同端点复用）

**应答规范（官方 v3 口径，与 V2 不同）**：处理成功只要求 **HTTP 200 或 204，无需应答报文**；仅失败时返回 4xx/5xx + `{"code":"FAIL","message":"…"}`。`{"code":"SUCCESS"}` 是 V2 语义，禁用。**5 秒应答预算**（官方要求）：本地链路（验签→解密→CAS→发货写库）为毫秒级同步处理，预算内天然满足；若本地处理超出预算，仍须先应答止重试，状态 advancement 由查单兜底路径（T1/手动查单）补齐——不得为等业务处理而让微信重试。

限流中间件白名单：notify 端点不限流（微信回调来源 IP 集中，且验签已是门）。

## 4. 注入与配置

`main.py` startup 三分支：mock→Mock（现状）；wxpay→构造 WechatPayGateway（`WXPAY_*` 缺一即 RuntimeError 列出缺失项；私钥文件读取+解析校验；`WXPAY_NOTIFY_URL` 校验为 https 全路径、无查询参数、非 localhost/内网地址——官方硬性要求，外网不可达则首笔回调全丢）；未知值→RuntimeError。`PAYMENTS_GATEWAY` 空串回落 mock（既有语义）。

配置全部环境变量（config.py），CI workflow envParams 补 `WXPAY_MCH_ID/WXPAY_APPID/WXPAY_CERT_SERIAL/WXPAY_PRIVATE_KEY_PATH/WXPAY_APIV3_KEY/WXPAY_PUB_KEY_ID/WXPAY_PUB_KEY_PATH/WXPAY_NOTIFY_URL` 八键（secrets 注入，未配空串时 wxpay 模式启动即 fail-fast——安全缺省）。私钥/公钥文件经 CI 生成为部署包内文件（secrets 值写文件，路径入 env）。

## 5. 测试策略

- **单测（固定向量，离线）**：回调验签（自构造 RSA 密钥对模拟微信签名，正/篡改/错公钥三态）、GCM 解密（正确/错 key）、金额不平→exception、重放幂等
- **契约**：WechatPayGateway 对 httpx MockTransport 跑与 Mock 同矩阵（下单成功/拒单/查单五态/关单已付/退款三态/账单解析）
- **端到端（sqlite）**：回调→发货→激活→退款回调全链（替换 D1 依赖）
- **验收（生产）**：rehearsal 白名单 + 1 分钱真实订单走 runbook 全链（含原路退回、商户平台账单 vs trade_events 人工核对、T4 首日真实对账）

## 6. 风险与边界

- **金额单位**：全链「分」；回调 `amount.total` 与订单 `amount_fen` 强一致校验是资金安全最后闸门（永不用 `payer_total` 核对——用券实付小于订单金额属正常）
- **回调重试风暴**：微信 15s/15s/30s/3m/10m/20m/30m/30m/30m/60m/3h/3h/3h/6h/6h 共 15 次衰减重试；所有路径按官方 v3 应答规范止重试（成功 200/204 无报文，失败 4xx/5xx+FAIL body）
- **验签密钥轮换**：微信支付公钥有 ID 头校验（Wechatpay-Serial），ID 不匹配的回调按未验签拒绝——SDK 内建，轮换期新 ID 需更新 `WXPAY_PUB_KEY_ID`（运维 SOP）；APIv3 密钥同为敏感凭据，录入 GitHub Secrets（不落仓库/不贴聊天），按微信侧轮换节奏同步更新
- **时钟**：回调解密后以本地状态机为准，不信任报文时间字段
- **探测噪声**：`WECHATPAY/SIGNTEST/` 前缀签名为微信官方验签探测，拒绝但豁免告警
- **关单时序**：下单后 5 分钟内微信拒绝关单（官方最短间隔）——本地 TTL（15 分钟）与 T1 扫描周期不得低于该值；重复关单/已关闭订单再关单为幂等操作，不告警
- **官方合规**：notify_url 须 https 外网可达全路径且无查询参数；回调应答预算 5 秒；接口限频（下单/关单 429 退避、退款失败仅 6QPS、退款查询 1 分钟起步衰减）；账单仅近三个月、次日 10 点后生成
- **退款运维**：商户平台「退款 IP 白名单」保持**关闭**（云托管出口 IP 动态，开启即全拒；报 `NOAUTH` 异常 IP 先查此开关）；V3 退款无需 V2 那种双向证书，复用商户私钥签名
