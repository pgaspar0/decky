const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// --- Diagnostico de sessao ---
console.log('--- Diagnostico de sessao ---');
console.log('XDG_SESSION_TYPE:', process.env.XDG_SESSION_TYPE || '(nao definido)');
console.log('ELECTRON_OZONE_PLATFORM_HINT:', process.env.ELECTRON_OZONE_PLATFORM_HINT || '(nao definido)');
console.log('------------------------------');

// --- Bloqueio de Instancia Unica (Single Instance Lock) ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Outra instancia do Decky ja esta em execucao. A encerrar...');
  app.quit();
}

const store = new Store({
  name: 'notes',
  defaults: { notes: [] },
});

/** @type {Map<string, BrowserWindow>} */
const noteWindows = new Map();
let tray = null;

function genId() {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNotes() {
  return store.get('notes') || [];
}

function getNotesWithStatus() {
  const notes = getNotes();
  return notes.map((n) => ({
    ...n,
    isOpen: noteWindows.has(n.id),
  }));
}

function broadcastNotesUpdated() {
  const notesWithStatus = getNotesWithStatus();
  for (const win of noteWindows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send('notes:updated', notesWithStatus);
    }
  }
}

function saveNote(partial) {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === partial.id);
  if (idx === -1) return;
  notes[idx] = { ...notes[idx], ...partial, updatedAt: Date.now() };
  store.set('notes', notes);
  return notes[idx];
}

function deleteNoteFromStore(id) {
  store.set('notes', getNotes().filter((n) => n.id !== id));
}

// Posicao em cascata para notas novas, para nao empilharem todas no mesmo sitio.
function nextSpawnPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  const count = noteWindows.size;
  const offset = (count % 8) * 28;
  return {
    x: workArea.x + 60 + offset,
    y: workArea.y + 60 + offset,
  };
}

function createNoteWindow(noteData) {
  if (noteWindows.has(noteData.id)) {
    const existing = noteWindows.get(noteData.id);
    if (!existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }
  }

  const isAlwaysOnTop = noteData.alwaysOnTop !== false;
  const noteColor = noteData.color || '#ffe14d';

  const win = new BrowserWindow({
    x: noteData.x,
    y: noteData.y,
    width: noteData.width || 280,
    height: noteData.height || 240,
    minWidth: 200,
    minHeight: 150,
    frame: false,
    resizable: true,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: true,
    backgroundColor: noteColor,
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.currentNoteId = noteData.id;

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    win.show();
    if (isAlwaysOnTop) {
      win.setAlwaysOnTop(true, 'floating');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    win.webContents.send('note:init', noteData);
    broadcastNotesUpdated();
  });

  // --- Persistencia de posicao/tamanho com debounce seguro ---
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        const bounds = win.getBounds();
        const currentId = win.currentNoteId || noteData.id;
        saveNote({ id: currentId, ...bounds });
        win.webContents.send('note:bounds', bounds);
      }
    }, 400);
  };

  win.on('move', scheduleSave);
  win.on('resize', scheduleSave);

  win.on('closed', () => {
    clearTimeout(saveTimer);
    const currentId = win.currentNoteId || noteData.id;
    noteWindows.delete(currentId);
    broadcastNotesUpdated();
  });

  noteWindows.set(noteData.id, win);
  return win;
}

// No arranque, abre APENAS a nota mais recente em vez de abrir todas as anteriores.
function openInitialNote() {
  const notes = getNotes();
  if (notes.length === 0) {
    createAndOpenNote();
    return;
  }
  // Ordenar por data da última atualização para abrir a nota mais recente
  const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const target = sorted[0];
  saveNote({ id: target.id, isOpen: true });
  createNoteWindow(target);
}

// Abre todas as notas (usado explicitamente pelo menu do Tray)
function openAllNotes() {
  const notes = getNotes();
  if (notes.length === 0) {
    createAndOpenNote();
    return;
  }
  notes.forEach((n) => {
    if (!noteWindows.has(n.id)) {
      saveNote({ id: n.id, isOpen: true });
      createNoteWindow(n);
    }
  });
}

