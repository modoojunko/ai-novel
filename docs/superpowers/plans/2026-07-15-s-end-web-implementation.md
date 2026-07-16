# S端 Web 页面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** 为 S端 实现 Landing page + 登录/注册 + 我的账号（套餐/激活码/设备/账号信息）页面。

**Architecture:** 纯 HTML/CSS/JS 静态前端 + FastAPI JSON API。前端零依赖，文件在 `server/static/www/`，API 在 `server/local_server.py`。

**Tech Stack:** FastAPI, SQLite, 纯 HTML/CSS/JS

---

## 文件结构

```
server/
├── local_server.py              ★ 修改：新增 API + 挂载静态文件
├── static/
│   ├── landing/index.html       ★ 已有，调导航链接
│   ├── auth/login.html          ★ 已有 OAuth 授权页
│   ├── admin/index.html         ★ 已有发码管理
│   └── www/                     ★ 新增
│       ├── style.css              全局样式
│       ├── api.js                 封装 fetch + token 管理
│       ├── index.html             Landing page（入口）
│       ├── login.html             登录
│       ├── register.html          注册
│       ├── dashboard.html         我的账号（导航框架）
│       ├── license.html           我的套餐
│       ├── activate.html          激活新码
│       ├── devices.html           我的设备
│       └── account.html           账号信息
```

---

### Task 1: 静态文件基础设施

**Files:**
- Create: `server/static/www/api.js`
- Create: `server/static/www/style.css`

**Step 1: 创建 api.js**

封装 fetch 请求和 token 管理：

```javascript
// server/static/www/api.js
const API = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  return res.json();
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
}
```

**Step 2: 创建 style.css**

```css
/* server/static/www/style.css */
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#f0f2f5; color:#333; }

/* Layout */
.page-center { display:flex; justify-content:center; align-items:center; min-height:100vh; padding:20px; }
.card { background:#fff; padding:32px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); width:400px; max-width:100%; }
.card h1 { font-size:24px; text-align:center; margin-bottom:4px; }
.card .subtitle { font-size:14px; color:#888; text-align:center; margin-bottom:24px; }

/* Forms */
label { display:block; font-size:14px; font-weight:500; margin-bottom:4px; color:#555; }
input[type=text], input[type=password] { width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:8px; font-size:14px; margin-bottom:16px; transition:border-color .2s; }
input:focus { outline:none; border-color:#1a73e8; box-shadow:0 0 0 3px rgba(26,115,232,0.12); }
.btn { width:100%; padding:12px; background:#1a73e8; color:#fff; border:none; border-radius:8px; font-size:16px; font-weight:500; cursor:pointer; }
.btn:hover { background:#1557b0; }
.btn:disabled { background:#93b8f0; cursor:not-allowed; }
.btn-danger { background:#dc3545; }
.btn-danger:hover { background:#c82333; }

/* Messages */
.msg { padding:10px 14px; border-radius:8px; font-size:14px; margin-bottom:16px; display:none; }
.msg.success { display:block; background:#d4edda; color:#155724; }
.msg.error { display:block; background:#f8d7da; color:#721c24; }
.msg.info { display:block; background:#d1ecf1; color:#0c5460; }

/* Links */
.link { color:#1a73e8; text-decoration:none; font-size:14px; cursor:pointer; }
.link:hover { text-decoration:underline; }
.text-sm { font-size:13px; }
.text-center { text-align:center; }
.mt-3 { margin-top:16px; }

/* Dashboard Layout */
.dashboard { display:flex; min-height:100vh; }
.sidebar { width:220px; background:#1a1a2e; color:#fff; padding:24px 0; flex-shrink:0; }
.sidebar .logo { padding:0 24px 24px; font-size:18px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:16px; }
.sidebar nav a { display:flex; align-items:center; gap:10px; padding:12px 24px; color:rgba(255,255,255,0.7); text-decoration:none; font-size:14px; transition:all .2s; }
.sidebar nav a:hover, .sidebar nav a.active { background:rgba(255,255,255,0.08); color:#fff; }
.main { flex:1; padding:32px; overflow-y:auto; }
.main h2 { font-size:22px; margin-bottom:20px; }
.topbar { display:flex; justify-content:flex-end; align-items:center; padding:12px 32px; background:#fff; border-bottom:1px solid #e0e0e0; gap:16px; }
.topbar .username { font-size:14px; color:#666; }
```

