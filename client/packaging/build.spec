# packaging/build.spec
# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from pathlib import Path

block_cipher = None

root_dir = Path(__file__).parent.parent.parent  # project root (contains client/, server/)
frontend_dist = root_dir / "client" / "frontend" / "dist"
backend_dir = root_dir / "client" / "backend"

a = Analysis(
    ['pywebview_app.py'],
    pathex=[str(root_dir), str(backend_dir)],
    binaries=[],
    datas=[
        # 前端构建产物 — 运行时在 _MEIPASS/frontend/
        (str(frontend_dist / "index.html"), "frontend"),
        (str(frontend_dist / "assets"), "frontend/assets"),
        # 参考模板 — 运行时在 _MEIPASS/reference/
        (str(root_dir / "client" / "reference"), "reference"),
    ],
    hiddenimports=[
        'aiosqlite',
        'sqlalchemy.ext.asyncio',
        'anthropic',
        'openai',
        'yaml',
        'httpx',
        'passlib',
        'bcrypt',
        'jose',
        'multipart',
        'auth_local',
        'auth_local.middleware',
        'auth_local.models',
        'auth_local.router',
        'auth_local.service',
        'projects',
        'settings',
        'chapters',
        'prompt',
        'write',
        'archive',
        'workflow',
        'filesystem',
        'story',
        'threads',
        'novel',
        'models',
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
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',
)
