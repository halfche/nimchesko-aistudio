const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nimcheskoDesktop', {
  isElectron: true,
  saveDesktopMarkdown: (payload) => ipcRenderer.invoke('desktop:save-markdown', payload),
  openDesktopFolder: (payload) => ipcRenderer.invoke('desktop:open-folder', payload),
  getDesktopPaths: () => ipcRenderer.invoke('desktop:get-paths'),
});
