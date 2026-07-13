# AI Novel C/S 架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Novel 从 SaaS 多用户 Web 平台重构为 C/S 架构的桌面应用，用户双击 .exe 即可使用。

**架构:** 四层——(1) S 端 CloudBase 云函数负责 License 验证/登录/设备管理/发码，(2) C 端 PyInstaller 打包 Python 后端 + React 前端 + pywebview，(3) 本地 SQLite 替代 PostgreSQL，(4) 用户自配 AI API Key 直接调模型。

**Tech Stack:** CloudBase (Python 云函数 + 云数据库 + 静态托管), FastAPI, SQLite, React 19, daisyUI, PyInstaller, pywebview

---

## 文件结构总览

### S 端（CloudBase）
```
serverless/
├── requirements.txt          # 所有云函数共享依赖
├── cloudfunctions/
│   ├── activate/
│   │   ├── main.py           # 激活码验证 + 首次注册
│   │   └── config.json       # 云函数配置
│   ├── login/
│   │   ├── main.py           # 登录 + 设备绑定
│   │   └── config.json
│   ├── verify/
│   │   ├── main.py           # 启动验证 + 每日心跳
│   │   └── config.json
│   ├── renew/
│   │   ├── main.py           # 续期叠加
│   │   └── config.json
│   ├── devices_list/
│   │   ├── main.py           # 查看已绑定设备
│   │   └── config.json
│   ├── devices_remove/
│   │   ├── main.py           # 解绑设备
│   │   └── config.json
│   ├── reset_password/
│   │   ├── main.py           # 密保重置密码
│   │   └── config.json
│   └── generate_code/
│       ├── main.py           # 生成激活码（管理用）
│       └── config.json
├── lib/                      # 云函数共享库
│   ├── __init__.py
│   ├── db.py                 # 数据库连接
│   ├── auth_utils.py         # JWT / bcrypt 工具
│   └── code_utils.py         # 激活码生成逻辑
└── static/
    ├── landing/
    │   └── index.html        # Landing page
    └── admin/
        ├── index.html        # 发码管理页面
        ├── app.js            # 管理页面逻辑
        └── style.css
```

### C 端（后端修改）
```
backend/
├── main.py                   # ✏️ 精简: 去掉 auth/billing/admin 路由
├── config.py                 # ✏️ 简化: 去掉 SaaS 环境变量
├── db.py                     # ✏️ 改为 SQLite 连接
├── ai_client.py              # ✏️ 支持动态 API Key
├── auth_local/               # 🆕 License 验证模块
│   ├── __init__.py
│   ├── router.py             # 激活/登录/验证/心跳 API
│   ├── service.py            # S 端 CloudBase 通信层
│   └── models.py             # 本地 license 缓存模型
├── (保留: projects/, chapters/, settings/, workflow/, prompt/, write/, archive/, filesystem/, story/)
├── (移除: auth/, billing/, admin/)
```

### C 端（前端修改）
```
frontend/src/
├── App.tsx                   # ✏️ 路由改造
├── lib/
│   ├── api.ts                # ✏️ 改为调 localhost
│   ├── auth.ts               # ✏️ 改为 License token 验证
│   └── license-api.ts        # 🆕 S 端 API 通信封装
├── pages/
│   ├── ActivatePage.tsx      # 🆕 激活码输入 + 注册
│   ├── LoginPage.tsx         # 🆕 用户名密码登录
│   ├── ResetPasswordPage.tsx # 🆕 密保重置密码
│   ├── ApiKeyConfigPage.tsx  # 🆕 API Key 配置
│   └── DeviceManagePage.tsx  # 🆕 设备管理
├── (去掉: admin/ 全部页面)
├── (去掉: 原有 LoginPage, RegisterPage)
```

### C 端（打包）
```
packaging/
├── pywebview_app.py          # 🆕 pywebview 入口
├── build.spec                # 🆕 PyInstaller spec
├── requirements.txt          # 🆕 额外打包依赖
└── build.bat                 # 🆕 构建脚本
```

---

### 关键架构决策

**前端 → 后端通信全部走 localhost，不直连 S端。**
- `license-api.ts` 中的逻辑在实施时应合并到 `api.ts`，前端所有 API 调用都走 `http://127.0.0.1:8000/api/...`
- 前端不需要知道 S 端的存在。激活、登录等操作由 C 端后端（`auth_local/service.py`）转发到 CloudBase
- 这样后端统一做离线缓存、错误降级，前端代码更干净

### 依赖关系

```
S端云函数（无外部依赖，CloudBase内部调用）
    ↑ 并行
C端后端改造（SQLite + 模块精简）
    ↑
C端前端页面（新页面）
    ↑
AI Client 改造
    ↑
C端打包（PyInstaller + pywebview）
    ↑
端到端测试
```

---

### Task 1: S 端 CloudBase 共享库

**Files:**
- Create: `serverless/requirements.txt`
- Create: `serverless/lib/__init__.py`
- Create: `serverless/lib/db.py`
- Create: `serverless/lib/auth_utils.py`
- Create: `serverless/lib/code_utils.py`

- [ ] **Step 1: 创建 requirements.txt**

```txt
# serverless/requirements.txt
pyjwt==2.9.0
passlib[bcrypt]==1.7.4
bcrypt==4.2.1
python-dotenv==1.0.1
```

- [ ] **Step 2: 创建 db.py（数据库连接）**

参考 CloudBase 云数据库文档。CloudBase Python 云函数使用 `tcb` SDK 连接云数据库。但更简单的方式是使用 CloudBase 的 `tcbsql` 或直接用 `pymongo`（CloudBase 数据库兼容 MongoDB 语法）。

实际上，CloudBase Python 云函数环境自带 `tcb` 包。数据库操作需要初始化 `tcb`，然后获取 `db` 对象。

```python
# serverless/lib/db.py
"""CloudBase 数据库操作封装"""

import os
from typing import Optional, Dict, List, Any

# CloudBase 云函数环境中通过环境变量获取数据库引用
# 使用全局单例避免每次调用都初始化
_db = None


def get_db():
    """获取 CloudBase 数据库引用"""
    global _db
    if _db is not None:
        return _db
    try:
        from tcb import tcb
        app = tcb.Database()
        _db = app.database()
        return _db
    except ImportError:
        # 本地开发时使用模拟
        raise RuntimeError("CloudBase SDK not available")


def get_collection(name: str):
    """获取集合引用"""
    db = get_db()
    return db.collection(name)
```

- [ ] **Step 3: 创建 auth_utils.py（JWT + bcrypt 工具）**

```python
# serverless/lib/auth_utils.py
"""JWT token 签发验证 + bcrypt 密码哈希"""

import os
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from passlib.context import CryptContext

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """使用 bcrypt 哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain, hashed)


def create_jwt(username: str) -> str:
    """签发 JWT"""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    """验证并解码 JWT，返回 payload 或 None"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
```

- [ ] **Step 4: 创建 code_utils.py（激活码生成）**

```python
# serverless/lib/code_utils.py
"""激活码生成工具"""

import secrets
import string
from datetime import datetime, timedelta, date
from typing import Optional


def generate_activation_code() -> str:
    """生成激活码，格式: AC-XXXX-YYYY-ZZZZ-WWWW"""
    def _block(length=4):
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    parts = [_block() for _ in range(4)]
    return f"AC-{'-'.join(parts)}"


def calc_expires_at(tier: str, from_date: Optional[date] = None) -> date:
    """根据套餐类型计算到期日"""
    duration_map = {
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "lifetime": 36500,  # 100年
    }
    days = duration_map.get(tier, 30)
    base = from_date or date.today()
    return base + timedelta(days=days)


def merge_expiry(current: Optional[date], new_days: int) -> date:
    """叠加续期：新到期日 = max(当前到期日, 今天) + duration_days"""
    today = date.today()
    base = max(current, today) if current else today
    return base + timedelta(days=new_days)
```


### Task 2: S 端核心云函数（activate / login / verify）

**Files:**
- Create: `serverless/cloudfunctions/activate/main.py`
- Create: `serverless/cloudfunctions/activate/config.json`
- Create: `serverless/cloudfunctions/login/main.py`
- Create: `serverless/cloudfunctions/login/config.json`
- Create: `serverless/cloudfunctions/verify/main.py`
- Create: `serverless/cloudfunctions/verify/config.json`

- [ ] **Step 1: 创建 activate 云函数**

