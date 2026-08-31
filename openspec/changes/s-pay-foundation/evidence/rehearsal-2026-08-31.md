# 8.2 生产 mock 全链演练记录（2026-08-31）

> 环境：ai-novel-test（生产 PG + CloudBase 云托管 novel-s-server / novel-s-web）
> 演练账号：`rehearsal_demo`（白名单内）；开关：`payments.purchase.enabled=rehearsal`
> 版本轨迹：052（CAS+datetime）→ 055（归一化动态段）→ 056（发货台账+激活）→ 057/058 CI（退款基准+naive 归一）
> 本地 tcb CLI / cloudbase MCP 凭证于演练中途过期，后续部署改走 GitHub Actions（workflow_dispatch 新增 ref 输入）。

## 演练链路（全部 code 0）

| # | 步骤 | 端点 | 结果 |
| --- | --- | --- | --- |
| A | 下单（包年 ¥299→8 折 ¥239.20 冻结） | POST /api/pay/orders | pending，code_url 生成 |
| B | 模拟支付+发货（D1） | /api/dev/pay/inject-payment | fulfilled（codes 台账行 pending_activation 落库） |
| C | 激活（两段式第二段） | POST /api/pay/grants/activate | grant_start=上单到期日顺延、expires=+365d |
| D | 套餐汇总 | GET /api/pay/membership | pro · 多单累计正确（736 天→三单 1101 天） |
| E | 退款预览 | GET …/refund-preview | **未激活全额退 ¥239.20**（PRD 口径） |
| F | 申请退款 | POST …/refund | refund_pending + 冷静期 300s |
| G | 冷静期取消 | POST …/refund/cancel | fulfilled 恢复（grant_restored） |
| H | 再次申请 | 同 F | 新冷静期 |
| I | 到点提交（R1 等价，D6） | /api/dev/pay/cron-run | cooldown_submitted=1 → refund_processing |
| J/K | 模拟退款成功（D3） | /api/dev/pay/inject-refund-result | refunded（重复调用幂等） |
| L | 终态 | GET …/orders/{no} | refunded，快照/协议/时间戳全量 |
| M | 对账（R4 等价） | cron-run 再跑 | reconcile skipped（mock 口径）+ 全程幂等 |
| N | 退款后权益 | membership | **其他两单不受影响**（仍 pro 1101 天）——退单只收回本单 |

## 演练排障修复（5 项，全部先本地复现→修复→部署→回归）

1. `get_pg_client` 未挂 CAS 扩展 + datetime 不可 JSON 序列化（下单 -1）
2. pending 复用分支 pg_http 行 created_at 为字符串（str+timedelta TypeError）
3. 路径归一化中间件不支持动态段（/orders/{order_no} 剥前缀形态 404）
4. **发货从未插入 codes 台账行**（注释称调用方完成但无人做）+ activate_entitlement 依赖不存在的仓储接口——补 create_from_order/find_by_order/find_active_by_user_id/activate_pending 四方法（双实现）+ 发货插行接线
5. 折算基准接台账行（未激活=全额退）+ aware/naive 混比归一（preview 500）

回归：后端 206/206 全绿（含新增两段式端到端测试）；S端 e2e 130/130。

## 待办（凭证恢复后）

- [ ] trade_events 事件流生产抽查（本地全链测试已断言事件序，生产落库由同一代码路径保证）
- [ ] pay-ops / pay-cron 云函数部署 + R1-R4 正式触发器注册（演练用 D6 cron-run 等价覆盖；CRON_TOKEN 需注入云托管 EnvParams）
- [ ] SERVERCHAN_SENDKEY 注入（告警通道当前降级为日志）
