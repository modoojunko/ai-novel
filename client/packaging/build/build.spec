# -*- mode: python ; coding: utf-8 -*-
#
# AI Novel — PyInstaller build spec
#
# 两种模式:
#   onefile: 单 exe（启动慢，开发测试用）
#   onedir:  文件夹（启动快，正式分发用）
#
# 用法:
#   pyinstaller build.spec                   → 默认 onedir
#   pyinstaller build.spec --onedir          → onedir（同默认）
#   pyinstaller build.spec --onedir /onefile → 切换模式
#   build.bat                                → 一键构建 + Inno Setup 安装包

import sys
import os
from pathlib import Path

block_cipher = None

# ── 路径 ──
spec_dir = Path(SPEC).parent if 'SPEC' in dir() else Path.cwd()
root_dir = spec_dir.parent.parent.parent   # build/ -> packaging/ -> client/ -> project root
frontend_dist = root_dir / "client" / "frontend" / "dist"
backend_dir = root_dir / "client" / "backend"

# ── 模式：onedir（默认）或 onefile ──
is_onefile = "--onefile" in sys.argv
mode_name = "onefile" if is_onefile else "onedir"
print(f"Building in {mode_name} mode")

# ── Analysis ──
a = Analysis(
    ['pywebview_app.py'],  # 与 build.spec 同目录
    pathex=[str(root_dir), str(backend_dir)],
    binaries=[],
    datas=[
        (str(frontend_dist / "index.html"), "frontend"),
        (str(frontend_dist / "assets"), "frontend/assets"),
        (str(root_dir / "client" / "reference"), "reference"),
    ],
    hiddenimports=[
        'main', 'config', 'db', 'ai_client',
        'aiosqlite', 'sqlalchemy.ext.asyncio',
        'anthropic', 'openai',
        'yaml', 'httpx', 'jose', 'multipart',
        'auth_local', 'auth_local.middleware', 'auth_local.models',
        'auth_local.router', 'auth_local.service',
        'projects', 'settings', 'chapters', 'prompt', 'write', 'archive',
        'api_configs', 'genres', 'workflow', 'workflow.engine', 'workflow.gates', 'workflow.tier',
        'filesystem', 'filesystem.storage', 'filesystem.init', 'filesystem.composite_storage',
        'settings.render',
        'story', 'story.engine', 'story.character_agent', 'story.models',
        'threads', 'novel',
        'models', 'models.user', 'models.project', 'models.token_log', 'models.chapter', 'models.volume',
    ],
    hookspath=[str(spec_dir / "hooks")],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL', 'pandas', 'numpy', 'notebook', 'test', 'unittest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ── 可执行文件 ──
_exe_kwargs = dict(
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

if is_onefile:
    exe = EXE(pyz, a.scripts, a.binaries, a.zipfiles, a.datas, [], **_exe_kwargs)
else:
    # onedir：EXE 只打包启动器，binaries/zipfiles/datas 由 COLLECT 收集。
    # （若 EXE 与 COLLECT 同时接收 a.binaries，macOS 构建会报
    #   “Resource 'dist/AI Novel' is not a valid file” —— 输出与收集循环引用。）
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, **_exe_kwargs)
    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=True,
        upx_exclude=[],
        name='AI Novel',
    )
