"""运营管理 API：generate_code, query_codes。"""
from __future__ import annotations

from fastapi import Depends

from app.config import settings
from app.domain.licensing import ActivationCode, tier_policy
from app.infrastructure.repositories.factory import code_repo
from app.interfaces.admin_api.router import router as r
from app.interfaces.deps import Db, get_db
from app.interfaces.dto import GenerateCodeRequest, QueryCodesRequest


@r.post("/api/generate_code")
async def api_generate_code(req: GenerateCodeRequest, db: Db = Depends(get_db)):
    if req.admin_token != settings.ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}
    if req.tier not in settings.TIER_POLICY:
        return {"code": 1, "msg": "无效的套餐类型"}
    if req.count < 1 or req.count > 100:
        return {"code": 1, "msg": "生成数量 1-100"}

    import secrets
    import string
    def _gen_code():
        chars = string.ascii_uppercase + string.digits
        return f"AC-{'-'.join(''.join(secrets.choice(chars) for _ in range(4)) for _ in range(4))}"

    repo = code_repo(db)
    generated = []
    for _ in range(req.count):
        code_id = _gen_code()
        cd = ActivationCode(
            code_id=code_id,
            tier=req.tier,
            duration_days=tier_policy.get_duration_days(req.tier),
            status="unused",
            bound_username="",
            expires_at=None,
            activated_at=None,
            created_at=None,
            created_by="admin",
        )
        repo.create(cd)
        generated.append(code_id)

    db.commit()
    return {"code": 0, "data": {"codes": generated, "count": len(generated)}}


@r.post("/api/query_codes")
async def api_query_codes(req: QueryCodesRequest, db: Db = Depends(get_db)):
    if req.admin_token != settings.ADMIN_TOKEN:
        return {"code": 3, "msg": "管理员验证失败"}
    repo = code_repo(db)
    if req.username:
        codes = repo.find_all_by_username(req.username)
    else:
        codes = repo.find_all(limit=200)

    code_list = [{
        "code_id": c.code_id,
        "tier": c.tier,
        "status": c.status,
        "bound_username": c.bound_username,
        "expires_at": str(c.expires_at) if c.expires_at else "",
        "created_at": str(c.created_at) if c.created_at else "",
    } for c in codes]
    return {"code": 0, "data": {"codes": code_list}}
