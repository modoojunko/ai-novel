# s-pay-wechat-gateway 任务清单

## 1. 依赖与配置地基

- [x] 1.1 引入 `wechatpayv3` 社区 SDK（锁版本入 requirements.txt；接入前核实所选版本支持公钥模式 public_key/public_key_id 初始化 + PyPI 发布记录与依赖树供应链审计）；config 新增 `WXPAY_MCH_ID/WXPAY_APPID/WXPAY_CERT_SERIAL/WXPAY_PRIVATE_KEY_PATH/WXPAY_APIV3_KEY/WXPAY_PUB_KEY_ID/WXPAY_PUB_KEY_PATH/WXPAY_NOTIFY_URL` 八配置。验证：config 单测覆盖缺省值与空串语义
- [x] 1.2 main.py 网关注入三分支落地（mock/wxpay/未知 fail-fast；wxpay 缺配置列出缺失项拒绝启动；私钥文件读取+解析校验；WXPAY_NOTIFY_URL 校验 https 全路径/无 query/非内网）。验证：启动单测三分支+notify_url 非法值拒绝

## 2. WechatPayGateway 适配层

- [x] 2.1 实现 create_payment（Native 下单，带 time_expire 对齐本地 TTL）/query_payment（含 REFUND 显式归一）/close_payment（先查单确认未付再关单；403 ORDERPAID→already_paid；已关闭类返回→幂等成功不告警；TTL≥关单最短间隔 5min）。验证：httpx MockTransport 契约测试
- [x] 2.2 实现 create_refund（请求带 notify_url 开通退款回调）/query_refund 归一：NOT_ENOUGH（账户余额不足）/USER_ACCOUNT_ABNORMAL（用户注销）→转告警不自动重试；FREQUENCY_LIMITED（受理中）/ORDER_NOT_READY（处理中）→原退款单号间隔重试；RefundStatus 四态全覆盖。验证：契约测试错误分类
- [x] 2.3 实现 download_bill：tradebill 接口 bill_type=ALL 与 REFUND 两张分下；CSV 逗号分隔+剥反引号前缀；金额元→分换算；download_url 5 分钟时效即取即下；SHA1 与 hash_digest 比对。验证：固定样例账单解析单测（含退款账单与元转分）
- [x] 2.4 错误归一层 `_map_error`：SDK 异常→领域结果，不穿透应用层；批量扫描限速退避参数（退款失败 6QPS 口径）。验证：异常注入测试

## 3. 回调端点

- [x] 3.1 `POST /api/pay/notify`：验签→解密→按 event_type 分流（TRANSACTION.*/REFUND.* 字段结构各自归一）；应答规范=成功 200/204 无报文、失败 4xx/5xx+FAIL body；`WECHATPAY/SIGNTEST/` 探测签名按拒绝处理且豁免告警。验证：自构造 RSA 密钥对签名三态单测（正/篡改/错公钥）+SIGNTEST 样例
- [x] 3.2 金额核对与状态机：金额平（仅比对 amount.total，永不用 payer_total）→fulfill_payment（幂等）；不平→exception+事件+告警；订单不存在/终态应答成功止重试。验证：端到端 sqlite 测试四场景
- [x] 3.3 退款回调（REFUND.SUCCESS/ABNORMAL/CLOSED）接 complete_refund（幂等）；限流中间件白名单 notify 端点。验证：重复回调重放测试

## 4. 接线与运维

- [x] 4.1 下单接真实 notify_url（WXPAY_NOTIFY_URL）；手动查单/T1 扫描与回调路径行为一致性核对。验证：伪代码对照走查
- [x] 4.2 CI workflow envParams 补 `WXPAY_*` 八键（secrets 注入+私钥/公钥写文件逻辑）；GitHub Secrets 配置清单交付（键名+指引）。验证：CI dispatch 干跑构建成功
- [x] 4.3 WechatPayGateway 单测矩阵与 Mock 同套契约跑通；SDK 异常穿透扫描（应用层零裸异常）。验证：pytest 全量绿
- [x] 4.4 前端二维码本地渲染：CashierPage 引入 `qrcode`（npm）canvas 绘制，删除 api.qrserver.com 外呼（code_url 支付凭证不外泄，P1 安全项）。验证：grep 无 qrserver 残留；e2e 收银台二维码仍渲染（mock code_url）

## 5. 验收（真实资金，rehearsal 白名单内）

- [x] 5.1 1 分钱真实订单全链：下单→真扫码→回调→发货→激活→退款原路退回；商户平台账单 vs trade_events 人工核对（证据：evidence/prod-acceptance-2026-09-01.md；订单 S20260901-767961286D578D72，本地演练+生产验收双过）
- [ ] 5.2 T4 首日真实对账跑通（balanced）；异常场景抽测（0.01 元退款到账时效✓、回调延迟场景查单兜底✓）——待明日账单生成后补跑对账
- [x] 5.3 验收证据入 change 目录；开关转 `on` 决策与操作待用户拍板

## 6. 收尾

- [x] 6.1 全套门禁：后端 pytest 全量（258 绿）+ S端 e2e（130 绿）+ tsc/vue-tsc（4.4 前端改动含在内）；openspec validate 全绿
- [ ] 6.2 归档流程（sync specs→PR→归档；勿 git add openspec/ 整目录）
