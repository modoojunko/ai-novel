# 复盘：S端生产 500（2026-08-31）——生产 PG 表结构漂移 + 数据库网关查询计划缓存

> 事故级别：生产不可用（S端已登录用户全部接口报 500）
> 影响时长：2026-08-31 17:12 部署起 ~ 18:00 前后修复（约 45 分钟）
> 触发方式：正常发版（b8c054b 权益级退款申请合入 main 自动部署）
> 状态：已修复，已验证

---

## 一、一句话总结

新代码合入 main 自动部署后，`/api/user/me` 和 `/api/device/my` 对**已登录用户**全部 500：表层原因是生产 PG 两张表的结构停留在旧形态（缺列 + 列类型漂移），深层原因是腾讯云 rdb 网关把坏查询的**预编译计划缓存**在连接池里——光修数据库没用，必须杀连接重建池子才能彻底恢复。

## 二、时间线

| 时间 | 事件 |
|---|---|
| 17:12 | b8c054b（权益级退款）合入 main，CI 自动部署云托管（镜像 046） |
| 17:31 | 用户登录 S端，`/api/user/me` 500，报障"生产前端访问不到后端" |
| ~17:40 | 第一轮修复：MCP 直改生产 PG（补列/换列/回填），`/user/me` 恢复，`/device/my` 仍 500 |
| 17:43 | CI 再次部署（镜像 049，同一份代码） |
| ~17:50 | 隔离变量实验，定位到网关查询计划缓存 |
| ~17:58 | `pg_terminate_backend` 杀光连接池，全部接口恢复 200 |
| 之后 | 浏览器实测工作台/设备页正常，复盘归档 |

## 三、影响面

- **已登录用户**：所有走 `codes`/`device_registry` 查询的接口 500（user/me、device/my，即控制台核心页面全部不可用）。
- **未登录访客**：无感（落地页正常，接口按业务码返回"未登录"）。
- **数据**：零丢失。6 行业务数据（3 用户 / 4 激活码 / 2 设备记录）全程完整，迁移前后一致。

## 四、根因（三层叠加）

### 第 1 层：生产 PG 表结构漂移（主因）

生产 PG 的表结构**不随部署迁移**：`pg_http` 启动分支直接 return（表结构靠管理端手工建），CI/CD 无 alembic 步骤。而代码模型早已演进：

| 表 | 代码模型（main） | 生产实际（事故前） |
|---|---|---|
| `codes` | `bound_username VARCHAR(128)`（用户名外键）+ `refund_requested_at` | 两列都没有，还是 `user_id BIGINT` |
| `device_registry` | `user_id VARCHAR(128)`（用户名外键）+ `bound_at/created_at/updated_at` | `user_id BIGINT`（数字内部 id），三列全缺 |

为什么之前一直没事？**旧代码没走到这些查询路径**——静默欠账，新代码一触达就爆。b8c054b 让 `/api/user/me` 首次捎带"未消耗权益"查询（`codes.bound_username`），`/api/device/my` 也撞上同款，双双 500。

### 第 2 层：PostgREST 400 被包装成 500

后端 `pg_http` 客户端对网关 400 只 `raise_for_status()`，全局异常处理器接住后统一回业务格式 `{"code":-1,"msg":"内部错误"}` + HTTP 500。前端看到 500，真实错误在网关响应体里（`DATABASE_22P02` 等），日志和响应两端都看不到细节。

### 第 3 层：rdb 网关的查询计划缓存（真正难点，最罕见）

PG 表修好之后 `/device/my` **依然 500**。直连网关隔离变量后实锤：

| 探测 | 结果 |
|---|---|
| `?select=*` 全表 | ✅ 200，返回的 `user_id` 已是用户名字符串 |
| 仅 filter `?user_id=eq.modoojunko` | ✅ 200 |
| 仅 order `?order=last_active_at.desc` | ✅ 200 |
| filter + order 合体（desc，线上旧模板） | ❌ 400 `DATABASE_22P02: invalid input syntax for type bigint` |
| filter + order 合体（**asc**，线上从没用过的方向） | ✅ 200 |

结论：网关连接池把 bigint 时代 `?user_id=eq.<u>&order=last_active_at.desc` 这条**查询模板的预编译计划**缓存住了，参数插槽还是 bigint，字符串塞进去必炸；升序方向从没被发过，每次现编译，按真实 varchar 解析所以通。

