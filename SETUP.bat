@echo off
echo ==========================================
echo GCSD Inventory - Setup
echo ==========================================
echo.

set "INSTALLDIR=%USERPROFILE%\Documents\INVENTORY"

echo This will:
echo   1. Create %INSTALLDIR%
echo   2. Copy application files there
echo   3. Create desktop shortcut
echo.
echo Press any key to continue or CTRL+C to cancel...
pause >nul

echo.
echo Creating folder...
if not exist "%INSTALLDIR%" mkdir "%INSTALLDIR%"

echo Looking for build files...
if exist "dist\win-unpacked\INVENTORY.exe" (
    echo Copying application...
    xcopy "dist\win-unpacked\*" "%INSTALLDIR%\" /E /Y /Q
) else (
    echo ERROR: Build files not found!
    echo Please run BUILD.bat first.
    pause
    exit /b 1
)

echo Copying icon...
copy "icon.ico" "%INSTALLDIR%\icon.ico" /Y 2>nul

echo Creating desktop shortcut...
set "SCRIPT=%TEMP%\createshortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SCRIPT%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\INVENTORY.lnk" >> "%SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SCRIPT%"
echo oLink.TargetPath = "%INSTALLDIR%\INVENTORY.exe" >> "%SCRIPT%"
echo oLink.WorkingDirectory = "%INSTALLDIR%" >> "%SCRIPT%"
echo oLink.IconLocation = "%INSTALLDIR%\icon.ico" >> "%SCRIPT%"
echo oLink.Save >> "%SCRIPT%"
cscript /nologo "%SCRIPT%"
del "%SCRIPT%"

echo.
echo ==========================================
echo SETUP COMPLETE!
echo ==========================================
echo.
echo Installed to: %INSTALLDIR%
echo Desktop shortcut: INVENTORY
echo.
echo You can now run INVENTORY from your desktop!
echo.
pause