```python
# serverless/cloudfunctions/activate/main.py
"""POST /api/activate - 激活码验证 + 首次注册"""

from datetime import date
from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password, create_jwt
from lib.code_utils import calc_expires_at


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    activation_code = body.get("activation_code", "").strip().upper()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    security_question = body.get("security_question", "").strip()
    security_answer = body.get("security_answer", "").strip()
    pc_hash = body.get("pc_hash", "").strip()
    pc_name = body.get("pc_name", "").strip()

    # 参数校验
    if not all([activation_code, username, password, security_question, security_answer, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}
    if len(username) < 2 or len(username) > 20:
        return {"code": 1, "msg": "用户名长度 2-20 个字符"}
    if len(password) < 6:
        return {"code": 1, "msg": "密码至少 6 位"}

    # 检查用户名是否已存在
    users_coll = get_collection("users")
    existing = users_coll.where({"username": username}).get()
    if existing and len(existing) > 0:
        return {"code": 1, "msg": "用户名已存在"}

    # 验证激活码
    codes_coll = get_collection("codes")
    code_records = codes_coll.where({"code_id": activation_code}).get()
    if not code_records or len(code_records) == 0:
        return {"code": 1, "msg": "无效的激活码"}
    
    code = code_records[0]
    if code.get("status") != "unused":
        return {"code": 1, "msg": "激活码已被使用或已过期"}

    # 创建用户
    user_data = {
        "username": username,
        "password_hash": hash_password(password),
        "security_question": security_question,
        "security_answer_hash": hash_password(security_answer),
        "status": "active",
        "created_at": __import__("datetime").datetime.now().isoformat(),
    }
    users_coll.add(user_data)

    # 更新激活码状态
    expires_at = calc_expires_at(code.get("tier", "monthly"))
    codes_coll.doc(code["_id"]).update({
        "status": "active",
        "bound_username": username,
        "activated_at": date.today().isoformat(),
        "expires_at": expires_at.isoformat(),
    })

    # 绑定设备
    devices_coll = get_collection("devices")
    devices_coll.add({
        "username": username,
        "pc_hash": pc_hash,
        "pc_name": pc_name,
        "last_active_at": __import__("datetime").datetime.now().isoformat(),
        "bound_at": __import__("datetime").datetime.now().isoformat(),
        "activation_code": activation_code,
    })

    token = create_jwt(username)
    # 查已绑定设备列表
    devices = list_devices(username)

    return {
        "code": 0,
        "data": {
            "token": token,
            "tier": code.get("tier"),
            "expires_at": expires_at.isoformat(),
            "devices": devices,
        }
    }


def list_devices(username: str) -> list:
    """查询用户所有设备"""
    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username}).get()
    result = []
    for d in records or []:
        result.append({
            "pc_hash": d.get("pc_hash"),
            "pc_name": d.get("pc_name"),
            "last_active_at": d.get("last_active_at"),
            "bound_at": d.get("bound_at"),
        })
    return result
```

```json
# serverless/cloudfunctions/activate/config.json
{
  "runtime": "Python3.12",
  "handler": "main.main",
  "timeout": 10,
  "envVariables": {
    "JWT_SECRET": "{{JWT_SECRET}}"
  }
}
```

- [ ] **Step 2: 创建 login 云函数**

```python
# serverless/cloudfunctions/login/main.py
"""POST /api/login - 用户名密码登录 + 设备绑定"""

from datetime import date, datetime
from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password, create_jwt, verify_jwt

MAX_DEVICES = 3


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    password = body.get("password", "")
    pc_hash = body.get("pc_hash", "").strip()
    pc_name = body.get("pc_name", "").strip()

    if not all([username, password, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    # 验证用户
    users_coll = get_collection("users")
    records = users_coll.where({"username": username}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "用户名或密码错误"}
    
    user = records[0]
    if not verify_password(password, user.get("password_hash", "")):
        return {"code": 1, "msg": "用户名或密码错误"}
    if user.get("status") != "active":
        return {"code": 1, "msg": "账户已被锁定，请联系客服"}

    # 查名下所有激活码，计算合并到期日
    codes_coll = get_collection("codes")
    user_codes = codes_coll.where({"bound_username": username, "status": "active"}).get()
    
    max_expires = None
    tiers = set()
    for c in user_codes or []:
        exp = c.get("expires_at")
        if exp:
            exp_date = date.fromisoformat(exp) if isinstance(exp, str) else exp
            if max_expires is None or exp_date > max_expires:
                max_expires = exp_date
        tiers.add(c.get("tier", ""))

    if max_expires is None or max_expires < date.today():
        return {"code": 1, "msg": "License 已过期，请续期"}

    # 检查/绑定设备
    devices_coll = get_collection("devices")
    all_devices = devices_coll.where({"username": username}).get() or []
    
    existing_device = None
    for d in all_devices:
        if d.get("pc_hash") == pc_hash:
            existing_device = d
            break
    
    if existing_device:
        # 更新最后活跃时间
        devices_coll.doc(existing_device["_id"]).update({
            "last_active_at": datetime.now().isoformat()
        })
    else:
        # 新设备：检查数量上限
        if len(all_devices) >= MAX_DEVICES:
            return {"code": 2, "msg": f"已超过最大设备数（{MAX_DEVICES} 台），请先在旧设备上解绑"}
        devices_coll.add({
            "username": username,
            "pc_hash": pc_hash,
            "pc_name": pc_name,
            "last_active_at": datetime.now().isoformat(),
            "bound_at": datetime.now().isoformat(),
        })

    # 刷新设备列表
    all_devices = devices_coll.where({"username": username}).get() or []
    device_list = [{
        "pc_hash": d.get("pc_hash"),
        "pc_name": d.get("pc_name"),
        "last_active_at": d.get("last_active_at"),
        "bound_at": d.get("bound_at"),
    } for d in all_devices]

    token = create_jwt(username)
    return {
        "code": 0,
        "data": {
            "token": token,
            "expires_at": max_expires.isoformat() if max_expires else None,
            "tier": ", ".join(sorted(tiers)) if tiers else "",
            "devices": device_list,
        }
    }
```

- [ ] **Step 3: 创建 verify 云函数**

```python
# serverless/cloudfunctions/verify/main.py
"""POST /api/verify - 启动验证 + 每日心跳"""

from datetime import date, datetime
from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    pc_hash = body.get("pc_hash", "").strip()

    if not all([username, token, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    # 验证 JWT
    payload = verify_jwt(token)
    if not payload:
        return {"code": 2, "msg": "Token 无效或已过期，请重新登录"}
    if payload.get("sub") != username:
        return {"code": 2, "msg": "Token 和用户名不匹配"}

    # 查激活码
    codes_coll = get_collection("codes")
    user_codes = codes_coll.where({"bound_username": username, "status": "active"}).get()
    
    max_expires = None
    tiers = set()
    for c in user_codes or []:
        exp = c.get("expires_at")
        if exp:
            exp_date = date.fromisoformat(exp) if isinstance(exp, str) else exp
            if max_expires is None or exp_date > max_expires:
                max_expires = exp_date
        tiers.add(c.get("tier", ""))

    valid = max_expires is not None and max_expires >= date.today()

    # 验证设备
    devices_coll = get_collection("devices")
    all_devices = devices_coll.where({"username": username}).get() or []
    
    device_valid = False
    device_list = []
    for d in all_devices:
        info = {
            "pc_hash": d.get("pc_hash"),
            "pc_name": d.get("pc_name"),
            "last_active_at": d.get("last_active_at"),
            "bound_at": d.get("bound_at"),
        }
        device_list.append(info)
        if d.get("pc_hash") == pc_hash:
            device_valid = True
            # 更新活跃时间
            devices_coll.doc(d["_id"]).update({
                "last_active_at": datetime.now().isoformat()
            })

    return {
        "code": 0,
        "data": {
            "valid": valid and device_valid,
            "license_valid": valid,
            "device_valid": device_valid,
            "expires_at": max_expires.isoformat() if max_expires else None,
            "tier": ", ".join(sorted(tiers)) if tiers else "",
            "devices": device_list,
            "max_devices": 3,
        }
    }
```


### Task 3: S 端辅助云函数（renew / devices / reset_password / generate_code）

**Files:**
- Create: `serverless/cloudfunctions/renew/main.py`
- Create: `serverless/cloudfunctions/devices_list/main.py`
- Create: `serverless/cloudfunctions/devices_remove/main.py`
- Create: `serverless/cloudfunctions/reset_password/main.py`
- Create: `serverless/cloudfunctions/generate_code/main.py`

- [ ] **Step 1: 创建 renew 云函数（续期叠加）**

```python
# serverless/cloudfunctions/renew/main.py
"""POST /api/renew - 续期叠加"""

from datetime import date
from lib.db import get_collection
from lib.auth_utils import verify_jwt
from lib.code_utils import merge_expiry


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    activation_code = body.get("activation_code", "").strip().upper()

    if not all([username, token, activation_code]):
        return {"code": 1, "msg": "缺少必要参数"}

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    # 验证新激活码
    codes_coll = get_collection("codes")
    records = codes_coll.where({"code_id": activation_code}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "无效的激活码"}
    
    code = records[0]
    if code.get("status") != "unused":
        return {"code": 1, "msg": "激活码已被使用"}

    # 计算当前到期日
    user_codes = codes_coll.where({"bound_username": username, "status": "active"}).get()
    current_expiry = None
    for c in user_codes or []:
        exp = c.get("expires_at")
        if exp:
            exp_date = date.fromisoformat(exp) if isinstance(exp, str) else exp
            if current_expiry is None or exp_date > current_expiry:
                current_expiry = exp_date

    from lib.code_utils import calc_expires_at
    new_days = calc_expires_at(code.get("tier", "monthly"))
    # 新到期日 = max(当前到期日, 今天) + duration_days
    base = max(current_expiry, date.today()) if current_expiry else date.today()
    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    days = duration_map.get(code.get("tier", "monthly"), 30)
    new_expires = base + __import__("datetime").timedelta(days=days)

    # 更新激活码
    codes_coll.doc(code["_id"]).update({
        "status": "active",
        "bound_username": username,
        "activated_at": date.today().isoformat(),
        "expires_at": new_expires.isoformat(),
    })

    return {
        "code": 0,
        "data": {
            "new_expires_at": new_expires.isoformat(),
        }
    }
```

