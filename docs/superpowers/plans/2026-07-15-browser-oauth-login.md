# 浏览器 OAuth 登录方案

> **For agentic workers:** Use subagent-driven-development to implement task-by-task.

**Goal:** C端通过打开系统浏览器让用户在 S端 网页登录，拿到 token 后完成本地授权，C端不存用户名密码。

**架构:** 
```
C端 → 打开系统浏览器 → S端登录页面 (landing page)
用户登录成功 → S端数据库记录 pc_hash 已授权
C端 后台轮询 S端: "pc_hash=xxx 授权了吗?"
S端 返回 token + 用户信息
C端 存 token 到本地 config.json，30天会话开始
```

**Tech Stack:** 后端 Python (FastAPI), 前端 React, S端 任意 (当前 local_server.py)

**权限模型:** S端 用户有 `tier`（monthly/quarterly/yearly/lifetime/none），授权时传给 C端。C端 根据 tier 控制功能：
- `none`（无套餐）: 仅能打开软件看界面，不能写作
- `monthly/quarterly/yearly`: 全部功能可用，到期日由 S端 管理
- `lifetime`: 全部功能永久可用

---

## Task 1: S端 新增授权页面 + 轮询 API

**Files:**
- Modify: `server/local_server.py`
- Create: `server/static/auth/login.html`

**Step 1: 创建登录页 HTML**

一个极简的 S端 登录页面，用户输入用户名密码后提交：

```html
<!-- server/static/auth/login.html -->
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AI Novel 登录</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,sans-serif; background:#f0f2f5; display:flex; justify-content:center; align-items:center; min-height:100vh; }
  .card { background:#fff; padding:32px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.1); width:360px; }
  h1 { font-size:24px; margin-bottom:8px; text-align:center; }
  .desc { font-size:14px; color:#666; text-align:center; margin-bottom:24px; }
  label { display:block; font-size:14px; margin-bottom:4px; }
  input { width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-bottom:16px; font-size:14px; }
  button { width:100%; padding:12px; background:#1a73e8; color:#fff; border:none; border-radius:6px; font-size:16px; cursor:pointer; }
  button:hover { background:#1557b0; }
  .msg { margin-top:12px; padding:8px; border-radius:6px; font-size:14px; display:none; }
  .msg.success { display:block; background:#d4edda; color:#155724; }
  .msg.error { display:block; background:#f8d7da; color:#721c24; }
</style>
</head>
<body>
<div class="card">
  <h1>AI Novel</h1>
  <p class="desc">登录以授权此设备</p>
  <div id="msg" class="msg"></div>
  <form id="loginForm">
    <label>用户名</label><input type="text" id="username" required>
    <label>密码</label><input type="password" id="password" required>
    <button type="submit">登录授权</button>
  </form>
</div>
<script>
  const params = new URLSearchParams(window.location.search);
  const pcHash = params.get('pc_hash');
  const redirect = params.get('redirect');

  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.className = 'msg';
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
      const res = await fetch('/api/authorize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password, pc_hash: pcHash })
      });
      const data = await res.json();
      if (data.code === 0) {
        msg.className = 'msg success';
        msg.textContent = '授权成功！此窗口可以关闭了';
        // 通知 C端 轮询已就绪（可选，靠轮询就行）
      } else {
        msg.className = 'msg error';
        msg.textContent = data.msg || '登录失败';
      }
    } catch(e) {
      msg.className = 'msg error';
      msg.textContent = '网络错误';
    }
  };
</script>
</body>
</html>
```

**Step 2: 添加 S端 authorize API**

在 `server/local_server.py` 中新增：

