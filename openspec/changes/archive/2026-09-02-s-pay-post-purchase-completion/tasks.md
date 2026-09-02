## 1. 后端契约（订单详情 + membership）

- [x] 1.1 订单详情 DTO 补字段（`_order_to_detail` 增 fulfilled_at/refund_requested_at/grant，get_order 经 find_by_order 取台账快照，order_id 空不兜底查询）——代码已先行落地（架构师评审后复核口径），本任务收尾：payments 契约测试补 pending 单 grant=null+时间列空串、已退款单三字段有值+grant=revoked、激活后 grant=active——`venv pytest tests/test_payments_api.py` 绿
- [x] 1.2 `get_membership` 重写：复用 `find_all_by_username` 后过滤 `source='order'` + 一批 orders in 查询映射 order_no，返回追加 `grants[]`（code_id/order_no/tier/duration_days/status/activated_at/expires_at/grant_start）与真实 `pending_count`（待激活行计数）；契约测试补：待激活行在 grants、revoked 行在 grants、unused 手工码不出现在 grants、pending_count 与行数一致——pytest 绿
- [x] 1.3 codes 写入显式 created_at：`pg_http/code_repo` `create()`/`create_from_order()` 与 `sql/code_repo` 同路径传 naive UTC；契约测试主断言「发货行 created_at 与订单 paid_at 秒级同口径（<60s）」——pytest 绿

## 2. 前端订单时间线（OrderDetailPage）

- [x] 2.1 `api/pay.ts` 扩 `OrderDetail` 类型（fulfilled_at/refund_requested_at/grant）；steps 重写：到货行当且仅当 fulfilled_at 非空显示（半截发货态不显示实际时间，不以 paid_at 冒充）+ 按 grant.status 折标注（待激活，未计时 / 已激活，计时中·剩余 X 天 / 已收回）；「申请退款」行带 refund_requested_at（有 refund_amount_fen 时带折算文案）；进行中环节预计时间（等待支付=由 remaining_pay_seconds 派生过期时刻、退款确认=cooldown_ends_at、退回中=预计 3 天内文案）；`npm run build`（vue-tsc）绿
- [x] 2.2 e2e：`e2e/mocks/api-handlers.ts` 订单详情 mock 补新字段，`order-detail.spec.ts` 增场景（已退款单到货时间可见且非 —、待激活标注、申请退款行），并验存量场景不红——本地 playwright 全量绿

## 3. 前端我的套餐（MembershipPage + 激活入口）

- [x] 3.1 `api/pay.ts` 扩 `MembershipView`（grants[]/pending_count，读取侧 `grants ?? []` 守卫旧后端）；MembershipPage 渲染：明细列表三态行（生效中 ok / 待激活 warn / 已收回 tag 灰显无操作，档位名补 lifetime→「永久」）、页头待激活数、空态判定改为三态皆无——`npm run build` 绿
- [x] 3.2 待激活区块+激活入口：行内「激活」按钮 → AppModal 确认族弹层（激活即开始计时/此后退款按已使用时长折算两条后果文案，按钮「确认激活」/「再想想」）→ `apiPayActivate(order_no)` → 成功 toast（ok）+reload；错误按附录 Z 约定的 msg 枚举映射文案+「联系客服」出口；e2e 增场景（dashboard-home 或新 spec：待激活行可见→确认→行转生效中；不可激活错误出路）——本地 playwright 全量绿

## 4. 文档与验收

- [x] 4.1 `docs/prd/backend-detail-design.md` 附录 Z 增量：OrderDetailView 三字段+grant、MembershipView.grants 结构、激活不可激活类错误以 msg 枚举对齐（not_fulfilled/code_not_found/NotActivatable）与前端映射；核对无内部术语入用户可见文案（§13 口径自查）
- [x] 4.2 渲染截图对照（订单详情退款态/待激活态、我的套餐三态）入 change 目录；`npm run design:lint` 双端绿（未触共享段，cross 免跑）；全量 pytest + 本机全量 e2e 终验后按 #202 起流程走 PR 合并部署，线上以 09-02 演练单 S20260902-1E2B7B837401A54B 复核时间线，用待激活演练单验证激活入口
