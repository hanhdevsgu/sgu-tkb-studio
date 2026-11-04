@echo off
title SGU TKB Studio - May Chu Dang Ky Tin Chi
color 0B

echo ====================================================================
echo    SGU TKB STUDIO - HE THONG XEP TKB VA DANG KY TIN CHI SGU
echo    Ho tro moi tai khoan sinh vien (Cap nhat linh hoat)
echo    Dang khoi dong may chu cuc bo (Zero Latency)...
echo ====================================================================
echo.

cd /d "%~dp0"

:: Tu dong mo trinh duyet vao ban lam viec Cong Dang Ky
start http://localhost:3000/#dkmh

:: Khoi chay Vite Dev Server (ho tro ca may tinh va thiet bi cung mang WiFi)
npx vite --host --port 3000

pause