function createAndOpenNote(content = '', title = '') {
  const spawn = nextSpawnPosition();
  const note = {
    id: genId(),
    title,
    content,
    x: spawn.x,
    y: spawn.y,
    width: 280,
    height: 240,
    color: '#ffe14d',
    alwaysOnTop: true,
    completed: false,
    isOpen: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const notes = getNotes();
  notes.push(note);
  store.set('notes', notes);
  createNoteWindow(note);
  broadcastNotesUpdated();
  return note;
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('Decky');
  const menu = Menu.buildFromTemplate([
    { label: 'Nova nota', click: () => createAndOpenNote() },
    { label: 'Mostrar todas as notas', click: () => openAllNotes() },
    {
      label: 'Esconder todas',
      click: () => noteWindows.forEach((w) => w.hide()),
    },
    { type: 'separator' },
    { label: 'Sair do Decky', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => openInitialNote());
}

// --- IPC ---------------------------------------------------------------
ipcMain.handle('notes:get-all', () => {
  return getNotesWithStatus();
});

ipcMain.handle('notes:create', (_e, content = '', title = '') => {
  return createAndOpenNote(content, title);
});

// Criar nova nota na mesma janela ativa
ipcMain.handle('notes:create-in-window', (e, { currentId }) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender);
  if (currentId) {
    saveNote({ id: currentId, isOpen: false });
    noteWindows.delete(currentId);
  }

  const currentBounds = senderWin && !senderWin.isDestroyed() ? senderWin.getBounds() : nextSpawnPosition();
  const note = {
    id: genId(),
    title: '',
    content: '',
    x: currentBounds.x,
    y: currentBounds.y,
    width: currentBounds.width || 280,
    height: currentBounds.height || 240,
    color: '#ffe14d',
    alwaysOnTop: senderWin && !senderWin.isDestroyed() ? senderWin.isAlwaysOnTop() : true,
    completed: false,
    isOpen: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const notes = getNotes();
  notes.push(note);
  store.set('notes', notes);

  if (senderWin && !senderWin.isDestroyed()) {
    senderWin.currentNoteId = note.id;
    noteWindows.set(note.id, senderWin);
  }

  broadcastNotesUpdated();
  return note;
});

// Abrir nota na janela atual ou focar se já estiver aberta noutra
ipcMain.handle('notes:open-in-window', (e, { currentId, targetId }) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender);
  const notes = getNotes();
  const target = notes.find((n) => n.id === targetId);
  if (!target) return null;

  if (noteWindows.has(targetId)) {
    const existing = noteWindows.get(targetId);
    if (existing && !existing.isDestroyed() && existing !== senderWin) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return { switched: false, note: target };
    }
  }

  if (currentId && currentId !== targetId) {
    saveNote({ id: currentId, isOpen: false });
    noteWindows.delete(currentId);
  }

  saveNote({ id: targetId, isOpen: true });
  if (senderWin && !senderWin.isDestroyed()) {
    senderWin.currentNoteId = targetId;
    noteWindows.set(targetId, senderWin);
    if (target.color) {
      senderWin.setBackgroundColor(target.color);
    }
  }

  broadcastNotesUpdated();
  return { switched: true, note: target };
});

ipcMain.handle('notes:open', (_e, { id }) => {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return true;
  }
  const notes = getNotes();
  const target = notes.find((n) => n.id === id);
  if (target) {
    saveNote({ id, isOpen: true });
    createNoteWindow(target);
    broadcastNotesUpdated();
    return true;
  }
  return false;
});

ipcMain.handle('notes:update-title', (_e, { id, title }) => {
  saveNote({ id, title });
  broadcastNotesUpdated();
});

// Otimização de Performance: apenas grava em background sem emitir broadcast a cada tecla
ipcMain.handle('notes:update-content', (_e, { id, content }) => {
  saveNote({ id, content });
});

ipcMain.handle('notes:set-color', (_e, { id, color }) => {
  saveNote({ id, color });
  broadcastNotesUpdated();
  return color;
});

