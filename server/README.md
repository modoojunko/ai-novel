# S端 — License 授权与设备管理服务

AI Novel 的 S端（Server），处理 License 验证、设备管理、用户认证和激活码管理。部署在腾讯云 CloudBase，通过云函数对外服务。

## 架构（2.0 重构版）

```
server/
├── app/                          # 新系统核心代码
│   ├── config.py                配置（环境变量 → Settings 单例）
│   ├── main.py                  FastAPI 应用工厂 + 启动入口
│   ├── models/                  SQLAlchemy ORM（6 张表）
│   ├── domain/                  领域层（纯 Python，无框架依赖）
│   │   ├── identity/           用户实体（User）
│   │   ├── licensing/           License 聚合、激活码、套餐策略
│   │   └── devices/            设备注册、授权凭证、激活策略
│   ├── infrastructure/          基础设施
│   │   ├── repositories/       5 个仓储（ORM → Domain 转换）
│   │   └── security/           JWT / 密码哈希
│   ├── application/             应用层（11 个 use case）
│   │   ├── identity/           注册、登录、重置密码
│   │   ├── licensing/          激活码、License 查询
│   │   └── devices/            设备授权/状态/列表/移除/验证
│   └── interfaces/              API 接口层
│       ├── client_api/         C端 API（auth-page, authorize, verify, devices）
│       ├── web_api/            门户 API（web/register, web/login, user/me, license/activate）
│       ├── admin_api/          管理 API（generate_code, query_codes）
│       ├── deps.py             FastAPI 依赖注入
│       ├── dto.py              请求/响应模型
│       ├── errors.py           全局异常处理
│       └── middleware.py        速率限制 / 访问日志 / CORS
├── frontend/                    # 管理门户 Vue SPA（Phase 3）
├── alembic/                     数据库迁移
├── tests/
│   ├── contract/                契约测试（12 条，替换旧系统的 acceptance spec）
│   └── unit/                    领域层单元测试（15 条）
└── requirements.txt
```

### 分层职责

| 层 | 依赖 | 职责 |
|---|------|------|
| **Domain** | 纯 Python | 业务规则（状态机、策略计算、实体行为） |
| **Infrastructure** | SQLAlchemy | 持久化、密码/JWT 工具 |
| **Application** | Domain + Repo | 编排用例，不包含业务规则 |
| **Interfaces** | FastAPI | HTTP 入站/出站，响应格式 |

## 启动

```bash
cd server

# 安装依赖
pip install -r requirements.txt

# 启动（开发/本地测试）
python app/main.py
# 默认监听 127.0.0.1:19000
```

## API 端点（共 17 个）

### C端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth-page` | 浏览器 OAuth 授权页面 |
| POST | `/api/authorize` | 设备授权（用户名密码 + 指纹） |
| GET | `/api/check-auth` | 轮询 OAuth 授权结果 |
| GET | `/api/devices/current` | 当前设备状态 |
| POST | `/api/devices/consume-enrolled` | 消费一次性 enrolled 标记 |
| POST | `/api/reset_password` | 密保重置密码 |
| POST | `/api/verify` | License + 设备心跳验证 |

### Web API（门户）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/web/register` | 注册新用户（送 7 天试用） |
| POST | `/api/web/login` | 登录（返回 JWT） |
| GET | `/api/user/me` | 当前用户信息 + License |
| PUT | `/api/user/password` | 修改密码 |
| PUT | `/api/user/security` | 修改密保 |
| POST | `/api/license/activate` | 激活码激活/续费 |
| GET | `/api/device/my` | 设备列表（含激活状态） |
| POST | `/api/device/remove` | 移除设备 |

### Admin API（运营管理）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate_code` | 生成激活码 |
| POST | `/api/query_codes` | 查询激活码 |

## 命令速查

```bash
# 启动服务
python app/main.py

# 运行契约测试 + 单元测试
python -m pytest tests/ -v

# 数据库迁移
alembic upgrade head

# 生成新迁移（修改模型后）
alembic revision --autogenerate -m "描述"
alembic upgrade head
```

## 关键环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `19000` | 监听端口 |
| `DB_BACKEND` | `sqlite` | 数据库后端：`sqlite`（本地/测试，默认）或 `pg_http`（生产：CloudBase PG HTTP API） |
| `TCB_PG_ENV_ID` | 空 | CloudBase 环境 ID（`DB_BACKEND=pg_http` 时必填，用于推导 PostgREST 端点） |
| `TCB_PG_API_KEY` | 空 | CloudBase 环境 API Key（`DB_BACKEND=pg_http` 时必填；角色 `service_role`，绕过 RLS） |
| `DATABASE_URL` | `sqlite:///<DB_DIR>/<DB_NAME>` | SQLite 连接串（本地路径跟随 DB_DIR/DB_NAME；PG 后端不使用 TCP 连接） |
| `DB_DIR` / `DB_NAME` | `server/` / `license.db` | SQLite 数据库路径 |
| `JWT_SECRET` | `local-license-secret` | JWT 签名密钥 |
| `ADMIN_TOKEN` | `admin123` | 管理员令牌 |
| `LOG_LEVEL` | `INFO` | 日志级别 |

