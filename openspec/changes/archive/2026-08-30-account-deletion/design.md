# Design: account-deletion（账号自助注销）

## Context

账号域现状：`users`（username + 密码哈希，无邮箱无手机号）、`device_grants`/`device_registry`（设备绑定）、`codes`（套餐权益台账，到货-激活两段式，行状态：待激活/排队中/消耗中/退款冻结/已回收）、orders/trade_events/refunds（append-only 交易与审计）。作品内容只在 C 端本地 SQLite，服务端零副本。

工程硬约束（来自仓库既定技术边界，本设计全部遵守）：

- 生产库 CloudBase PG，走 pg_http/PostgREST，**无多表事务**——任何"状态转移 + 审计 + 清理"必须拆成可独立重放的幂等单语句；
- 幂等靠唯一约束 + 单语句 CAS UPDATE；跨表一致性靠补偿扫描而非事务；
- alembic 迁移：本地生成 + MCP applyMigration 应用；
- S 端 pytest 全 mock；S 端 e2e 全 mock 跑 PR CI；改交互类代码须本机先跑 C 端/S 端全量 e2e。

动机与范围见 proposal.md，对外行为契约见 specs delta。本文只写实现口径。

## Goals / Non-Goals

**Goals:**

- 定义注销状态机（正常 → 撤销期 → 已注销）与每一步的状态转移实现方式，全部落在"单语句 CAS + 幂等"模式内；
- 定义到期执行的触发机制（惰性 + 定时双保险）与补偿扫描；
- 定义去标识化的具体字段口径与交易留存边界（P1/P2 决策落地）；
- 定义未消耗权益的处置路径（退款引导复用既有链路 / 放弃作废）与审计落点；
- 定义 C 端会话失效处理的落点（client/backend + client/frontend）。

**Non-Goals:**

- 不改退款/支付链路本身（复用既有订单页退款 API）；
- 不做账号数据导出、不做管理面代办注销；
- 不处理任何作品数据（服务端没有）；
- 不改 docs/legal/（法律文案更新是实施期任务项，见 tasks.md）。

## Decisions

### D1 · 状态机与存储：`users` 行内状态字段，独立子状态表否决

`users` 新增三个字段（一次 alembic 迁移）：`deletion_status`（`正常` / `注销撤销期` / `已注销`，沿用 codes 中文枚举风格）、`deletion_deadline`（到期执行时刻）、`deletion_requested_at`。不建独立 `account_deletions` 表——理由：无多表事务环境下，状态判定只能安全地依赖单行读取；独立表会造成"users 状态与申请表状态"两处真相，恢复一致性全靠补偿，得不偿失。撤销期时长定 **15 天**（与协议人工通道"15 个工作日"的时间体感一致，覆盖主流产品的后悔期惯例），实现为常量。

状态转移全部是单语句 CAS：

- 申请：`UPDATE users SET deletion_status='注销撤销期', deletion_deadline=now()+15d, deletion_requested_at=now() WHERE id=:id AND deletion_status='正常'`——重复提交/并发提交天然幂等（0 行受影响即已在流程中）；
- 撤销：`UPDATE users SET deletion_status='正常', deletion_deadline=NULL, ... WHERE id=:id AND deletion_status='注销撤销期' AND now() < deletion_deadline`——与到期执行竞态时必有一方 CAS 失败，安全；
- 到期执行标记：`UPDATE ... SET deletion_status='已注销' WHERE id=:id AND deletion_status='注销撤销期' AND deletion_deadline<=now()`。

### D2 · 到期执行：惰性触发为主、定时扫描兜底、每步可重放

到期"执行"不是一个原子动作，而是**一组按固定顺序、各自幂等的单语句**，任一步失败可整批重放（补偿扫描的幂等基础）：

1. CAS 标记 `已注销`（D1，这是"是否已执行"的唯一真相）；
2. 去标识化 `users`：`username` 改写为 `deleted-<uuid4>`（满足唯一约束、不可逆推原用户名），`password_hash` 置空，单语句 UPDATE，`WHERE deletion_status='已注销' AND username NOT LIKE 'deleted-%'` 保证重放安全；
3. `DELETE FROM device_grants WHERE user_id=:id` / `DELETE FROM device_registry WHERE user_id=:id`——DELETE 本身幂等；
4. `codes` 处置：`UPDATE codes SET status='已回收' WHERE user_id=:id AND status IN ('待激活','排队中','消耗中')`（用户已显式放弃；「退款冻结」「已回收」不动）；
5. 审计：向 trade_events 追加一条注销执行事件（append-only INSERT，幂等靠事件唯一约束）。

触发机制：

- **惰性触发（主）**：认证/登录/check-auth 链路在读取用户状态时顺带执行"到期未撤销则执行"的 CAS——已过期账号一旦冒头即被处理，覆盖绝大多数场景，零新增基础设施；
- **定时扫描（兜底）**：云托管定时触发器周期扫描 `deletion_status='注销撤销期' AND deletion_deadline<=now()` 的行并执行同一组语句——保证无人登录的账号也会按期注销，且扫描重入安全。

交易记录（orders/trade_events/refunds）在执行中**零改动**（只读留存），天然规避了无事务环境下最大的跨表一致面。

### D3 · 认证失效：注销状态进认证链路，JWT 无需吊销列表

