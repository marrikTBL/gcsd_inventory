const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

// Version - increment this when releasing new versions
const APP_VERSION = '5.1.0';
const GITHUB_REPO = 'marrikTBL/gcsd_inventory';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
const GITHUB_ZIP_URL = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;

// Helper function to make HTTPS requests
const httpsGet = (url) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (reqUrl) => {
      const protocol = reqUrl.startsWith('https') ? https : http;
      protocol.get(reqUrl, { 
        headers: { 'User-Agent': 'GCSD-Inventory-Updater' }
      }, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(url);
  });
};

// Helper function to download file
const downloadFile = (url, destPath) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (reqUrl) => {
      const protocol = reqUrl.startsWith('https') ? https : http;
      protocol.get(reqUrl, {
        headers: { 'User-Agent': 'GCSD-Inventory-Updater' }
      }, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', reject);
    };
    makeRequest(url);
  });
};

// Compare version strings (e.g., "5.1.0" > "5.0.0")
const compareVersions = (v1, v2) => {
  // Extract numeric parts
  const normalize = (v) => {
    const match = v.match(/(\d+)\.(\d+)\.?(\d*)/);
    if (match) {
      return [parseInt(match[1]) || 0, parseInt(match[2]) || 0, parseInt(match[3]) || 0];
    }
    // Try simple number
    const num = parseInt(v);
    return [isNaN(num) ? 0 : num, 0, 0];
  };
  
  const parts1 = normalize(v1);
  const parts2 = normalize(v2);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  return 0;
};

// Check for updates from GitHub
const checkForUpdates = async () => {
  try {
    // Try to fetch package.json from GitHub
    const packageUrl = `${GITHUB_RAW_BASE}/package.json`;
    const packageData = await httpsGet(packageUrl);
    const remotePackage = JSON.parse(packageData);
    const remoteVersion = remotePackage.version || '0.0.0';
    
    console.log(`Current version: ${APP_VERSION}, Remote version: ${remoteVersion}`);
    
    if (compareVersions(remoteVersion, APP_VERSION) > 0) {
      return {
        updateAvailable: true,
        currentVersion: APP_VERSION,
        latestVersion: remoteVersion,
        downloadUrl: GITHUB_ZIP_URL
      };
    }
    
    return {
      updateAvailable: false,
      currentVersion: APP_VERSION,
      latestVersion: remoteVersion
    };
  } catch (error) {
    console.error('Update check failed:', error.message);
    return {
      updateAvailable: false,
      error: error.message,
      currentVersion: APP_VERSION
    };
  }
};

// Download and apply update
const downloadAndApplyUpdate = async (progressCallback) => {
  const tempDir = app.getPath('temp');
  const zipPath = path.join(tempDir, 'gcsd-update.zip');
  const extractDir = path.join(tempDir, 'gcsd-update-extracted');
  
  try {
    progressCallback({ stage: 'downloading', progress: 0 });
    
    // Download the zip file
    await downloadFile(GITHUB_ZIP_URL, zipPath);
    progressCallback({ stage: 'downloading', progress: 50 });
    
    // Get the application directory
    const appDir = app.isPackaged 
      ? path.dirname(process.execPath)
      : __dirname;
    
    progressCallback({ stage: 'extracting', progress: 60 });
    
    // Create batch script to extract and update after app closes
    const updateScript = path.join(tempDir, 'gcsd-update.bat');
    const scriptContent = `@echo off
echo GCSD Inventory Update in Progress...
echo Please wait while the update is being applied...
echo.

:: Wait for the app to close
timeout /t 3 /nobreak > nul

:: Create extraction directory
if exist "${extractDir}" rmdir /s /q "${extractDir}"
mkdir "${extractDir}"

:: Extract using PowerShell
echo Extracting update files...
powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"

:: Find the extracted folder (usually named gcsd_inventory-main)
for /d %%i in ("${extractDir}\\*") do set "SOURCE=%%i"

:: Copy files to app directory (preserve data file)
echo Copying updated files...
if exist "%SOURCE%\\main.js" copy /y "%SOURCE%\\main.js" "${appDir}\\main.js"
if exist "%SOURCE%\\preload.js" copy /y "%SOURCE%\\preload.js" "${appDir}\\preload.js"
if exist "%SOURCE%\\index.html" copy /y "%SOURCE%\\index.html" "${appDir}\\index.html"
if exist "%SOURCE%\\package.json" copy /y "%SOURCE%\\package.json" "${appDir}\\package.json"
if exist "%SOURCE%\\icon.ico" copy /y "%SOURCE%\\icon.ico" "${appDir}\\icon.ico"
if exist "%SOURCE%\\icon.png" copy /y "%SOURCE%\\icon.png" "${appDir}\\icon.png"

:: Cleanup
echo Cleaning up...
rmdir /s /q "${extractDir}"
del /q "${zipPath}"

echo.
echo Update complete! Restarting application...
timeout /t 2 /nobreak > nul

:: Restart the app
cd /d "${appDir}"
start "" "${app.isPackaged ? process.execPath : 'npm start'}"

:: Delete this script
del "%~f0"
`;
    
    fs.writeFileSync(updateScript, scriptContent);
    progressCallback({ stage: 'ready', progress: 100, scriptPath: updateScript });
    
    return { success: true, scriptPath: updateScript };
  } catch (error) {
    console.error('Update download failed:', error);
    // Cleanup on failure
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (e) {}
    return { success: false, error: error.message };
  }
};

