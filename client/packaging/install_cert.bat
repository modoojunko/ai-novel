@echo off
REM 安装 AI Novel 自签名证书到受信任的根证书颁发机构
REM 需要管理员权限运行
REM 安装后，安装包和程序将不再被 SmartScreen 拦截

setlocal enabledelayedexpansion
echo ===== AI Novel 证书安装 =====
echo.
echo 正在安装证书到受信任的根证书颁发机构...
echo.

REM 检查是否管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 需要管理员权限！
    echo 请右键本文件 → "以管理员身份运行"
    pause
    exit /b 1
)

REM 安装证书
certutil -addstore -f "Root" "%~dp0cert.pfx" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 证书安装成功！
    echo AI Novel 安装包和程序现在被系统信任
) else (
    echo [错误] 证书安装失败
    echo 请手动安装: 双击 cert.pfx → 选择"本地计算机"→ 下一步
    echo 证书密码: ainovel123
)

echo.
echo 按任意键退出...
pause >nul
