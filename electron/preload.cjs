const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('psycloudDesktop', {
  exportBackup: () => ipcRenderer.invoke('db:export'),
  importBackup: () => ipcRenderer.invoke('db:import'),
  enableDbEncryption: (args) => ipcRenderer.invoke('db:encrypt:enable', args),
  disableDbEncryption: () => ipcRenderer.invoke('db:encrypt:disable'),
  encryptionStatus: () => ipcRenderer.invoke('db:encrypt:status'),
});
