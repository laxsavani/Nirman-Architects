const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentAPI', {
  login: (credentials) => ipcRenderer.invoke('agent:login', credentials),
  getStatus: () => ipcRenderer.invoke('agent:getStatus'),
  syncQueue: () => ipcRenderer.invoke('agent:syncQueue'),
  openLogs: () => ipcRenderer.invoke('agent:openLogs'),
  quitApp: () => ipcRenderer.send('agent:quit')
});