- [ ] **Step 2: 创建设备管理云函数（list + remove）**

```python
# serverless/cloudfunctions/devices_list/main.py
"""POST /api/devices/list - 查看已绑定设备"""

from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username}).get() or []
    device_list = [{
        "pc_hash": d.get("pc_hash"),
        "pc_name": d.get("pc_name"),
        "last_active_at": d.get("last_active_at"),
        "bound_at": d.get("bound_at"),
    } for d in records]

    return {"code": 0, "data": {"devices": device_list, "max_devices": 3}}
```

```python
# serverless/cloudfunctions/devices_remove/main.py
"""POST /api/devices/remove - 解绑设备"""

from lib.db import get_collection
from lib.auth_utils import verify_jwt


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    token = body.get("token", "")
    pc_hash = body.get("pc_hash", "").strip()

    if not all([username, token, pc_hash]):
        return {"code": 1, "msg": "缺少必要参数"}

    payload = verify_jwt(token)
    if not payload or payload.get("sub") != username:
        return {"code": 2, "msg": "Token 无效"}

    devices_coll = get_collection("devices")
    records = devices_coll.where({"username": username, "pc_hash": pc_hash}).get()
    if records and len(records) > 0:
        devices_coll.doc(records[0]["_id"]).remove()
    
    return {"code": 0, "data": {"success": True}}
```

- [ ] **Step 3: 创建 reset_password 云函数**

```python
# serverless/cloudfunctions/reset_password/main.py
"""POST /api/reset_password - 密保重置密码"""

from lib.db import get_collection
from lib.auth_utils import hash_password, verify_password


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    username = body.get("username", "").strip()
    security_answer = body.get("security_answer", "").strip()
    new_password = body.get("new_password", "")

    if not all([username, security_answer, new_password]):
        return {"code": 1, "msg": "缺少必要参数"}
    if len(new_password) < 6:
        return {"code": 1, "msg": "密码至少 6 位"}

    users_coll = get_collection("users")
    records = users_coll.where({"username": username}).get()
    if not records or len(records) == 0:
        return {"code": 1, "msg": "用户不存在"}

    user = records[0]
    if not verify_password(security_answer, user.get("security_answer_hash", "")):
        return {"code": 1, "msg": "密保答案错误"}

    users_coll.doc(user["_id"]).update({
        "password_hash": hash_password(new_password)
    })

    return {"code": 0, "data": {"success": True}}
```

- [ ] **Step 4: 创建 generate_code 云函数（管理用）**

```python
# serverless/cloudfunctions/generate_code/main.py
"""POST /api/generate_code - 批量生成激活码（管理用）"""

import os
from lib.db import get_collection
from lib.code_utils import generate_activation_code

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    admin_token = body.get("admin_token", "")
    tier = body.get("tier", "monthly")
    count = int(body.get("count", 1))

    if admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}

    if tier not in ("monthly", "quarterly", "yearly", "lifetime"):
        return {"code": 1, "msg": "无效的套餐类型"}
    if count < 1 or count > 100:
        return {"code": 1, "msg": "生成数量 1-100"}

    duration_map = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    codes_coll = get_collection("codes")
    now = __import__("datetime").datetime.now().isoformat()
    generated = []

    for _ in range(count):
        code_id = generate_activation_code()
        codes_coll.add({
            "code_id": code_id,
            "tier": tier,
            "duration_days": duration_map[tier],
            "status": "unused",
            "created_at": now,
        })
        generated.append(code_id)

    return {"code": 0, "data": {"codes": generated, "count": len(generated)}}
```


### Task 4: S 端 Landing Page + 发码管理页面

**Files:**
- Create: `serverless/static/landing/index.html`
- Create: `serverless/static/admin/index.html`

- [ ] **Step 1: 创建 Landing page**

一个极简的产品介绍页，包含：
- 产品名称 + 标语
- 功能介绍（列表/ICON）
- 下载按钮（指向 .exe 下载链接）
- 无注册、无交易、无用户信息收集

```html
<!-- serverless/static/landing/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Novel - AI 辅助小说创作工具</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; background: #fafafa; color: #333; }
    h1 { font-size: 2.5em; margin-bottom: 0.2em; }
    .subtitle { font-size: 1.2em; color: #666; margin-bottom: 2em; }
    .features { list-style: none; padding: 0; }
    .features li { padding: 8px 0; }
    .download-btn { display: inline-block; padding: 14px 36px; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 8px; font-size: 1.1em; margin-top: 20px; }
    .download-btn:hover { background: #1557b0; }
    .footer { margin-top: 40px; font-size: 0.9em; color: #999; }
  </style>
</head>
<body>
  <h1>📝 AI Novel</h1>
  <div class="subtitle">AI 辅助长篇小说创作工具 — 本地运行，数据完全由你掌控</div>
  <h2>功能</h2>
  <ul class="features">
    <li>✓ 6 阶段创作工作流：设定 → 大纲 → 提示词 → 写作 → 归档</li>
    <li>✓ 支持任意 AI 模型：接入你自己的 API Key</li>
    <li>✓ SSE 流式写作：实时生成，随时中断调整</li>
    <li>✓ 剧情推演引擎：角色决策驱动情节发展</li>
    <li>✓ 本地离线存储：你的小说永远属于你</li>
  </ul>
  <p>需自行准备 AI API Key（支持 OpenAI、Anthropic、DeepSeek 等兼容端点）</p>
  <a class="download-btn" href="https://github.com/mooodjunko/ai-novel/releases/latest">下载 AI Novel</a>
  <p style="margin-top: 8px; font-size: 0.9em; color: #888;">Windows 版本 · ~120MB</p>
  <div class="footer">
    <p>购买激活码请访问淘宝店铺</p>
    <p>本软件不收集任何用户数据，所有创作内容存储在本地。</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: 创建发码管理页面**

内嵌 HTML + JS，纯前端页面，直接调用 generate_code 云函数。

```html
<!-- serverless/static/admin/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>发码管理</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { font-size: 1.8em; }
    .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    label { display: block; margin: 10px 0 5px; font-weight: bold; }
    select, input[type=number], input[type=password] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { background: #1a73e8; color: #fff; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; margin-top: 10px; }
    button:hover { background: #1557b0; }
    .code-list { margin-top: 10px; }
    .code-item { padding: 6px 10px; background: #f0f8ff; border: 1px solid #b3d4fc; border-radius: 4px; margin: 4px 0; font-family: monospace; cursor: pointer; word-break: break-all; }
    .code-item:hover { background: #d0e8ff; }
    .msg { margin-top: 10px; padding: 8px; border-radius: 4px; }
    .msg.ok { background: #d4edda; color: #155724; }
    .msg.err { background: #f8d7da; color: #721c24; }
    .tab { margin-bottom: 15px; }
    .tab button { background: #e0e0e0; color: #333; margin-right: 5px; }
    .tab button.active { background: #1a73e8; color: #fff; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    #codesTable { width: 100%; border-collapse: collapse; margin-top: 10px; }
    #codesTable th, #codesTable td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
    #codesTable th { background: #f0f0f0; }
    .search-box { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; box-sizing: border-box; }
  </style>
</head>
<body>
  <h1>🔑 AI Novel 发码管理</h1>
  
  <div class="tab">
    <button class="active" onclick="switchTab('generate')">生成激活码</button>
    <button onclick="switchTab('query')">查询激活码</button>
  </div>

  <div id="tab-generate" class="tab-content active">
    <div class="card">
      <label>管理员 Token</label>
      <input type="password" id="adminToken" placeholder="输入管理员 Token">
      <label>套餐类型</label>
      <select id="tier">
        <option value="monthly">月付（30天）</option>
        <option value="quarterly">季度（90天）</option>
        <option value="yearly" selected>年付（365天）</option>
        <option value="lifetime">永久</option>
      </select>
      <label>生成数量</label>
      <input type="number" id="count" value="1" min="1" max="100">
      <button onclick="generateCodes()">生成激活码</button>
      <div id="generateMsg"></div>
      <div class="code-list" id="codeList"></div>
    </div>
  </div>

  <div id="tab-query" class="tab-content">
    <div class="card">
      <label>管理员 Token</label>
      <input type="password" id="queryAdminToken" placeholder="输入管理员 Token" class="search-box">
      <label>按用户名查询</label>
      <input type="text" id="queryUsername" placeholder="输入用户名（留空查全部）" class="search-box">
      <button onclick="queryCodes()">查询</button>
      <div id="queryMsg"></div>
      <table id="codesTable">
        <thead><tr><th>激活码</th><th>套餐</th><th>状态</th><th>绑定用户</th><th>到期日</th><th>创建时间</th></tr></thead>
        <tbody id="codesBody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const API_BASE = '/api';
    function switchTab(name) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab button').forEach(el => el.classList.remove('active'));
      document.getElementById(`tab-${name}`).classList.add('active');
      event.target.classList.add('active');
    }

    async function generateCodes() {
      const token = document.getElementById('adminToken').value;
      const tier = document.getElementById('tier').value;
      const count = parseInt(document.getElementById('count').value);
      const msg = document.getElementById('generateMsg');
      const list = document.getElementById('codeList');

      try {
        const res = await fetch(`${API_BASE}/generate_code`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ admin_token: token, tier, count })
        });
        const data = await res.json();
        if (data.code === 0) {
          msg.className = 'msg ok';
          msg.textContent = `成功生成 ${data.data.count} 个激活码（点击复制）`;
          list.innerHTML = data.data.codes.map(c => `<div class="code-item" onclick="copyCode('${c}')">${c}</div>`).join('');
        } else {
          msg.className = 'msg err';
          msg.textContent = data.msg;
        }
      } catch(e) {
        msg.className = 'msg err';
        msg.textContent = '请求失败: ' + e.message;
      }
    }

    function copyCode(code) {
      navigator.clipboard.writeText(code).then(() => {
        alert(`已复制: ${code}`);
      });
    }

    async function queryCodes() {
      const token = document.getElementById('queryAdminToken').value;
      const username = document.getElementById('queryUsername').value.trim();
      const msg = document.getElementById('queryMsg');
      const body = document.getElementById('codesBody');
      
      try {
        const res = await fetch(`${API_BASE}/query_codes`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ admin_token: token, username: username || undefined })
        });
        const data = await res.json();
        if (data.code === 0) {
          msg.className = 'msg ok';
          msg.textContent = `查询到 ${data.data.codes.length} 条记录`;
          body.innerHTML = data.data.codes.map(c => `
            <tr>
              <td style="font-family:monospace">${c.code_id}</td>
              <td>${c.tier}</td>
              <td>${c.status}</td>
              <td>${c.bound_username || '-'}</td>
              <td>${c.expires_at || '-'}</td>
              <td>${c.created_at ? c.created_at.slice(0,10) : '-'}</td>
            </tr>
          `).join('');
        } else {
          msg.className = 'msg err';
          msg.textContent = data.msg;
        }
      } catch(e) {
        msg.className = 'msg err';
        msg.textContent = '请求失败: ' + e.message;
      }
    }
  </script>
</body>
</html>
```

注意：发码页面额外需要一个 `query_codes` 云函数来查询激活码状态。在下一个 task 中补充。

- [ ] **Step 3: 创建 query_codes 云函数（管理查询）**

```python
# serverless/cloudfunctions/query_codes/main.py
"""POST /api/query_codes - 查询激活码（管理用）"""

import os
from lib.db import get_collection

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "change-me")


