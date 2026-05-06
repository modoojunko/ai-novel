from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from auth.service import (
    create_access_token,
    create_user,
    get_user_by_email,
    get_user_by_id,
    verify_password,
)
from db import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    display_name: str = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    user: dict


@router.post("/register", status_code=201)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    if await get_user_by_email(db, body.email):
        raise HTTPException(409, "Email already registered")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    user = await create_user(db, body.email, body.password, body.display_name)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=_user_dict(user))


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=_user_dict(user))


@router.get("/me")
async def me(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    u = await get_user_by_id(db, user["id"])
    return _user_dict(u)


def _user_dict(u) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "display_name": u.display_name,
        "token_balance": u.token_balance,
        "plan": u.plan,
        "total_tokens": u.total_tokens,
    }
