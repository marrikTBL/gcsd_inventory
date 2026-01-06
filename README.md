# GCSD Inventory Management System - Desktop App

## Version 5.4.0

This is a standalone desktop application for the Greene County Sheriff's Department Equipment Inventory Management System.

### Version 5.4.0 Changes
- **Automatic Updates** - App now checks for updates from GitHub on startup
- One-click download and install of new versions
- Automatic restart after update installation
- Visual update notification in header when updates are available

### Version 5.0 Changes
- Comprehensive error checking throughout application
- Improved data validation on load/save operations
- Better error messages for cloud backup failures (network issues, access denied, etc.)
- Application crash handling and recovery
- Null safety checks on all equipment operations
- IPC communication error handling wrapper
- Enhanced logging for troubleshooting

## Quick Install (3 Steps)

1. **Install Node.js** from https://nodejs.org (LTS version)
2. **Double-click `BUILD.bat`** - Wait for it to complete
3. **Double-click `SETUP.bat`** - Installs to Documents\INVENTORY with desktop shortcut

Done! Click the "INVENTORY" icon on your desktop to run.

## Automatic Updates

The application automatically checks for updates from GitHub when it starts. When an update is available:

1. An **"Update!"** button appears in the header (highlighted in orange)
2. Click it to see update details and release notes
3. Click **"Download & Install"** to update
4. The app will restart automatically with the new version

You can also manually check for updates by clicking the **"Updates"** button in the header at any time.

**Update Source:** https://github.com/marrikTBL/gcsd_inventory/releases

## Data Storage

All data is automatically saved to `GCSD-DATA.json` in the same folder as the EXE. Every change you make is instantly saved.

## Cloud Backup & Update

**Backup:** Click the "☁️ Backup" button to backup your data to the network share:
`\\192.168.0.249\Inventory\Inventory-Backup`

Each backup creates a timestamped file like: `GCSD-DATA_2024-01-05_14-30.json`

**Update:** Click the "☁️ Update" button to load the most recent backup from the cloud.

The Cloud box always shows the last backup date/time.

Buttons are organized into labeled boxes:
- **Local** box: Export and Import (for local file backups)
- **Cloud** box: Backup and Update (for network share)

The footer shows cloud backup status:
- 🟢 **CLOUD BACKUP** = Backup exists on network
- 🔴 **CLOUD BACKUP** = No backup found or network unavailable

## What Gets Installed

- **Location:** `Documents\INVENTORY\INVENTORY.exe`
- **Desktop shortcut:** INVENTORY (with badge icon)
- **Data file:** `Documents\INVENTORY\GCSD-DATA.json`

## Backup

Your data is saved in `GCSD-DATA.json` next to the EXE. To backup:
1. Copy `GCSD-DATA.json` to a safe location
2. To restore, replace the file with your backup

## Running Without Installing

If you just want to test without installing:
1. Double-click `INSTALL.bat` (installs dependencies)
2. Double-click `START.bat` (runs the app)

## Features

- ✅ **Automatic Updates** from GitHub releases
- ✅ Optimized launch with loading box & status messages
- ✅ Auto-save to local file (no browser dependency)
- ✅ Cloud backup with timestamped filenames (easy to identify)
- ✅ Cloud update loads most recent backup
- ✅ Organized button layout (Local & Cloud boxes)
- ✅ Last cloud backup date/time always visible
- ✅ Works offline
- ✅ Shows backup status indicators in footer
- ✅ Desktop shortcut with badge icon
- ✅ All features from browser version

## Designed by Brad Kiker
