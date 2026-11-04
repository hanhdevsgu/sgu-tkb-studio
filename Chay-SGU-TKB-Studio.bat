@echo off
title SGU TKB Studio - May Chu Dang Ky Tin Chi SGU
color 0B

echo ====================================================================
echo    SGU TKB STUDIO - HE THONG XEP TKB VA DANG KY TIN CHI SGU
echo    Tai khoan MSSV: 3124410007 (K24 CNTT)
echo    Dang khoi dong may chu cuc bo (Zero Latency)...
echo ====================================================================
echo.

cd /d "%~dp0"
start http://localhost:3000/#dkmh
npm run dev
pause
