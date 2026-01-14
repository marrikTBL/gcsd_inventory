@echo off
echo GCSD Inventory - Installing Dependencies
where node >nul 2>nul || (echo ERROR: Node.js not installed! Get it from https://nodejs.org && pause && exit /b 1)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
call npm install || (echo ERROR: npm install failed! && pause && exit /b 1)
echo Installation Complete! Run START.bat to launch.
pause
