# Novel SaaS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkbox syntax.

**Goal:** Multi-user web platform for AI-assisted novel writing, 6-phase workflow, streaming prose generation, token billing.

**Architecture:** FastAPI backend + Next.js frontend, PostgreSQL for user/project metadata, filesystem for novel data, SSE streaming for real-time generation, JWT auth, single Docker Compose deploy.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Next.js 14, TypeScript, shadcn/ui, PostgreSQL 16, Nginx

---

## Phase 0 — Project Scaffolding

### Task 0.1: Monorepo + Backend Skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/db.py`
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `nginx/nginx.conf`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - novel_data:/data/projects
    depends_on: [backend, frontend]

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://novel:novel@postgres:5432/novelsaas
      JWT_SECRET: ${JWT_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      DATA_ROOT: /data/projects
    volumes: [novel_data:/data/projects]
    depends_on: [postgres]

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: /api

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: novel
      POSTGRES_PASSWORD: novel
      POSTGRES_DB: novelsaas
    volumes: [pgdata:/var/lib/postgresql/data]

volumes:
  pgdata:
  novel_data:
```

- [ ] **Step 2: Create backend/requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
pydantic==2.9.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
anthropic==0.39.0
pyyaml==6.0.2
python-multipart==0.0.12
```

- [ ] **Step 3: Create backend/config.py**

```python
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://novel:novel@localhost:5432/novelsaas")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
DATA_ROOT = os.getenv("DATA_ROOT", "/data/projects")
```

- [ ] **Step 4: Create backend/db.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

- [ ] **Step 5: Create backend/main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Novel SaaS", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 7: Create nginx/nginx.conf**

```nginx
events { worker_connections 1024; }
http {
    server {
        listen 80;
        location /api/ {
            proxy_pass http://backend:8000/api/;
            proxy_buffering off;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
        }
    }
}
```

- [ ] **Step 8: Start backend, verify health check**

```bash
cd ~/novel-saas && docker compose up -d postgres backend
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

- [ ] **Step 9: Commit**

```bash
cd ~/novel-saas && git init && git add -A && git commit -m "feat: monorepo scaffolding with FastAPI + PostgreSQL + Nginx"
```

---

### Task 0.2: Frontend Skeleton

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Create Next.js project**

```bash
cd ~/novel-saas && npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

- [ ] **Step 2: Install shadcn/ui**

```bash
cd ~/novel-saas/frontend && npx shadcn@latest init -d && npx shadcn@latest add button input card toast tabs separator scroll-area textarea dialog dropdown-menu
```

- [ ] **Step 3: Create frontend/src/lib/api.ts**

```typescript
const BASE = "/api";

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body?: unknown) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
```

- [ ] **Step 4: Create frontend/src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = { title: "Novel SaaS", description: "AI-assisted novel writing platform" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create frontend/src/app/page.tsx (landing)**

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Novel SaaS</h1>
      <p className="text-lg text-gray-500">AI-assisted novel writing, from outline to prose.</p>
      <div className="flex gap-4">
        <Link href="/register" className="px-6 py-3 bg-black text-white rounded-lg">Get Started</Link>
        <Link href="/login" className="px-6 py-3 border rounded-lg">Sign In</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

- [ ] **Step 7: Verify frontend starts**

```bash
cd ~/novel-saas/frontend && npm run dev
# Open http://localhost:3000 → should see landing page
```

- [ ] **Step 8: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: Next.js frontend skeleton with shadcn/ui"
```

---

## Phase 1 — Auth + User System

### Task 1.1: User Model + Migration

**Files:**
- Create: `backend/models/user.py`
- Create: `backend/models/__init__.py`

- [ ] **Step 1: Create backend/models/__init__.py**

```python
from models.user import User

__all__ = ["User"]
```

- [ ] **Step 2: Create backend/models/user.py**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    token_balance: Mapped[int] = mapped_column(BigInteger, default=0)
    total_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    plan: Mapped[str] = mapped_column(String(20), default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: Update backend/main.py to import models**

```python
# Add after db imports:
import models  # noqa: F401 — registers models with Base
```

- [ ] **Step 4: Start DB and verify table creation**

```bash
cd ~/novel-saas && docker compose up -d postgres
docker compose run --rm backend python -c "from db import engine, Base; import asyncio; asyncio.run(engine.begin()).run_sync(Base.metadata.create_all)"
docker compose exec postgres psql -U novel -d novelsaas -c "\dt"
# Expected: users table listed
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: user model with SQLAlchemy"
```

---

### Task 1.2: Auth Service + Router

**Files:**
- Create: `backend/auth/service.py`
- Create: `backend/auth/router.py`
- Create: `backend/auth/middleware.py`
- Create: `backend/auth/__init__.py`

- [ ] **Step 1: Create backend/auth/service.py**

```python
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM]).get("sub")
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, password: str, display_name: str) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
        token_balance=50000,  # free tier: 50K tokens
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

- [ ] **Step 2: Create backend/auth/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.service import create_user, get_user_by_email, verify_password, create_access_token, get_user_by_id
from auth.middleware import get_current_user

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
async def me(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await get_user_by_id(db, user["id"])
    return _user_dict(u)


def _user_dict(u) -> dict:
    return {"id": str(u.id), "email": u.email, "display_name": u.display_name, "token_balance": u.token_balance, "plan": u.plan, "total_tokens": u.total_tokens}
```

- [ ] **Step 3: Create backend/auth/middleware.py**

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from auth.service import decode_token

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    return {"id": user_id}
```

- [ ] **Step 4: Wire auth router into main.py**

```python
# Add to main.py:
from auth.router import router as auth_router
app.include_router(auth_router)
```

- [ ] **Step 5: Test register + login**

```bash
curl -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123456"}'
# Expected: {"access_token":"...", "user":{...}}

curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123456"}'
# Expected: {"access_token":"...", "user":{...}}
```

- [ ] **Step 6: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: auth system with JWT register/login/me"
```

---

### Task 1.3: Auth Frontend (Login + Register Pages)

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/components/auth/AuthGuard.tsx`

- [ ] **Step 1: Create frontend/src/lib/auth.ts**

```typescript
"use client";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}

export async function register(email: string, password: string, displayName: string) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.user;
}
```

- [ ] **Step 2: Create frontend/src/app/login/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Card className="w-96">
        <CardHeader><CardTitle>Sign In</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">Sign In</Button>
            <p className="text-sm text-center">No account? <Link href="/register" className="underline">Register</Link></p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Create frontend/src/app/register/page.tsx** — same pattern as login, call `register()` instead. (Skipping inline for brevity — same as login but 3 fields: email, password, display_name)

- [ ] **Step 4: Create frontend/src/components/auth/AuthGuard.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); }
    else { setOk(true); }
  }, [router]);

  if (!ok) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return <>{children}</>;
}
```

- [ ] **Step 5: Test — open http://localhost:3000/register, register, should redirect to /dashboard (404 for now)**

- [ ] **Step 6: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: login/register pages with auth guard"
```

