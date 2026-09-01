# s-pay-wechat-gateway（Change 2：微信支付真实对接）

## Why

Change 1（s-pay-foundation）已上线：订单状态机、台账、退款冷静期、补偿扫描、对账管道全部就绪并经生产 mock 演练 14 步验证，但支付网关仍是 Mock 占位——用户无法真实付款。微信支付商户号已开通（mch_id 1749993584，Native 权限，AppID wx41899938fa14c26d 已绑定，APIv3 证书/密钥/公钥齐备），现在把 Mock 替换为真实 WechatPayGateway，打通收款闭环。

## What Changes

- 新增 `WechatPayGateway`：实现既有 `PaymentGateway` 协议全部 6 方法（Native 下单 / 查单 / 关单 / 退款 / 退款查询 / 账单下载），微信支付 APIv3 签名（商户私钥）+ 应答验签（微信支付公钥模式，PUB_KEY_ID 校验）
- 新增回调端点 `POST /api/pay/notify`（无登录态）：验签 → AES-256-GCM 解密（APIv3 密钥）→ 金额核对（不平转 exception 冻结，绝不发货）→ 幂等转状态机（paid/退款成功）→ 应答微信规范 JSON；验签失败/异常应答让微信重试
- **网关注入接线**：startup 按 `PAYMENTS_GATEWAY` 选择实现——mock→MockPaymentGateway（现状不变）；wxpay→WechatPayGateway（此前 fail-fast 占位替换为真实实现）；其他值维持 fail-fast 拒绝启动
- 配置项新增：`WXPAY_MCH_ID` / `WXPAY_APPID` / `WXPAY_CERT_SERIAL` / `WXPAY_PRIVATE_KEY_PATH` / `WXPAY_APIV3_KEY` / `WXPAY_PUB_KEY_ID` / `WXPAY_PUB_KEY_PATH` / `WXPAY_NOTIFY_URL`（全部走环境变量/CI secrets，不入库）
- 下单 `create_payment` 接线真实 `notify_url`（`WXPAY_NOTIFY_URL`，形如 `https://www.awesomenovel.com/api/pay/notify`）
- **不改动**：订单状态机、台账、退款冷静期、补偿扫描、对账管道——Mock 演练已验证的编排逻辑原样复用；CI 的 envParams 同步补 `WXPAY_*` secrets 键（防止部署覆盖漂移）

**BREAKING**（运维语义）：生产设 `PAYMENTS_GATEWAY=wxpay` 后，dev 注入端点（D1-D6）自动消失，支付验证改走真实回调/查单——演练期依赖 D1 的操作方式随之结束。

## Capabilities

- **New Capabilities**: `wechat-pay-gateway`（微信支付网关对接：签名/验签/下单/退款/账单 + 回调端点 + 网关注入切换）

## Impact

- 代码：`server/app/infrastructure/payments/`（新增 wechatpay.py + 依赖库）、`server/app/main.py`（注入分支）、`server/app/interfaces/web_api/notify.py`（新回调路由）、`server/app/config.py`（WXPAY_* 配置）、`.github/workflows/s-server-deploy.yml`（envParams 补键）
- 测试：签名/验签/解密单测（固定向量）、回调端点契约测试（金额平/不平/重放/验签失败）、gateway 契约测试（与 Mock 同矩阵跑 FakeServer）
- 运维：GitHub Secrets 新增 `WXPAY_*` 五项；验收走 1 分钱真实订单全链（runbook §四）
- 风险：真实资金操作——验收期保持 `rehearsal` 白名单，1 分钱单通过后才转 `on`