**这不是普通 schema 缓存**——以下手段全部无效：
- ❌ `NOTIFY pgrst, 'reload schema'`（试了两次；**8-30 theme 加列那次"靠 NOTIFY 自愈"的结论是错的**，那次能好是因为"未知列 filter 网关放行透传"，与 NOTIFY 无关）
- ❌ 整表 DROP + 重建（新 oid 也刷不掉）

**唯一有效手段**：
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();
```
杀光所有连接 → 网关连接池重建 → 新连接按真实表结构编译计划 → 立即全通（杀完会有十几秒 503 `DATABASE_PGRST001 Retrying the connection`，属预期，自愈）。

## 五、修复动作清单（可复用配方）

1. **补列 + 回填**（codes 表）：
   ```sql
   ALTER TABLE codes ADD COLUMN IF NOT EXISTS bound_username VARCHAR(128);
   ALTER TABLE codes ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP;
   UPDATE codes c SET bound_username = u.username
     FROM users u WHERE u.id::text = c.user_id::text;
   ```
2. **换列类型**（device_registry 表，`ALTER TYPE ... USING` 里不能写子查询，必须三步换列法）：
   ```
   加新列(user_id_username) → 标量子查询回填 → DROP 旧列 → RENAME → SET NOT NULL
   → 补缺列(DEFAULT now()) → 重建 UNIQUE/FK/索引
   ```
3. **杀连接刷新网关连接池**（见上），等 503 自愈后复测。
4. **验证**：直连网关复现原查询 200 → 后端接口带真 token 200 → 浏览器登录态页面正常。

## 六、排障方法论（这次做对了的和绕的弯）

做对了：
- **直连网关拿真实错误体**。后端把错误吞了，绕过它：API Key 就在 `queryCloudRun action=detail` 返回的 `EnvParams.TCB_PG_API_KEY` 里，对着 `https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest/<table>` 原样复现查询，一眼看到 `22P02`。
- **隔离变量**：select=* / 仅 filter / 仅 order / 换排序方向，四组对照把"数据问题"和"查询模板缓存"切开，避免在错误层面反复用力。
- **拿存量数据映射表**再动手：改结构前先 `LEFT JOIN` 验证全部旧行能映射、无孤儿，`SET NOT NULL` 当护栏，失败即整体回滚。
- **用真 token 走完整链路**：注册测试号在浏览器里实测，不靠猜。

绕的弯（下次跳过）：
- `NOTIFY pgrst` ×2、表重建 ×1——都是对"缓存"的无效冲击，应该在第一个对照实验（filter/order 拆分）出现后立刻转向连接池假设。
- **CLS 日志不可依赖**：当天日志多次延迟 >10 分钟甚至缺失，等日志不如直连实证。

## 七、遗留与防复发

- [ ] **`pg-schema-self-check` change 应尽快开工**（现停审批口，已是两起同款事故）。设计需升级：不能只探测列存在，要把 `models/` 列类型对拍进去；每次改表后加"杀连接刷新网关池"步骤。
- [ ] S端任何涉及建表/加列/改列的 change，tasks 必须含"生产 PG 手工执行 DDL + 杀连接"步骤（同 8-30 拍板，本次补强）。
- [ ] `pg_http` client 的 400 可考虑把网关响应体带进异常消息（`resp.read()` + raise），下次排障省一轮直连。
- [ ] s-pay-foundation 分支后续上线前：它的 schema 变更同样要手工同步生产 + 杀连接，发布清单里写死。
- [ ] 观察项：测试号 `zcode_probe_0831`（7 天试用）留在生产用于验证，可手动删或等过期。
- [ ] 小尾巴：S端前端 API 基址写死云托管直连域名（`.env.production`，CI 注入失效时期的妥协），www 域名网关转发其实健在，是否收编到 www 另立 change 拍板。

## 八、关联

- 8-30 同源事故：theme 列漏加（`users.theme` 500）——记忆 `s-server-prod-schema-manual`
- 记忆更新：本次已合并进 `s-server-prod-schema-manual`（含网关 plan 缓存结论修正）
- 相关提交：b8c054b（触发部署）、7d615a0（legal，同批部署）
