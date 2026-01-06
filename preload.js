const { contextBridge, ipcRenderer } = require('electron');

// Wrapper function to handle IPC errors
const safeInvoke = async (channel, ...args) => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC Error [${channel}]:`, error);
    return { success: false, error: error.message || 'IPC communication failed' };
  }
};

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (data) => safeInvoke('save-data', data),
  loadData: () => safeInvoke('load-data'),
  getDataPath: () => safeInvoke('get-data-path'),
  cloudBackup: (data) => safeInvoke('cloud-backup', data),
  checkCloudBackup: () => safeInvoke('check-cloud-backup'),
  loadFromCloud: () => safeInvoke('load-from-cloud'),
  
  // Auto-updater APIs
  checkForUpdates: () => safeInvoke('check-for-updates'),
  downloadUpdate: (updateInfo) => safeInvoke('download-update', updateInfo),
  applyUpdate: (zipPath, tempDir) => safeInvoke('apply-update', zipPath, tempDir),
  restartApp: () => safeInvoke('restart-app'),
  getAppVersion: () => safeInvoke('get-app-version'),
  
  // Listen for download progress
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, data) => callback(data));
  },
  removeUpdateProgressListener: () => {
    ipcRenderer.removeAllListeners('update-download-progress');
  },
  
  // Version info
  getVersion: () => '5.4.0'
});
