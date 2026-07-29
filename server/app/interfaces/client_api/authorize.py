"""C端 OAuth 授权流：auth-page / authorize / check-auth。"""
from __future__ import annotations
import logging
from fastapi import Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.interfaces.deps import get_db
from app.interfaces.dto import AuthorizeRequest
from app.application.devices.authorize_device import authorize_device
from app.infrastructure.repositories.user_repo import UserRepo
from app.infrastructure.repositories.code_repo import CodeRepo
from app.infrastructure.repositories.device_repo import DeviceRepo
from app.infrastructure.repositories.grant_repo import GrantRepo

logger = logging.getLogger("api.client.auth")

AUTH_PAGE_HTML = """\
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>AI Novel 授权</title>
<style>
body{font-family:sans-serif;max-width:400px;margin:50px auto;padding:0 20px}
input{width:100%;padding:8px;margin:6px 0;box-sizing:border-box}
button{width:100%;padding:10px;background:#4f46e5;color:#fff;border:none;border-radius:4px;cursor:pointer}
.error{color:#dc2626;display:none}
</style>
</head>
<body>
<h2>AI Novel 设备授权</h2>
<form id="authForm">
<input type="hidden" name="pc_hash" id="pc_hash">
<input type="hidden" name="device_profile" id="device_profile">
<label>用户名</label><input type="text" name="username" id="username" required>
<label>密码</label><input type="password" name="password" id="password" required>
<button type="submit">授权登录</button>
<p class="error" id="errorMsg"></p>
</form>
<script>
document.getElementById('authForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const params = new URLSearchParams(window.location.search);
  document.getElementById('pc_hash').value = params.get('pc_hash') || '';
  document.getElementById('device_profile').value = params.get('device_profile') || '';
  const resp = await fetch('/api/authorize', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    pc_hash: document.getElementById('pc_hash').value,
    device_profile: document.getElementById('device_profile').value
  })});
  const data = await resp.json();
  if(data.code === 0){document.body.innerHTML='<h2>授权成功</h2><p>请返回应用继续使用。</p>';}
  else{document.getElementById('errorMsg').style.display='block';document.getElementById('errorMsg').textContent=data.msg||'授权失败';}
});
</script>
</body>
</html>"""

from app.interfaces.client_api.router import router as r


@r.get("/api/auth-page")
async def api_auth_page(request: Request):
    """返回授权页面（C端 OAuth 流程）。"""
    return HTMLResponse(AUTH_PAGE_HTML)


@r.post("/api/authorize")
async def api_authorize(
    req: AuthorizeRequest,
    db: Session = Depends(get_db),
):
    logger.info("event=authorize.start user=%s", req.username)
    result = authorize_device(
        UserRepo(db), CodeRepo(db), DeviceRepo(db), GrantRepo(db),
        username=req.username.strip(),
        password=req.password,
        pc_hash=req.pc_hash,
        pc_name=req.pc_name,
        device_profile_b64=req.device_profile,
    )
    logger.info("event=authorize.result user=%s code=%d", req.username, result["code"])
    if result["code"] == 0:
        db.commit()
    return result


@r.get("/api/check-auth")
async def api_check_auth(pc_hash: str = "", db: Session = Depends(get_db)):
    """C端 轮询：该 pc_hash 是否已授权。"""
    if not pc_hash:
        return {"code": 1, "msg": "缺少 pc_hash"}
    try:
        grant = GrantRepo(db).get(pc_hash)
        if grant:
            from app.domain.licensing import License
            codes = CodeRepo(db).find_active_by_username(grant.username)
            license_ = License(username=grant.username).merge(codes)
            return {
                "code": 0,
                "data": {
                    "token": grant.token,
                    "username": grant.username,
                    "tier": license_.effective_tier,
                    "expires_at": license_.max_expires_at.isoformat() if license_.max_expires_at else "",
                },
            }
        return {"code": 1, "msg": "等待授权"}
    except Exception:
        logger.error("event=check_auth_error pc_hash=%s", pc_hash, exc_info=True)
        return {"code": -1, "msg": "内部错误，请查看服务器日志"}
