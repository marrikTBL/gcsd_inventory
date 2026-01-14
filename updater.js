const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { execSync } = require("child_process");

const GITHUB_OWNER = "marrikTBL";
const GITHUB_REPO = "gcsd_inventory";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const getAppDir = () => {
  if (app.isPackaged) {
    const resourcesApp = path.join(path.dirname(process.execPath), "resources", "app");
    return fs.existsSync(resourcesApp) ? resourcesApp : path.dirname(process.execPath);
  }
  return __dirname;
};

const getExeDir = () => {
  return app.isPackaged ? path.dirname(process.execPath) : __dirname;
};

const getBackupsDir = () => {
  return path.join(getExeDir(), "backups");
};

const getCurrentVersion = () => {
  try {
    const appPackage = path.join(getAppDir(), "package.json");
    if (fs.existsSync(appPackage)) {
      return JSON.parse(fs.readFileSync(appPackage, "utf8")).version || "0.0.0";
    }
    const localPackage = path.join(__dirname, "package.json");
    if (fs.existsSync(localPackage)) {
      return JSON.parse(fs.readFileSync(localPackage, "utf8")).version || "0.0.0";
    }
  } catch (e) {
    console.error("Error reading current version:", e);
  }
  return "0.0.0";
};

const isNewerVersion = (current, latest) => {
  current = current.replace(/^v/, "");
  latest = latest.replace(/^v/, "");
  const currentParts = current.split(".").map(p => parseInt(p, 10) || 0);
  const latestParts = latest.split(".").map(p => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
};

const httpsGet = (url, headers = {}) => new Promise((resolve, reject) => {
  const defaultHeaders = { "User-Agent": "GCSD-Inventory-Updater/1.0", ...headers };
  const doRequest = (requestUrl, redirectCount = 0) => {
    if (redirectCount > 5) {
      reject(new Error("Too many redirects"));
      return;
    }
    const urlObj = new URL(requestUrl);
    const protocol = urlObj.protocol === "https:" ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: defaultHeaders
    };
    const req = protocol.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        doRequest(res.headers.location, redirectCount + 1);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ data, headers: res.headers }));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  };
  doRequest(url);
});

const downloadFile = (url, destPath, progressCallback) => new Promise((resolve, reject) => {
  const doRequest = (requestUrl, redirectCount = 0) => {
    if (redirectCount > 5) {
      reject(new Error("Too many redirects"));
      return;
    }
    const urlObj = new URL(requestUrl);
    const protocol = urlObj.protocol === "https:" ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: { "User-Agent": "GCSD-Inventory-Updater/1.0" }
    };
    const req = protocol.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        doRequest(res.headers.location, redirectCount + 1);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      const totalSize = parseInt(res.headers["content-length"], 10) || 0;
      let downloaded = 0;
      const fileStream = fs.createWriteStream(destPath);
      res.on("data", chunk => {
        downloaded += chunk.length;
        if (progressCallback && totalSize > 0) {
          progressCallback(downloaded, totalSize);
        }
      });
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve(destPath);
      });
      fileStream.on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on("error", reject);
    req.setTimeout(300000, () => {
      req.destroy();
      reject(new Error("Download timeout"));
    });
    req.end();
  };
  doRequest(url);
});

const checkForUpdates = async (currentVer = null) => {
  try {
    console.log("Checking for updates...");
    console.log("GitHub API URL:", GITHUB_API_URL);
    const version = currentVer || getCurrentVersion();
    console.log("Current version:", version);
    
    let responseData;
    try {
      const response = await httpsGet(GITHUB_API_URL, { Accept: "application/vnd.github.v3+json" });
      responseData = response.data;
    } catch (e) {
      if (e.message && e.message.includes("404")) {
        console.log("No releases found on GitHub repository (404)");
        return {
          updateAvailable: false,
          currentVersion: version,
          latestVersion: version,
          noReleases: true,
          message: "No releases published yet. You have the latest version."
        };
      }
      throw e;
    }
    
    const release = JSON.parse(responseData);
    const latestVersion = release.tag_name || release.name || "0.0.0";
    console.log("Latest version:", latestVersion);
    
    return {
      updateAvailable: isNewerVersion(version, latestVersion),
      currentVersion: version,
      latestVersion: latestVersion.replace(/^v/, ""),
      releaseNotes: release.body || "No release notes available.",
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets: release.assets || [],
      zipballUrl: release.zipball_url,
      tarballUrl: release.tarball_url
    };
  } catch (e) {
    console.error("Error checking for updates:", e);
    throw e;
  }
};

