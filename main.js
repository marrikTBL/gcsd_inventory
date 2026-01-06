const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Version
const APP_VERSION = '5.4.0';

// Auto-updater (loaded after app is ready)
let updater = null;
const loadUpdater = () => {
  try {
    // Try multiple paths for the updater module
    const possiblePaths = [
      path.join(__dirname, 'updater.js'),
      path.join(app.getAppPath(), 'updater.js'),
      path.join(path.dirname(process.execPath), 'updater.js'),
      path.join(path.dirname(process.execPath), 'resources', 'updater.js'),
    ];
    
    let updaterPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        updaterPath = p;
        console.log('Found updater at:', p);
        break;
      }
    }
    
    if (updaterPath) {
      updater = require(updaterPath);
      console.log('Updater module loaded successfully from:', updaterPath);
    } else {
      console.error('Updater module not found in any expected location');
      console.log('Searched paths:', possiblePaths);
    }
  } catch (error) {
    console.error('Failed to load updater module:', error);
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

// Check for updates from GitHub
ipcMain.handle('check-for-updates', async () => {
  try {
    if (!updater) {
      return { success: false, error: 'Updater not available' };
    }
    const updateInfo = await updater.checkForUpdates(APP_VERSION);
    return { success: true, ...updateInfo };
  } catch (error) {
    console.error('Check for updates error:', error);
    return { success: false, error: error.message || 'Failed to check for updates' };
  }
});

// Download update
ipcMain.handle('download-update', async (event, updateInfo) => {
  try {
    if (!updater) {
      return { success: false, error: 'Updater not available' };
    }
    
    // Send progress updates to renderer
    const onProgress = (downloaded, total) => {
      const percent = Math.round((downloaded / total) * 100);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', { downloaded, total, percent });
      }
    };
    
    const result = await updater.downloadUpdate(updateInfo, onProgress);
    return { success: true, ...result };
  } catch (error) {
    console.error('Download update error:', error);
    return { success: false, error: error.message || 'Failed to download update' };
  }
});

// Apply update and restart
ipcMain.handle('apply-update', async (event, zipPath, tempDir) => {
  try {
    if (!updater) {
      return { success: false, error: 'Updater not available' };
    }
    const result = await updater.applyUpdate(zipPath, tempDir);
    return { success: true, ...result };
  } catch (error) {
    console.error('Apply update error:', error);
    return { success: false, error: error.message || 'Failed to apply update' };
  }
});

// Restart application
ipcMain.handle('restart-app', async () => {
  try {
    if (!updater) {
      return { success: false, error: 'Updater not available' };
    }
    // Small delay to allow response to be sent
    setTimeout(() => {
      updater.restartApp();
    }, 500);
    return { success: true };
  } catch (error) {
    console.error('Restart app error:', error);
    return { success: false, error: error.message || 'Failed to restart application' };
  }
});

// Get current version
ipcMain.handle('get-app-version', () => {
  return APP_VERSION;
});

app.whenReady().then(() => {
  console.log('App ready - Version:', APP_VERSION);
  
  // Load the updater module
  loadUpdater();
  
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
