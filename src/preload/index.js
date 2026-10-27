const { contextBridge, ipcRenderer } = require('electron');

// Superficie minima e explicita para o renderer
contextBridge.exposeInMainWorld('notesAPI', {
  getAllNotes: () => ipcRenderer.invoke('notes:get-all'),
  createNote: (content) => ipcRenderer.invoke('notes:create', content),
  openNote: (id) => ipcRenderer.invoke('notes:open', { id }),
  closeNoteWindow: (id, content) => ipcRenderer.invoke('notes:close-window', { id, content }),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', { id }),
  updateContent: (id, content) => ipcRenderer.invoke('notes:update-content', { id, content }),
  toggleAlwaysOnTop: (id) => ipcRenderer.invoke('notes:toggle-always-on-top', { id }),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  onInit: (cb) => ipcRenderer.on('note:init', (_e, data) => cb(data)),
  onBounds: (cb) => ipcRenderer.on('note:bounds', (_e, bounds) => cb(bounds)),
  onNotesUpdated: (cb) => ipcRenderer.on('notes:updated', (_e, notes) => cb(notes)),
});
