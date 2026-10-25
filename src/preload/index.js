const { contextBridge, ipcRenderer } = require('electron');

// Superficie minima e explicita. O renderer nunca ve ipcRenderer nem require().
contextBridge.exposeInMainWorld('notesAPI', {
  updateContent: (id, content) => ipcRenderer.invoke('notes:update-content', { id, content }),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', { id }),
  toggleAlwaysOnTop: (id) => ipcRenderer.invoke('notes:toggle-always-on-top', { id }),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  onInit: (cb) => ipcRenderer.on('note:init', (_e, data) => cb(data)),
  onBounds: (cb) => ipcRenderer.on('note:bounds', (_e, bounds) => cb(bounds)),
});
