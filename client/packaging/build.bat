@echo off
REM client/packaging/build.bat
REM AI Novel — Build Script
REM
REM Usage:
REM   build.bat             → 构建 onedir + 安装包（推荐）
REM   build.bat quick       → 构建单 exe（测试用，启动慢）
REM
REM 前置: Node.js 20+, Python 3.12+, Inno Setup 6+

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set CLIENT_DIR=%SCRIPT_DIR%..
set PROJECT_DIR=%CLIENT_DIR%..\

echo ===== AI Novel Build =====
echo Mode: %1

REM 1. Build frontend
echo.
echo [1/4] Building frontend...
cd /d "%CLIENT_DIR%\frontend"
call npm ci >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] npm ci failed & exit /b 1 )
call npm run build >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] Frontend build failed & exit /b 1 )
echo [OK] Frontend built

REM 2. Install backend dependencies
echo.
echo [2/4] Installing backend dependencies...
cd /d "%CLIENT_DIR%\backend"
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] Backend deps install failed & exit /b 1 )
echo [OK] Backend deps installed

REM 3. Build with PyInstaller
echo.
if "%1"=="quick" (
  echo [3/4] Building single EXE (onefile)...
  cd /d "%SCRIPT_DIR%"
  rmdir /S /Q dist build 2>nul
  pyinstaller build.spec --clean --noconfirm -- --onefile
  if %errorlevel% neq 0 ( echo [ERROR] PyInstaller failed & exit /b 1 )
  echo [OK] Output: dist\AI Novel.exe
) else (
  echo [3/4] Building onedir (for installer)...
  cd /d "%SCRIPT_DIR%"
  rmdir /S /Q dist build 2>nul
  pyinstaller build.spec --clean --noconfirm
  if %errorlevel% neq 0 ( echo [ERROR] PyInstaller failed & exit /b 1 )
  echo [OK] Output: dist\AI Novel\  (folder)
)

REM 4. Build installer (only if Inno Setup is available)
echo.
if "%1"=="quick" goto :end
where iscc >nul 2>&1
if %errorlevel% equ 0 (
  echo [4/4] Building installer...
  cd /d "%SCRIPT_DIR%"
  iscc installer.iss >nul 2>&1
  if %errorlevel% equ 0 (
    echo [OK] Installer: dist_installer\AI_Novel_Setup_*.exe
  ) else (
    echo [WARN] Inno Setup build failed — check installer.iss
  )
) else (
  echo [SKIP] Inno Setup not installed — skipping installer
  echo        Install from: https://jrsoftware.org/isdl.php
  echo        Then run: iscc installer.iss
)

:end
echo.
echo ===== Build Complete =====
