@echo off
REM AI Novel - Build Script
REM Prerequisites: Node.js, Python 3.12

echo ===== AI Novel Build =====

REM 1. Build frontend
echo [1/4] Building frontend...
cd /d "%~dp0..\frontend"
call npm ci
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b 1
)

REM 2. Install backend dependencies
echo [2/4] Installing backend dependencies...
cd /d "%~dp0..\backend"
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Backend deps install failed!
    exit /b 1
)

REM 3. Install packaging dependencies
echo [3/4] Installing packaging dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Packaging deps install failed!
    exit /b 1
)

REM 4. Build executable
echo [4/4] Building executable...
cd /d "%~dp0"
pyinstaller build.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo ===== Build Complete =====
echo Output: dist/AI Novel.exe
pause