const downloadUpdate = async (updateInfo, progressCallback) => {
  const exeDir = getExeDir();
  const tempDir = path.join(exeDir, "update_temp");
  const zipPath = path.join(tempDir, "update.zip");
  
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    let downloadUrl = null;
    let source = "unknown";
    
    console.log("Looking for download in release...");
    console.log("Available assets:", updateInfo.assets?.length || 0);
    
    if (updateInfo.assets && updateInfo.assets.length > 0) {
      updateInfo.assets.forEach(a => console.log("  Asset:", a.name, a.browser_download_url));
      let asset = updateInfo.assets.find(a => 
        a.name.endsWith(".zip") && 
        (a.name.toLowerCase().includes("win") || 
         a.name.toLowerCase().includes("gcsd") || 
         a.name.toLowerCase().includes("inventory") || 
         a.name.toLowerCase().includes("desktop"))
      );
      if (!asset) {
        asset = updateInfo.assets.find(a => a.name.endsWith(".zip"));
      }
      if (asset) {
        downloadUrl = asset.browser_download_url;
        source = "release-asset";
        console.log("Found release asset:", asset.name);
      }
    }
    
    if (!downloadUrl && updateInfo.zipballUrl) {
      downloadUrl = updateInfo.zipballUrl;
      source = "release-zipball";
      console.log("Using release source zipball");
    }
    
    if (!downloadUrl) {
      throw new Error("No downloadable update found in release");
    }
    
    console.log("Download source:", source);
    console.log("Downloading from:", downloadUrl);
    
    await downloadFile(downloadUrl, zipPath, progressCallback);
    console.log("Download complete:", zipPath);
    
    return { success: true, zipPath, tempDir };
  } catch (e) {
    console.error("Error downloading update:", e);
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {}
    throw e;
  }
};

const applyUpdate = async (zipPath, tempDir) => {
  const appDir = getAppDir();
  const exeDir = getExeDir();
  const extractDir = path.join(tempDir, "extracted");
  const backupsDir = getBackupsDir();
  
  console.log("=== Update Application ===");
  console.log("App directory (source files):", appDir);
  console.log("EXE directory:", exeDir);
  console.log("Temp directory:", tempDir);
  console.log("Backups directory:", backupsDir);
  
  try {
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    console.log("Extracting update...");
    console.log("ZIP path:", zipPath);
    console.log("Extract to:", extractDir);
    
    const zipPathNormalized = zipPath.replace(/\\/g, "/");
    const psCommand = `Expand-Archive -LiteralPath '${zipPathNormalized}' -DestinationPath '${extractDir.replace(/\\/g, "/")}' -Force`;
    
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, {
        stdio: "pipe",
        timeout: 120000,
        windowsHide: true
      });
      console.log("Extraction complete");
    } catch (psErr) {
      console.error("PowerShell extraction failed:", psErr.message);
      console.log("Trying fallback extraction with tar...");
      try {
        execSync(`tar -xf "${zipPath}" -C "${extractDir}"`, {
          stdio: "pipe",
          timeout: 120000,
          windowsHide: true
        });
        console.log("Tar extraction complete");
      } catch (tarErr) {
        console.error("Tar extraction also failed:", tarErr.message);
        throw new Error("Failed to extract update. Please try again or update manually.");
      }
    }
    
    let sourceDir = extractDir;
    const entries = fs.readdirSync(extractDir);
    console.log("Extracted entries:", entries);
    
    if (entries.length === 1) {
      const singleEntry = path.join(extractDir, entries[0]);
      if (fs.statSync(singleEntry).isDirectory()) {
        sourceDir = singleEntry;
      }
    }
    
    console.log("Source directory for update files:", sourceDir);
    console.log("Files in source:", fs.readdirSync(sourceDir));
    
    const filesToUpdate = ["main.js", "preload.js", "index.html", "updater.js", "package.json", "icon.png", "icon.ico"];
    
    console.log("=== Updating Files ===");
    console.log("Destination (appDir):", appDir);
    
    // Get current version for backup folder name
    const currentVersion = getCurrentVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupDir = path.join(backupsDir, `v${currentVersion}_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log("Backup directory:", backupDir);
    
    // Save version info to backup
    const backupInfo = {
      version: currentVersion,
      timestamp: new Date().toISOString(),
      files: []
    };
    
    // Backup existing files
    for (const file of filesToUpdate) {
      const sourcePath = path.join(appDir, file);
      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(backupDir, file);
        fs.copyFileSync(sourcePath, destPath);
        backupInfo.files.push(file);
        console.log("Backed up:", file);
      }
    }
    
    // Save backup info
    fs.writeFileSync(path.join(backupDir, "backup-info.json"), JSON.stringify(backupInfo, null, 2));
    
    // Apply updates
    let updatedCount = 0;
    for (const file of filesToUpdate) {
      const srcFile = path.join(sourceDir, file);
      const destFile = path.join(appDir, file);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Updated: ${file} -> ${destFile}`);
        updatedCount++;
      } else {
        console.log(`Skipped (not in update): ${file}`);
      }
    }
    
    // Copy any additional files
    const allFiles = fs.readdirSync(sourceDir);
    for (const file of allFiles) {
      const srcFile = path.join(sourceDir, file);
      const destFile = path.join(appDir, file);
      if (!fs.statSync(srcFile).isDirectory() && file !== "GCSD-DATA.json" && !file.startsWith(".")) {
        if (!fs.existsSync(destFile)) {
          fs.copyFileSync(srcFile, destFile);
          console.log("Added new file:", file);
          updatedCount++;
        }
      }
    }
    
    console.log(`=== Update Complete: ${updatedCount} files updated ===`);
    
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("Error cleaning up temp directory:", cleanupErr);
    }
    
    // Clear Electron cache to ensure new files are loaded
    try {
      const { session } = require("electron");
      if (session && session.defaultSession) {
        await session.defaultSession.clearCache();
        console.log("Electron cache cleared");
      }
    } catch (cacheErr) {
      console.error("Error clearing cache:", cacheErr);
    }
    
    // Clear app cache directories
    try {
      const userDataPath = app.getPath("userData");
      const cacheDirs = ["Cache", "Code Cache", "GPUCache"];
      for (const cacheDir of cacheDirs) {
        const cachePath = path.join(userDataPath, cacheDir);
        if (fs.existsSync(cachePath)) {
          fs.rmSync(cachePath, { recursive: true, force: true });
          console.log("Cleared cache directory:", cacheDir);
        }
      }
    } catch (cacheDirErr) {
      console.error("Error clearing cache directories:", cacheDirErr);
    }
    
    // Clean up old backups (keep last 5)
    cleanupOldBackups(5);
    
    return { success: true, backupDir, previousVersion: currentVersion };
  } catch (e) {
    console.error("Error applying update:", e);
    throw e;
  }
};