```python
class AuthorizeRequest(BaseModel):
    username: str
    password: str
    pc_hash: str


@app.get("/api/auth-page")
async def api_auth_page(pc_hash: str = "", redirect: str = ""):
    """返回登录 HTML 页面"""
    from pathlib import Path
    html_path = Path(__file__).parent / "static" / "auth" / "login.html"
    if html_path.exists():
        content = html_path.read_text(encoding="utf-8")
        return HTMLResponse(content)
    return HTMLResponse("登录页面不可用", status_code=503)


@app.post("/api/authorize")
async def api_authorize(req: AuthorizeRequest):
    """用户名密码验证 + 绑定 pc_hash"""
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=?", (req.username.strip(),)).fetchone()
    if not user or not verify_password(req.password, user["password_hash"]):
        conn.close()
        return {"code": 1, "msg": "用户名或密码错误"}

    # 查用户套餐
    codes_row = conn.execute(
        "SELECT tier, expires_at FROM codes WHERE bound_username=? AND status='active' ORDER BY expires_at DESC LIMIT 1",
        (user["username"],)
    ).fetchone()
    tier = codes_row["tier"] if codes_row else "none"
    expires_at = codes_row["expires_at"] if codes_row else ""

    # 记录该 pc_hash 已授权（含套餐信息）
    conn.execute(
        "INSERT OR REPLACE INTO auth_tokens (pc_hash, username, token, tier, expires_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        (req.pc_hash, user["username"], f"oauth-token-{req.pc_hash[:8]}", tier, expires_at)
    )
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"message": "授权成功", "tier": tier, "expires_at": expires_at}}


@app.get("/api/check-auth")
async def api_check_auth(pc_hash: str = ""):
    """C端 轮询：该 pc_hash 是否已授权"""
    if not pc_hash:
        return {"code": 1, "msg": "缺少 pc_hash"}
    conn = get_db()
    row = conn.execute("SELECT token, username FROM auth_tokens WHERE pc_hash=?", (pc_hash,)).fetchone()
    conn.close()
    if row:
        return {"code": 0, "data": {
            "token": row["token"],
            "username": row["username"],
            "tier": row["tier"],
            "expires_at": row["expires_at"],
        }}
    return {"code": 1, "msg": "等待授权"}
```

**Step 3: 建 auth_tokens 表**

在 `init_db()` 中添加：
```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
    pc_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    token TEXT NOT NULL,
    tier TEXT DEFAULT 'none',
    expires_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);
```

Also add `from fastapi.responses import HTMLResponse` to the imports.

**Step 4: 验证**

```bash
python server/local_server.py
# 访问 http://127.0.0.1:19000/api/auth-page?pc_hash=test
# 应该看到登录页面
```


### Task 2: C端 后端 — browser_auth 认证流

**Files:**
- Modify: `client/backend/auth_local/service.py`
- Modify: `client/backend/auth_local/router.py`

**Step 1: 替换 login/register 为 browser_auth**

```python
# 在 auth_local/service.py 中

import webbrowser  # 新增导入

SESSION_DAYS = 30
POLL_INTERVAL = 2  # 轮询间隔（秒）
POLL_TIMEOUT = 120  # 轮询超时（秒）


async def browser_auth() -> dict:
    """打开浏览器让用户在 S端 登录，轮询等待授权"""
    cfg = load_or_create_config()
    pc_hash = cfg["pc_hash"]

    # DEV_MODE: 跳过
    if os.environ.get("DEV_MODE"):
        cfg["username"] = "devuser"
        cfg["last_login_at"] = datetime.now().isoformat()
        cfg["token"] = "dev-token"
        save_local_config(cfg)
        return {"code": 0, "data": {"message": "开发模式", "token": "dev-token"}}

    # 打开浏览器到 S端 授权页面
    auth_url = f"{SERVER_API_BASE}/auth-page?pc_hash={pc_hash}"
    webbrowser.open(auth_url)

    # 后台轮询授权结果
    import asyncio
    start = time.time()
    while time.time() - start < POLL_TIMEOUT:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{SERVER_API_BASE}/check-auth", params={"pc_hash": pc_hash})
                data = resp.json()
                if data.get("code") == 0:
                    token_data = data["data"]
                    cfg["username"] = token_data["username"]
                    cfg["token"] = token_data["token"]
                    cfg["tier"] = token_data.get("tier", "none")
                    cfg["expires_at"] = token_data.get("expires_at", "")
                    cfg["last_login_at"] = datetime.now().isoformat()
                    save_local_config(cfg)
                    return {"code": 0, "data": {"message": "授权成功", "tier": cfg["tier"]}}
        except Exception:
            pass
        await asyncio.sleep(POLL_INTERVAL)

    return {"code": -1, "msg": "授权超时，请重新尝试"}
```

