# s-pay-wechat-gateway 任务清单

## 1. 依赖与配置地基

- [ ] 1.1 引入 `wechatpayv3` SDK（锁版本入 requirements.txt）；config 新增 `WXPAY_MCH_ID/WXPAY_APPID/WXPAY_CERT_SERIAL/WXPAY_PRIVATE_KEY_PATH/WXPAY_APIV3_KEY/WXPAY_PUB_KEY_ID/WXPAY_PUB_KEY_PATH/WXPAY_NOTIFY_URL` 八配置。验证：config 单测覆盖缺省值与空串语义
- [ ] 1.2 main.py 网关注入三分支落地（mock/wxpay/未知 fail-fast；wxpay 缺配置列出缺失项拒绝启动；私钥文件读取+解析校验）。验证：启动单测三分支

## 2. WechatPayGateway 适配层

- [ ] 2.1 实现 create_payment（Native 下单）/query_payment/close_payment 归一化（含 already_paid 语义）。验证：httpx MockTransport 契约测试
- [ ] 2.2 实现 create_refund/query_refund（NOT_ENOUGH/ABNORMAL 归一）。验证：契约测试三态
- [ ] 2.3 实现 download_bill（CSV `^` 分隔解析→BillLine，支付+退款行）。验证：固定样例账单解析单测
- [ ] 2.4 错误归一层 `_map_error`：SDK 异常→领域结果，不穿透应用层。验证：异常注入测试

## 3. 回调端点

- [ ] 3.1 `POST /api/pay/notify`：验签→解密→路由（payment/refund 资源类型）。验证：自构造 RSA 密钥对签名三态单测（正/篡改/错公钥）
- [ ] 3.2 金额核对与状态机：金额平→fulfill_payment（幂等）；不平→exception+事件+告警；订单不存在/终态应答 SUCCESS 止重试。验证：端到端 sqlite 测试四场景
- [ ] 3.3 退款回调接 complete_refund（幂等）；限流中间件白名单 notify 端点。验证：重复回调重放测试

## 4. 接线与运维

- [ ] 4.1 下单接真实 notify_url（WXPAY_NOTIFY_URL）；手动查单/T1 扫描与回调路径行为一致性核对。验证：伪代码对照走查
- [ ] 4.2 CI workflow envParams 补 `WXPAY_*` 八键（secrets 注入+私钥/公钥写文件逻辑）；GitHub Secrets 配置清单交付（键名+指引）。验证：CI dispatch 干跑构建成功
- [ ] 4.3 WechatPayGateway 单测矩阵与 Mock 同套契约跑通；SDK 异常穿透扫描（应用层零裸异常）。验证：pytest 全量绿

## 5. 验收（真实资金，rehearsal 白名单内）

- [ ] 5.1 1 分钱真实订单全链：下单→真扫码→回调→发货→激活→退款原路退回；商户平台账单 vs trade_events 人工核对
- [ ] 5.2 T4 首日真实对账跑通（balanced）；异常场景抽测（0.01 元退款到账时效、回调延迟场景查单兜底）
- [ ] 5.3 验收证据入 change 目录；开关转 `on` 决策与操作待用户拍板

## 6. 收尾

- [ ] 6.1 全套门禁：后端 pytest 全量 + S端 e2e + tsc/vue-tsc（前端无改动则复述基线）；openspec validate 全绿
- [ ] 6.2 归档流程（sync specs→PR→归档；勿 git add openspec/ 整目录）
