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

  const win = new BrowserWindow({
    x: noteData.x,
    y: noteData.y,
    width: noteData.width || 260,
    height: noteData.height || 220,
    minWidth: 180,
    minHeight: 140,
    frame: false,
    resizable: true,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#ffe14d',
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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
        saveNote({ id: noteData.id, ...bounds });
        win.webContents.send('note:bounds', bounds);
      }
    }, 400);
  };

  win.on('move', scheduleSave);
  win.on('resize', scheduleSave);

  win.on('closed', () => {
    clearTimeout(saveTimer);
    noteWindows.delete(noteData.id);
    broadcastNotesUpdated();
  });

  noteWindows.set(noteData.id, win);
  return win;
}

function openAllNotes() {
  const notes = getNotes();
  if (notes.length === 0) {
    createAndOpenNote();
    return;
  }
  // Abre as notas que estavam abertas, ou a mais recente caso todas estivessem fechadas
  const openable = notes.filter((n) => n.isOpen !== false);
  if (openable.length === 0) {
    const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const target = sorted[0];
    saveNote({ id: target.id, isOpen: true });
    createNoteWindow(target);
  } else {
    openable.forEach((n) => {
      if (!noteWindows.has(n.id)) createNoteWindow(n);
    });
  }
}

function createAndOpenNote(content = '') {
  const spawn = nextSpawnPosition();
  const note = {
    id: genId(),
    content,
    x: spawn.x,
    y: spawn.y,
    width: 260,
    height: 220,
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
    { label: 'Mostrar todas', click: () => openAllNotes() },
    {
      label: 'Esconder todas',
      click: () => noteWindows.forEach((w) => w.hide()),
    },
    { type: 'separator' },
    { label: 'Sair do Decky', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => openAllNotes());
}

// --- IPC ---------------------------------------------------------------
ipcMain.handle('notes:get-all', () => {
  return getNotesWithStatus();
});

ipcMain.handle('notes:create', (_e, content = '') => {
  return createAndOpenNote(content);
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

ipcMain.handle('notes:update-content', (_e, { id, content }) => {
  saveNote({ id, content });
  broadcastNotesUpdated();
});

ipcMain.handle('notes:close-window', (_e, { id, content }) => {
  if (typeof content === 'string') {
    // Se a nota nao tiver texto, apaga-a para nao encher o historico de notas vazias
    if (!content.trim()) {
      deleteNoteFromStore(id);
    } else {
      saveNote({ id, content, isOpen: false });
    }
  } else {
    saveNote({ id, isOpen: false });
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
    openAllNotes();
  });

  app.on('window-all-closed', () => {
    // Quando todas as janelas de notas forem fechadas, a aplicacao encerra
    // libertando o terminal sem necessidade de Ctrl+C.
    app.quit();
  });
}
