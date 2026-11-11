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

echo [2/2] Dang khoi dong may chu noi bo...
echo He thong se tu dong mo trinh duyet ngay khi may chu load xong 100%% (HTTP 200).
echo.

:: Khoi dong tien trinh ngam tham do HTTP 200 OK roi moi tu dong bat trinh duyet
start "" /b node scripts/open-when-ready.cjs

call npm run dev
pause
