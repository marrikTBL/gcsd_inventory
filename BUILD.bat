@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs -WorkingDirectory '%~dp0'"
    exit /b
)
cd /d "%~dp0"
echo GCSD Inventory - Build
echo.
where node >nul 2>nul || (echo ERROR: Node.js not found! Install from https://nodejs.org && pause && exit /b 1)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
echo Installing dependencies...
call npm install --loglevel=error || (echo ERROR: npm install failed! && pause && exit /b 1)
echo Building EXE...
call npm run build-win || (echo ERROR: Build failed! && pause && exit /b 1)
echo.
echo BUILD COMPLETE! Files in "dist\win-unpacked" folder.
echo Run SETUP.bat to install.
pause
