const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Performance optimizations - increase memory and enable hardware acceleration
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');

const APP_VERSION = "6.1.0-BETA";
let updater = null;

const loadUpdater = () => {
  try {
    const searchPaths = [
      path.join(__dirname, "updater.js"),
      path.join(app.getAppPath(), "updater.js"),
      path.join(path.dirname(process.execPath), "updater.js"),
      path.join(path.dirname(process.execPath), "resources", "updater.js")
    ];
    let foundPath = null;
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        console.log("Found updater at:", p);
        break;
      }
    }
    if (foundPath) {
      updater = require(foundPath);
      console.log("Updater module loaded successfully from:", foundPath);
    } else {
      console.error("Updater module not found in any expected location");
      console.log("Searched paths:", searchPaths);
    }
  } catch (e) {
    console.error("Failed to load updater module:", e);
  }
};

const getDataPath = () => {
  try {
    const basePath = app.isPackaged ? path.dirname(process.execPath) : __dirname;
    return path.join(basePath, "GCSD-DATA.json");
  } catch (e) {
    console.error("Error getting data path:", e);
    return path.join(__dirname, "GCSD-DATA.json");
  }
};

const CLOUD_BACKUP_DIR = "\\\\192.168.0.249\\Inventory\\Inventory-Backup";
const CLOUD_BACKUP_FILE = "Inventory.json";

const getCloudBackupPath = () => {
  return path.join(CLOUD_BACKUP_DIR, CLOUD_BACKUP_FILE);
};

const findBackup = () => {
  try {
    const backupPath = getCloudBackupPath();
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      return {
        name: CLOUD_BACKUP_FILE,
        path: backupPath,
        mtime: stats.mtime
      };
    }
    return null;
  } catch (e) {
    console.error("Error finding backup:", e);
    return null;
  }
};

const validateData = (data) => {
  return !(!data || typeof data !== "object");
};

let mainWindow;

function createWindow() {
  let iconPath;
  try {
    iconPath = path.join(__dirname, "icon.png");
    if (!fs.existsSync(iconPath)) {
      console.warn("Icon not found at:", iconPath);
      iconPath = undefined;
    }
  } catch (e) {
    console.error("Error setting icon path:", e);
    iconPath = undefined;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck'
    },
    title: "GCSD Inventory Management System v6.1.0-BETA",
    backgroundColor: "#1a1a1a",
    show: true
  });

  mainWindow.loadFile("index.html");
  mainWindow.setMenuBarVisibility(false);

  // Enable hardware acceleration and increase memory limits
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1);
  });

  mainWindow.webContents.on("crashed", () => {
    console.error("Window crashed");
    dialog.showErrorBox("Application Error", "The application has crashed. Please restart.");
  });

  mainWindow.on("unresponsive", () => {
    console.error("Window unresponsive");
  });
}

ipcMain.handle("save-data", async (event, data) => {
  try {
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid data format" };
    }
    const dataPath = getDataPath();
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(dataPath, jsonData, "utf8");
    console.log("Data saved to:", dataPath, "- Size:", jsonData.length, "bytes");
    return { success: true, path: dataPath };
  } catch (e) {
    console.error("Save error:", e);
    return { success: false, error: e.message || "Failed to save data" };
  }
});

ipcMain.handle("load-data", async () => {
  try {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      const fileData = fs.readFileSync(dataPath, "utf8");
      const data = JSON.parse(fileData);
      if (validateData(data)) {
        console.log("Data loaded from:", dataPath);
        return { success: true, data: data, path: dataPath };
      } else {
        return { success: false, error: "Invalid data structure in file" };
      }
    }
    console.log("No data file found at:", dataPath);
    return { success: false, message: "No data file found" };
  } catch (e) {
    console.error("Load error:", e);
    return { success: false, error: e.message || "Failed to load data" };
  }
});

ipcMain.handle("get-data-path", () => {
  try {
    return getDataPath();
  } catch (e) {
    console.error("Get path error:", e);
    return "Unknown";
  }
});