const getAvailableBackups = () => {
  const backupsDir = getBackupsDir();
  const exeDir = getExeDir();
  const backups = [];
  
  console.log("=== Getting Available Backups ===");
  console.log("Backups directory:", backupsDir);
  console.log("EXE directory:", exeDir);
  
  try {
    // Check new backups directory
    if (fs.existsSync(backupsDir)) {
      console.log("Backups directory exists");
      const entries = fs.readdirSync(backupsDir);
      console.log("Entries in backups dir:", entries);
      
      for (const entry of entries) {
        const backupPath = path.join(backupsDir, entry);
        const infoPath = path.join(backupPath, "backup-info.json");
        
        if (fs.statSync(backupPath).isDirectory()) {
          if (fs.existsSync(infoPath)) {
            try {
              const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
              backups.push({
                name: entry,
                path: backupPath,
                version: info.version,
                timestamp: info.timestamp,
                files: info.files || [],
                type: "new"
              });
              console.log("Found new-style backup:", entry, "version:", info.version);
            } catch (parseErr) {
              console.error("Error parsing backup info:", entry, parseErr);
            }
          } else {
            console.log("Backup dir without info file:", entry);
          }
        }
      }
    } else {
      console.log("Backups directory does not exist yet");
    }
    
    // Also check for legacy backups in exe directory (backup_timestamp format)
    if (fs.existsSync(exeDir)) {
      const exeEntries = fs.readdirSync(exeDir);
      for (const entry of exeEntries) {
        if (entry.startsWith("backup_")) {
          const backupPath = path.join(exeDir, entry);
          if (fs.statSync(backupPath).isDirectory()) {
            // Try to get version from package.json in backup
            let version = "Unknown";
            let timestamp = null;
            const pkgPath = path.join(backupPath, "package.json");
            
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
                version = pkg.version || "Unknown";
              } catch (e) {}
            }
            
            // Extract timestamp from folder name
            const tsMatch = entry.match(/backup_(\d+)/);
            if (tsMatch) {
              timestamp = new Date(parseInt(tsMatch[1])).toISOString();
            }
            
            // Get list of files
            const files = fs.readdirSync(backupPath).filter(f => !fs.statSync(path.join(backupPath, f)).isDirectory());
            
            backups.push({
              name: entry,
              path: backupPath,
              version: version,
              timestamp: timestamp || new Date().toISOString(),
              files: files,
              type: "legacy"
            });
            console.log("Found legacy backup:", entry, "version:", version);
          }
        }
      }
    }
    
    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log("Total backups found:", backups.length);
    return backups;
  } catch (e) {
    console.error("Error getting available backups:", e);
    return [];
  }
};