def main(event, context):
    body = event.get("body", {}) if isinstance(event, dict) else {}
    admin_token = body.get("admin_token", "")
    username = body.get("username", "")

    if admin_token != ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}

    codes_coll = get_collection("codes")
    if username:
        records = codes_coll.where({"bound_username": username}).order_by("created_at", "desc").get()
    else:
        records = codes_coll.order_by("created_at", "desc").limit(200).get()

    code_list = [{
        "code_id": c.get("code_id"),
        "tier": c.get("tier"),
        "status": c.get("status"),
        "bound_username": c.get("bound_username"),
        "expires_at": c.get("expires_at"),
        "created_at": c.get("created_at"),
    } for c in (records or [])]

    return {"code": 0, "data": {"codes": code_list}}
```


### Task 5: C 端后端 — SQLite 适配 + 模块移除

**Files:**
- Modify: `backend/db.py`
- Modify: `backend/config.py`
- Modify: `backend/main.py`
- Remove: `backend/auth/router.py`, `backend/auth/service.py`, `backend/auth/middleware.py`
- Remove: `backend/billing/`
- Remove: `backend/admin/`

- [ ] **Step 1: 修改 db.py 为 SQLite**

```python
# backend/db.py
"""SQLAlchemy async engine — 本地 SQLite"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# SQLite 数据库路径，默认在 data/novel.db
DB_PATH = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./data/novel.db")

engine = create_async_engine(DB_PATH, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    """启动时自动创建表"""
    async with engine.begin() as conn:
        from models import User, Project, TokenLog, NovelFile
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 2: 简化 config.py**

```python
# backend/config.py
"""本地应用配置"""

import os
from pathlib import Path

# 数据目录
DATA_ROOT = os.environ.get("DATA_ROOT", "./data")
PROJECTS_DIR = os.path.join(DATA_ROOT, "projects")

# 数据库路径
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DATA_ROOT}/novel.db"
)

# AI 配置（用户动态设置，运行时从 config.json 读取）
DEFAULT_AI_BASE_URL = "https://api.deepseek.com/anthropic"
DEFAULT_AI_MODEL = "deepseek-v4-flash"

# JWT（本地存 token 用）
JWT_SECRET = os.environ.get("JWT_SECRET", "local-license-secret")
JWT_ALGORITHM = "HS256"

# 模板路径
REFERENCE_DIR = os.environ.get("REFERENCE_DIR", "./reference")

# S 端 API 地址
SERVER_API_BASE = os.environ.get(
    "SERVER_API_BASE",
    "https://your-cloudbase-app.com/api"
)
```

- [ ] **Step 3: 精简 main.py**

```python
# backend/main.py
"""AI Novel — C/S 架构本地服务"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from db import create_tables

# 路由
from projects.router import router as projects_router
from chapters.router import router as chapters_router
from settings.router import router as settings_router
from settings.status import router as settings_status_router
from settings.ai_router import router as settings_ai_router
from prompt.router import router as prompt_router
from write.router import router as write_router
from archive.router import router as archive_router
from threads.router import router as threads_router
from novel.router import router as novel_router
from story.router import router as story_router

# License 本地验证
from auth_local.router import router as auth_local_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="AI Novel (Local)", version="4.0.0", lifespan=lifespan)

# CORS（仅本地访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由（License 验证在最前面）
app.include_router(auth_local_router, prefix="/api/auth", tags=["auth"])

# 核心业务路由
app.include_router(projects_router, prefix="/api")
app.include_router(settings_router, prefix="/api/projects/{project_id}")
app.include_router(settings_status_router, prefix="/api/projects/{project_id}")
app.include_router(settings_ai_router, prefix="/api/projects/{project_id}")
app.include_router(chapters_router, prefix="/api/projects/{project_id}")
app.include_router(prompt_router, prefix="/api/projects/{project_id}")
app.include_router(write_router, prefix="/api/projects/{project_id}")
app.include_router(archive_router, prefix="/api/projects/{project_id}")
app.include_router(threads_router, prefix="/api/projects/{project_id}")
app.include_router(novel_router, prefix="/api/projects/{project_id}")
app.include_router(story_router, prefix="/api")

# 后端也挂载前端静态文件（以便 pywebview 直接访问）
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


@app.get("/api/health")
async def health():
    return {"status": "ok", "mode": "local"}
```

- [ ] **Step 4: 删除 SaaS 模块目录**

```bash
# 移除 auth, billing, admin 模块
rm -rf backend/auth/
rm -rf backend/billing/
rm -rf backend/admin/

# 确认 models 中的引用需要更新
# User 模型中的 billing 字段可以保留（SQLite 会自动加列），但不再使用
```

注意：需要检查 `models/` 中对 `TokenLog` 的引用。如果 `billing/service.py` 被删了但 `models.py` 中的 `TokenLog` ORM 模型还在，它不会影响 SQLite 使用（只是多一张空表）。可以保留模型定义避免改太多 import。

- [ ] **Step 5: 检查并清理所有 auth/billing/admin 的 import 引用**

在整个 `backend/` 目录中搜索 `from auth`、`from billing`、`from admin` 的 import，将所有依赖删除或替换。特别注意项目中是否有路由或服务代码 import 了 `auth.middleware.get_current_user`。C/S 架构下需要替换为 `auth_local` 模块的验证。


### Task 6: C 端后端 — auth_local 模块（本地 License 验证）

**Files:**
- Create: `backend/auth_local/__init__.py`
- Create: `backend/auth_local/models.py`
- Create: `backend/auth_local/service.py`
- Create: `backend/auth_local/router.py`

- [ ] **Step 1: 创建 models.py**

```python
# backend/auth_local/models.py
"""本地 License 缓存模型 — SQLite 表"""

from sqlalchemy import Column, String, DateTime, Boolean
from db import Base