JWT 本身无状态、不可吊销，因此失效判定落在认证链路的查库点上：现有 `check-auth`/认证中间件读取用户时，增加对 `deletion_status` 的检查——`已注销` 一律拒绝（等价凭据失效）；`注销撤销期` 拒绝正常登录并返回结构化状态（含剩余天数），供 S 端展示撤销页。配合步骤 2 的 `password_hash` 置空，密码重放也不可通过。撤销操作本身要求密码验证（同一确认强度）。不引入 token 黑名单——既有 JWT 短有效期 + 状态检查已满足行为 spec 的"注销后认证被拒绝"。

### D4 · 未消耗权益处置：退款引导复用既有链路，注销 API 不碰资金

向导侧（server/frontend）：检测到 待激活/排队中/消耗中 权益时，展示清单 + 两个出口——「去退款」跳转既有订单页退款流（待激活全额退、消耗中按《退款政策》秒级折算，全部既有逻辑）；「放弃未消耗权益」显式勾选。后端在受理申请时以同一查询复验权益状态，未处置则拒绝受理（防前端绕过）。「退款冻结」不阻塞：原路退回不依赖账号存活，注销不影响在途退款到账（向导文案明确提示 1~7 个工作日）。资金动作 100% 留在既有退款链路，是本设计最重要的风险隔离：注销 API 内没有任何资金写操作。

### D5 · username 释放策略：永久封存，不回收注册

去标识化后的 username 采用不可注册的 `deleted-<uuid>` 格式，**永不释放**回注册池。备选"N 天后释放"被否决：① 10 年留存的交易记录与匿名主体的对应关系要求稳定，释放后同名新用户会制造"历史交易归属"混淆与冒名风险；② 回收需要额外扫描任务，在无事务环境又添一条补偿链；③ 封存是零成本默认。同名新用户注册会收到"用户名不可用"，符合预期。

### D6 · C 端会话失效：client/backend 清凭据，client/frontend 回登录页

C 端 JWT 持久化在 config.json。落点：client/backend（Python 代理层）在收到 S 端认证失效响应时，清空 config.json 中的 token 与用户名，并把结构化失效信号传给 client/frontend；client/frontend 收到信号后导航回登录页（复用既有登录屏，无新界面）。登出/失效处理收敛到代理层一处，避免每个前端调用点各自处理 401。本地 SQLite 作品数据全程不触碰。

## Risks / Trade-offs

- [无多表事务：执行中途失败留下半处置状态] → 执行序列每步独立幂等（D2），补偿扫描按同一序列整批重放；`已注销` 标记先行，半处置状态不会对外表现为"还活着"。
- [定时扫描与惰性触发竞态] → 所有写入均 CAS，两者同时执行同一账号时必有一方 0 行受影响，无双重处置。
- [用户误读"注销会删本地作品"] → 向导后果告知逐条列出"本地作品不受影响"；文案走 design-language §13，补救句带出口。
- [撤销期内账号被用于绕过付费（登录被拒但旧 JWT 残留）] → 认证链路对 `注销撤销期` 同样拒绝业务接口（D3），撤销期内只有撤销动作可用。
- [15 天撤销期 vs 协议承诺口径衔接] → 协议改版（客户端内自助注销）是实施期任务，上线节奏上协议文案更新与功能发布同批完成，避免"协议还说 15 个工作日、功能已即时"的窗口期。
- [放弃权益的用户事后争议] → 放弃动作显式勾选 + 注销申请写入审计（trade_events），可追溯。

## Migration Plan

1. alembic 本地生成迁移（users 三字段）→ MCP applyMigration 应用（可回滚：downgrade 删字段，字段仅在注销流程使用，先于代码部署无副作用）；
2. 部署 S 端（API + 控制台）与 C 端（失效处理）；
3. 同批完成协议 §三.4 文案更新（见 tasks）；
4. 回滚策略：还原部署即可——注销功能全部为新端点与新字段，不改变既有路径行为；已产生的撤销期账号在回滚后按旧逻辑正常登录（字段被忽略），无数据损坏。

## Open Questions

无阻塞项。两个推荐决策——撤销期 15 天（D1）、username 永久封存（D5）——已按 PM 推荐口径写入 spec；若业务方在审批时倾向不同取值（如撤销期缩短、或要求释放用户名），改动面仅限常量与 D2 步骤 2 的格式策略，不影响架构与任务拆分。

### D7 · 实现补注（2026-08-30，实施期）

- **code 约定**：S 端登录对「注销撤销期」返回 **code 4**（结构化状态）——code 2 已被前端 axios 拦截器全局保留为「会话失效→清 token→硬跳 /login」，复用会引发整页导航吞掉撤销视图。已注销沿用 code 1 + `data.deleted: true`。
- **D5' username 封存实现**：username 为 users 主键且被 codes/device_grants/device_registry FK 引用，物理改名在无事务 + FK 环境不安全。实现为**行内封存**：`password_hash` 置空 + `deletion_status='已注销'` + 注册接口 `exists()` 命中已注销行 →「用户名已存在」。达成 D5 全部目标（不可登录/不可再注册/交易归属稳定），少一条跨表改名补偿链。
- **审计载体**：`trade_events` 表随支付 change 建立；当前执行审计以结构化日志（event=deletion.requested/revoked/executed）承载，支付 change 落地后可补双写。
