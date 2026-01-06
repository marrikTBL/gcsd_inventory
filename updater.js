/**
 * GCSD Inventory Auto-Updater
 * Pulls releases from https://github.com/marrikTBL/gcsd_inventory
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { execSync } = require('child_process');

// GitHub repository configuration
const GITHUB_OWNER = 'marrikTBL';
const GITHUB_REPO = 'gcsd_inventory';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Get the application directory where source files are located
const getAppDir = () => {
  if (app.isPackaged) {
    // In packaged app, files are in resources/app folder (with asar: false)
    const resourcesPath = path.join(path.dirname(process.execPath), 'resources', 'app');
    if (fs.existsSync(resourcesPath)) {
      return resourcesPath;
    }
    // Fallback to exe directory
    return path.dirname(process.execPath);
  }
  return __dirname;
};

// Get the directory where the EXE is located (for temp files)
const getExeDir = () => {
  return app.isPackaged 
    ? path.dirname(process.execPath)
    : __dirname;
};

// Get current version from package.json
const getCurrentVersion = () => {
  try {
    const packagePath = path.join(getAppDir(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return pkg.version || '0.0.0';
    }
    // Fallback: try to read from app directory
    const localPackage = path.join(__dirname, 'package.json');
    if (fs.existsSync(localPackage)) {
      const pkg = JSON.parse(fs.readFileSync(localPackage, 'utf8'));
      return pkg.version || '0.0.0';
    }
  } catch (error) {
    console.error('Error reading current version:', error);
  }
  return '0.0.0';
};

// Compare semantic versions (returns true if v2 > v1)
const isNewerVersion = (v1, v2) => {
  // Remove 'v' prefix if present
  v1 = v1.replace(/^v/, '');
  v2 = v2.replace(/^v/, '');
  
  const parts1 = v1.split('.').map(x => parseInt(x, 10) || 0);
  const parts2 = v2.split('.').map(x => parseInt(x, 10) || 0);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p2 > p1) return true;
    if (p2 < p1) return false;
  }
  return false;
};

// Make HTTPS request with redirect following
const httpsGet = (url, headers = {}) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'GCSD-Inventory-Updater/1.0',
      ...headers
    };
    
    const makeRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      const urlObj = new URL(requestUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: defaultHeaders
      };
      
      const req = protocol.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, headers: res.headers }));
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    };
    
    makeRequest(url);
  });
};

// Download file to disk with progress callback
const downloadFile = (url, destPath, onProgress) => {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      const urlObj = new URL(requestUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'GCSD-Inventory-Updater/1.0'
        }
      };
      
      const req = protocol.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location, redirectCount + 1);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedSize = 0;
        
        const fileStream = fs.createWriteStream(destPath);
        
        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (onProgress && totalSize > 0) {
            onProgress(downloadedSize, totalSize);
          }
        });
        
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); // Clean up
          reject(err);
        });
      });
      
      req.on('error', reject);
      req.setTimeout(300000, () => { // 5 minute timeout for downloads
        req.destroy();
        reject(new Error('Download timeout'));
      });
      req.end();
    };
    
    makeRequest(url);
  });
};

// Check for updates from GitHub
const checkForUpdates = async (appVersion = null) => {
  try {
    console.log('Checking for updates...');
    console.log('GitHub API URL:', GITHUB_API_URL);
    
    // Use passed version or fall back to reading from package.json
    const currentVersion = appVersion || getCurrentVersion();
    console.log('Current version:', currentVersion);
    
    let data;
    try {
      const response = await httpsGet(GITHUB_API_URL, {
        'Accept': 'application/vnd.github.v3+json'
      });
      data = response.data;
    } catch (httpError) {
      // Handle specific HTTP errors
      if (httpError.message && httpError.message.includes('404')) {
        console.log('No releases found on GitHub repository (404)');
        return {
          updateAvailable: false,
          currentVersion,
          latestVersion: currentVersion,
          noReleases: true,
          message: 'No releases published yet. You have the latest version.'
        };
      }
      throw httpError;
    }
    
    const release = JSON.parse(data);
    const latestVersion = release.tag_name || release.name || '0.0.0';
    
    console.log('Latest version:', latestVersion);
    
    const updateAvailable = isNewerVersion(currentVersion, latestVersion);
    
    return {
      updateAvailable,
      currentVersion,
      latestVersion: latestVersion.replace(/^v/, ''),
      releaseNotes: release.body || 'No release notes available.',
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      assets: release.assets || [],
      zipballUrl: release.zipball_url,
      tarballUrl: release.tarball_url
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    throw error;
  }
};

// Download and extract update
const downloadUpdate = async (updateInfo, onProgress) => {
  const exeDir = getExeDir();
  const tempDir = path.join(exeDir, 'update_temp');
  const zipPath = path.join(tempDir, 'update.zip');
  
  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Find the right asset to download from the RELEASE (not main branch)
    let downloadUrl = null;
    let downloadSource = 'unknown';
    
    console.log('Looking for download in release...');
    console.log('Available assets:', updateInfo.assets?.length || 0);
    
    // First, look for a pre-built release asset (any zip file)
    if (updateInfo.assets && updateInfo.assets.length > 0) {
      // Log all assets for debugging
      updateInfo.assets.forEach(a => console.log('  Asset:', a.name, a.browser_download_url));
      
      // Try to find a ZIP asset (prefer ones with specific names, but accept any .zip)
      let zipAsset = updateInfo.assets.find(a => 
        a.name.endsWith('.zip') && 
        (a.name.toLowerCase().includes('win') || 
         a.name.toLowerCase().includes('gcsd') || 
         a.name.toLowerCase().includes('inventory') ||
         a.name.toLowerCase().includes('desktop'))
      );
      
      // If no specific match, try any .zip file
      if (!zipAsset) {
        zipAsset = updateInfo.assets.find(a => a.name.endsWith('.zip'));
      }
      
      if (zipAsset) {
        downloadUrl = zipAsset.browser_download_url;
        downloadSource = 'release-asset';
        console.log('Found release asset:', zipAsset.name);
      }
    }
    
    // Fall back to release zipball (this is the source code for THIS RELEASE, not main branch)
    if (!downloadUrl && updateInfo.zipballUrl) {
      downloadUrl = updateInfo.zipballUrl;
      downloadSource = 'release-zipball';
      console.log('Using release source zipball (tagged release, not main branch)');
    }
    
    if (!downloadUrl) {
      throw new Error('No downloadable update found in release');
    }
    
    console.log('Download source:', downloadSource);
    console.log('Downloading from:', downloadUrl);
    
    // Download the update
    await downloadFile(downloadUrl, zipPath, onProgress);
    
    console.log('Download complete:', zipPath);
    
    return {
      success: true,
      zipPath,
      tempDir
    };
  } catch (error) {
    console.error('Error downloading update:', error);
    // Clean up on error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
    throw error;
  }
};

// Apply the update (extract and replace files)
const applyUpdate = async (zipPath, tempDir) => {
  const appDir = getAppDir();
  const exeDir = getExeDir();
  const extractDir = path.join(tempDir, 'extracted');
  
  console.log('=== Update Application ===');
  console.log('App directory (source files):', appDir);
  console.log('EXE directory:', exeDir);
  console.log('Temp directory:', tempDir);
  
  try {
    // Create extract directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    console.log('Extracting update...');
    console.log('ZIP path:', zipPath);
    console.log('Extract to:', extractDir);
    
    // Convert paths to use forward slashes for PowerShell compatibility
    const zipPathSafe = zipPath.replace(/\\/g, '/');
    const extractDirSafe = extractDir.replace(/\\/g, '/');
    
    // Use PowerShell to extract ZIP (built into Windows)
    // Using -LiteralPath and single quotes to avoid escaping issues
    const psCommand = `Expand-Archive -LiteralPath '${zipPathSafe}' -DestinationPath '${extractDirSafe}' -Force`;
    
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, { 
        stdio: 'pipe',
        timeout: 120000, // 2 minute timeout
        windowsHide: true
      });
      console.log('Extraction complete');
    } catch (extractError) {
      console.error('PowerShell extraction failed:', extractError.message);
      
      // Fallback: try using tar (available in Windows 10 1803+)
      console.log('Trying fallback extraction with tar...');
      try {
        execSync(`tar -xf "${zipPath}" -C "${extractDir}"`, {
          stdio: 'pipe',
          timeout: 120000,
          windowsHide: true
        });
        console.log('Tar extraction complete');
      } catch (tarError) {
        console.error('Tar extraction also failed:', tarError.message);
        throw new Error('Failed to extract update. Please try again or update manually.');
      }
    }
    
    // Find the actual content directory (GitHub zipballs have a root folder)
    let sourceDir = extractDir;
    const entries = fs.readdirSync(extractDir);
    console.log('Extracted entries:', entries);
    
    if (entries.length === 1) {
      const singleEntry = path.join(extractDir, entries[0]);
      if (fs.statSync(singleEntry).isDirectory()) {
        sourceDir = singleEntry;
      }
    }
    
    console.log('Source directory for update files:', sourceDir);
    console.log('Files in source:', fs.readdirSync(sourceDir));
    
    // Files to update (preserve user data)
    const filesToUpdate = [
      'main.js',
      'preload.js', 
      'index.html',
      'updater.js',
      'package.json',
      'icon.png',
      'icon.ico'
    ];
    
    console.log('=== Updating Files ===');
    console.log('Destination (appDir):', appDir);
    
    // Backup current files
    const backupDir = path.join(exeDir, 'backup_' + Date.now());
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('Backup directory:', backupDir);
    
    for (const file of filesToUpdate) {
      const srcPath = path.join(appDir, file);
      if (fs.existsSync(srcPath)) {
        const backupPath = path.join(backupDir, file);
        fs.copyFileSync(srcPath, backupPath);
        console.log('Backed up:', file);
      }
    }
    
    // Copy new files
    let updatedCount = 0;
    for (const file of filesToUpdate) {
      const newFilePath = path.join(sourceDir, file);
      const destPath = path.join(appDir, file);
      
      if (fs.existsSync(newFilePath)) {
        fs.copyFileSync(newFilePath, destPath);
        console.log(`Updated: ${file} -> ${destPath}`);
        updatedCount++;
      } else {
        console.log(`Skipped (not in update): ${file}`);
      }
    }
    
    // Also copy any new files that don't exist yet
    const newFiles = fs.readdirSync(sourceDir);
    for (const file of newFiles) {
      const srcPath = path.join(sourceDir, file);
      const destPath = path.join(appDir, file);
      
      // Skip directories, data files, and node_modules
      if (fs.statSync(srcPath).isDirectory()) continue;
      if (file === 'GCSD-DATA.json') continue;
      if (file.startsWith('.')) continue;
      
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log('Added new file:', file);
        updatedCount++;
      }
    }
    
    console.log(`=== Update Complete: ${updatedCount} files updated ===`);
    
    // Clean up temp directory (but keep backup)
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Error cleaning up temp directory:', e);
    }
    
    return {
      success: true,
      backupDir
    };
  } catch (error) {
    console.error('Error applying update:', error);
    throw error;
  }
};

// Create update script for restart (hidden, no command prompt)
const createRestartScript = () => {
  const exeDir = getExeDir();
  const isPackaged = app.isPackaged;
  const exePath = isPackaged ? process.execPath : path.join(__dirname, 'node_modules', '.bin', 'electron.cmd');
  
  if (process.platform === 'win32') {
    // Use VBScript to run batch file hidden (no command prompt window)
    const batPath = path.join(exeDir, 'restart.bat');
    const vbsPath = path.join(exeDir, 'restart.vbs');
    
    // Batch file content
    const batContent = `@echo off
timeout /t 2 /nobreak >nul
start "" "${exePath}"
del "${vbsPath}" 2>nul
del "%~f0"
`;
    
    // VBScript to run batch file hidden
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${batPath.replace(/\\/g, '\\\\')}" & chr(34), 0
Set WshShell = Nothing
`;
    
    fs.writeFileSync(batPath, batContent);
    fs.writeFileSync(vbsPath, vbsContent);
    return vbsPath; // Return VBS path to launch hidden
  } else {
    // Linux/Mac shell script
    const shPath = path.join(exeDir, 'restart.sh');
    
    const shContent = `#!/bin/bash
sleep 2
"${exePath}" &
rm -- "$0"
`;
    
    fs.writeFileSync(shPath, shContent);
    fs.chmodSync(shPath, '755');
    return shPath;
  }
};

// Restart the application
const restartApp = () => {
  const { spawn } = require('child_process');
  const scriptPath = createRestartScript();
  
  console.log('Restarting application via:', scriptPath);
  
  if (process.platform === 'win32') {
    // Use wscript to run VBS silently
    spawn('wscript.exe', [scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  } else {
    spawn('sh', [scriptPath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
  
  // Quit the current app
  app.quit();
};

module.exports = {
  checkForUpdates,
  downloadUpdate,
  applyUpdate,
  restartApp,
  getCurrentVersion,
  isNewerVersion,
  GITHUB_OWNER,
  GITHUB_REPO
};
