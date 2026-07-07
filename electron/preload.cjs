const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startGoogleOauth: (clientId) => ipcRenderer.invoke('start-google-oauth', clientId),
  speakText: (params) => ipcRenderer.invoke('speak-text', params),
  downloadGoogleDrive: (urlString, id) => ipcRenderer.invoke('download-google-drive', { urlString, id }),
  onDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-progress-event', listener);
    return () => ipcRenderer.off('download-progress-event', listener);
  }
});