**Step 3: 修改 local_server.py 挂载静态文件**

在 `local_server.py` 中，确保 FastAPI 挂载 `/` 路由时优先提供 `www/` 中的静态文件：

```python
# 在 app 初始化后添加
from fastapi.staticfiles import StaticFiles
www_path = Path(__file__).parent / "static" / "www"
if www_path.exists():
    app.mount("/", StaticFiles(directory=str(www_path), html=True), name="www")
else:
    # fallback to landing if www not ready yet
    landing_path = Path(__file__).parent / "static" / "landing"
    app.mount("/", StaticFiles(directory=str(landing_path), html=True), name="landing")
```

注意：需要把这段代码放在 API 路由注册之后，避免覆盖 API 路径。


### Task 2: 注册 + 登录页面 + API

**Files:**
- Create: `server/static/www/login.html`
- Create: `server/static/www/register.html`
- Modify: `server/local_server.py`

**Step 1: login.html**

```html
<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>登录 - AI Novel</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<div class="page-center">
<div class="card">
  <h1>AI Novel</h1>
  <p class="subtitle">登录你的账号</p>
  <div id="msg" class="msg"></div>
  <form id="form">
    <label>用户名</label><input type="text" id="username" autocomplete="username" required>
    <label>密码</label><input type="password" id="password" autocomplete="current-password" required>
    <button type="submit" class="btn" id="btn">登录</button>
  </form>
  <p class="text-center mt-3"><a href="/register.html" class="link">没有账号？注册</a></p>
</div></div>
<script src="/api.js"></script>
<script>
document.getElementById('form').onsubmit = async (e) => {
  e.preventDefault(); const btn=document.getElementById('btn'); btn.disabled=true;
  const msg=document.getElementById('msg');
  try {
    const res = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
    });
    const data = await res.json();
    if (data.code === 0) { localStorage.setItem('token', data.data.token); window.location.href = '/dashboard.html'; }
    else { msg.className='msg error'; msg.textContent=data.msg||'登录失败'; btn.disabled=false; }
  } catch(e) { msg.className='msg error'; msg.textContent='网络错误'; btn.disabled=false; }
};
</script></body></html>
```

**Step 2: register.html**

与 login.html 结构类似，增加密保问题/答案字段，提交到 `/api/register`。

**Step 3: local_server.py — 新增 API**

```python
# === 请求模型 ===
class RegisterRequest(BaseModel):
    username: str
    password: str
    security_question: str = ""
    security_answer: str = ""

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

class SecurityChangeRequest(BaseModel):
    security_question: str
    security_answer: str

class ActivateRequest2(BaseModel):
    code: str
```

