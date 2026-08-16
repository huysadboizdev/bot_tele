@echo off
chcp 65001 >nul
echo ====================================================
echo   KHỞI CHẠY TELEGRAM BOT QUẢN LÝ CÔNG VIỆC CÔNG TY
echo ====================================================
echo.

cd /d "%~dp0\.."

if not exist "node_modules" (
    echo [1/3] Dang cai dat thu vien npm...
    call npm install
)

if not exist ".env" (
    echo [!] Chua tim thay file .env! Dang tao tu .env.example...
    copy .env.example .env
    echo [!] Vui long mo file .env va dien BOT_TOKEN truoc khi chay!
    pause
    exit /b
)

echo [2/3] Dang bien dich TypeScript...
call npm run build

echo.
echo [3/3] Dang khoi chay Bot...
call npm start

pause
