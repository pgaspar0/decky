const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

console.log('--- Diagnostico de sessao ---');
console.log('XDG_SESSION_TYPE:', process.env.XDG_SESSION_TYPE || '(nao definido)');
console.log('ELECTRON_OZONE_PLATFORM_HINT:', process.env.ELECTRON_OZONE_PLATFORM_HINT || '(nao definido)');
console.log('------------------------------');

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
  return store.get('notes');
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
  const win = new BrowserWindow({
    x: noteData.x,
    y: noteData.y,
    width: noteData.width || 260,
    height: noteData.height || 220,
    minWidth: 160,
    minHeight: 140,
    frame: false,
    resizable: true,
    alwaysOnTop: !!noteData.alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    transparent: false, // muda para true se quiseres cantos arredondados reais; custa performance/compatibilidade
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
    win.webContents.send('note:init', noteData);
  });

  // --- Persistencia de posicao/tamanho -------------------------------------
  // No X11 (ou XWayland) isto funciona sem drama: getBounds() devolve a
  // posicao real apos o utilizador largar o rato.
  // No Wayland nativo, getBounds() devolve sempre {x:0, y:0, ...} -- e por
  // design do protocolo, nao um bug do Electron. Se vires SEMPRE x:0,y:0 no
  // log abaixo mesmo depois de arrastares a nota para outro sitio, confirma
  // que estas em Wayland nativo -> corre com `npm run start:x11`.
  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const bounds = win.getBounds();
      console.log(`[${noteData.id}] a guardar bounds:`, bounds);
      saveNote({ id: noteData.id, ...bounds });
      win.webContents.send('note:bounds', bounds);
    }, 400);
  };
  win.on('move', scheduleSave);
  win.on('resize', scheduleSave);

  win.on('closed', () => {
    noteWindows.delete(noteData.id);
  });

  noteWindows.set(noteData.id, win);
  return win;
}

function openAllNotes() {
  const notes = getNotes();
  if (notes.length === 0) {
    createAndOpenNote(); // primeira execucao: cria uma nota de boas-vindas
    return;
  }
  notes.forEach((n) => {
    if (!noteWindows.has(n.id)) createNoteWindow(n);
  });
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const notes = getNotes();
  notes.push(note);
  store.set('notes', notes);
  createNoteWindow(note);
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
    { label: 'Sair', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => openAllNotes());
}

// --- IPC ---------------------------------------------------------------
ipcMain.handle('notes:update-content', (_e, { id, content }) => {
  saveNote({ id, content });
});

ipcMain.handle('notes:delete', (_e, { id }) => {
  const win = noteWindows.get(id);
  if (win) win.close();
  deleteNoteFromStore(id);
});

ipcMain.handle('notes:toggle-always-on-top', (_e, { id }) => {
  const win = noteWindows.get(id);
  if (!win) return null;
  const next = !win.isAlwaysOnTop();
  // Nota: no Wayland nativo esta chamada e ignorada silenciosamente.
  win.setAlwaysOnTop(next);
  saveNote({ id, alwaysOnTop: next });
  return next;
});

ipcMain.handle('diagnostics:get', () => ({
  sessionType: process.env.XDG_SESSION_TYPE || null,
}));

app.whenReady().then(() => {
  buildTray();
  openAllNotes();
});

app.on('window-all-closed', (e) => {
  // A app deve continuar viva no tray mesmo sem notas abertas.
  e.preventDefault?.();
});