// Execute update (close app and run update script)
const executeUpdate = (scriptPath) => {
  try {
    // Launch the update script
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();
    
    // Quit the app
    setTimeout(() => {
      app.quit();
    }, 500);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to execute update:', error);
    return { success: false, error: error.message };
  }
};

// Data file path - saves in same folder as the EXE
const getDataPath = () => {
  try {
    const basePath = app.isPackaged 
      ? path.dirname(process.execPath)
      : __dirname;
    return path.join(basePath, 'GCSD-DATA.json');
  } catch (error) {
    console.error('Error getting data path:', error);
    return path.join(__dirname, 'GCSD-DATA.json');
  }
};

// Cloud backup directory
const CLOUD_BACKUP_DIR = '\\\\192.168.0.249\\Inventory\\Inventory-Backup';

// Generate timestamped filename: GCSD-DATA_2024-01-05_14-30.json
const getTimestampedFilename = () => {
  try {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // 2024-01-05
    const time = now.toTimeString().slice(0, 5).replace(':', '-'); // 14-30
    return `GCSD-DATA_${date}_${time}.json`;
  } catch (error) {
    console.error('Error generating timestamp:', error);
    return `GCSD-DATA_backup.json`;
  }
};

// Find the most recent backup file in cloud directory
const findLatestBackup = () => {
  try {
    if (!fs.existsSync(CLOUD_BACKUP_DIR)) {
      console.log('Cloud backup directory does not exist:', CLOUD_BACKUP_DIR);
      return null;
    }
    
    const files = fs.readdirSync(CLOUD_BACKUP_DIR)
      .filter(f => f.startsWith('GCSD-DATA') && f.endsWith('.json'))
      .map(f => {
        try {
          const filePath = path.join(CLOUD_BACKUP_DIR, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            mtime: stats.mtime
          };
        } catch (err) {
          console.error('Error reading file stats:', f, err);
          return null;
        }
      })
      .filter(f => f !== null)
      .sort((a, b) => b.mtime - a.mtime);
    
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('Error finding latest backup:', error);
    return null;
  }
};

// Validate JSON data structure
const validateData = (data) => {
  if (!data || typeof data !== 'object') return false;
  // Basic structure validation
  return true;
};

let mainWindow;

function createWindow() {
  // Icon path - with asar:false, files are unpacked
  let iconPath;
  try {
    iconPath = path.join(__dirname, 'icon.png');
    
    // Verify icon exists
    if (!fs.existsSync(iconPath)) {
      console.warn('Icon not found at:', iconPath);
      iconPath = undefined;
    }
  } catch (error) {
    console.error('Error setting icon path:', error);
    iconPath = undefined;
  }
    
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'GCSD Inventory Management System v' + APP_VERSION,
    backgroundColor: '#0a0a0a',
    show: true,  // Show immediately so loading screen is visible
  });

  mainWindow.loadFile('index.html');
  
  // Remove menu bar for cleaner look
  mainWindow.setMenuBarVisibility(false);
  
  // Handle window errors
  mainWindow.webContents.on('crashed', () => {
    console.error('Window crashed');
    dialog.showErrorBox('Application Error', 'The application has crashed. Please restart.');
  });
  
  mainWindow.on('unresponsive', () => {
    console.error('Window unresponsive');
  });
}

// Handle save data request from renderer
ipcMain.handle('save-data', async (event, data) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid data format' };
    }
    const filePath = getDataPath();
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');
    console.log('Data saved to:', filePath, '- Size:', jsonData.length, 'bytes');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message || 'Failed to save data' };
  }
});