```python
# === 工具函数 ===
import uuid
def generate_session_token() -> str:
    return str(uuid.uuid4()).replace("-", "")[:32]


# === API ===

@app.post("/api/login")
async def api_login(req: LoginRequest):
    """登录 → 返回 session token"""
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=?", (req.username.strip(),)).fetchone()
    if not user or not verify_password(req.password, user["password_hash"]):
        conn.close()
        return {"code": 1, "msg": "用户名或密码错误"}
    token = generate_session_token()
    conn.execute("INSERT OR REPLACE INTO auth_tokens (pc_hash, username, token, tier, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                 (f"web_{token[:8]}", user["username"], token, ""))
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"token": token}}


@app.post("/api/register")
async def api_register(req: RegisterRequest):
    """注册"""
    conn = get_db()
    existing = conn.execute("SELECT 1 FROM users WHERE username=?", (req.username.strip(),)).fetchone()
    if existing:
        conn.close()
        return {"code": 1, "msg": "用户名已存在"}
    conn.execute("INSERT INTO users (username, password_hash, security_question, security_answer_hash, status, created_at) VALUES (?, ?, ?, ?, 'active', datetime('now'))",
                 (req.username.strip(), hash_password(req.password), req.security_question, hash_password(req.security_answer)))
    token = generate_session_token()
    conn.execute("INSERT OR REPLACE INTO auth_tokens (pc_hash, username, token, tier, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
                 (f"web_{token[:8]}", req.username.strip(), token, ""))
    conn.commit()
    conn.close()
    return {"code": 0, "data": {"token": token, "message": "注册成功"}}


def _get_user_from_token(token: str):
    """从 token 获取用户信息"""
    conn = get_db()
    row = conn.execute("SELECT username FROM auth_tokens WHERE token=?", (token,)).fetchone()
    conn.close()
    return row["username"] if row else None


@app.get("/api/user/me")
async def api_user_me(token: str = ""):
    """当前用户信息"""
    # 从 Authorization header 或 query param 取 token
    username = _get_user_from_token(token)
    if not username:
        return {"code": 1, "msg": "未登录"}
    conn = get_db()
    user = conn.execute("SELECT username, security_question, created_at FROM users WHERE username=?", (username,)).fetchone()
    codes = conn.execute("SELECT code_id, tier, expires_at, activated_at FROM codes WHERE bound_username=? ORDER BY activated_at DESC", (username,)).fetchall()
    conn.close()
    # 计算合并到期日
    max_expires = None
    for c in codes:
        if c["expires_at"]:
            from datetime import date; e = date.fromisoformat(c["expires_at"])
            if max_expires is None or e > max_expires: max_expires = e
    tier = codes[0]["tier"] if codes else "none"
    return {"code": 0, "data": {
        "username": user["username"],
        "tier": tier,
        "expires_at": str(max_expires) if max_expires else "",
        "security_question": user["security_question"],
        "codes": [{"code_id": c["code_id"], "tier": c["tier"], "expires_at": c["expires_at"], "activated_at": c["activated_at"]} for c in codes],
    }}
```

注意：C端 OAuth 使用的 `/api/login` 和 `/api/register` 已经存在（用于 OAuth 授权流程）。新增的登录页 API 是独立的，使用 `auth_tokens` 表存 web session token。两者可以共存，互不冲突。


### Task 3: 我的账号 — 导航框架

**Files:**
- Create: `server/static/www/dashboard.html`

**Step 1: dashboard.html**

导航框架 + Hash 路由：

```html
<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>我的账号 - AI Novel</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<div class="dashboard">
  <div class="sidebar">
    <div class="logo">AI Novel</div>
    <nav>
      <a href="#license" class="active">📋 我的套餐</a>
      <a href="#activate">🔑 激活新码</a>
      <a href="#devices">💻 我的设备</a>
      <a href="#account">👤 账号信息</a>
    </nav>
  </div>
  <div style="flex:1;display:flex;flex-direction:column">
    <div class="topbar">
      <span class="username" id="username"></span>
      <a href="#" class="link" onclick="logout()">退出</a>
    </div>
    <div class="main" id="content">
      <p style="color:#888">加载中...</p>
    </div>
  </div>
</div>
<script src="/api.js"></script>
<script>
const PAGES = { license: '/license.html', activate: '/activate.html', devices: '/devices.html', account: '/account.html' };

async function loadPage() {
  // 验证登录
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return; }
  const user = await request(`/user/me?token=${token}`);
  if (user.code !== 0) { logout(); return; }
  document.getElementById('username').textContent = user.data.username;

  // 加载子页面
  const page = window.location.hash.slice(1) || 'license';
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${page}`));
  const pageFile = PAGES[page] || PAGES.license;
  const resp = await fetch(pageFile);
  const html = await resp.text();
  document.getElementById('content').innerHTML = html;
  if (window.pageInit) window.pageInit(user.data);
}

window.addEventListener('hashchange', loadPage);
loadPage();
</script></body></html>
```


### Task 4: 我的套餐 + 激活新码

**Files:**
- Create: `server/static/www/license.html`
- Create: `server/static/www/activate.html`
- Modify: `server/local_server.py`

**Step 1: license.html**

显示当前套餐信息 + 历史激活码列表：

```html
<div id="licenseContent">
  <h2>📋 我的套餐</h2>
  <div id="planCard" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:24px;border-radius:12px;margin-bottom:24px">
    <p style="font-size:14px;opacity:0.9">当前套餐</p>
    <p style="font-size:28px;font-weight:700" id="tierDisplay">-</p>
    <p style="font-size:14px;opacity:0.9;margin-top:8px">到期日：<span id="expiresDisplay">-</span></p>
  </div>
  <h3 style="margin-bottom:12px">历史激活码</h3>
  <div id="codeList"></div>
