from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.service import decode_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    return {"id": user_id}
