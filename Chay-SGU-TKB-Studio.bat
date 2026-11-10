@echo off
title SGU TKB Studio - He Thong Xep TKB & Dang Ky Hoc Phan SGU
color 0B

echo ====================================================================
echo    SGU TKB STUDIO - HE THONG XEP TKB VA DANG KY TIN CHI SGU
echo    Ho tro: Xep lich 5 phuong an + Cong DKMH + Radar Sniper tu dong
echo    Chay cuc bo 100%% tren may tinh cua ban (Zero Latency)
echo ====================================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/2] Phat hien lan chay dau tien - Dang cai dat thu vien ^(npm install^)...
    call npm install
    echo.
)

echo [2/2] Dang khoi dong may chu tai http://localhost:3000 ...
start http://localhost:3000
call npm run dev
pause