</div>
<script>
window.pageInit = function(user) {
  document.getElementById('tierDisplay').textContent = user.tier === 'none' ? '无套餐' : {monthly:'月付',quarterly:'季付',yearly:'年付',lifetime:'永久'}[user.tier] || user.tier;
  document.getElementById('expiresDisplay').textContent = user.expires_at || '-';
  const list = document.getElementById('codeList');
  if (!user.codes || user.codes.length === 0) { list.innerHTML = '<p style="color:#888">暂无激活记录</p>'; return; }
  list.innerHTML = user.codes.map(c => {
    const exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString('zh-CN') : '-';
    const act = c.activated_at ? new Date(c.activated_at).toLocaleDateString('zh-CN') : '-';
    return `<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin-bottom:8px">
      <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px">${c.code_id}</code>
      <span style="margin-left:12px;font-size:14px;color:#666">${c.tier}</span>
      <span style="margin-left:12px;font-size:13px;color:#999">激活于 ${act}</span>
      <span style="margin-left:12px;font-size:13px;color:#999">到期 ${exp}</span>
    </div>`;
  }).join('');
};
</script>
```

**Step 2: activate.html**

```html
<div style="max-width:480px">
  <h2>🔑 激活新码</h2>
  <p style="color:#888;margin-bottom:20px">在淘宝购买的激活码，在这里输入绑定到你的账号。</p>
  <div id="msg" class="msg"></div>
  <input type="text" id="code" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;font-family:monospace" placeholder="AC-XXXX-YYYY-ZZZZ-WWWW">
  <button class="btn" style="margin-top:16px" onclick="activateCode()">激活</button>
</div>
<script>
async function activateCode() {
  const msg = document.getElementById('msg'); msg.className = 'msg';
  const code = document.getElementById('code').value.trim().toUpperCase();
  if (!code) { msg.className='msg error'; msg.textContent='请输入激活码'; return; }
  const token = localStorage.getItem('token');
  const res = await request('/license/activate', { method:'POST', body:JSON.stringify({ code }) });
  if (res.code === 0) { msg.className='msg success'; msg.textContent='激活成功！到期日已叠加'; setTimeout(() => window.location.hash='#license', 1500); }
  else { msg.className='msg error'; msg.textContent=res.msg||'激活失败'; }
}
</script>
```

**Step 3: local_server.py — 新增 API**

```python
@app.post("/api/license/activate")
async def api_license_activate(req: ActivateRequest2, token: str = ""):
    """激活码绑定到当前登录用户"""
    username = _get_user_from_token(token)
    if not username: return {"code": 1, "msg": "未登录"}
    conn = get_db()
    code = conn.execute("SELECT * FROM codes WHERE code_id=?", (req.code.strip().upper(),)).fetchone()
    if not code: conn.close(); return {"code": 1, "msg": "无效的激活码"}
    if code["status"] != "unused": conn.close(); return {"code": 1, "msg": "激活码已被使用"}
    # 叠加到期日
    cur = conn.execute("SELECT MAX(expires_at) as mx FROM codes WHERE bound_username=? AND status='active'", (username,)).fetchone()
    base = date.fromisoformat(cur["mx"]) if cur and cur["mx"] else date.today()
    duration = {"monthly": 30, "quarterly": 90, "yearly": 365, "lifetime": 36500}
    new_expires = base + timedelta(days=duration.get(code["tier"], 30))
    conn.execute("UPDATE codes SET status='active', bound_username=?, activated_at=date('now'), expires_at=? WHERE code_id=?",
                 (username, new_expires.isoformat(), req.code.strip().upper()))
    conn.commit(); conn.close()
    return {"code": 0, "data": {"new_expires_at": new_expires.isoformat()}}
