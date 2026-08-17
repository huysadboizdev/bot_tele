@echo off
title Telegram Bot Company - MadBros
color 0B

echo ========================================================
echo   🤖 TELEGRAM BOT QUAN LY CONG VIEC (WINDOWS VPS)
echo ========================================================
echo.

cd /d %~dp0

if not exist ".env" (
    echo [Cau hinh] Khoi tao .env tu .env.example...
    copy ".env.example" ".env" >nul
    echo ⚠️  Vui long mo file .env de dien BOT_TOKEN va ADMIN_IDS neu chua co!
    echo.
)

echo [1/2] Kiem tra va cai dat thu vien...
call npm install

echo.
echo [2/2] Build TypeScript code...
call npm run build

echo.
echo ========================================================
echo 🚀 Dang khoi chay Telegram Bot qua Long-Polling...
echo ========================================================
echo.

npm run start

pause
