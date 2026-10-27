const textarea = document.getElementById('content');
const pinBtn = document.getElementById('pin-btn');
const closeBtn = document.getElementById('close-btn');
const menuBtn = document.getElementById('menu-btn');
const newBtn = document.getElementById('new-btn');

// Drawer elements
const drawer = document.getElementById('drawer');
const drawerBackBtn = document.getElementById('drawer-back-btn');
const drawerNewBtn = document.getElementById('drawer-new-btn');
const searchInput = document.getElementById('search-input');
const drawerList = document.getElementById('drawer-list');
const quitBtn = document.getElementById('quit-btn');

let noteId = null;
let saveTimeout = null;
let allNotesCache = [];

function flushSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    if (noteId) {
      window.notesAPI.updateContent(noteId, textarea.value);
    }
  }
}

window.notesAPI.onInit((data) => {
  noteId = data.id;
  textarea.value = data.content || '';
  pinBtn.classList.toggle('active', data.alwaysOnTop !== false);
  textarea.focus();
});

textarea.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    window.notesAPI.updateContent(noteId, textarea.value);
    saveTimeout = null;
  }, 300);
});

// Guardar sempre antes de descarregar a janela
window.addEventListener('beforeunload', () => {
  flushSave();
});

pinBtn.addEventListener('click', async () => {
  const next = await window.notesAPI.toggleAlwaysOnTop(noteId);
  if (next !== null) pinBtn.classList.toggle('active', next);
});

closeBtn.addEventListener('click', () => {
  flushSave();
  window.notesAPI.closeNoteWindow(noteId, textarea.value);
});

newBtn.addEventListener('click', () => {
  flushSave();
  window.notesAPI.createNote();
});

// --- Drawer / Menu Hambúrguer ---

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (isToday) {
    return `Hoje às ${hours}:${minutes}`;
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month} às ${hours}:${minutes}`;
}

function getSnippet(content) {
  if (!content || !content.trim()) return '(Sem conteúdo)';
  const firstLine = content.trim().split('\n')[0];
  return firstLine.length > 30 ? firstLine.slice(0, 30) + '…' : firstLine;
}

function renderDrawerList() {
  const query = (searchInput.value || '').trim().toLowerCase();
  drawerList.innerHTML = '';

  const filtered = allNotesCache
    .filter((n) => {
      if (!query) return true;
      return (n.content || '').toLowerCase().includes(query);
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'drawer-empty-msg';
    emptyMsg.textContent = query ? 'Nenhuma nota encontrada.' : 'Não há notas anteriores.';
    drawerList.appendChild(emptyMsg);
    return;
  }

  filtered.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-item';
    if (note.id === noteId) {
      item.classList.add('current');
    }

    const info = document.createElement('div');
    info.className = 'note-item-info';

    const snippet = document.createElement('div');
    snippet.className = 'note-item-snippet';
    const isEmpty = !note.content || !note.content.trim();
    if (isEmpty) snippet.classList.add('empty');
    snippet.textContent = getSnippet(note.content);

    const meta = document.createElement('div');
    meta.className = 'note-item-meta';
    meta.textContent = formatDate(note.updatedAt || note.createdAt);

    if (note.id === noteId) {
      const badge = document.createElement('span');
      badge.className = 'note-badge';
      badge.textContent = 'Esta nota';
      meta.appendChild(badge);
    } else if (note.isOpen) {
      const badge = document.createElement('span');
      badge.className = 'note-badge active-badge';
      badge.textContent = 'Aberta';
      meta.appendChild(badge);
    }

    info.appendChild(snippet);
    info.appendChild(meta);
    item.appendChild(info);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-delete-btn';
    deleteBtn.title = 'Apagar permanentemente';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.notesAPI.deleteNote(note.id);
    });
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => {
      if (note.id === noteId) {
        closeDrawer();
      } else {
        window.notesAPI.openNote(note.id);
        closeDrawer();
      }
    });

    drawerList.appendChild(item);
  });
}

async function openDrawer() {
  flushSave();
  allNotesCache = await window.notesAPI.getAllNotes();
  drawer.hidden = false;
  searchInput.value = '';
  renderDrawerList();
  searchInput.focus();
}

function closeDrawer() {
  drawer.hidden = true;
  textarea.focus();
}

menuBtn.addEventListener('click', () => {
  if (drawer.hidden) {
    openDrawer();
  } else {
    closeDrawer();
  }
});

drawerBackBtn.addEventListener('click', closeDrawer);

drawerNewBtn.addEventListener('click', () => {
  flushSave();
  window.notesAPI.createNote();
  closeDrawer();
});

searchInput.addEventListener('input', () => {
  renderDrawerList();
});

quitBtn.addEventListener('click', () => {
  flushSave();
  window.notesAPI.quitApp();
});

window.notesAPI.onNotesUpdated((notes) => {
  allNotesCache = notes;
  if (!drawer.hidden) {
    renderDrawerList();
  }
});