```

Where `token` comes from the request header. Update the route to read from Authorization header:

```python
@app.post("/api/license/activate")
async def api_license_activate(req: ActivateRequest2, authorization: str = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else ""
    ...
```

All protected endpoints should use the same pattern: read `Authorization: Bearer <token>` header, call `_get_user_from_token(token)`.


### Task 5: 我的设备 + 账号信息

**Files:**
- Create: `server/static/www/devices.html`
- Create: `server/static/www/account.html`
- Modify: `server/local_server.py`

**Step 1: devices.html**

```html
<div>
  <h2>💻 我的设备</h2>
  <p style="color:#888;margin-bottom:20px">最多绑定 <strong>3</strong> 台设备</p>
  <div id="deviceList"></div>
</div>
<script>
window.pageInit = async function() {
  const token = localStorage.getItem('token');
  const res = await request(`/device/my?token=${token}`);
  const list = document.getElementById('deviceList');
  if (!res.data || res.data.length === 0) { list.innerHTML = '<p style="color:#888">暂无已绑定设备</p>'; return; }
  list.innerHTML = res.data.map(d => {
    const last = d.last_active_at ? new Date(d.last_active_at).toLocaleDateString('zh-CN') : '-';
    return `<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div><span style="font-size:16px">${d.pc_name || '未知设备'}</span><br><span style="font-size:13px;color:#999">最后活跃: ${last}</span></div>
      <button class="btn btn-danger" style="width:auto;padding:6px 16px;font-size:13px" onclick="removeDevice('${d.pc_hash}')">解绑</button>
    </div>`;
  }).join('');
};
async function removeDevice(hash) {
  if (!confirm('确定解绑此设备？')) return;
  const token = localStorage.getItem('token');
  const res = await request('/device/remove', { method:'POST', body:JSON.stringify({ pc_hash: hash, token }) });
  if (res.code === 0) { window.pageInit(); }
}
</script>
```

**Step 2: account.html**

```html
<div style="max-width:480px">
  <h2>👤 账号信息</h2>
  <p style="margin-bottom:8px">用户名：<strong id="usernameDisplay"></strong></p>
  <p style="color:#888;font-size:13px;margin-bottom:24px">用户名不可修改</p>

  <div id="msg" class="msg"></div>
  <h3 style="margin-bottom:12px">修改密码</h3>
  <input type="password" id="oldPwd" placeholder="旧密码">
  <input type="password" id="newPwd" placeholder="新密码（至少6位）">
  <input type="password" id="confirmPwd" placeholder="确认新密码">
  <button class="btn" onclick="changePassword()">保存密码</button>

  <h3 style="margin:24px 0 12px">密保问题</h3>
  <p style="font-size:14px;color:#666;margin-bottom:8px">当前问题：<span id="currentQuestion">-</span></p>
  <input type="text" id="newQuestion" placeholder="新密保问题">
  <input type="password" id="newAnswer" placeholder="新密保答案">
  <button class="btn" onclick="changeSecurity()">保存密保</button>
</div>
<script>
window.pageInit = function(user) {
  document.getElementById('usernameDisplay').textContent = user.username;
  document.getElementById('currentQuestion').textContent = user.security_question || '未设置';
};
async function changePassword() {
  const msg = document.getElementById('msg'); msg.className='msg';
  const oldPwd = document.getElementById('oldPwd').value;
  const newPwd = document.getElementById('newPwd').value;
  const confirmPwd = document.getElementById('confirmPwd').value;
  if (!oldPwd || !newPwd) { msg.className='msg error'; msg.textContent='请填写完整'; return; }
  if (newPwd !== confirmPwd) { msg.className='msg error'; msg.textContent='两次密码不一致'; return; }
  if (newPwd.length < 6) { msg.className='msg error'; msg.textContent='密码至少6位'; return; }
  const token = localStorage.getItem('token');
  const res = await request('/user/password', { method:'PUT', body:JSON.stringify({ old_password: oldPwd, new_password: newPwd, token }) });
  if (res.code === 0) { msg.className='msg success'; msg.textContent='密码已修改'; document.getElementById('oldPwd').value=''; document.getElementById('newPwd').value=''; document.getElementById('confirmPwd').value=''; }
  else { msg.className='msg error'; msg.textContent=res.msg||'修改失败'; }
}
async function changeSecurity() {
  ...
}
</script>
```

**Step 3: local_server.py — 新增 API**

```python
@app.get("/api/device/my")
async def api_device_my(token: str = ""):
    username = _get_user_from_token(token)
    if not username: return {"code": 1, "msg": "未登录"}
    conn = get_db()
    devices = conn.execute("SELECT pc_hash, pc_name, last_active_at FROM devices WHERE username=?", (username,)).fetchall()
    conn.close()
    return {"code": 0, "data": [dict(d) for d in devices]}

@app.delete("/api/device/{pc_hash}")
async def api_device_delete(pc_hash: str, token: str = ""):
    username = _get_user_from_token(token)
    if not username: return {"code": 1, "msg": "未登录"}
    conn = get_db()
    conn.execute("DELETE FROM devices WHERE username=? AND pc_hash=?", (username, pc_hash))
    conn.commit(); conn.close()
    return {"code": 0, "data": {"success": True}}
```

For `/api/user/password` and `/api/user/security`, implement as:

```python
@app.put("/api/user/password")
async def api_user_password(body: dict):
    token = body.get("token", "")
    username = _get_user_from_token(token)
    if not username: return {"code": 1, "msg": "未登录"}
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not verify_password(body.get("old_password",""), user["password_hash"]):
        conn.close(); return {"code": 1, "msg": "旧密码错误"}
    if len(body.get("new_password","")) < 6:
        conn.close(); return {"code": 1, "msg": "密码至少6位"}
    conn.execute("UPDATE users SET password_hash=? WHERE username=?", (hash_password(body["new_password"]), username))
    conn.commit(); conn.close()
    return {"code": 0, "data": {"success": True}}

@app.put("/api/user/security")
async def api_user_security(body: dict):
    token = body.get("token", "")
    username = _get_user_from_token(token)
    if not username: return {"code": 1, "msg": "未登录"}
    conn = get_db()
    conn.execute("UPDATE users SET security_question=?, security_answer_hash=? WHERE username=?",
                 (body.get("security_question",""), hash_password(body.get("security_answer","")), username))
    conn.commit(); conn.close()
    return {"code": 0, "data": {"success": True}}
```


### Task 6: Landing page 导航更新

**Files:**
- Modify: `server/static/landing/index.html`

在 Landing page 顶部导航（如果有）或底部添加指向新页面的链接：
- 登录 → `/login.html`
- 注册 → `/register.html`
- 下载链接保持不变

如果没有导航区域，添加一个简单的顶部栏：

```html
<div style="display:flex;justify-content:space-between;align-items:center;max-width:800px;margin:0 auto;padding:16px 20px">
  <b style="font-size:20px">📝 AI Novel</b>
  <div><a href="/login.html" class="link" style="margin-right:16px">登录</a><a href="/register.html" class="link">注册</a></div>
</div>
```


### Task 7: Admin 页面风格统一

**Files:**
- Modify: `server/static/admin/index.html`

更新 admin 页面的 CSS 引用，使用 `www/style.css` 中的样式，保持视觉一致。或者加一个到 admin 页面的导航链接。


### Task 8: 端到端测试

**Step 1: 启动 S端**

```bash
python server/local_server.py
```

**Step 2: 测试注册**

浏览器打开 `http://127.0.0.1:19000/register.html` → 创建用户 → 自动登录跳转到 dashboard。

**Step 3: 测试套餐展示**

Dashboard 默认显示"我的套餐" → 确认无套餐时显示"无套餐"。

**Step 4: 测试激活码**

通过 `/api/generate_code` 生成一个码，然后在页面输入激活 → 确认套餐信息更新。

**Step 5: 测试设备**

确认设备列表为空或少（取决于是否有 C端 授权过的设备）。

**Step 6: 测试账号信息**

修改密码 → 退出 → 用新密码登录成功。

**Step 7: C端 OAuth 不受影响**

确认 `http://127.0.0.1:19000/api/auth-page?pc_hash=test` 仍然正常工作。
