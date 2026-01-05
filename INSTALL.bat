@echo off
echo ==========================================
echo GCSD Inventory - Installing Dependencies
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org
    echo.
    echo Choose the LTS version for best compatibility.
    echo After installing, run this script again.
    echo.
    pause
    exit /b 1
)

echo Node.js found.
echo.

echo Cleaning old dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json

echo Installing fresh dependencies...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Installation Complete!
echo ==========================================
echo.
echo Run START.bat to launch the application.
echo.
pause
