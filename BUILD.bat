@echo off
:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
)

cd /d "%~dp0"

echo ==========================================
echo GCSD Inventory - Build (Administrator)
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Install from: https://nodejs.org
    pause
    exit /b 1
)

echo Cleaning old dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json

echo.
echo Installing dependencies (this may take a minute)...
call npm install --loglevel=error
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo Dependencies installed successfully.
echo.
echo Building EXE...
call npm run build-win
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo BUILD COMPLETE!
echo ==========================================
echo.
echo Files created in "dist\win-unpacked" folder.
echo Now run SETUP.bat to install.
echo.
pause
