const noteRoot = document.getElementById('note-root');
const textarea = document.getElementById('content');
const pinBtn = document.getElementById('pin-btn');
const closeBtn = document.getElementById('close-btn');
const menuBtn = document.getElementById('menu-btn');
const newBtn = document.getElementById('new-btn');
const colorBtn = document.getElementById('color-btn');
const colorPalette = document.getElementById('color-palette');

// Drawer elements
const drawer = document.getElementById('drawer');
const drawerBackBtn = document.getElementById('drawer-back-btn');
const drawerNewBtn = document.getElementById('drawer-new-btn');
const searchInput = document.getElementById('search-input');
const drawerList = document.getElementById('drawer-list');
const quitBtn = document.getElementById('quit-btn');

let noteId = null;
let currentColor = '#ffe14d';
let saveTimeout = null;
let allNotesCache = [];

const THEME_CLASSES = {
  '#ffe14d': '',
  '#bbf7d0': 'theme-green',
  '#bae6fd': 'theme-blue',
  '#fed7aa': 'theme-peach',
  '#e9d5ff': 'theme-purple',
  '#374151': 'theme-dark',
};

function applyColorTheme(color) {
  currentColor = color || '#ffe14d';
  // Limpar classes de tema anteriores
  Object.values(THEME_CLASSES).forEach((cls) => {
    if (cls) noteRoot.classList.remove(cls);
  });

  const targetClass = THEME_CLASSES[currentColor];
  if (targetClass) {
    noteRoot.classList.add(targetClass);
  }

  // Atualizar dot ativo
  const dots = colorPalette.querySelectorAll('.color-dot');
  dots.forEach((d) => {
    d.classList.toggle('active', d.dataset.color === currentColor);
  });
}

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
  applyColorTheme(data.color || '#ffe14d');
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

// --- Paleta de Cores ---
colorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorPalette.hidden = !colorPalette.hidden;
});

colorPalette.querySelectorAll('.color-dot').forEach((dot) => {
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    const color = dot.dataset.color;
    applyColorTheme(color);
    window.notesAPI.setNoteColor(noteId, color);
    colorPalette.hidden = true;
  });
});

document.addEventListener('click', (e) => {
  if (!colorPalette.hidden && !colorPalette.contains(e.target) && e.target !== colorBtn) {
    colorPalette.hidden = true;
  }
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
  return firstLine.length > 28 ? firstLine.slice(0, 28) + '…' : firstLine;
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

    // Botão de Eliminar com Confirmação Inline
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-delete-btn';
    deleteBtn.title = 'Apagar nota';
    deleteBtn.textContent = '🗑';

    const confirmBox = document.createElement('div');
    confirmBox.className = 'delete-confirm-box';
    confirmBox.hidden = true;

    const yesBtn = document.createElement('button');
    yesBtn.className = 'confirm-btn yes';
    yesBtn.textContent = 'Sim';

    const noBtn = document.createElement('button');
    noBtn.className = 'confirm-btn no';
    noBtn.textContent = 'Não';

    confirmBox.appendChild(yesBtn);
    confirmBox.appendChild(noBtn);

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBtn.hidden = true;
      confirmBox.hidden = false;
    });

    yesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.notesAPI.deleteNote(note.id);
    });

    noBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmBox.hidden = true;
      deleteBtn.hidden = false;
    });

    item.appendChild(deleteBtn);
    item.appendChild(confirmBox);

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
  colorPalette.hidden = true;
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

function toggleDrawer() {
  if (drawer.hidden) {
    openDrawer();
  } else {
    closeDrawer();
  }
}

menuBtn.addEventListener('click', toggleDrawer);
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

// --- Atalhos de Teclado Globais (Produtividade) ---
window.addEventListener('keydown', (e) => {
  // Escape: fechar gaveta ou paleta de cores
  if (e.key === 'Escape') {
    if (!colorPalette.hidden) {
      colorPalette.hidden = true;
      textarea.focus();
      return;
    }
    if (!drawer.hidden) {
      closeDrawer();
      return;
    }
  }

  // Ctrl + N: Nova nota
  if (e.ctrlKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    flushSave();
    window.notesAPI.createNote();
    return;
  }

  // Ctrl + H ou Ctrl + M: Alternar Gaveta de Notas Anteriores
  if (e.ctrlKey && (e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'm')) {
    e.preventDefault();
    toggleDrawer();
    return;
  }

  // Ctrl + W: Fechar nota atual
  if (e.ctrlKey && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    flushSave();
    window.notesAPI.closeNoteWindow(noteId, textarea.value);
    return;
  }

  // Ctrl + P: Alternar Always on Top
  if (e.ctrlKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    pinBtn.click();
    return;
  }
});
