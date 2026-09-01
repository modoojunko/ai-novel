# s-pay-wechat-gateway 生产验收证据（1 分钱真实订单全链）

日期：2026-09-01 ｜ 验收人：用户（微信实付） ｜ 环境：生产 novel-s-server 079（wxpay 真网关）

## 验收单

- 订单号：`S20260901-767961286D578D72`
- SKU：pro_monthly（临时改价 1 分，验收后已复原 ¥30）
- 验收用户：`wxpay_prod_test`（rehearsal 白名单临时加入，已移出）
- 微信交易单号：`4500000349202609013893039654`
- 微信退款单号：`50301408612026090146498169456`

## 全链步骤（任务 5.1）

| # | 步骤 | 证据 |
|---|---|---|
| 1 | wxpay 模式启动 | dev 注入端点 `/api/dev/pay/inject-payment` 404（wxpay 下不注册） |
| 2 | 真调微信下单 | `code_url: weixin://wxpay/bizpayurl?pr=...`（真返回，非 mock 前缀） |
| 3 | 用户扫码实付 0.01 元 | 微信交易单号落 orders；paid_at 2026-09-01 11:47:34 UTC |
| 4 | 支付确认→发货 | 订单 fulfilled；trade_events 四事件（created/paid/granted/fulfilled）；台账行 pending_activation |
| 5 | 手动查单兜底 | `POST /orders/{no}/query` → `{"hit":true,"hint":"SUCCESS"}`（与回调双路径等价，本地演练已验回调路径） |
| 6 | 退款预览 | 「未激活，全额退」refund_fen=1 |
| 7 | 退款申请→冷静期 | refund_pending，300 秒 |
| 8 | 到点提交微信 | R1 扫描 `cooldown_submitted=1`；refund_processing |
| 9 | 原路退回到账 | 用户微信收到 0.01 元退款；订单 refunded；refund_status=succeeded；refund_wx_id 落库 |
| 10 | 台账收回（bf382c3 修复验证） | codes 行 status=revoked——退款后权益不可再激活，防白嫖断点在生产生效 |

## 异常场景（任务 5.2 部分）

- 冷静期内取消、NOT_ENOUGH、ABNORMAL 转人工：单测/契约测试覆盖；生产抽测回调延迟场景由查单兜底路径覆盖（步骤 5）
- T4 首日真实对账：待明日账单生成后补跑（账单次日 10 点后可取）

## 验收后状态复原

- pro_monthly 价格复原 3000 分；白名单移除 wxpay_prod_test（回到 rehearsal_demo）
- 购买开关保持 rehearsal（转 on 等用户拍板）

## 演练过程暴露并修复的缺陷（当日闭环）

1. **退款后台账未收回断点**（bf382c3）：complete_refund 注释称调用方 revoke 但无人调用——本地演练暴露，修复含协议/双后端/三调用方贯通+防回归断言，生产验收步骤 10 验证生效
2. **CI 部署 envParams 未进容器**：tcb `--force` 长期未刷新环境变量（云端停留 5 个旧键）——改走 MCP manageCloudRun 显式 EnvParams 部署（079 版生效 16 键）
3. **Dockerfile 漏拷 secrets/**（49138b9）：CI 生成的密钥文件未进镜像，wxpay 启动会 fail-fast
4. cron token 走 X-Cron-Token 头非 query 参数（端点设计正确，调用姿势坑）