---

## Phase 2 — Project CRUD + Filesystem Layer

### Task 2.1: Project Model + Filesystem Init

**Files:**
- Create: `backend/models/project.py`
- Create: `backend/filesystem/init.py`
- Create: `backend/filesystem/__init__.py`
- Update: `backend/models/__init__.py`

- [ ] **Step 1: Create backend/models/project.py**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    root_path: Mapped[str] = mapped_column(String(500), nullable=False)
    current_phase: Mapped[str] = mapped_column(String(20), default="init")
    status: Mapped[str] = mapped_column(String(20), default="active")
    total_volumes: Mapped[int] = mapped_column(Integer, default=0)
    total_chapters: Mapped[int] = mapped_column(Integer, default=0)
    total_archives: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "slug"),)
```

- [ ] **Step 2: Update backend/models/__init__.py**

```python
from models.user import User
from models.project import Project

__all__ = ["User", "Project"]
```

- [ ] **Step 3: Create backend/filesystem/init.py**

```python
import os
import shutil
from pathlib import Path

TEMPLATE_DIR = Path(__file__).parent.parent.parent / "reference"

SKELETON_DIRS = [
    "settings/character-setting",
    "volumes", "chapters", "prompts", "archives",
]

TEMPLATE_FILES = {
    "story.yaml.template": "story.yaml",
    "author-intent.md.template": "author-intent.md",
    "current-focus.md.template": "current-focus.md",
    "world-setting.yaml.template": "settings/world-setting.yaml",
    "writing-style.yaml.template": "settings/writing-style.yaml",
    "anti-ai.yaml.template": "settings/anti-ai.yaml",
    "hooks.yaml.template": "settings/hooks.yaml",
}


def init_project_skeleton(root_path: str):
    """Create novel project directory skeleton from templates."""
    os.makedirs(root_path, exist_ok=True)
    for d in SKELETON_DIRS:
        os.makedirs(os.path.join(root_path, d), exist_ok=True)

    for src_name, dst_rel in TEMPLATE_FILES.items():
        src = TEMPLATE_DIR / src_name
        dst = os.path.join(root_path, dst_rel)
        if src.exists():
            shutil.copy2(src, dst)
        else:
            Path(dst).touch()

    # Create empty threads.yaml
    Path(os.path.join(root_path, "threads.yaml")).write_text("threads: {}\n")
```

- [ ] **Step 4: Verify skeleton creation**

```bash
docker compose run --rm backend python -c "
from filesystem.init import init_project_skeleton
init_project_skeleton('/tmp/test-novel')
import os
for root, dirs, files in os.walk('/tmp/test-novel'):
    print(root, dirs, files)
"
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: project model + filesystem skeleton init"
```

---

### Task 2.2: Project CRUD API

**Files:**
- Create: `backend/projects/router.py`
- Create: `backend/projects/service.py`
- Create: `backend/projects/__init__.py`

- [ ] **Step 1: Create backend/projects/service.py**

```python
import re
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.project import Project
from filesystem.init import init_project_skeleton
from config import DATA_ROOT


def slugify(name: str) -> str:
    slug = re.sub(r"[^\w\-]", "-", name.lower()).strip("-")
    return slug or "untitled"


