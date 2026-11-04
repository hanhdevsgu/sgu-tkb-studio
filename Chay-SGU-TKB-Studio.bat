@echo off
chcp 65001 >nul
title SGU TKB Studio - Auto ĐK Môn Học & Xếp TKB
color 0B

echo ====================================================================
echo    SGU TKB STUDIO - HỆ THỐNG XẾP TKB VÀ ĐĂNG KÝ MÔN TỰ ĐỘNG
echo    Tài khoản MSSV: 3124410007 (K24 CNTT)
echo    Đang khởi động Vite Dev Server...
echo ====================================================================
echo.

cd /d "%~dp0"
start http://localhost:3000
npm run dev
pause