ipcMain.handle("cloud-backup", async (event, data) => {
  try {
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid data format" };
    }
    if (!fs.existsSync(CLOUD_BACKUP_DIR)) {
      return { success: false, error: "Cloud backup location not accessible. Check network connection." };
    }
    const backupPath = getCloudBackupPath();
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(backupPath, jsonData, { encoding: "utf8", flag: "w" });
    console.log("Cloud backup saved to:", backupPath, "- Size:", jsonData.length, "bytes");
    return { success: true, path: backupPath, filename: CLOUD_BACKUP_FILE };
  } catch (e) {
    console.error("Cloud backup error:", e);
    let errorMsg = e.message || "Failed to create cloud backup";
    if (e.code === "ENOENT") errorMsg = "Network path not found";
    if (e.code === "EACCES") errorMsg = "Access denied to network path";
    if (e.code === "ETIMEDOUT") errorMsg = "Network connection timed out";
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle("check-cloud-backup", async () => {
  try {
    const backup = findBackup();
    if (backup) {
      return {
        success: true,
        exists: true,
        lastModified: backup.mtime.toISOString(),
        path: backup.path,
        filename: backup.name
      };
    }
    return { success: true, exists: false };
  } catch (e) {
    console.error("Cloud backup check error:", e);
    return { success: false, error: e.message || "Failed to check cloud backup" };
  }
});

ipcMain.handle("load-from-cloud", async () => {
  try {
    const backup = findBackup();
    if (backup) {
      const fileData = fs.readFileSync(backup.path, "utf8");
      const data = JSON.parse(fileData);
      if (validateData(data)) {
        console.log("Data loaded from cloud backup:", backup.path);
        return {
          success: true,
          data: data,
          path: backup.path,
          filename: backup.name,
          lastModified: backup.mtime.toISOString()
        };
      } else {
        return { success: false, error: "Invalid data structure in cloud backup" };
      }
    }
    return { success: false, message: "No cloud backup file found" };
  } catch (e) {
    console.error("Load from cloud error:", e);
    return { success: false, error: e.message || "Failed to load from cloud" };
  }
});

ipcMain.handle("check-for-updates", async () => {
  try {
    if (!updater) {
      return { success: false, error: "Updater not available" };
    }
    return { success: true, ...await updater.checkForUpdates("6.1.0-BETA") };
  } catch (e) {
    console.error("Check for updates error:", e);
    return { success: false, error: e.message || "Failed to check for updates" };
  }
});

ipcMain.handle("download-update", async (event, updateInfo) => {
  try {
    if (!updater) {
      return { success: false, error: "Updater not available" };
    }
    const progressCallback = (downloaded, total) => {
      const percent = Math.round((downloaded / total) * 100);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-download-progress", { downloaded, total, percent });
      }
    };
    return { success: true, ...await updater.downloadUpdate(updateInfo, progressCallback) };
  } catch (e) {
    console.error("Download update error:", e);
    return { success: false, error: e.message || "Failed to download update" };
  }
});

ipcMain.handle("apply-update", async (event, zipPath, tempDir) => {
  try {
    if (!updater) {
      return { success: false, error: "Updater not available" };
    }
    return { success: true, ...await updater.applyUpdate(zipPath, tempDir) };
  } catch (e) {
    console.error("Apply update error:", e);
    return { success: false, error: e.message || "Failed to apply update" };
  }
});

ipcMain.handle("restart-app", async () => {
  try {
    if (updater) {
      setTimeout(() => {
        updater.restartApp();
      }, 500);
      return { success: true };
    }
    return { success: false, error: "Updater not available" };
  } catch (e) {
    console.error("Restart app error:", e);
    return { success: false, error: e.message || "Failed to restart application" };
  }
});

ipcMain.handle("relaunch-app", async () => {
  try {
    const { exec } = require('child_process');
    const appName = path.basename(process.execPath, '.exe');
    
    // Kill all other instances of the app on Windows
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        exec(`taskkill /F /IM "${appName}.exe" /FI "PID ne ${process.pid}"`, (error) => {
          // Ignore errors - may not have other instances
          resolve();
        });
      });
    }
    
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 300);
    return { success: true };
  } catch (e) {
    console.error("Relaunch app error:", e);
    return { success: false, error: e.message || "Failed to relaunch application" };
  }
});

ipcMain.handle("close-app", async () => {
  try {
    setTimeout(() => {
      app.exit(0);
    }, 500);
    return { success: true };
  } catch (e) {
    console.error("Close app error:", e);
    return { success: false, error: e.message || "Failed to close application" };
  }
});

ipcMain.handle("get-available-backups", async () => {
  try {
    if (!updater || !updater.getAvailableBackups) {
      return { success: false, error: "Updater not available" };
    }
    const backups = updater.getAvailableBackups();
    return { success: true, backups };
  } catch (e) {
    console.error("Get backups error:", e);
    return { success: false, error: e.message || "Failed to get backups" };
  }
});

ipcMain.handle("rollback-to-backup", async (event, backupName) => {
  try {
    if (!updater || !updater.rollbackToBackup) {
      return { success: false, error: "Updater not available" };
    }
    const result = updater.rollbackToBackup(backupName);
    return { success: true, ...result };
  } catch (e) {
    console.error("Rollback error:", e);
    return { success: false, error: e.message || "Failed to rollback" };
  }
});

ipcMain.handle("get-app-version", () => "6.1.0-BETA");

app.whenReady().then(() => {
  console.log("App ready - Version:", "6.1.0-BETA");
  loadUpdater();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((e) => {
  console.error("App initialization error:", e);
  dialog.showErrorBox("Startup Error", "Failed to start application: " + e.message);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

process.on("uncaughtException", (e) => {
  console.error("Uncaught exception:", e);
  dialog.showErrorBox("Application Error", "An unexpected error occurred: " + e.message);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