async def create_project(db: AsyncSession, user_id: str, name: str) -> Project:
    slug = slugify(name)
    # Ensure unique slug
    existing = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.slug == slug)
    )
    if existing.scalar_one_or_none():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    root_path = f"{DATA_ROOT}/{user_id}/{slug}"
    init_project_skeleton(root_path)

    project = Project(user_id=user_id, name=name, slug=slug, root_path=root_path)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def list_projects(db: AsyncSession, user_id: str) -> list[Project]:
    result = await db.execute(
        select(Project).where(Project.user_id == user_id, Project.status != "deleted")
        .order_by(Project.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_project(db: AsyncSession, project_id: str, user_id: str | None = None) -> Project | None:
    stmt = select(Project).where(Project.id == project_id)
    if user_id:
        stmt = stmt.where(Project.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_project(db: AsyncSession, project: Project):
    project.status = "deleted"
    await db.commit()
```

- [ ] **Step 2: Create backend/projects/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import create_project, list_projects, get_project, delete_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectBody(BaseModel):
    name: str


@router.post("", status_code=201)
async def create(body: CreateProjectBody, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await create_project(db, user["id"], body.name)
    return _project_dict(project)


@router.get("")
async def list(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    projects = await list_projects(db, user["id"])
    return [_project_dict(p) for p in projects]


@router.get("/{project_id}")
async def get_one(project_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    return _project_dict(project)


@router.delete("/{project_id}")
async def delete(project_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await delete_project(db, project)
    return {"ok": True}


def _project_dict(p) -> dict:
    return {
        "id": str(p.id), "name": p.name, "slug": p.slug,
        "current_phase": p.current_phase, "status": p.status,
        "total_volumes": p.total_volumes, "total_chapters": p.total_chapters,
        "total_archives": p.total_archives,
        "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
    }
```

- [ ] **Step 3: Wire project router into main.py**

```python
from projects.router import router as projects_router
app.include_router(projects_router)
```

- [ ] **Step 4: Test create + list projects**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123456"}' | jq -r .access_token)

curl -X POST http://localhost:8000/api/projects -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"My First Novel"}'
# Expected: project JSON with id, slug, root_path

curl http://localhost:8000/api/projects -H "Authorization: Bearer $TOKEN"
# Expected: [project]
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: project CRUD API with filesystem skeleton"
```

---

### Task 2.3: Dashboard Page

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface Project {
  id: string; name: string; slug: string;
  current_phase: string; total_chapters: number; updated_at: string;
}

export default function DashboardPage() {
  return <AuthGuard><Dashboard /></AuthGuard>;
}

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const router = useRouter();

  useEffect(() => {
    api.get("/projects").then(setProjects);
  }, []);

  async function create() {
    if (!name.trim()) return;
    const p = await api.post("/projects", { name });
    router.push(`/project/${p.slug}`);
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">My Projects</h1>

      <div className="flex gap-4 mb-8">
        <Input placeholder="Project name..." value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} />
        <Button onClick={create}><Plus className="w-4 h-4 mr-2" />New Project</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {projects.map(p => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/project/${p.slug}`)}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Phase: {p.current_phase} · Chapters: {p.total_chapters}</p>
              <p className="text-xs text-gray-400 mt-1">Updated: {new Date(p.updated_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify flow — open browser, register, create project, see it on dashboard**

- [ ] **Step 3: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: dashboard page with project creation"
```

---

## Phase 3 — Filesystem Reader/Writer + Settings API

### Task 3.1: YAML Reader/Writer

**Files:**
- Create: `backend/filesystem/reader.py`
- Create: `backend/filesystem/writer.py`

- [ ] **Step 1: Create backend/filesystem/reader.py**

```python
import os
import yaml
from pathlib import Path


def read_yaml(root_path: str, relative_path: str) -> dict:
    filepath = os.path.join(root_path, relative_path)
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def read_md(root_path: str, relative_path: str) -> str:
    filepath = os.path.join(root_path, relative_path)
    if not os.path.exists(filepath):
        return ""
    return Path(filepath).read_text(encoding="utf-8")


def list_dir(root_path: str, relative_path: str = "") -> list[str]:
    dirpath = os.path.join(root_path, relative_path)
    if not os.path.exists(dirpath):
        return []
    return os.listdir(dirpath)


def project_exists(root_path: str) -> bool:
    return os.path.exists(os.path.join(root_path, "story.yaml"))
```

- [ ] **Step 2: Create backend/filesystem/writer.py**

```python
import os
import yaml
from pathlib import Path


def write_yaml(root_path: str, relative_path: str, data: dict):
    filepath = os.path.join(root_path, relative_path)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def write_md(root_path: str, relative_path: str, content: str):
    filepath = os.path.join(root_path, relative_path)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    Path(filepath).write_text(content, encoding="utf-8")
```

- [ ] **Step 3: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: YAML/MD filesystem reader and writer"
```

---

### Task 3.2: Settings API (Phase 2 Backend)

**Files:**
- Create: `backend/settings/router.py`
- Create: `backend/settings/__init__.py`

- [ ] **Step 1: Create backend/settings/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import get_project
from filesystem.reader import read_yaml, list_dir
from filesystem.writer import write_yaml

router = APIRouter(prefix="/api/projects/{project_id}/settings", tags=["settings"])

VALID_TYPES = {"world", "style", "anti-ai", "hooks"}


@router.get("/{type}")
async def get_settings(project_id: str, type: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    if type.startswith("character/"):
        name = type.split("/", 1)[1]
        data = read_yaml(project.root_path, f"settings/character-setting/{name}.yaml")
        return data

    if type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid settings type: {type}")

    file_map = {"world": "settings/world-setting.yaml", "style": "settings/writing-style.yaml", "anti-ai": "settings/anti-ai.yaml", "hooks": "settings/hooks.yaml"}
    return read_yaml(project.root_path, file_map[type])


@router.put("/{type}")
async def update_settings(project_id: str, type: str, body: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    if type.startswith("character/"):
        name = type.split("/", 1)[1]
        write_yaml(project.root_path, f"settings/character-setting/{name}.yaml", body)
        return {"ok": True}

    if type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid settings type: {type}")

    file_map = {"world": "settings/world-setting.yaml", "style": "settings/writing-style.yaml", "anti-ai": "settings/anti-ai.yaml", "hooks": "settings/hooks.yaml"}
    write_yaml(project.root_path, file_map[type], body)

    # Auto-advance: if settings look complete, move to outline phase
    if project.current_phase == "init" and type == "style":
        project.current_phase = "settings"
        await db.commit()

    return {"ok": True}


@router.get("/characters")
async def list_characters(project_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    names = list_dir(project.root_path, "settings/character-setting")
    return [n.replace(".yaml", "") for n in names if n.endswith(".yaml")]
```

- [ ] **Step 2: Wire settings router into main.py**

```python
from settings.router import router as settings_router
app.include_router(settings_router)
```

- [ ] **Step 3: Test settings read/write**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"test123456"}' | jq -r .access_token)
PID=$(curl -s http://localhost:8000/api/projects -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl "http://localhost:8000/api/projects/$PID/settings/world" -H "Authorization: Bearer $TOKEN"
# Expected: world-setting.yaml contents

curl -X PUT "http://localhost:8000/api/projects/$PID/settings/world" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"era":"现代","location":"上海"}'
# Expected: {"ok": true}
```

- [ ] **Step 4: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: settings API — read/write world/style/anti-ai/hooks/characters"
```

---

## Phase 4 — Workflow Engine + Chapters

### Task 4.1: Workflow Engine + Gates

**Files:**
- Create: `backend/workflow/engine.py`
- Create: `backend/workflow/gates.py`
- Create: `backend/workflow/__init__.py`

- [ ] **Step 1: Create backend/workflow/gates.py**

```python
from filesystem.reader import read_yaml


def gate_settings_complete(root_path: str) -> tuple[bool, list[str]]:
    """Check if settings are complete enough to start outlining."""
    missing = []
    world = read_yaml(root_path, "settings/world-setting.yaml")
    style = read_yaml(root_path, "settings/writing-style.yaml")
    hooks = read_yaml(root_path, "settings/hooks.yaml")

    filled_fields = sum(1 for v in world.values() if v)
    if filled_fields < 5:
        missing.append("world-setting: need at least 5 fields filled")

    if not style.get("role"):
        missing.append("writing-style: role not set")

    hook_list = hooks.get("hooks", [])
    if len(hook_list) < 3:
        missing.append("hooks: need at least 3 hooks")

    return len(missing) == 0, missing


def gate_chapter_ready(chapter_data: dict) -> tuple[bool, list[str]]:
    """Check if chapter outline is ready for prompt generation."""
    missing = []
    memo = chapter_data.get("memo", {})
    memo_fields = ["why_this_scene", "reader_promise", "reader_question",
                   "emotion_curve", "character_state_change", "thread_position", "to_avoid"]
    for f in memo_fields:
        if not memo.get(f):
            missing.append(f"memo.{f} is empty")

    segments = chapter_data.get("outline", {}).get("segments", [])
    if not segments:
        missing.append("no segments defined")

    return len(missing) == 0, missing


def gate_prompts_exist(root_path: str, chapter_ref: str) -> bool:
    import os
    prompt_dir = os.path.join(root_path, "prompts")
    if not os.path.exists(prompt_dir):
        return False
    files = os.listdir(prompt_dir)
    prefix = chapter_ref  # e.g. "vol-1-ch-3"
    return any(f.startswith(prefix) for f in files)


def gate_quality_passed(chapter_data: dict) -> bool:
    qc = chapter_data.get("quality_check", {})
    return qc.get("passed", False)
```

- [ ] **Step 2: Create backend/workflow/engine.py**

```python
from filesystem.reader import read_yaml
from filesystem.writer import write_yaml


ALLOWED_TRANSITIONS = {
    "init": ["settings"],
    "settings": ["outline"],
    "outline": ["prompt"],
    "prompt": ["write"],
    "write": ["archive"],
    "archive": ["outline"],  # back to outlining next chapter
}


def can_transition(current_phase: str, target_phase: str) -> bool:
    return target_phase in ALLOWED_TRANSITIONS.get(current_phase, [])


def update_phase(project, new_phase: str):
    if not can_transition(project.current_phase, new_phase):
        raise ValueError(f"Cannot transition from {project.current_phase} to {new_phase}")
    project.current_phase = new_phase


def load_chapter(root_path: str, chapter_ref: str) -> dict:
    """Load chapter YAML. chapter_ref = 'vol-1-ch-3'"""
    return read_yaml(root_path, f"chapters/{chapter_ref}.yaml")


def save_chapter(root_path: str, chapter_ref: str, data: dict):
    write_yaml(root_path, f"chapters/{chapter_ref}.yaml", data)
```

- [ ] **Step 3: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: workflow engine with phase gates"
```

---

### Task 4.2: Chapter CRUD API (Phase 3 Backend)

**Files:**
- Create: `backend/chapters/router.py`
- Create: `backend/chapters/__init__.py`

- [ ] **Step 1: Create backend/chapters/router.py**

```python
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import get_project
from workflow.engine import load_chapter, save_chapter, update_phase
from workflow.gates import gate_chapter_ready, gate_settings_complete
from filesystem.writer import write_yaml

router = APIRouter(prefix="/api/projects/{project_id}", tags=["chapters"])


@router.get("/volumes")
async def list_volumes(project_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    vol_dir = os.path.join(project.root_path, "volumes")
    vols = []
    if os.path.exists(vol_dir):
        for f in sorted(os.listdir(vol_dir)):
            if f.endswith(".yaml"):
                vols.append({"filename": f, "name": f.replace(".yaml", "")})
    return vols


@router.post("/volumes")
async def create_volume(project_id: str, body: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    # Check gate
    ok, missing = gate_settings_complete(project.root_path)
    if not ok:
        raise HTTPException(400, f"Settings incomplete: {missing}")
    update_phase(project, "outline")

    vol_num = body.get("vol_num", project.total_volumes + 1)
    write_yaml(project.root_path, f"volumes/vol-{vol_num}.yaml", {
        "volume": vol_num, "title": body.get("title", f"第{vol_num}卷"),
        "summary": "", "chapters": [],
    })
    project.total_volumes = vol_num
    await db.commit()
    return {"vol_num": vol_num, "filename": f"vol-{vol_num}.yaml"}


@router.get("/chapters/{chapter_ref}")
async def get_chapter(project_id: str, chapter_ref: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    data = load_chapter(project.root_path, chapter_ref)
    if not data:
        raise HTTPException(404, "Chapter not found")
    return data


@router.put("/chapters/{chapter_ref}")
async def update_chapter(project_id: str, chapter_ref: str, body: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    save_chapter(project.root_path, chapter_ref, body)
    return {"ok": True}


@router.post("/chapters/{chapter_ref}/confirm")
async def confirm_chapter(project_id: str, chapter_ref: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Gate check chapter → advance to prompt phase if ready."""
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    chapter = load_chapter(project.root_path, chapter_ref)
    ok, missing = gate_chapter_ready(chapter)
    if not ok:
        raise HTTPException(400, f"Chapter not ready: {missing}")
    update_phase(project, "prompt")
    await db.commit()
    return {"ok": True, "phase": project.current_phase}
```

- [ ] **Step 2: Wire chapter router into main.py**

```python
from chapters.router import router as chapters_router
app.include_router(chapters_router)
```

- [ ] **Step 3: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: chapter list/create/read/update API with gate confirmation"
```

---

## Phase 5 — Prompt Assembly (Phase 4 Core)

### Task 5.1: Prompt Assembler

**Files:**
- Create: `backend/prompt/assembler.py`
- Create: `backend/prompt/context.py`
- Create: `backend/prompt/router.py`
- Create: `backend/prompt/__init__.py`

- [ ] **Step 1: Create backend/prompt/context.py**

```python
"""Context injection for prompt assembly — sliding window + cross-thread."""
from filesystem.reader import read_yaml


def inject_story_context(root_path: str, chapter: dict, thread_state: dict) -> str:
    parts = []
    thread_name = chapter.get("thread", "")

    if thread_state and thread_name in thread_state:
        t = thread_state[thread_name]
        parts.append(f"当前线索状态：{t.get('current_state', '')}")
        parts.append(f"情绪温度：{t.get('emotional_temperature', 'medium')}")

    # Concurrent threads
    concurrent = chapter.get("concurrent_with", [])
    for ref in concurrent:
        if thread_state:
            for tname, tdata in thread_state.items():
                if tdata.get("last_chapter") == ref:
                    parts.append(f"同时发生（{tname}）：{tdata.get('current_state', '')}")
                    break

    # Crossover
    cross = chapter.get("crossover_ref", "")
    if cross:
        cross_ch = read_yaml(root_path, f"chapters/{cross}.yaml")
        if cross_ch:
            parts.append(f"上次交汇（{cross}）：{cross_ch.get('outline', {}).get('summary', '')[:200]}")

    return "\n\n".join(parts) if parts else ""


def inject_character_snapshots(root_path: str, character_names: list[str]) -> str:
    parts = []
    for name in character_names:
        ch_data = read_yaml(root_path, f"settings/character-setting/{name}.yaml")
        if not ch_data:
            parts.append(f"### {name}\n（新角色，无前史）")
            continue
        history = ch_data.get("state_history", [])
        parts.append(
            f"### {name}\n"
            f"身份：{ch_data.get('role', '未知')}\n"
            f"当前状态：{history[-1].get('state', '初始') if history else '初始'}\n"
            f"动机：{ch_data.get('current_motivation', '不明')}\n"
            f"所在：{ch_data.get('current_location', '不明')}"
        )
    return "\n\n".join(parts)


def inject_active_hooks(root_path: str, current_chapter_ref: str) -> str:
    hooks_data = read_yaml(root_path, "settings/hooks.yaml")
    hooks = [h for h in hooks_data.get("hooks", [])
             if h.get("status") in ("mentioned", "reinforced")
             and h.get("introduced_in") != current_chapter_ref]
    if not hooks:
        return ""
    lines = ["## 当前悬而未决的伏笔"]
    for h in hooks[:8]:
        lines.append(f"- [{h['id']}] {h['description']}（状态：{h['status']}）")
    return "\n".join(lines)
```

- [ ] **Step 2: Create backend/prompt/assembler.py**

```python
from filesystem.reader import read_yaml
from filesystem.writer import write_md
from prompt.context import inject_story_context, inject_character_snapshots, inject_active_hooks


def assemble_segment_prompt(root_path: str, chapter_ref: str, seg_idx: int, novel_title: str = "") -> str:
    chapter = read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    style = read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = read_yaml(root_path, "settings/anti-ai.yaml")
    threads = read_yaml(root_path, "threads.yaml")

    segments = chapter.get("outline", {}).get("segments", [])
    seg = segments[seg_idx] if seg_idx < len(segments) else {}

    vol = chapter.get("volume", "?")
    ch_num = chapter.get("chapter", "?")
    seg_num = seg.get("seg", seg_idx + 1)

    prompt = f"""## 角色定位
你是{style.get('role', '一位小说家')}。{style.get('core_principles', '')}

## 原则与禁忌
{style.get('possible_mistakes', '')}

禁止使用以下词汇：{', '.join(anti_ai.get('fatigue_words', []))}
禁止以下句式：{', '.join(anti_ai.get('forbidden_patterns', []))}

## 故事背景
本段是{novel_title}第{vol}卷第{ch_num}章第{seg_num}段。
{inject_story_context(root_path, chapter, threads.get('threads', {}))}

{inject_character_snapshots(root_path, seg.get('characters', []))}

{inject_active_hooks(root_path, chapter_ref)}

## 写作指引
{seg.get('focus', '')}
情绪主调：{seg.get('emotion', '')}
关键桥段：{seg.get('key_beat', '')}
出场角色：{', '.join(seg.get('characters', []))}
地点：{seg.get('location', '')}
时间：{seg.get('time', '')}

注意：{chapter.get('memo', {}).get('to_avoid', '')}

## 写作要求
{style.get('depiction_techniques', '')}
输出长度：约{seg.get('target_words', 1500)}字。
不写总结、不写章节标题。
"""
    return prompt


def assemble_all_segments(root_path: str, chapter_ref: str, novel_title: str = "") -> list[str]:
    chapter = read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    segments = chapter.get("outline", {}).get("segments", [])
    prompts = []
    for i in range(len(segments)):
        prompt = assemble_segment_prompt(root_path, chapter_ref, i, novel_title)
        prompt_path = f"prompts/{chapter_ref}-seg-{i+1}-prompt.md"
        write_md(root_path, prompt_path, prompt)
        prompts.append(prompt_path)
    return prompts
```

- [ ] **Step 3: Create backend/prompt/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import get_project
from workflow.engine import load_chapter, update_phase
from prompt.assembler import assemble_segment_prompt, assemble_all_segments

router = APIRouter(prefix="/api/projects/{project_id}/chapters/{chapter_ref}", tags=["prompts"])


@router.post("/perspective")
async def run_perspective_conversion(project_id: str, chapter_ref: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    chapter = load_chapter(project.root_path, chapter_ref)
    summary = chapter.get("outline", {}).get("summary", "")
    pov = chapter.get("pov_character", "主角")

    # Call Anthropic for perspective conversion
    import anthropic
    from config import ANTHROPIC_API_KEY

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system="将以下上帝视角章纲转换为沉浸式写作指引。用第二人称'你'。保留所有关键事件，但用感官细节替换概括性描述。200-300字。",
        messages=[{"role": "user", "content": f"视角：{pov}\n章纲：{summary}"}],
    )
    guidance = message.content[0].text

    # Save to chapter
    chapter["outline"]["perspective_guidance"] = guidance
    from filesystem.writer import write_yaml
    write_yaml(project.root_path, f"chapters/{chapter_ref}.yaml", chapter)

    return {"guidance": guidance, "tokens_used": message.usage.input_tokens + message.usage.output_tokens}


@router.get("/prompts")
async def list_prompts(project_id: str, chapter_ref: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    import os
    prompt_dir = os.path.join(project.root_path, "prompts")
    if not os.path.exists(prompt_dir):
        return []
    return sorted([f for f in os.listdir(prompt_dir) if f.startswith(chapter_ref)])


@router.post("/prompts/generate")
async def generate_prompts(project_id: str, chapter_ref: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    paths = assemble_all_segments(project.root_path, chapter_ref, project.name)
    update_phase(project, "prompt")
    await db.commit()
    return {"prompts": paths}


@router.get("/prompts/{seg}")
async def get_prompt_content(project_id: str, chapter_ref: str, seg: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from filesystem.reader import read_md
    content = read_md(project.root_path, f"prompts/{chapter_ref}-{seg}-prompt.md")
    return PlainTextResponse(content)
```

- [ ] **Step 4: Wire prompt router into main.py**

```python
from prompt.router import router as prompt_router
app.include_router(prompt_router)
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: prompt assembler with perspective conversion + context injection"
```

---

## Phase 6 — Streaming Write (Phase 5)

### Task 6.1: Streaming Write Endpoint

**Files:**
- Create: `backend/write/stream.py`
- Create: `backend/write/router.py`
- Create: `backend/write/quality.py`
- Create: `backend/write/__init__.py`

- [ ] **Step 1: Create backend/write/stream.py**

```python
import asyncio
import json
from anthropic import AsyncAnthropic

from config import ANTHROPIC_API_KEY
from filesystem.reader import read_yaml, read_md


async def stream_segment(root_path: str, chapter_ref: str, seg_idx: int, model: str = "claude-haiku-4-5-20251001"):
    """SSE generator for streaming prose generation of one segment."""
    prompt = read_md(root_path, f"prompts/{chapter_ref}-seg-{seg_idx}-prompt.md")
    style = read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = read_yaml(root_path, "settings/anti-ai.yaml")

    system_msg = f"你是{style.get('role', '一位小说家')}。{style.get('core_principles', '')}"

    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    full_text = ""
    async with client.messages.stream(
        model=model,
        max_tokens=4096,
        system=system_msg,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                chunk = event.delta.text
                full_text += chunk

                # Real-time anti-ai scan
                violations = scan_chunk(full_text, anti_ai)

                yield f"data: {json.dumps({'type': 'violation' if violations else 'chunk', 'text': chunk, 'violations': violations}, ensure_ascii=False)}\n\n"

            elif event.type == "message_stop":
                yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'total_tokens': event.usage.output_tokens if hasattr(event, 'usage') else 0}, ensure_ascii=False)}\n\n"


def scan_chunk(text: str, anti_ai: dict) -> list[str]:
    """Scan text for anti-AI violations. Returns list of rule names violated."""
    violations = []
    fatigue_words = anti_ai.get("fatigue_words", [])
    for word in fatigue_words:
        if word in text:
            violations.append(f"疲劳词: {word}")

    forbidden = anti_ai.get("forbidden_patterns", [])
    import re
    for pattern in forbidden:
        try:
            if re.search(pattern, text):
                violations.append(f"禁用句式: {pattern}")
        except re.error:
            pass

    return violations
```

- [ ] **Step 2: Create backend/write/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import get_project
from workflow.engine import load_chapter, update_phase
from write.stream import stream_segment
from write.quality import run_quality_checks

router = APIRouter(prefix="/api/projects/{project_id}/chapters/{chapter_ref}/write", tags=["write"])


@router.get("/stream/{seg}")
async def write_stream(project_id: str, chapter_ref: str, seg: int, request: Request, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    # Check prompts exist
    import os
    prompt_file = os.path.join(project.root_path, "prompts", f"{chapter_ref}-seg-{seg}-prompt.md")
    if not os.path.exists(prompt_file):
        raise HTTPException(400, "Prompt not found. Generate prompts first.")

    update_phase(project, "write")
    await db.commit()

    return StreamingResponse(
        stream_segment(project.root_path, chapter_ref, seg),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/quality-check")
async def quality_check(project_id: str, chapter_ref: str, body: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Run all 6 quality checks on the assembled chapter text."""
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    full_text = body.get("full_text", "")
    chapter = load_chapter(project.root_path, chapter_ref)
    results = run_quality_checks(project.root_path, chapter, full_text)

    chapter["quality_check"] = results
    from filesystem.writer import write_yaml
    write_yaml(project.root_path, f"chapters/{chapter_ref}.yaml", chapter)

    return results
```

- [ ] **Step 3: Create backend/write/quality.py**

```python
import re
from filesystem.reader import read_yaml


def run_quality_checks(root_path: str, chapter: dict, full_text: str) -> dict:
    anti_ai = read_yaml(root_path, "settings/anti-ai.yaml")
    style = read_yaml(root_path, "settings/writing-style.yaml")

    results = {"passed": True, "checks": {}}

    # 1. Anti-AI fatigue words
    fatigue_hits = [w for w in anti_ai.get("fatigue_words", []) if w in full_text]
    results["checks"]["fatigue_words"] = {"passed": len(fatigue_hits) == 0, "hits": fatigue_hits}

    # 2. Forbidden sentence patterns
    pattern_hits = {}
    for p in anti_ai.get("forbidden_patterns", []):
        matches = re.findall(p, full_text)
        if matches:
            pattern_hits[p] = len(matches)
    results["checks"]["forbidden_patterns"] = {"passed": len(pattern_hits) == 0, "hits": pattern_hits}

    # 3. Dialogue ratio
    dialogue_chars = 0
    for m in re.finditer(r'[""「」]([^""「」]*)[""「」]', full_text):
        dialogue_chars += len(m.group(1))
    total = len(full_text.replace("\n", "").replace(" ", ""))
    dialogue_ratio = dialogue_chars / total if total > 0 else 0
    target_min, target_max = style.get("dialogue_ratio", {}).get("min", 0.1), style.get("dialogue_ratio", {}).get("max", 0.6)
    results["checks"]["dialogue_ratio"] = {"passed": target_min <= dialogue_ratio <= target_max, "value": round(dialogue_ratio, 3), "target": [target_min, target_max]}

    # 4. Description ratio (simplified: count env/psych keywords)
    env_hits = len(re.findall(r'(天[空气]|阳光|风|雨|雪|灯|暗|影|气味|声音|温度|寒冷|炎热|潮湿)', full_text))
    desc_estimate = env_hits * 30 / total if total > 0 else 0
    results["checks"]["description_ratio"] = {"passed": desc_estimate > 0.05, "value": round(desc_estimate, 3)}

    # 5. Hook mention check
    hooks_data = read_yaml(root_path, "settings/hooks.yaml")
    chapter_hooks = [h for h in hooks_data.get("hooks", []) if h.get("resolve_plan") == chapter.get("ref", "")]
    hooks_mentioned = sum(1 for h in chapter_hooks if h.get("description", "")[:10] in full_text)
    results["checks"]["hook_mentions"] = {"passed": hooks_mentioned == len(chapter_hooks) if chapter_hooks else True, "expected": len(chapter_hooks), "found": hooks_mentioned}

    # 6. Continuity (placeholder — needs AI call in production)
    results["checks"]["continuity"] = {"passed": True, "note": "skipped in v1"}

    results["passed"] = all(c["passed"] for c in results["checks"].values())
    return results
```

- [ ] **Step 4: Wire write router into main.py**

```python
from write.router import router as write_router
app.include_router(write_router)
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: streaming write endpoint with SSE + quality checks"
```

---

## Phase 7 — Archive (Phase 6)

### Task 7.1: Archive Service + Endpoint

**Files:**
- Create: `backend/archive/service.py`
- Create: `backend/archive/router.py`
- Create: `backend/archive/__init__.py`

- [ ] **Step 1: Create backend/archive/service.py**

```python
import os
from datetime import datetime

from filesystem.reader import read_yaml
from filesystem.writer import write_yaml, write_md
from config import ANTHROPIC_API_KEY


def archive_chapter(root_path: str, chapter_ref: str, full_text: str):
    """Write prose to archives/, generate summary, update thread + hooks."""
    chapter = read_yaml(root_path, f"chapters/{chapter_ref}.yaml")

    # Write archive file
    vol = chapter.get("volume", 1)
    ch = chapter.get("chapter", 1)
    title = chapter.get("title", "未命名")
    slug = title.replace(" ", "-").lower()[:50]
    archive_path = f"archives/vol-{vol}-ch-{ch}-{slug}.md"
    write_md(root_path, archive_path, full_text)

    # Generate 200-char summary via AI
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content": f"用200字以内总结本章核心事件，只陈述事实不评论：\n\n{full_text[:3000]}"}],
    )
    summary = message.content[0].text[:200]

    chapter["archive_summary"] = summary
    chapter["archive_path"] = archive_path
    chapter["status"] = "archived"
    write_yaml(root_path, f"chapters/{chapter_ref}.yaml", chapter)

    # Update thread state
    update_thread_state(root_path, chapter, summary)
    update_character_states(root_path, chapter, full_text)

    return {"archive_path": archive_path, "summary": summary}


def update_thread_state(root_path: str, chapter: dict, summary: str):
    threads = read_yaml(root_path, "threads.yaml")
    thread_name = chapter.get("thread", "主线")

    if "threads" not in threads:
        threads["threads"] = {}
    if thread_name not in threads["threads"]:
        threads["threads"][thread_name] = {}

    t = threads["threads"][thread_name]
    t["pov"] = chapter.get("pov_character", t.get("pov", "未知"))
    t["last_chapter"] = f"vol-{chapter.get('volume')}-ch-{chapter.get('chapter')}"
    t["current_state"] = summary
    t["emotional_temperature"] = chapter.get("memo", {}).get("emotion_curve", "medium")

    # Update hook statuses mentioned in this chapter
    hooks = read_yaml(root_path, "settings/hooks.yaml")
    for hook in hooks.get("hooks", []):
        if hook.get("introduced_in") == t["last_chapter"]:
            hook["status"] = "mentioned"
    write_yaml(root_path, "settings/hooks.yaml", hooks)

    write_yaml(root_path, "threads.yaml", threads)


def update_character_states(root_path: str, chapter: dict, full_text: str):
    """Quick character state update based on chapter content."""
    for name in chapter.get("outline", {}).get("segments", [{}])[0].get("characters", []):
        char = read_yaml(root_path, f"settings/character-setting/{name}.yaml")
        if not char:
            continue
        if "state_history" not in char:
            char["state_history"] = []
        state_change = chapter.get("memo", {}).get("character_state_change", "")
        char["state_history"].append({
            "chapter": f"vol-{chapter.get('volume')}-ch-{chapter.get('chapter')}",
            "change": state_change,
            "timestamp": datetime.now().isoformat(),
        })
        write_yaml(root_path, f"settings/character-setting/{name}.yaml", char)
```

- [ ] **Step 2: Create backend/archive/router.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from projects.service import get_project
from workflow.engine import update_phase
from archive.service import archive_chapter

router = APIRouter(prefix="/api/projects/{project_id}/chapters/{chapter_ref}/archive", tags=["archive"])


@router.post("")
async def archive(project_id: str, chapter_ref: str, body: dict, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")

    full_text = body.get("full_text", "")
    if len(full_text) < 100:
        raise HTTPException(400, "Text too short to archive")

    result = archive_chapter(project.root_path, chapter_ref, full_text)
    update_phase(project, "archive")
    project.total_archives += 1
    await db.commit()

    return result
```

- [ ] **Step 3: Wire archive router into main.py**

```python
from archive.router import router as archive_router
app.include_router(archive_router)
```

- [ ] **Step 4: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: archive service with memory compression + thread/character updates"
```

---

## Phase 8 — Billing + Token Tracking

### Task 8.1: TokenLog Model + Billing API

**Files:**
- Create: `backend/models/token_log.py`
- Create: `backend/billing/router.py`
- Create: `backend/billing/service.py`
- Create: `backend/billing/__init__.py`

- [ ] **Step 1: Create backend/models/token_log.py**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class TokenLog(Base):
    __tablename__ = "token_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    chapter_id: Mapped[str] = mapped_column(String(100), nullable=True)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(50), default="haiku")
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_cents: Mapped[int] = mapped_column(Integer, default=0)  # in 0.01 USD
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 2: Create backend/billing/service.py**

```python
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.token_log import TokenLog
from models.user import User


async def log_token_usage(db: AsyncSession, user_id: str, project_id: str | None,
                          chapter_id: str | None, operation: str, model: str,
                          tokens_in: int, tokens_out: int):
    # Pricing (simplified):
    # haiku: $0.80/M input, $4/M output
    # sonnet: $3/M input, $15/M output
    rates = {
        "haiku": (0.08, 0.40),    # cents per 1K tokens
        "sonnet": (0.30, 1.50),
    }
    in_rate, out_rate = rates.get(model, (0.08, 0.40))
    cost = int((tokens_in / 1000) * in_rate + (tokens_out / 1000) * out_rate)

    log = TokenLog(
        user_id=user_id, project_id=project_id, chapter_id=chapter_id,
        operation=operation, model=model,
        tokens_in=tokens_in, tokens_out=tokens_out, cost_cents=max(cost, 0),
    )
    db.add(log)

    # Deduct from user balance (convert cents to tokens at ~$10/1M tokens = 1 cent per 100 tokens)
    user = await db.get(User, user_id)
    if user:
        user.token_balance -= tokens_in + tokens_out
        user.total_tokens += tokens_in + tokens_out

    await db.commit()


async def get_usage_summary(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(
            func.sum(TokenLog.tokens_in + TokenLog.tokens_out).label("total"),
            func.sum(TokenLog.cost_cents).label("cost"),
            func.count().label("calls"),
        ).where(TokenLog.user_id == user_id)
    )
    row = result.one()
    return {"total_tokens": row.total or 0, "total_cost_cents": row.cost or 0, "total_calls": row.calls or 0}
```

- [ ] **Step 3: Create backend/billing/router.py**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from auth.middleware import get_current_user
from billing.service import get_usage_summary

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/usage")
async def usage(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await get_usage_summary(db, user["id"])


@router.get("/plans")
async def plans():
    return [
        {"name": "Free", "tokens": 50000, "price_cents": 0},
        {"name": "Pro", "tokens": 500000, "price_cents": 1500},
        {"name": "Unlimited", "tokens": 2000000, "price_cents": 4900},
    ]
```

- [ ] **Step 4: Wire into main.py, update models/__init__.py**

```python
# models/__init__.py
from models.user import User
from models.project import Project
from models.token_log import TokenLog

# main.py
from billing.router import router as billing_router
app.include_router(billing_router)
```

- [ ] **Step 5: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: token tracking + billing usage API"
```

---

## Phase 9 — Frontend: Project Workspace Shell

### Task 9.1: Project Layout + Navigation

**Files:**
- Create: `frontend/src/app/project/[slug]/layout.tsx`
- Create: `frontend/src/app/project/[slug]/page.tsx`
- Create: `frontend/src/components/project/ProjectNav.tsx`

- [ ] **Step 1: Create ProjectNav component**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings", label: "Settings" },
  { href: "/outline", label: "Outline" },
  { href: "/prompts", label: "Prompts" },
  { href: "/write", label: "Write" },
  { href: "/archives", label: "Archives" },
  { href: "/threads", label: "Threads" },
];

export function ProjectNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/project/${slug}`;

  return (
    <nav className="flex gap-1 border-b px-6 py-2">
      {links.map(l => (
        <Link key={l.href} href={`${base}${l.href}`}
          className={cn("px-3 py-1.5 rounded-md text-sm", pathname.endsWith(l.href) ? "bg-black text-white" : "hover:bg-gray-100")}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create project layout**

```tsx
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ProjectNav } from "@/components/project/ProjectNav";

export default function ProjectLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  return (
    <AuthGuard>
      <ProjectNav slug={params.slug} />
      <div className="p-6">{children}</div>
    </AuthGuard>
  );
}
```

- [ ] **Step 3: Verify — navigate to /project/my-first-novel, see nav bar, all links work (pages 404 for now)**

- [ ] **Step 4: Commit**

```bash
cd ~/novel-saas && git add -A && git commit -m "feat: project workspace shell with navigation"
```

---

## Phase 10 — Remaining Frontend Pages

(Same pattern for each page: API call → form/setState → render. Full code omitted below for plan brevity — each follows shadcn/ui patterns established in login/dashboard.)

### Task 10.1: Settings Pages (Phase 2 UI)
- `frontend/src/app/project/[slug]/settings/page.tsx` — settings hub
- `frontend/src/app/project/[slug]/settings/world/page.tsx` — world-setting form
- `frontend/src/app/project/[slug]/settings/style/page.tsx` — style configurator
- `frontend/src/app/project/[slug]/settings/characters/page.tsx` — character list
- `frontend/src/app/project/[slug]/settings/hooks/page.tsx` — hooks board

### Task 10.2: Outline Board (Phase 3 UI)
- `frontend/src/app/project/[slug]/outline/page.tsx` — volumes + chapter tree

### Task 10.3: Prompt Viewer (Phase 4 UI)
- `frontend/src/app/project/[slug]/prompts/page.tsx` — prompt list + content reader

### Task 10.4: Writing Studio (Phase 5 UI)
- `frontend/src/app/project/[slug]/write/page.tsx` — multi-pane SSE streaming
- `frontend/src/hooks/useSSE.ts` — EventSource hook

### Task 10.5: Archives Reader (Phase 6 UI)
- `frontend/src/app/project/[slug]/archives/page.tsx` — archive browser

### Task 10.6: Thread Timeline
- `frontend/src/app/project/[slug]/threads/page.tsx` — visual thread timeline

---

## Phase 11 — Integration & Polish

### Task 11.1: End-to-End Flow Test
- Register → create project → fill settings → create outline → generate prompts → write prose → archive

### Task 11.2: Token Tracking Integration
- Wire token logging into all AI call sites (perspective conversion, write stream, archive summary)

### Task 11.3: Error Handling + Loading States
- All pages: error boundaries, loading skeletons, empty states

### Task 11.4: Production Config
- `.env.example`, CORS restrictions, rate limiting, backup cron job

---

## Execution Order

```
Phase 0  (scaffolding)     ██░░░░░░░░░░  2 tasks
Phase 1  (auth)            ████░░░░░░░░  3 tasks
Phase 2  (projects + fs)   ████░░░░░░░░  3 tasks
Phase 3  (filesystem r/w)  ██░░░░░░░░░░  2 tasks
Phase 4  (workflow)        ███░░░░░░░░░  2 tasks
Phase 5  (prompt assembly) ██░░░░░░░░░░  1 task
Phase 6  (streaming write) ██░░░░░░░░░░  1 task
Phase 7  (archive)         █░░░░░░░░░░░  1 task
Phase 8  (billing)         █░░░░░░░░░░░  1 task
Phase 9  (frontend shell)  █░░░░░░░░░░░  1 task
Phase 10 (frontend pages)  ██████░░░░░░  6 tasks
Phase 11 (integration)     ████░░░░░░░░  4 tasks
                           ─────────────
                           27 tasks total
```

Each task = one commit. Follow TDD: write test → see it fail → implement → see it pass → commit.
