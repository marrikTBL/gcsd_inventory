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
  
  // Version info
  getVersion: () => safeInvoke('get-version'),
  
  // Update functionality
  checkForUpdates: () => safeInvoke('check-for-updates'),
  downloadUpdate: () => safeInvoke('download-update'),
  executeUpdate: (scriptPath) => safeInvoke('execute-update', scriptPath),
  
  // Listen for update progress
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, data) => callback(data));
  },
  
  // Remove update progress listener
  removeUpdateProgressListener: () => {
    ipcRenderer.removeAllListeners('update-progress');
  }
});
