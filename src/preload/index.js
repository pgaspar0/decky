const { contextBridge, ipcRenderer } = require('electron');

// Superficie minima e explicita para o renderer
contextBridge.exposeInMainWorld('notesAPI', {
  getAllNotes: () => ipcRenderer.invoke('notes:get-all'),
  createNote: (content, title) => ipcRenderer.invoke('notes:create', content, title),
  createNoteInWindow: (currentId) => ipcRenderer.invoke('notes:create-in-window', { currentId }),
  openNoteInWindow: (currentId, targetId) => ipcRenderer.invoke('notes:open-in-window', { currentId, targetId }),
  openNote: (id) => ipcRenderer.invoke('notes:open', { id }),
  closeNoteWindow: (id, content, title) => ipcRenderer.invoke('notes:close-window', { id, content, title }),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', { id }),
  updateTitle: (id, title) => ipcRenderer.invoke('notes:update-title', { id, title }),
  updateContent: (id, content) => ipcRenderer.invoke('notes:update-content', { id, content }),
  setNoteColor: (id, color) => ipcRenderer.invoke('notes:set-color', { id, color }),
  toggleAlwaysOnTop: (id) => ipcRenderer.invoke('notes:toggle-always-on-top', { id }),
  showContextMenu: (id) => ipcRenderer.invoke('notes:show-context-menu', { id }),
  showDrawerItemContextMenu: (targetId) => ipcRenderer.invoke('notes:show-drawer-item-context-menu', { targetId }),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  getDiagnostics: () => ipcRenderer.invoke('diagnostics:get'),
  onInit: (cb) => ipcRenderer.on('note:init', (_e, data) => cb(data)),
  onBounds: (cb) => ipcRenderer.on('note:bounds', (_e, bounds) => cb(bounds)),
  onNotesUpdated: (cb) => ipcRenderer.on('notes:updated', (_e, notes) => cb(notes)),
  onActionNewSameWindow: (cb) => ipcRenderer.on('note:action-new-same-window', () => cb()),
  onActionToggleDrawer: (cb) => ipcRenderer.on('note:action-toggle-drawer', () => cb()),
  onActionLoadInWindow: (cb) => ipcRenderer.on('note:action-load-in-window', (_e, data) => cb(data)),
  onPinUpdated: (cb) => ipcRenderer.on('note:pin-updated', (_e, active) => cb(active)),
});
