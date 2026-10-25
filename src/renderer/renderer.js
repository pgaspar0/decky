const textarea = document.getElementById('content');
const pinBtn = document.getElementById('pin-btn');
const closeBtn = document.getElementById('close-btn');
const debugFooter = document.getElementById('debug-footer');

let noteId = null;
let saveTimeout = null;

window.notesAPI.onInit((data) => {
  noteId = data.id;
  textarea.value = data.content || '';
  pinBtn.classList.toggle('active', !!data.alwaysOnTop);
  textarea.focus();
});

window.notesAPI.onBounds((bounds) => {
  // Se isto ficar preso em "0, 0" mesmo depois de arrastares a nota,
  // estas em Wayland nativo -- corre `npm run start:x11` para comparar.
  debugFooter.textContent = `pos: ${bounds.x}, ${bounds.y}`;
});

textarea.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    window.notesAPI.updateContent(noteId, textarea.value);
  }, 300);
});

pinBtn.addEventListener('click', async () => {
  const next = await window.notesAPI.toggleAlwaysOnTop(noteId);
  if (next !== null) pinBtn.classList.toggle('active', next);
});

closeBtn.addEventListener('click', () => {
  window.notesAPI.deleteNote(noteId);
});

window.notesAPI.getDiagnostics().then(({ sessionType }) => {
  debugFooter.textContent = `sessao: ${sessionType || '?'}`;
});
