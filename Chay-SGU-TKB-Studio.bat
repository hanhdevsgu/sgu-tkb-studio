@echo off
chcp 65001 >nul
title SGU TKB Studio - Bàn Làm Việc Đăng Ký Tín Chỉ SGU
color 0B

echo ====================================================================
echo    SGU TKB STUDIO - HỆ THỐNG XẾP TKB VÀ ĐĂNG KÝ TÍN CHỈ SGU
echo    Hỗ trợ mọi tài khoản sinh viên (Tự động cập nhật linh hoạt)
echo    Đang khởi động máy chủ cục bộ (Zero Latency)...
echo ====================================================================
echo.

cd /d "%~dp0"

:: Tự động mở trình duyệt vào đúng bàn làm việc Cổng Đăng Ký
start http://localhost:3000/#dkmh

:: Khởi chạy Vite Dev Server (hỗ trợ cả máy tính và thiết bị cùng mạng WiFi qua --host)
npx vite --host --port 3000

pause
