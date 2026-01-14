const { contextBridge, ipcRenderer } = require("electron");

const safeInvoke = async (channel, ...args) => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC Error [${channel}]:`, error);
    return { success: false, error: error.message || "IPC communication failed" };
  }
};

contextBridge.exposeInMainWorld("electronAPI", {
  saveData: (data) => safeInvoke("save-data", data),
  loadData: () => safeInvoke("load-data"),
  getDataPath: () => safeInvoke("get-data-path"),
  cloudBackup: (data) => safeInvoke("cloud-backup", data),
  checkCloudBackup: () => safeInvoke("check-cloud-backup"),
  loadFromCloud: () => safeInvoke("load-from-cloud"),
  checkForUpdates: () => safeInvoke("check-for-updates"),
  downloadUpdate: (info) => safeInvoke("download-update", info),
  applyUpdate: (zipPath, tempDir) => safeInvoke("apply-update", zipPath, tempDir),
  restartApp: () => safeInvoke("restart-app"),
  closeApp: () => safeInvoke("close-app"),
  relaunchApp: () => safeInvoke("relaunch-app"),
  getAppVersion: () => safeInvoke("get-app-version"),
  getAvailableBackups: () => safeInvoke("get-available-backups"),
  rollbackToBackup: (backupName) => safeInvoke("rollback-to-backup", backupName),
  onUpdateProgress: (callback) => {
    ipcRenderer.on("update-download-progress", (event, data) => callback(data));
  },
  removeUpdateProgressListener: () => {
    ipcRenderer.removeAllListeners("update-download-progress");
  },
  getVersion: () => "6.1.0-BETA"
});