const rollbackToBackup = (backupName) => {
  const backupsDir = getBackupsDir();
  const exeDir = getExeDir();
  const appDir = getAppDir();
  
  // Check both locations for the backup
  let backupPath = path.join(backupsDir, backupName);
  if (!fs.existsSync(backupPath)) {
    backupPath = path.join(exeDir, backupName);
  }
  
  console.log("=== Rollback to Backup ===");
  console.log("Backup name:", backupName);
  console.log("Backup path:", backupPath);
  console.log("App directory:", appDir);
  
  try {
    if (!fs.existsSync(backupPath)) {
      throw new Error("Backup not found: " + backupName);
    }
    
    // Get version info
    let version = "Unknown";
    let filesToRestore = [];
    
    const infoPath = path.join(backupPath, "backup-info.json");
    const pkgPath = path.join(backupPath, "package.json");
    
    if (fs.existsSync(infoPath)) {
      // New-style backup with info file
      const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      version = info.version;
      filesToRestore = info.files || [];
      console.log("Using backup-info.json, version:", version);
    } else if (fs.existsSync(pkgPath)) {
      // Legacy backup - get version from package.json and restore all files
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        version = pkg.version || "Unknown";
      } catch (e) {}
      // Get all files in backup directory
      filesToRestore = fs.readdirSync(backupPath).filter(f => {
        const fullPath = path.join(backupPath, f);
        return !fs.statSync(fullPath).isDirectory();
      });
      console.log("Using legacy backup, version:", version);
    } else {
      throw new Error("Invalid backup: cannot determine backup contents");
    }
    
    console.log("Rolling back to version:", version);
    console.log("Files to restore:", filesToRestore);
    
    let restoredCount = 0;
    for (const file of filesToRestore) {
      const srcFile = path.join(backupPath, file);
      const destFile = path.join(appDir, file);
      
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Restored: ${file}`);
        restoredCount++;
      } else {
        console.log(`Skipped (not in backup): ${file}`);
      }
    }
    
    console.log(`=== Rollback Complete: ${restoredCount} files restored ===`);
    
    return { 
      success: true, 
      restoredVersion: version, 
      restoredFiles: restoredCount 
    };
  } catch (e) {
    console.error("Error rolling back:", e);
    throw e;
  }
};

const cleanupOldBackups = (keepCount = 5) => {
  const backups = getAvailableBackups();
  
  if (backups.length > keepCount) {
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      try {
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log("Deleted old backup:", backup.name);
      } catch (e) {
        console.error("Error deleting old backup:", backup.name, e);
      }
    }
  }
};

const createRestartScript = () => {
  const exeDir = getExeDir();
  const exePath = app.isPackaged ? process.execPath : path.join(__dirname, "node_modules", ".bin", "electron.cmd");
  
  if (process.platform === "win32") {
    const batPath = path.join(exeDir, "restart.bat");
    const vbsPath = path.join(exeDir, "restart.vbs");
    
    const batContent = `@echo off
timeout /t 2 /nobreak >nul
start "" "${exePath}"
del "${vbsPath}" 2>nul
del "%~f0"
`;
    
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${batPath.replace(/\\/g, "\\\\")}" & chr(34), 0
Set WshShell = Nothing
`;
    
    fs.writeFileSync(batPath, batContent);
    fs.writeFileSync(vbsPath, vbsContent);
    return vbsPath;
  } else {
    const shPath = path.join(exeDir, "restart.sh");
    const shContent = `#!/bin/bash
sleep 2
"${exePath}" &
rm -- "$0"
`;
    fs.writeFileSync(shPath, shContent);
    fs.chmodSync(shPath, "755");
    return shPath;
  }
};

const restartApp = () => {
  const { spawn } = require("child_process");
  const scriptPath = createRestartScript();
  
  console.log("Restarting application via:", scriptPath);
  
  if (process.platform === "win32") {
    spawn("wscript.exe", [scriptPath], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else {
    spawn("sh", [scriptPath], { detached: true, stdio: "ignore" }).unref();
  }
  
  app.quit();
};

module.exports = {
  checkForUpdates,
  downloadUpdate,
  applyUpdate,
  getAvailableBackups,
  rollbackToBackup,
  restartApp,
  getCurrentVersion,
  isNewerVersion,
  GITHUB_OWNER,
  GITHUB_REPO
};