## 部署到 CloudBase（云托管 + PostgreSQL HTTP API）

S端 数据层通过**仓储接口 + 双实现**抽象：`DB_BACKEND=sqlite`（SQLAlchemy，本地/测试）与 `DB_BACKEND=pg_http`（CloudBase PG PostgREST HTTP API，生产）——服务层零感知，切换只改环境变量。

CloudBase 体验版套餐的 PostgreSQL 不开放 TCP 直连（无连接地址/账号管理），但可通过 **PostgREST HTTP API** 完整读写（环境 API Key 鉴权，`service_role` 身份）。

### 1. 数据库准备（一次性，管理端）

1. 环境开通 PostgreSQL 后，用 CloudBase MCP `managePgDatabase(applyMigration)` 建表（users/codes/device_grants/device_registry/global_config），并写入 `alembic_version` 打标 —— 应用启动时 `pg_http` 后端跳过迁移
2. 控制台「身份认证 → API 密钥」创建服务端 API Key（或在 MCP 中 `manageAppAuth(createApiKey)`）

### 2. 部署（tcb CLI）

```bash
cd server
tcb login            # 设备码登录
tcb cloudrun deploy  # 读取 server/cloudbaserc.json（服务 novel-s-server）
```

`cloudbaserc.json` 中 envParams 需填入真实值（**含凭据，勿提交真实值到仓库**）：

- `TCB_PG_API_KEY`：上面创建的 API Key
- `JWT_SECRET` / `ADMIN_TOKEN`：强随机值

### 3. 验证

```bash
# 接口冒烟
curl https://<cloudrun-domain>/api/web/register -X POST -H 'Content-Type: application/json' \
  -d '{"username":"smoke1","password":"Pass123!","security_question":"q?","security_answer":"a"}'
```

### 4. 生产 schema 变更 SOP（pg-schema-self-check）

生产 PG 的表结构**不随部署迁移**（pg_http 启动不跑 alembic），加表/加列/改列全靠人工执行 DDL。两道防线防止"代码上线了、表没改"：

- **部署前门禁**：`s-server-deploy.yml` 在部署后端之前跑 `server/scripts/pg_gate.py`，对照 `app/infrastructure/pg_schema.py` 的 `REQUIRED` 清单探测生产库，缺失即中止部署并打印清单。
- **启动自检兜底**：后端 pg_http 启动时用同一清单自检，云托管日志可见 `event=app.schema_check result=ok`（通过留痕）或 `result=fail missing=表.列`（告警，不阻断启动）。

**改表流程**（新 feature change 涉及表结构时）：

1. 同一 PR 内更新 `app/infrastructure/pg_schema.py` 的 `REQUIRED` 清单（design D2 强制约定）+ models + 仓储代码。
2. push main 触发部署 → 门禁拦截（exit 1，日志列缺失项）。
3. 会话内 CloudBase MCP 设备码登录 → `managePgDatabase` 应用对应 DDL。
4. **改列类型或重建表后必须刷新网关连接池**：rdb 网关连接池缓存旧查询的预编译计划，仅改表会继续 `DATABASE_22P02` 400（2026-08-31 事故实证）；执行 `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();` 杀光连接（十几秒 503 自愈）。纯加列可跳过此步。
5. 重跑部署（workflow_dispatch 或 re-run failed jobs）。
6. 云托管日志确认 `event=app.schema_check result=ok tables=5`。

**回滚**：revert 该 PR 重新部署即可（代码回退，生产 DDL 不需要回滚——多出的列对旧代码无害）。

> 本地开发：`python app/main.py`（默认 sqlite，数据在 `server/license.db`）；现有 50 个测试全部基于 sqlite 后端运行。

## S端 前端部署（CloudBase 静态托管，成本≈0）

管理门户（Vue SPA）发布到静态托管（体验版套餐含免费额度），API 直连云托管后端域名（静态托管无反代，靠 CORS——后端 `allow_origins=["*"]` 已放开）。

```bash
cd server/frontend
# 构建时注入后端 API 地址（不注入则回退 /api，适配本地 docker-compose nginx 反代）
VITE_API_BASE=https://<cloudrun-domain>/api npm run build
# 用 CloudBase MCP manageApps 部署（framework=static, installCmd="", buildCmd="", buildPath=dist）
# 或 tcb CLI 等价命令；独立子域名：<serviceName>-<envId>.webapps.tcloudbase.com
```

- `src/api/request.ts`：`baseURL = import.meta.env.VITE_API_BASE || '/api'`
- 部署后配置静态托管路由规则：404 → index.html（SPA 子路由回退）
- 前端已部署实例：`novel-s-web` → https://novel-s-web-ai-novel-test-d1ghsr86ra814c12c.webapps.tcloudbase.com

## 数据模型（6 张表）

| 表 | 用途 |
|----|------|
| `users` | 用户账户（密码哈希、密保、状态） |
| `codes` | 激活码（套餐类型、到期日、绑定用户） |
| `device_registry` | 设备注册记录（指纹、主机名、OS） |
| `device_grants` | 设备授权凭证（C端 OAuth 授权记录） |
| `global_config` | 全局配置键值对 |
| `alembic_version` | Alembic 迁移版本 |