class LicenseCache(Base):
    """License 本地缓存表"""
    __tablename__ = "license_cache"
    
    username = Column(String(64), primary_key=True)
    token = Column(String(512), nullable=False)  # JWT 缓存
    pc_hash = Column(String(128), nullable=False)
    pc_name = Column(String(128), default="")
    tier = Column(String(32), default="")
    expires_at = Column(String(32), nullable=False)  # ISO date
    last_verify_at = Column(String(32), nullable=False)  # ISO datetime
    locked = Column(Boolean, default=False)
```

- [ ] **Step 2: 创建 service.py**

```python
# backend/auth_local/service.py
"""S 端通信层 — 调用 CloudBase API + 本地缓存管理"""

import json
import os
import platform
import hashlib
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx

from config import SERVER_API_BASE

# 本地配置文件
CONFIG_DIR = os.environ.get("DATA_ROOT", "./data")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
GRACE_DAYS = 90  # 未心跳宽限天数


def get_local_config() -> dict:
    """读取本地配置"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def save_local_config(config: dict):
    """保存本地配置"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def load_or_create_config() -> dict:
    """加载配置，如不存在则创建默认"""
    cfg = get_local_config()
    changed = False
    defaults = {
        "username": "",
        "pc_hash": "",
        "pc_name": "",
        "api_key": "",
        "api_base_url": "https://api.deepseek.com/anthropic",
        "api_model": "deepseek-v4-flash",
        "tier": "",
        "expires_at": "",
        "last_verify_at": "",
        "locked": False,
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    # 自动生成 PC hash（如果不存在）
    if not cfg.get("pc_hash"):
        cfg["pc_hash"] = generate_pc_hash()
        cfg["pc_name"] = platform.node() or "My PC"
        changed = True
    if changed:
        save_local_config(cfg)
    return cfg


def generate_pc_hash() -> str:
    """生成本机唯一标识（CPU + 主板 + 磁盘的混合 hash）"""
    info = []
    try:
        # Windows 下取 wmic 信息
        import subprocess
        # CPU ID
        result = subprocess.run(
            ["wmic", "cpu", "get", "ProcessorId"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                info.append(lines[1].strip())
        # 主板序列号
        result = subprocess.run(
            ["wmic", "baseboard", "get", "SerialNumber"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                info.append(lines[1].strip())
        # 磁盘序列号
        result = subprocess.run(
            ["wmic", "diskdrive", "get", "SerialNumber"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            if len(lines) > 1:
                info.append(lines[1].strip())
    except Exception:
        pass
    raw = "-".join(info) or platform.node() or "unknown"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def call_server_api(endpoint: str, payload: dict) -> dict:
    """调 S 端 CloudBase API"""
    url = f"{SERVER_API_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            return resp.json()
    except httpx.TimeoutException:
        return {"code": -1, "msg": "网络超时"}
    except Exception as e:
        return {"code": -1, "msg": f"网络错误: {str(e)}"}


async def activate(activation_code: str, username: str, password: str,
                   security_question: str, security_answer: str) -> dict:
    """激活码激活 + 注册"""
    cfg = load_or_create_config()
    payload = {
        "activation_code": activation_code,
        "username": username,
        "password": password,
        "security_question": security_question,
        "security_answer": security_answer,
        "pc_hash": cfg["pc_hash"],
        "pc_name": cfg["pc_name"],
    }
    result = await call_server_api("activate", payload)
    if result.get("code") == 0:
        data = result["data"]
        cfg["username"] = username
        cfg["token"] = data["token"]
        cfg["tier"] = data["tier"]
        cfg["expires_at"] = data["expires_at"]
        cfg["last_verify_at"] = datetime.now().isoformat()
        cfg["locked"] = False
        save_local_config(cfg)
    return result


async def login(username: str, password: str) -> dict:
    """登录验证"""
    cfg = load_or_create_config()
    payload = {
        "username": username,
        "password": password,
        "pc_hash": cfg["pc_hash"],
        "pc_name": cfg["pc_name"],
    }
    result = await call_server_api("login", payload)
    if result.get("code") == 0:
        data = result["data"]
        cfg["username"] = username
        cfg["token"] = data["token"]
        cfg["tier"] = data["tier"]
        cfg["expires_at"] = data["expires_at"]
        cfg["last_verify_at"] = datetime.now().isoformat()
        cfg["locked"] = False
        save_local_config(cfg)
    return result


async def verify_license() -> dict:
    """启动时验证 License，支持离线缓存"""
    cfg = load_or_create_config()
    if not cfg.get("username") or not cfg.get("token"):
        return {"valid": False, "msg": "未激活"}

    # 先尝试联网验证
    payload = {
        "username": cfg["username"],
        "token": cfg["token"],
        "pc_hash": cfg["pc_hash"],
    }
    result = await call_server_api("verify", payload)
    
    now = datetime.now()
    
    if result.get("code") == 0:
        data = result["data"]
        if data.get("valid"):
            cfg["expires_at"] = data["expires_at"]
            cfg["last_verify_at"] = now.isoformat()
            cfg["locked"] = False
            save_local_config(cfg)
            return {"valid": True, "expires_at": data["expires_at"]}
        else:
            cfg["locked"] = True
            save_local_config(cfg)
            return {"valid": False, "msg": "License 无效或已过期"}
    
    # 联网验证失败，走本地缓存
    return verify_local_cache(cfg)


def verify_local_cache(cfg: dict) -> dict:
    """离线验证本地缓存"""
    if cfg.get("locked"):
        return {"valid": False, "msg": "License 已被锁定"}
    
    expires_at = cfg.get("expires_at", "")
    last_verify_at = cfg.get("last_verify_at", "")
    
    if not expires_at:
        return {"valid": False, "msg": "未检测到 License"}
    
    # 检查是否过期
    try:
        exp = date.fromisoformat(expires_at)
        if exp < date.today():
            return {"valid": False, "msg": "License 已过期"}
    except ValueError:
        return {"valid": False, "msg": "License 信息异常"}
    
    # 检查时钟回拨
    if last_verify_at:
        try:
            last = datetime.fromisoformat(last_verify_at)
            if datetime.now() < last:
                # 系统时间被回拨了
                return {"valid": False, "msg": "系统时间异常，请校准时间后重试"}
        except ValueError:
            pass
    
    # 检查离线宽限期
    if last_verify_at:
        try:
            last = datetime.fromisoformat(last_verify_at)
            delta = datetime.now() - last
            if delta > timedelta(days=GRACE_DAYS):
                return {"valid": False, "msg": f"已超过 {GRACE_DAYS} 天未联网验证，请连接网络后重启"}
        except ValueError:
            pass
    
    return {"valid": True, "expires_at": expires_at}


async def renew(activation_code: str) -> dict:
    """续期"""
    cfg = load_or_create_config()
    payload = {
        "username": cfg["username"],
        "token": cfg["token"],
        "activation_code": activation_code,
        "pc_hash": cfg["pc_hash"],
    }
    result = await call_server_api("renew", payload)
    if result.get("code") == 0:
        cfg["expires_at"] = result["data"]["new_expires_at"]
        save_local_config(cfg)
    return result


async def list_devices() -> dict:
    """查看已绑定设备"""
    cfg = load_or_create_config()
    payload = {"username": cfg["username"], "token": cfg["token"]}
    return await call_server_api("devices/list", payload)


async def remove_device(pc_hash: str) -> dict:
    """解绑设备"""
    cfg = load_or_create_config()
    payload = {"username": cfg["username"], "token": cfg["token"], "pc_hash": pc_hash}
    return await call_server_api("devices/remove", payload)


async def reset_password(security_answer: str, new_password: str) -> dict:
    """密保重置密码"""
    cfg = load_or_create_config()
    payload = {
        "username": cfg["username"],
        "security_answer": security_answer,
        "new_password": new_password,
    }
    return await call_server_api("reset_password", payload)
```

- [ ] **Step 3: 创建 router.py**

```python
# backend/auth_local/router.py
"""License 验证 API — C 端本地调用"""

from fastapi import APIRouter
from pydantic import BaseModel

from .service import (
    activate, login, verify_license, renew,
    list_devices, remove_device, reset_password,
    load_or_create_config, save_local_config, get_local_config
)

router = APIRouter(tags=["auth"])


class ActivateRequest(BaseModel):
    activation_code: str
    username: str
    password: str
    security_question: str
    security_answer: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RenewRequest(BaseModel):
    activation_code: str


class ResetPasswordRequest(BaseModel):
    security_answer: str
    new_password: str


class DeviceRemoveRequest(BaseModel):
    pc_hash: str


class ApiKeySaveRequest(BaseModel):
    api_key: str
    api_base_url: str
    api_model: str


@router.post("/activate")
async def api_activate(req: ActivateRequest):
    """激活码 + 注册"""
    result = await activate(
        req.activation_code.strip().upper(),
        req.username.strip(),
        req.password,
        req.security_question.strip(),
        req.security_answer.strip(),
    )
    return result


@router.post("/login")
async def api_login(req: LoginRequest):
    """登录"""
    return await login(req.username.strip(), req.password)


@router.post("/verify")
async def api_verify():
    """验证 License"""
    return await verify_license()


@router.post("/renew")
async def api_renew(req: RenewRequest):
    """续期"""
    return await renew(req.activation_code.strip().upper())


@router.get("/devices")
async def api_devices():
    """设备列表"""
    return await list_devices()


@router.post("/devices/remove")
async def api_devices_remove(req: DeviceRemoveRequest):
    """解绑设备"""
    return await remove_device(req.pc_hash)


@router.post("/reset-password")
async def api_reset_password(req: ResetPasswordRequest):
    """密保重置密码"""
    return await reset_password(req.security_answer, req.new_password)


@router.get("/config")
async def api_get_config():
    """获取本地配置（不含敏感字段）"""
    cfg = get_local_config()
    return {
        "username": cfg.get("username", ""),
        "pc_name": cfg.get("pc_name", ""),
        "pc_hash": cfg.get("pc_hash", ""),
        "tier": cfg.get("tier", ""),
        "expires_at": cfg.get("expires_at", ""),
        "last_verify_at": cfg.get("last_verify_at", ""),
        "has_api_key": bool(cfg.get("api_key")),
        "api_base_url": cfg.get("api_base_url", ""),
        "api_model": cfg.get("api_model", ""),
    }


@router.post("/config/api-key")
async def api_save_api_key(req: ApiKeySaveRequest):
    """保存 AI API Key"""
    cfg = get_local_config()
    cfg["api_key"] = req.api_key
    cfg["api_base_url"] = req.api_base_url
    cfg["api_model"] = req.api_model
    save_local_config(cfg)
    return {"code": 0, "msg": "保存成功"}
```

- [ ] **Step 4: 在其他路由中将 get_current_user 替换为本地验证**

原来所有路由都用 `Depends(get_current_user)` 从 JWT 中提取 user_id。在 C/S 模式下，这些验证不再需要，改为简单的 `auth_local` 验证：

```python
# 替换方案：在各路由中将
from auth.middleware import get_current_user
# 替换为本地配置读取

from auth_local.service import get_local_config

async def get_local_user():
    """简易的本地用户验证"""
    cfg = get_local_config()
    if not cfg.get("username") or not cfg.get("expires_at"):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="未激活")
    return {"id": cfg["username"], "username": cfg["username"]}
```

在实际修改时，每个路由将 `Depends(get_current_user)` 替换为 `Depends(get_local_user)`。

### Task 7: C 端后端 — AI Client 改造

**Files:**
- Modify: `backend/ai_client.py`
- Modify: `backend/ai_config.yaml`（可选，降级为默认配置）

- [ ] **Step 1: 改造 ai_client.py 支持动态 API Key**

```python
# backend/ai_client.py
"""Provider-agnostic AI client — 支持动态配置 API Key"""

import os
import json
from typing import Optional, AsyncIterator, Dict, Any

from auth_local.service import get_local_config, save_local_config


class AIClientConfig:
    """运行时 AI 客户端配置，从本地 config.json 读取"""
    
    def __init__(self):
        self._config = {}
        self._loaded = False
    
    def load(self):
        if self._loaded:
            return
        cfg = get_local_config()
        self.api_key = cfg.get("api_key", "")
        self.base_url = cfg.get("api_base_url", "")
        self.model = cfg.get("api_model", "")
        self.api_format = self._detect_format(self.base_url)
        self._loaded = True
    
    def _detect_format(self, base_url: str) -> str:
        """根据 base_url 判断 API 格式"""
        if "anthropic" in base_url:
            return "anthropic"
        return "openai"
    
    def reload(self):
        """重新加载配置（用户修改后调用）"""
        self._loaded = False
        self.load()


ai_config = AIClientConfig()


def get_client():
    """获取 AI 客户端实例，使用当前配置"""
    ai_config.load()
    if not ai_config.api_key:
        raise ValueError("未配置 API Key，请在设置页面填写")
    
    api_format = ai_config.api_format
    
    if api_format == "anthropic":
        from anthropic import AsyncAnthropic
        return AsyncAnthropic(
            api_key=ai_config.api_key,
            base_url=ai_config.base_url,
        )
    else:
        from openai import AsyncOpenAI
        return AsyncOpenAI(
            api_key=ai_config.api_key,
            base_url=ai_config.base_url,
        )


def get_model(model_type: str = "haiku") -> str:
    """获取模型名"""
    ai_config.load()
    return ai_config.model or "deepseek-v4-flash"


async def chat(messages: list, model_type: str = "haiku", max_tokens: int = 2048, **kwargs) -> str:
    """非流式对话"""
    client = get_client()
    model = get_model(model_type)
    
    if isinstance(client, __import__("anthropic").AsyncAnthropic):
        resp = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            **kwargs
        )
        return resp.content[0].text
    else:
        resp = await client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            **kwargs
        )
        return resp.choices[0].message.content


async def chat_stream(messages: list, model_type: str = "haiku", max_tokens: int = 4096, **kwargs) -> AsyncIterator[str]:
    """流式对话"""
    client = get_client()
    model = get_model(model_type)
    
    if isinstance(client, __import__("anthropic").AsyncAnthropic):
        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            **kwargs
        ) as stream:
            async for chunk in stream.text_stream:
                yield chunk
    else:
        stream = await client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            stream=True,
            **kwargs
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
```

注意：由于 `ai_client.py` 被大量模块引用（projects, ai_prefill, settings/ai_router, prompt/router, write, archive, story），改造时需要确保原有调用接口不变。上面的 `chat()` 和 `chat_stream()` 保持与原版相同的函数签名，只是内部实现改为读取动态配置。

- [ ] **Step 2: 全局搜索所有对 AIClient 类的引用，更新调用方式**

原代码中大部分地方使用：
```python
from ai_client import AIClient
client = AIClient()
result = await client.chat(...)
```

改造后使用：
```python
from ai_client import chat, chat_stream
result = await chat(messages, model_type, max_tokens)
```

需要更新所有调用点。可以添加向后兼容的包装，让新旧调用都工作。

- [ ] **Step 3: （可选）清理 ai_config.yaml**

该文件目前存储 DeepSeek API Key，改造后用户可以动态配置。可以将 ai_config.yaml 降级为默认 fallback，或直接删除。


### Task 8: C 端前端 — 路由改造 + 新增页面

**Files:**
- Create: `frontend/src/lib/license-api.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/auth.ts`
- Create: `frontend/src/pages/ActivatePage.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/ResetPasswordPage.tsx`
- Create: `frontend/src/pages/ApiKeyConfigPage.tsx`
- Create: `frontend/src/pages/DeviceManagePage.tsx`
- Remove: `frontend/src/pages/LoginPage.tsx`（原有）
- Remove: `frontend/src/pages/RegisterPage.tsx`
- Remove: `frontend/src/pages/admin/`

- [ ] **Step 1: 创建 license-api.ts**

```typescript
// frontend/src/lib/license-api.ts
/** S 端 CloudBase API 通信层 */

const SERVER_API = (window as any).__RUNTIME_CONFIG__?.SERVER_API_BASE || '';

interface ApiResult {
  code: number;
  msg?: string;
  data?: any;
}

async function callServer(endpoint: string, payload: any): Promise<ApiResult> {
  try {
    const res = await fetch(`${SERVER_API}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { code: -1, msg: '网络连接失败' };
  }
}

export async function apiActivate(
  activationCode: string, username: string, password: string,
  securityQuestion: string, securityAnswer: string
): Promise<ApiResult> {
  return callServer('activate', {
    activation_code: activationCode, username, password,
    security_question: securityQuestion, security_answer: securityAnswer,
  });
}

export async function apiLogin(username: string, password: string): Promise<ApiResult> {
  return callServer('login', { username, password });
}

export async function apiResetPassword(
  username: string, securityAnswer: string, newPassword: string
): Promise<ApiResult> {
  return callServer('reset_password', {
    username, security_answer: securityAnswer, new_password: newPassword,
  });
}
```

- [ ] **Step 2: 创建 ActivatePage.tsx**

```tsx
// frontend/src/pages/ActivatePage.tsx
import { useState } from 'react';
import { request } from '../lib/api';  // 统一走 localhost 后端

const apiActivate = async (code: string, username: string, password: string, q: string, a: string) =>
  request('/auth/activate', { method: 'POST', body: JSON.stringify({ activation_code: code, username, password, security_question: q, security_answer: a }) });

export default function ActivatePage() {
  const [step, setStep] = useState<'code' | 'register' | 'done'>('code');
  const [activationCode, setActivationCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!activationCode.trim()) { setError('请输入激活码'); return; }
    setError('');
    setStep('register');
  };

  const handleActivate = async () => {
    setError('');
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (!securityQuestion.trim()) { setError('请设置密保问题'); return; }
    if (!securityAnswer.trim()) { setError('请设置密保答案'); return; }
    setLoading(true);
    const res = await apiActivate(
      activationCode.trim(), username.trim(), password,
      securityQuestion.trim(), securityAnswer.trim()
    );
    setLoading(false);
    if (res.code === 0) {
      setStep('done');
    } else {
      setError(res.msg || '激活失败');
    }
  };

  if (step === 'done') {
    return (
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-3xl font-bold text-success">🎉 激活成功！</h1>
            <p className="py-4">现在可以去设置 AI API Key 开始创作了</p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/#/config'}>
              配置 API Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">AI Novel</h1>
          <p className="text-base-content/60">激活你的 License</p>
        </div>
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            {step === 'code' ? (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">激活码</span></label>
                  <input type="text" className="input input-bordered font-mono" placeholder="AC-XXXX-YYYY-ZZZZ-WWWW"
                    value={activationCode} onChange={e => setActivationCode(e.target.value.toUpperCase())} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleNext}>下一步</button>
              </>
            ) : (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered" placeholder="给自己起个名字"
                    value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密码</span></label>
                  <input type="password" className="input input-bordered" placeholder="至少 6 位"
                    value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">确认密码</span></label>
                  <input type="password" className="input input-bordered"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保问题</span></label>
                  <input type="text" className="input input-bordered" placeholder="例如：我最喜欢的城市是？"
                    value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保答案</span></label>
                  <input type="text" className="input input-bordered"
                    value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleActivate} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '激活并注册'}
                </button>
              </>
            )}
            <p className="text-xs text-base-content/40 text-center mt-2">
              没有激活码？<a href="https://shop.taobao.com" className="link" target="_blank">前往淘宝购买</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 LoginPage.tsx**

```tsx
// frontend/src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { setToken } from '../lib/auth';

const apiLogin = async (username: string, password: string) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    const res = await apiLogin(username.trim(), password);
    setLoading(false);
    if (res.code === 0) {
      setToken(res.data.token, username.trim());
      navigate('/novel');
    } else {
      setError(res.msg || '登录失败');
    }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">AI Novel</h1>
          <p className="text-base-content/60">登录你的账号</p>
        </div>
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="form-control">
              <label className="label"><span className="label-text">用户名</span></label>
              <input type="text" className="input input-bordered"
                value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">密码</span></label>
              <input type="password" className="input input-bordered"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && <p className="text-error text-sm">{error}</p>}
            <button className="btn btn-primary mt-4" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="loading loading-spinner" /> : '登录'}
            </button>
            <div className="flex justify-between mt-2 text-sm">
              <a href="/#/activate" className="link link-hover">激活新 License</a>
              <a href="/#/reset-password" className="link link-hover">忘记密码？</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 ResetPasswordPage.tsx**

```tsx
// frontend/src/pages/ResetPasswordPage.tsx
import { useState } from 'react';
import { request } from '../lib/api';

const apiResetPassword = async (username: string, answer: string, password: string) =>
  request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ username, security_answer: answer, new_password: password }) });

export default function ResetPasswordPage() {
  const [step, setStep] = useState<'username' | 'answer' | 'done'>('username');
  const [username, setUsername] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!username.trim()) { setError('请输入用户名'); return; }
    setError('');
    setStep('answer');
  };

  const handleReset = async () => {
    if (!securityAnswer.trim()) { setError('请输入密保答案'); return; }
    if (newPassword.length < 6) { setError('密码至少 6 位'); return; }
    setLoading(true);
    setError('');
    const res = await apiResetPassword(username.trim(), securityAnswer.trim(), newPassword);
    setLoading(false);
    if (res.code === 0) {
      setStep('done');
    } else {
      setError(res.msg || '重置失败');
    }
  };

  if (step === 'done') {
    return (
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-success">密码已重置</h1>
            <a href="/#/login" className="btn btn-primary mt-4">去登录</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">重置密码</h2>
            {step === 'username' ? (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered"
                    value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleNext}>下一步</button>
              </>
            ) : (
              <>
                <p className="text-sm">用户: {username}</p>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保答案</span></label>
                  <input type="text" className="input input-bordered"
                    value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">新密码</span></label>
                  <input type="password" className="input input-bordered" placeholder="至少 6 位"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleReset} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '重置'}
                </button>
              </>
            )}
            <a href="/#/login" className="link link-hover text-sm">返回登录</a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 ApiKeyConfigPage.tsx**

```tsx
// frontend/src/pages/ApiKeyConfigPage.tsx
import { useState, useEffect } from 'react';
import { getLocalConfig, saveApiKeyConfig } from '../lib/api';

export default function ApiKeyConfigPage() {
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.deepseek.com/anthropic');
  const [apiModel, setApiModel] = useState('deepseek-v4-flash');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocalConfig().then(cfg => {
      if (cfg.api_base_url) setApiBaseUrl(cfg.api_base_url);
      if (cfg.api_model) setApiModel(cfg.api_model);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) { alert('请输入 API Key'); return; }
    await saveApiKeyConfig(apiKey.trim(), apiBaseUrl.trim(), apiModel.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI 模型配置</h1>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="form-control">
            <label className="label">
              <span className="label-text">API Key</span>
            </label>
            <input type="password" className="input input-bordered" placeholder="sk-..."
              value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">API 地址</span>
            </label>
            <input type="text" className="input input-bordered"
              value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} />
            <label className="label">
              <span className="label-text-alt text-base-content/50">例如: https://api.deepseek.com/anthropic</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">模型名</span>
            </label>
            <input type="text" className="input input-bordered"
              value={apiModel} onChange={e => setApiModel(e.target.value)} />
          </div>
          <button className="btn btn-primary mt-4" onClick={handleSave}>
            {saved ? '✅ 已保存' : '保存配置'}
          </button>
        </div>
      </div>
      <div className="mt-6 p-4 bg-base-200 rounded-lg text-sm">
        <p className="font-bold mb-2">支持的 AI 供应商</p>
        <ul className="list-disc list-inside space-y-1 text-base-content/70">
          <li>DeepSeek: <code className="bg-base-300 px-1 rounded">https://api.deepseek.com/anthropic</code></li>
          <li>OpenAI: <code className="bg-base-300 px-1 rounded">https://api.openai.com/v1</code></li>
          <li>Anthropic: <code className="bg-base-300 px-1 rounded">https://api.anthropic.com/v1</code></li>
          <li>任意兼容 OpenAI/Anthropic 格式的 API</li>
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 创建 DeviceManagePage.tsx**

```tsx
// frontend/src/pages/DeviceManagePage.tsx
import { useState, useEffect } from 'react';
import { getDevices, removeDevice } from '../lib/api';

export default function DeviceManagePage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    setLoading(true);
    const res = await getDevices();
    if (res.code === 0) {
      setDevices(res.data.devices);
    }
    setLoading(false);
  };

  useEffect(() => { loadDevices(); }, []);

  const handleRemove = async (hash: string, name: string) => {
    if (!confirm(`确定解绑 "${name}" 吗？`)) return;
    await removeDevice(hash);
    loadDevices();
  };

  if (loading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">设备管理</h1>
      <p className="text-sm text-base-content/60 mb-4">最多绑定 3 台设备</p>
      {devices.length === 0 ? (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center text-base-content/50">暂无已绑定设备</div>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d, i) => (
            <div key={i} className="card bg-base-100 shadow-sm">
              <div className="card-body p-4 flex-row items-center justify-between">
                <div>
                  <p className="font-medium">{d.pc_name}</p>
                  <p className="text-xs text-base-content/50">最后活跃: {d.last_active_at?.slice(0, 10)}</p>
                </div>
                <button className="btn btn-ghost btn-sm text-error" onClick={() => handleRemove(d.pc_hash, d.pc_name)}>
                  解绑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 修改 App.tsx 路由**

```tsx
// frontend/src/App.tsx（关键修改部分）
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ActivatePage from './pages/ActivatePage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ApiKeyConfigPage from './pages/ApiKeyConfigPage';
import DeviceManagePage from './pages/DeviceManagePage';
import AuthGuard from './components/auth/AuthGuard';
// 保留其他页面

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/activate" element={<ActivatePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* 已激活用户路由 */}
        <Route element={<AuthGuard />}>
          <Route path="/config" element={<ApiKeyConfigPage />} />
          <Route path="/devices" element={<DeviceManagePage />} />
          {/* 保留原有的 novel/dashboard 等路由 */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/project/:id" element={<ProjectLayout />}>
            <Route index element={<NovelPage />} />
          </Route>
        </Route>
        
        {/* 默认跳转 */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 8: 修改 AuthGuard 适配 C/S 模式**

```tsx
// frontend/src/components/auth/AuthGuard.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '../../lib/auth';

export default function AuthGuard() {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 9: 修改 api.ts 适应本地后端**

```typescript
// frontend/src/lib/api.ts — 关键修改
const API_BASE = 'http://127.0.0.1:8000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/#/login';
    throw new Error('Unauthorized');
  }
  return res.json();
}

// 导出新函数
export async function getLocalConfig() {
  return request<any>('/auth/config');
}

export async function saveApiKeyConfig(apiKey: string, apiBaseUrl: string, apiModel: string) {
  return request<any>('/auth/config/api-key', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey, api_base_url: apiBaseUrl, api_model: apiModel }),
  });
}

export async function getDevices() {
  return request<any>('/auth/devices');
}

export async function removeDevice(pcHash: string) {
  return request<any>('/auth/devices/remove', {
    method: 'POST',
    body: JSON.stringify({ pc_hash: pcHash }),
  });
}
```

- [ ] **Step 10: 修改 auth.ts（本地 License token 管理）**

```typescript
// frontend/src/lib/auth.ts
const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_username';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  window.location.href = '/#/login';
}
```

- [ ] **Step 11: 删除原有前端 LoginPage.tsx、RegisterPage.tsx 和 admin/ 目录**

```bash
rm -f frontend/src/pages/LoginPage.tsx
rm -f frontend/src/pages/RegisterPage.tsx
rm -rf frontend/src/pages/admin/
```


### Task 9: PyInstaller 打包 + pywebview 入口

**Files:**
- Create: `packaging/pywebview_app.py`
- Create: `packaging/build.spec`
- Create: `packaging/requirements.txt`
- Create: `packaging/build.bat`

- [ ] **Step 1: 创建 pywebview_app.py**

```python
# packaging/pywebview_app.py
"""AI Novel 桌面应用入口 — pywebview 壳"""

import os
import sys
import json
import threading
import random
import subprocess
from pathlib import Path


# 确保能找到后端模块
backend_dir = Path(__file__).parent.parent / "backend"
if backend_dir.exists():
    sys.path.insert(0, str(backend_dir))


def start_server():
    """启动 FastAPI 后端"""
    import uvicorn
    # 使用随机端口避免冲突
    port = random.randint(18000, 18999)
    # 保存端口号供前端调用
    config_dir = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    config_dir.mkdir(parents=True, exist_ok=True)
    port_file = config_dir / "port.json"
    with open(port_file, "w") as f:
        json.dump({"port": port}, f)
    
    # 设置环境变量
    os.environ.setdefault("DATA_ROOT", str(config_dir / "data"))
    os.environ.setdefault("SERVER_API_BASE", "https://your-cloudbase-app.com/api")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


def main():
    """主入口"""
    # 在后台线程启动后端服务
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # 等待后端启动
    import time
    time.sleep(2)
    
    # 读取端口
    config_dir = Path(os.environ.get("APPDATA", ".")) / "AI Novel"
    port_file = config_dir / "port.json"
    with open(port_file) as f:
        port = json.load(f)["port"]
    
    # 启动 pywebview 窗口
    import webview
    window = webview.create_window(
        title="AI Novel",
        url=f"http://127.0.0.1:{port}",
        width=1400,
        height=900,
        min_size=(1024, 680),
        resizable=True,
        text_select=True,
    )
    webview.start(debug=False, window=window)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 创建 build.spec（PyInstaller 打包配置）**

```python
# packaging/build.spec
# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from pathlib import Path

block_cipher = None

# 项目根目录
root_dir = Path(__file__).parent.parent

# 前端构建产物目录
frontend_dist = root_dir / "frontend" / "dist"

# 后端代码
backend_dir = root_dir / "backend"

a = Analysis(
    ['pywebview_app.py'],
    pathex=[str(root_dir), str(backend_dir)],
    binaries=[],
    datas=[
        # 内嵌前端构建产物
        (str(frontend_dist / "index.html"), "frontend"),
        (str(frontend_dist / "assets"), "frontend/assets"),
        # 内嵌 reference 模板
        (str(root_dir / "reference"), "reference"),
    ],
    hiddenimports=[
        # SQLAlchemy 异步驱动
        'aiosqlite',
        'sqlalchemy.ext.asyncio',
        # AI SDK
        'anthropic',
        'openai',
        # 其他
        'yaml',
        'httpx',
        'passlib',
        'bcrypt',
        'jose',
        'multipart',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'PIL',
        'pandas',
        'numpy',
        'notebook',
        'test',
        'unittest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='AI Novel',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,           # 不显示控制台窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',         # 需要准备一个 .ico 图标文件
)
```

- [ ] **Step 3: 创建 packaging/requirements.txt**

```txt
# packaging/requirements.txt
# 打包额外依赖（除后端已有依赖外）
pywebview==5.4.1
```

- [ ] **Step 4: 创建 build.bat**

```bat
@echo off
REM AI Novel - 构建脚本
REM 前置条件: Node.js, Python 3.12, 已安装 requirements.txt

echo ===== AI Novel Build =====

REM 1. 构建前端
echo [1/4] Building frontend...
cd /d "%~dp0..\frontend"
call npm ci
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b 1
)

REM 2. 安装后端依赖
echo [2/4] Installing backend dependencies...
cd /d "%~dp0..\backend"
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Backend deps install failed!
    exit /b 1
)

REM 3. 安装打包依赖
echo [3/4] Installing packaging dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
pip install pyinstaller
if %errorlevel% neq 0 (
    echo Packaging deps install failed!
    exit /b 1
)

REM 4. 打包
echo [4/4] Building executable...
cd /d "%~dp0"
pyinstaller build.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo ===== Build Complete =====
echo Output: dist/AI Novel.exe
pause
```


### Task 10: S 端 CloudBase 部署与配置

- [ ] **Step 1: 初始化 CloudBase 环境**

```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli@latest

# 登录（需要腾讯云账号）
tcb login

# 初始化环境
tcb init
# 按提示配置: 环境 ID、地域、是否创建新环境
```

- [ ] **Step 2: 创建云数据库集合**

在 CloudBase 控制台手动创建三个集合，或通过云函数自动创建：

```bash
# 通过控制台创建:
# 集合: codes, users, devices, global_config
# 权限: 所有集合设为 "仅管理员可读写"（云函数通过管理员权限访问）
```

- [ ] **Step 3: 部署云函数**

```bash
# 逐个部署云函数
tcb functions:deploy activate -e <env_id>
tcb functions:deploy login -e <env_id>
tcb functions:deploy verify -e <env_id>
tcb functions:deploy renew -e <env_id>
tcb functions:deploy devices_list -e <env_id>
tcb functions:deploy devices_remove -e <env_id>
tcb functions:deploy reset_password -e <env_id>
tcb functions:deploy generate_code -e <env_id>
tcb functions:deploy query_codes -e <env_id>

# 设置云函数环境变量
tcb functions:config:set activate -e <env_id> --env JWT_SECRET=<your-secret>,ADMIN_TOKEN=<your-admin-token>
# 对所有函数重复上述命令
```

- [ ] **Step 4: 部署静态页面**

```bash
# 部署 Landing page
tcb hosting:deploy serverless/static/landing/index.html -e <env_id> --path /index.html

# 部署管理页面
tcb hosting:deploy serverless/static/admin/ -e <env_id> --path /admin/
```

- [ ] **Step 5: 配置 API 网关**

在 CloudBase 控制台中配置 HTTP 访问：
- 将云函数绑定到 HTTP 路径，例如 `POST /api/activate` → activate 函数
- 开启云函数 HTTP 触发


### Task 11: 端到端验证

- [ ] **Step 1: 发码验证**

通过发码管理页面生成一个年费激活码 → 确认码出现在数据库中。

- [ ] **Step 2: 激活验证**

1. 启动打包后的 AI Novel.exe
2. 进入激活页面，输入激活码 + 设置用户名密码 + 密保
3. 确认激活成功，自动跳转到主界面

- [ ] **Step 3: API Key 配置验证**

在配置页面填写 API Key → 保存 → 确认配置持久化。

- [ ] **Step 4: 创作流程验证**

1. 新建项目
2. 配置世界观/风格/角色
3. 创建卷纲 → 章纲
4. 生成提示词 → 写作
5. 归档
6. 确认所有页面正常、数据持久化在本地

- [ ] **Step 5: 设备管理验证**

1. 确认设备管理页面显示当前设备
2. 解绑设备 → 重新登录 → 确认设备重新绑定

- [ ] **Step 6: 续期验证**

输入一个新的年费激活码 → 确认到期日叠加正确。

- [ ] **Step 7: 离线验证**

1. 断网后重启软件
2. 确认本地缓存 License 有效，软件正常使用
3. 修改系统时间向后超过 90 天 → 重启 → 确认软件锁定

- [ ] **Step 8: 密码重置验证**

在登录页点击"忘记密码"→ 输入密保答案 → 重置密码 → 新密码登录成功。


### Task 12: P1 完善（后续迭代）

- [ ] **版本更新检查** — verify 接口返回最新版本号，C 端检测到新版本时提示用户下载
- [ ] **异常处理完善** — 网络超时友好提示、S 端不可用时的降级体验
- [ ] **安装包图标** — 准备 .ico 文件，打包时包含
- [ ] **代码签名证书** — 购买 Windows 代码签名证书，避免 SmartScreen 拦截
- [ ] **GitHub Release 自动化** — 自动构建并上传 .exe 到 GitHub Releases
- [ ] **淘宝发货自动化** — 可选: 提供简单的 API 给淘宝卖家，下单后自动生成码并返回
