@echo off
echo GCSD Inventory - Setup
echo.
set "INSTALLDIR=%USERPROFILE%\Documents\INVENTORY"
echo Installing to %INSTALLDIR%
echo Press any key to continue or CTRL+C to cancel...
pause >nul
if not exist "%INSTALLDIR%" mkdir "%INSTALLDIR%"
if exist "dist\win-unpacked\INVENTORY.exe" (
    xcopy "dist\win-unpacked\*" "%INSTALLDIR%\" /E /Y /Q
) else (echo ERROR: Build files not found! Run BUILD.bat first. && pause && exit /b 1)
copy "icon.ico" "%INSTALLDIR%\icon.ico" /Y 2>nul
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
echo SETUP COMPLETE! Run INVENTORY from your desktop.
pause