// Handle load data request from renderer
ipcMain.handle('load-data', async () => {
  try {
    const filePath = getDataPath();
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);
      if (!validateData(data)) {
        return { success: false, error: 'Invalid data structure in file' };
      }
      console.log('Data loaded from:', filePath);
      return { success: true, data: data, path: filePath };
    }
    console.log('No data file found at:', filePath);
    return { success: false, message: 'No data file found' };
  } catch (error) {
    console.error('Load error:', error);
    return { success: false, error: error.message || 'Failed to load data' };
  }
});

// Get data file path for display
ipcMain.handle('get-data-path', () => {
  try {
    return getDataPath();
  } catch (error) {
    console.error('Get path error:', error);
    return 'Unknown';
  }
});

// Handle cloud backup request - creates timestamped file
ipcMain.handle('cloud-backup', async (event, data) => {
  try {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid data format' };
    }
    
    // Check if network path is accessible
    if (!fs.existsSync(CLOUD_BACKUP_DIR)) {
      return { success: false, error: 'Cloud backup location not accessible. Check network connection.' };
    }
    
    const filename = getTimestampedFilename();
    const filePath = path.join(CLOUD_BACKUP_DIR, filename);
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData, { encoding: 'utf8', flag: 'w' });
    console.log('Cloud backup saved to:', filePath, '- Size:', jsonData.length, 'bytes');
    return { success: true, path: filePath, filename: filename };
  } catch (error) {
    console.error('Cloud backup error:', error);
    let errorMsg = error.message || 'Failed to create cloud backup';
    if (error.code === 'ENOENT') errorMsg = 'Network path not found';
    if (error.code === 'EACCES') errorMsg = 'Access denied to network path';
    if (error.code === 'ETIMEDOUT') errorMsg = 'Network connection timed out';
    return { success: false, error: errorMsg };
  }
});

// Check if cloud backup exists - finds most recent
ipcMain.handle('check-cloud-backup', async () => {
  try {
    const latest = findLatestBackup();
    if (latest) {
      return { 
        success: true, 
        exists: true, 
        lastModified: latest.mtime.toISOString(),
        path: latest.path,
        filename: latest.name
      };
    }
    return { success: true, exists: false };
  } catch (error) {
    console.error('Cloud backup check error:', error);
    return { success: false, error: error.message || 'Failed to check cloud backup' };
  }
});

// Load data from cloud backup - loads most recent
ipcMain.handle('load-from-cloud', async () => {
  try {
    const latest = findLatestBackup();
    if (latest) {
      const rawData = fs.readFileSync(latest.path, 'utf8');
      const data = JSON.parse(rawData);
      if (!validateData(data)) {
        return { success: false, error: 'Invalid data structure in cloud backup' };
      }
      console.log('Data loaded from cloud backup:', latest.path);
      return { 
        success: true, 
        data: data, 
        path: latest.path,
        filename: latest.name,
        lastModified: latest.mtime.toISOString()
      };
    }
    return { success: false, message: 'No cloud backup file found' };
  } catch (error) {
    console.error('Load from cloud error:', error);
    return { success: false, error: error.message || 'Failed to load from cloud' };
  }
});

// ==================== UPDATE HANDLERS ====================

// Check for updates
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await checkForUpdates();
    return { success: true, ...result };
  } catch (error) {
    console.error('Update check error:', error);
    return { success: false, error: error.message };
  }
});

// Download update
ipcMain.handle('download-update', async (event) => {
  try {
    const result = await downloadAndApplyUpdate((progress) => {
      // Send progress to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-progress', progress);
      }
    });
    return result;
  } catch (error) {
    console.error('Update download error:', error);
    return { success: false, error: error.message };
  }
});

// Execute update (restart and apply)
ipcMain.handle('execute-update', async (event, scriptPath) => {
  try {
    return executeUpdate(scriptPath);
  } catch (error) {
    console.error('Update execution error:', error);
    return { success: false, error: error.message };
  }
});

// Get current version
ipcMain.handle('get-version', () => {
  return APP_VERSION;
});

app.whenReady().then(() => {
  console.log('App ready - Version:', APP_VERSION);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error('App initialization error:', error);
  dialog.showErrorBox('Startup Error', 'Failed to start application: ' + error.message);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Application Error', 'An unexpected error occurred: ' + error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
