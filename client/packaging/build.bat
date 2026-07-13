@echo off
REM client/packaging/build.bat
REM AI Novel - Build Script
REM Prerequisites: Node.js 20+, Python 3.12+
REM
REM 构建流程:
REM   1. 构建前端 (npm ci && npm run build)
REM   2. 安装后端依赖
REM   3. 安装打包依赖 (pywebview, pyinstaller)
REM   4. PyInstaller 打包为 AI Novel.exe
REM
REM 输出: client/packaging/dist/AI Novel.exe

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set CLIENT_DIR=%SCRIPT_DIR%..
set PROJECT_DIR=%CLIENT_DIR%..\

echo ===== AI Novel Build =====
echo Client dir: %CLIENT_DIR%
echo Project dir: %PROJECT_DIR%

REM 1. Build frontend
echo.
echo [1/4] Building frontend...
cd /d "%CLIENT_DIR%\frontend"
call npm ci
if %errorlevel% neq 0 (
    echo [ERROR] npm ci failed
    exit /b 1
)
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed
    exit /b 1
)
echo [OK] Frontend built

REM 2. Install backend dependencies
echo.
echo [2/4] Installing backend dependencies...
cd /d "%CLIENT_DIR%\backend"
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Backend deps install failed
    exit /b 1
)
echo [OK] Backend deps installed

REM 3. Install packaging dependencies
echo.
echo [3/4] Installing packaging dependencies...
cd /d "%SCRIPT_DIR%"
pip install -r requirements.txt
pip install pyinstaller
if %errorlevel% neq 0 (
    echo [ERROR] Packaging deps install failed
    exit /b 1
)
echo [OK] Packaging deps installed

REM 4. Build executable
echo.
echo [4/4] Building executable...
cd /d "%SCRIPT_DIR%"
rmdir /S /Q dist build 2>nul
pyinstaller build.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller build failed
    exit /b 1
)

echo.
echo ===== Build Complete =====
echo Output: %SCRIPT_DIR%dist\AI Novel.exe
dir "%SCRIPT_DIR%dist\AI Novel.exe" 2>nul

pause
