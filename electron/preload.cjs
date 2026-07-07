const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startGoogleOauth: (clientId) => ipcRenderer.invoke('start-google-oauth', clientId),
  speakText: (params) => ipcRenderer.invoke('speak-text', params),
});
