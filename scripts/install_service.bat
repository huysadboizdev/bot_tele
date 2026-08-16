@echo off
chcp 65001 >nul
echo ====================================================
echo   CÀI ĐẶT BOT CHẠY NGẦM 24/7 TRÊN VPS WINDOWS (PM2)
echo ====================================================
echo.

cd /d "%~dp0\.."

echo [1/4] Bien dich du an...
call npm run build

echo [2/4] Cai dat PM2 va Cong cu Khoi dong cung Windows...
call npm install -g pm2 pm2-windows-startup

echo [3/4] Dang ky dich vu khoi dong voi Windows...
call pm2-startup install

echo [4/4] Khoi chay Bot qua PM2 va luu trang thai...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo ====================================================
echo   CÀI ĐẶT HOÀN TẤT! BOT ĐANG CHẠY NGẦM 24/7.
echo   Moi khi khoi dong lai VPS, Bot se tu dong chay!
echo.
echo   Lenh quan ly huu ich:
echo   - Xem trang thai: pm2 status
echo   - Xem nhat ky:    pm2 logs bot-tele-company
echo   - Khoi dong lai:  pm2 restart bot-tele-company
echo   - Dung bot:       pm2 stop bot-tele-company
echo ====================================================
pause