**Step 2: 简化 router**

```python
# auth_local/router.py — 只保留 browser_auth 相关

@router.post("/browser-auth")
async def api_browser_auth():
    """打开浏览器 OAuth 登录"""
    return await browser_auth()
```

移除旧的 `login`, `register`, `reset_password` 等不再需要的接口。

**Step 3: 验证语法**

```bash
python -c "import ast; ast.parse(open('client/backend/auth_local/service.py',encoding='utf-8').read()); print('OK')"
```


### Task 3: C端 前端 — 简化 LoginPage

**Files:**
- Modify: `client/frontend/src/pages/LoginPage.tsx`
- Modify: `client/frontend/src/pages/ResetPasswordPage.tsx`（可能有）
- Modify: `client/frontend/src/App.tsx`

**Step 1: 简化 LoginPage**

去掉用户名密码输入框，改为一个按钮：

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBrowserAuth = async () => {
    setLoading(true);
    setError('');
    const res = await request('/auth/browser-auth', { method: 'POST' });
    setLoading(false);
    if (res.code === 0) {
      navigate('/dashboard');
    } else {
      setError(res.msg || '登录失败');
    }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col text-center">
        <h1 className="text-3xl font-bold">AI Novel</h1>
        <p className="text-base-content/60 mb-4">登录以授权此设备</p>
        <button className="btn btn-primary btn-lg" onClick={handleBrowserAuth} disabled={loading}>
          {loading ? <span className="loading loading-spinner" /> : '打开浏览器登录'}
        </button>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <p className="text-xs text-base-content/40 mt-4">将在系统浏览器中打开登录页面</p>
      </div>
    </div>
  );
}
```

**Step 2: 更新 App.tsx**

移除 `/register` 路由、移除 `ResetPasswordPage` 导入。

**Step 3: 构建前端**

```bash
cd client/frontend && npm run build
```


### Task 4: 端到端测试

**Step 1: 启动 S端 本地测试服务器**

```bash
python server/local_server.py
```

**Step 2: 启动 C端 后端**

```bash
cd client/backend && DATA_ROOT=./data uvicorn main:app --port 8000
```

**Step 3: 准备测试用户**

通过 `POST http://127.0.0.1:19000/api/register` 创建一个测试用户。

**Step 4: 浏览器 OAuth 流程**

1. POST `http://127.0.0.1:8000/api/auth/browser-auth` → C端 打开浏览器
2. 浏览器显示 `http://127.0.0.1:19000/api/auth-page?pc_hash=xxx`
3. 输入用户名密码 → 提交 → 显示"授权成功"
4. C端 轮询到授权 → 返回 token → 跳转到主界面


### 权限控制

C端 启动时验证 `config.json` 中的 `tier` 和 `expires_at`：

| tier | 权限 |
|------|------|
| `none` | 仅能看到欢迎页面 + 购买套餐引导 |
| `monthly` / `quarterly` / `yearly` | 全部功能，检查 `expires_at` 是否过期 |
| `lifetime` | 全部功能，不过期 |

`auth_local/service.py` 新增权限检查函数：

```python
def check_permission(cfg: dict) -> dict:
    tier = cfg.get("tier", "none")
    expires_at = cfg.get("expires_at", "")
    if tier == "none":
        return {"allowed": False, "reason": "no_tier", "msg": "请购买套餐后使用"}
    if tier in ("monthly", "quarterly", "yearly"):
        from datetime import date
        try:
            if date.fromisoformat(expires_at) < date.today():
                return {"allowed": False, "reason": "expired", "msg": "套餐已过期"}
        except ValueError:
            return {"allowed": False, "reason": "invalid", "msg": "套餐信息异常"}
    return {"allowed": True, "tier": tier}
```


### Task 5: 打包验证

**Step 1: 构建安装包**

```bash
cd client/packaging/build && build.bat
```

**Step 2: 安装测试**

安装后运行，确认：
- 点击"打开浏览器登录" → 弹出系统浏览器
- 浏览器指向 S端 地址（没有部署 CloudBase 时需配置本地地址）
- 授权完成后自动回到 C端