ipcMain.handle('notes:close-window', (_e, { id, content, title }) => {
  const note = getNotes().find((n) => n.id === id);
  const text = typeof content === 'string' ? content : (note ? note.content : '');
  const noteTitle = typeof title === 'string' ? title : (note ? note.title : '');

  // Se a nota nao tiver texto nem titulo, apaga-a para nao encher o historico de notas vazias
  if (!text.trim() && !noteTitle.trim()) {
    deleteNoteFromStore(id);
  } else {
    saveNote({ id, content: text, title: noteTitle, isOpen: false });
  }

  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) {
    win.close();
  }
  broadcastNotesUpdated();
});

ipcMain.handle('notes:delete', (_e, { id }) => {
  const win = noteWindows.get(id);
  if (win && !win.isDestroyed()) {
    win.close();
  }
  deleteNoteFromStore(id);
  broadcastNotesUpdated();
});

ipcMain.handle('notes:show-context-menu', (e, { id }) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender);
  if (!senderWin || senderWin.isDestroyed()) return;

  const template = [
    {
      label: 'Nova nota (nesta janela)',
      accelerator: 'CmdOrCtrl+N',
      click: () => senderWin.webContents.send('note:action-new-same-window'),
    },
    {
      label: 'Nova nota (em nova janela)',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => createAndOpenNote(),
    },
    { type: 'separator' },
    {
      label: 'Fixar no topo',
      type: 'checkbox',
      checked: senderWin.isAlwaysOnTop(),
      click: () => {
        const next = !senderWin.isAlwaysOnTop();
        senderWin.setAlwaysOnTop(next, 'floating');
        senderWin.setVisibleOnAllWorkspaces(next, { visibleOnFullScreen: true });
        if (id) saveNote({ id, alwaysOnTop: next });
        senderWin.webContents.send('note:pin-updated', next);
      },
    },
    {
      label: 'Notas anteriores',
      accelerator: 'CmdOrCtrl+H',
      click: () => senderWin.webContents.send('note:action-toggle-drawer'),
    },
    { type: 'separator' },
    {
      label: 'Apagar esta nota',
      click: () => {
        if (id) {
          senderWin.close();
          deleteNoteFromStore(id);
          broadcastNotesUpdated();
        }
      },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: senderWin });
});

ipcMain.handle('notes:show-drawer-item-context-menu', (e, { targetId }) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender);
  if (!senderWin || senderWin.isDestroyed()) return;

  const template = [
    {
      label: 'Abrir nesta janela',
      click: () => senderWin.webContents.send('note:action-load-in-window', { targetId }),
    },
    {
      label: 'Abrir em nova janela',
      click: () => {
        const notes = getNotes();
        const target = notes.find((n) => n.id === targetId);
        if (target) {
          saveNote({ id: targetId, isOpen: true });
          createNoteWindow(target);
          broadcastNotesUpdated();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Apagar nota',
      click: () => {
        const targetWin = noteWindows.get(targetId);
        if (targetWin && !targetWin.isDestroyed()) {
          targetWin.close();
        }
        deleteNoteFromStore(targetId);
        broadcastNotesUpdated();
      },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: senderWin });
});

ipcMain.handle('notes:toggle-always-on-top', (_e, { id }) => {
  const win = noteWindows.get(id);
  if (!win || win.isDestroyed()) return null;
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next, 'floating');
  win.setVisibleOnAllWorkspaces(next, { visibleOnFullScreen: true });
  saveNote({ id, alwaysOnTop: next });
  return next;
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('diagnostics:get', () => ({
  sessionType: process.env.XDG_SESSION_TYPE || null,
}));

if (gotTheLock) {
  app.on('second-instance', () => {
    // Quando invocado pela segunda vez, cria uma nova nota para o utilizador
    const note = createAndOpenNote();
    const win = noteWindows.get(note.id);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildTray();
    // Arranque otimizado: abre apenas a nota mais recente
    openInitialNote();
  });

  app.on('window-all-closed', () => {
    // Quando todas as janelas de notas forem fechadas, a aplicacao encerra
    // libertando o terminal sem necessidade de Ctrl+C.
    app.quit();
  });
}
