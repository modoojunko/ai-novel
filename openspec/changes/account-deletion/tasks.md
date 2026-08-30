# Tasks: account-deletion（账号自助注销）

## 1. 双端影响判定（原型先行替代）

- [x] 1.1 双端影响判定：本 change 界面改动限于 S 端控制台（注销向导弹层三态、撤销期提示条）+ C 端既有登录屏回跳（无像素变化）；仅消费既有 .panel/.pill/.notice/.btn/.mcard 词汇，不触碰两端共享段（base.css 令牌与基础类零改动）——依据 proposal「Design Impact」判定（S 端纯自有改动免原型先行、C 端无界面变化）。判定结论记入本 change 目录；截图对照在 4.3 补入。验证：判定记录存在，结论与 Design Impact 一致，且确认无需 design-cross。

## 2. 数据迁移（alembic 本地生成 + MCP applyMigration）

- [x] 2.1 本地生成 alembic 迁移：`users` 新增 `deletion_status`（正常/注销撤销期/已注销，中文枚举沿 codes 风格）、`deletion_requested_at`、`deletion_deadline` 三字段（口径见 design D1）。验证：本地 `alembic upgrade head` 后字段存在，`alembic downgrade -1` 往返无损。
- [ ] 2.2 通过 MCP applyMigration 将迁移应用到 CloudBase PG 生产/开发环境。验证：applyMigration 返回成功，查询 `users` 表结构确认三字段就位。

## 3. S 端后端：注销 API（单语句 CAS + 幂等，见 design D1–D3）

- [x] 3.1 注销状态查询端点：返回 是否已申请注销/剩余撤销天数/到期执行时刻。验证：pytest（全 mock）覆盖 正常/撤销期/已注销 三态返回。
- [x] 3.2 注销申请端点：服务端复验权益状态（存在 待激活/排队中/消耗中 且未处置 → 拒绝受理，见 design D4）、密码校验、CAS 写入撤销期（`WHERE deletion_status='正常'`）。验证：pytest 覆盖 权益阻塞/密码错误/成功受理/重复提交幂等（第二次返回 0 行受影响不报错）。
- [x] 3.3 撤销端点：密码验证 + 单语句 CAS（`WHERE deletion_status='注销撤销期' AND now()<deletion_deadline`），撤销成功即恢复账号。验证：pytest 覆盖 成功恢复/已到期 CAS 失败/密码错误。
- [x] 3.4 到期执行器：按 design D2 五步幂等序列实现（CAS 标记已注销 → 去标识化 username/password_hash → device_grants/device_registry 删除 → codes 待处置行置已回收 → trade_events 审计追加），挂接认证/check-auth 链路的惰性触发。验证：pytest mock 断言每步为幂等单语句（同一输入重放安全），orders/trade_events/refunds 交易数据零写操作。
- [x] 3.5 补偿扫描兜底：周期扫描 `deletion_status='注销撤销期' AND deletion_deadline<=now()` 并重放 3.4 同一序列，配置云托管定时触发器。验证：pytest mock 扫描查询与重入安全；触发器配置可查。
- [x] 3.6 认证链路注销状态检查：`已注销` 拒绝一切认证；`注销撤销期` 拒绝正常登录并返回结构化状态（剩余天数）供 S 端撤销页消费（见 design D3）。验证：pytest 覆盖三态的认证与业务接口拒绝行为。

## 4. S 端前端：控制台注销向导

- [x] 4.1 账号安全入口 + 注销向导弹层（后果告知 info → 权益处置（「去退款」出口 / 「放弃未消耗权益」显式勾选 warn）→ 密码确认），按钮全动词、无内部术语、补救句带可点击出口，语气词仅 info/ok/warn/err（design-language §13）。验证：S 端 e2e（全 mock）走通"有权益→退款引导→放弃勾选→密码确认→受理"与"无权益直达确认"两条路径；`npm run design:lint` 通过。
- [x] 4.2 撤销期账号登录提示（剩余天数 + 「撤销注销」按钮，warn 提示条）与撤销成功反馈（ok）。验证：e2e（全 mock）覆盖撤销成功恢复与到期后拒绝两条路径。
- [ ] 4.3 补充实现截图对照到本 change 目录（S 端无 parity 门禁，截图即一致性证据）。验证：evidence/ 含向导三态 + 撤销提示截图。

## 5. C 端会话失效处理

- [x] 5.1 client/backend 代理层：收到 S 端认证失效响应时清空 config.json 中 JWT 与用户名，向前端发结构化失效信号；全程不触碰本地 SQLite 作品数据（见 design D6）。验证：client 端测试覆盖"失效→凭据清空→信号发出"且作品数据断言不变。
- [ ] 5.2 client/frontend：收到失效信号导航回登录页；重新登录后正常进入工作台。（代码完成：useAuthHeal 会话失效→清凭据→hash #/login；e2e 用例待与 6.3 本机全量同批跑——docker 栈由统一会话管理，见 todo.md）验证：e2e（mock 401/失效响应）断言回登录页、重登可用、无循环请求。

## 6. 测试与 CI

- [x] 6.1 S 端 pytest 全量绿（全 mock，不触真实库）。验证：`pytest` 输出全绿贴入 evidence/。
- [ ] 6.2 S 端 e2e 全 mock 跑 PR CI 绿。验证：PR CI 记录含 e2e job 通过。
- [ ] 6.3 本机先跑 C 端/S 端全量 e2e（本次改了交互类代码：S 端向导 + C 端失效处理）。验证：两端全量 e2e 本机输出全绿，结论记入 evidence/。

## 7. 回归与门禁

- [ ] 7.1 门禁执行与结论记录：server/frontend `npm run design:lint`；双端 `vue-tsc --noEmit` / `tsc --noEmit`；C 端 `design:check` 不适用（无像素变化，判定见 1.1）；不触共享段故 `design-cross` 不适用。验证：各命令实际输出结论贴入 evidence/，与 1.1 判定一致。

## 8. 法律文档核对（协议侧已于 2026-08-29 提前完成更新；实施期仅核对）

- [ ] 8.1 核对《用户服务协议》§三.4–7 注销条款组与实际功能行为逐条一致（自助入口位置、客服兜底、15 天撤销期与到期自动执行、六项后果告知、效力存续）。验证：逐条对照记录留档；如有出入，改功能不改条款，确需改条款则走协议修订升版本。
- [ ] 8.2 核对《隐私政策》第四章第 2/3 款（删除/去标识化、交易留存去关联）与自助流程及 P1/P2 决策口径一致。验证：逐条核对记录留档。
- [ ] 8.3 节奏确认：协议 v2026.08 已先行写入自助注销承诺，功能上线前由客服人工通道兑现（§三.4 双通道口径），无"协议超前于功能"的合规窗口；发布清单附核对记录即可。验证：发布清单含本组三项核对记录。

