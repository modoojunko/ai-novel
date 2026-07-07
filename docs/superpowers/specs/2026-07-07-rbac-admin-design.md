# RBAC 权限体系 + 管理后台 — 设计文档

## 核心设计

### 两角色 · 两状态

```
角色（Role）：admin | user

用户状态（Status）：active | inactive
  active   = 已付费或试用期内 → 对自己项目的全部权限
  inactive = 试用到期或续费到期 → 只读+导出
```

### 权限矩阵

```
操作                    admin     user+active    user+inactive
─────────────────────────────────────────────────────────────
管理后台                    ✅         ❌             ❌
查看任意用户空间            ✅         ❌             ❌
─────────────────────────────────────────────────────────────
创建/删除项目              ❌         ✅             ❌
设定面板                   ❌         ✅             ❌
写正文/AI 写作             ❌         ✅             ❌
剧情推演                   ❌         ✅             ❌
版本历史/回退              ❌         ✅             ❌
归档                       ❌         ✅             ❌
─────────────────────────────────────────────────────────────
查看自己项目               ❌         ✅             ✅
导出正文                   ❌         ✅             ✅
```

### 一句话规则

> **已激活用户对自己的项目空间拥有一切权限。**
> **未激活用户只能读和导出，不能创建/编辑/写。**

没有权限模板、没有功能开关、没有项目级覆盖。权限只有「有」和「没有」两种状态，由用户激活状态决定。

## 用户生命周期

```
注册
  │
  ▼
试用（3天激活）
  │
  ├── 付费（包月/包季/包年）
  │     ├── 有效期内 → active
  │     └── 到期未续 → inactive
  │
  └── 30天后未付费
        └── inactive
              ├── 付费 → active
              └── 持续未付费 → inactive（30天后可清理）
```

## 数据库设计

### users（扩展字段）

```sql
ALTER TABLE users ADD COLUMN (
    role                    VARCHAR(20) DEFAULT 'user',  -- admin | user
    status                  VARCHAR(20) DEFAULT 'active',-- active | inactive
    trial_expires_at        DATETIME,                    -- 试用到期时间
    subscription_type       VARCHAR(20),                 -- monthly | quarterly | yearly | lifetime
    subscription_expires_at DATETIME,                    -- 订阅到期时间
    is_lifetime             BOOLEAN DEFAULT FALSE,       -- 永久用户
    activated_at            DATETIME                     -- 首次激活时间
);
```

### 状态转换规则

```
注册时：
  role = "user"
  status = "active"
  trial_expires_at = now + 30天

每日定时任务（或每次请求时惰性检查）：
  IF trial_expires_at < now AND subscription_type IS NULL
  AND is_lifetime = false
  THEN status = "inactive"

  IF subscription_expires_at < now AND is_lifetime = false
  THEN status = "inactive"

  IF 用户付费后：
     subscription_type = "monthly" | "quarterly" | "yearly"
     subscription_expires_at = 对应时间
     status = "active"
```

## 管理员

### 配置方式

```bash
# .env
ADMIN_EMAILS=admin@example.com
```

启动时读取。注册时邮箱在列表中 → `role = "admin"`。

### 管理员职责

```
  ├── 查看用户列表
  ├── 查看任意用户空间（只读）
  ├── 修改用户套餐（包月/季/年/永久）
  ├── 补充用户点数
  └── 解决用户权限问题（如重置试用、延长期限）
```

## 管理后台页面

```
/admin
  ├── 仪表盘
  │     ├── 用户总数 / 活跃数 / 未激活数
  │     ├── 项目总数
  │     └── Token 消耗统计
  │
  ├── 用户管理
  │     ├── 列表：邮箱/角色/状态/套餐/注册时间（可筛选搜索）
  │     ├── 点击用户 → 详情
  │     │     ├── 基本信息（只读）
  │     │     ├── 项目列表（只读查看）
  │     │     ├── Token 消耗记录
  │     │     └── 操作：修改套餐/补充点数/重置试用期
  │     └── 批量操作：导出用户列表
  │
  ├── 项目浏览
  │     ├── 所有用户的项目列表（只读）
  │     └── 点击进入项目查看（只读，不可编辑）
  │
  └── Token 账单
        ├── 消耗排行
        ├── 明细查询
        └── 补充点数
```

## 后端 API

### 新增端点

```
用户管理：
  GET    /api/admin/users                      — 用户列表
  GET    /api/admin/users/{id}                 — 用户详情
  PUT    /api/admin/users/{id}/plan            — 修改套餐
  POST   /api/admin/users/{id}/topup           — 补充点数

项目浏览：
  GET    /api/admin/projects                   — 所有项目列表
  GET    /api/admin/projects/{id}              — 项目详情

统计：
  GET    /api/admin/stats                      — 仪表盘数据

Token 操作：
  GET    /api/admin/token-logs                 — 消耗明细
  GET    /api/admin/token-logs/user/{id}       — 特定用户明细
```

### 权限检查中间件

```python
async def require_admin(user: dict = Depends(get_current_user), db = Depends(get_db)):
    """Admin check for management endpoints."""
    u = await get_user_by_id(db, user["id"])
    if not u or u.role != "admin":
        raise HTTPException(403, "管理员权限不足")
    return u


async def check_active(user: dict = Depends(get_current_user), db = Depends(get_db)):
    """Check if user can perform write operations."""
    u = await get_user_by_id(db, user["id"])
    if u.role == "admin":
        return u  # admin can do everything
    if u.status != "active":
        raise HTTPException(403, "账号未激活，请续费后使用")
    return u
```

## 后端文件

```
backend/admin/
  ├── __init__.py
  ├── router.py              — 管理后台 API
  ├── service.py             — 管理后台业务逻辑
  └── middleware.py           — 角色/状态检查
```

## 前端文件

```
frontend/src/pages/admin/
  ├── AdminLayout.tsx         — 后台布局
  ├── DashboardPage.tsx      — 仪表盘
  ├── UsersPage.tsx          — 用户列表
  ├── UserDetailPage.tsx     — 用户详情
  ├── ProjectsPage.tsx       — 项目浏览
  └── TokenLogsPage.tsx      — Token 账单
```

## 边界情况

- admin 不消耗 token，不占用付费名额
- 未激活用户仍然可以登录、查看项目列表、阅读已写好的正文
- 未激活用户的写作功能按钮显示「需续费使用」提示
- 管理员修改套餐后立即生效，不需要用户重新登录
- trial 到期前 3 天前端提示「试用即将到期」
- 管理员操作的 API 需要二次确认（弹窗确认）
