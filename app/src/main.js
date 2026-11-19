// Vice Coast Cover Studio: the editor. Wires the controls to the cover
// engine, keeps an undo stack, and exports PNGs in the three post sizes.
// Photos never leave the machine: uploads are read with FileReader and kept
// in memory; samples are files under app/samples/.
import { LAYOUTS, layoutById, panelAt } from './layouts.js';
import { GRADES, gradeById } from './grades.js';
import { renderCover } from './cover.js';
import { runShot } from './shots.js';

export const SIZES = {
  square: { name: 'Square 1080 x 1080', w: 1080, h: 1080 },
  story: { name: 'Story 1080 x 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

const SAMPLES = [
  { key: 'pier', label: 'Pier at dusk', src: 'samples/pier.jpg' },
  { key: 'boulevard', label: 'Boulevard gold', src: 'samples/boulevard.jpg' },
];

function defaultPanels() {
  return Array.from({ length: 9 }, (_, i) => ({
    photo: i % 2 === 0 ? 'pier' : 'boulevard',
    zoom: 1.15,
    ox: 0,
    oy: 0,
    grade: null,
  }));
}

export function defaultState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    title: 'VICE COAST',
    subtitle: 'Sunset Heist',
    badge: 'VICE CITY',
    heat: 4,
    size: 'square',
    panels: defaultPanels(),
  };
}

const images = new Map(); // photo key -> HTMLImageElement
const uploads = new Map(); // upload id -> data URL (kept in memory only)
let uploadCount = 0;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function ensureSamples() {
  for (const s of SAMPLES) {
    if (!images.has(s.key)) images.set(s.key, await loadImage(s.src));
  }
}

// ---- state, history -------------------------------------------------------
let state = defaultState();
let selectedPanel = 0;
const undoStack = [];
const redoStack = [];
let historyTimer = null;

function snapshot() {
  return JSON.stringify(state);
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  refreshUndoButtons();
}

function pushHistoryDebounced() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(pushHistory, 350);
}

function restore(json) {
  state = JSON.parse(json);
  syncControls();
  render();
}

function undo() {
  if (!undoStack.length) return;
  // A pending debounced push belongs to the edit being undone; letting it
  // fire after the undo would silently wipe the redo stack.
  clearTimeout(historyTimer);
  redoStack.push(snapshot());
  restore(undoStack.pop());
  refreshUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  clearTimeout(historyTimer);
  undoStack.push(snapshot());
  restore(redoStack.pop());
  refreshUndoButtons();
}

// ---- rendering ------------------------------------------------------------
const preview = document.getElementById('preview');
const statusEl = document.getElementById('status');

function previewSize() {
  const size = SIZES[state.size];
  const scale = 560 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function render() {
  const { w, h } = previewSize();
  try {
    renderCover(preview, state, images, w, h);
  } catch (err) {
    statusEl.textContent = 'Render failed: ' + err.message;
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

// ---- export ---------------------------------------------------------------
function renderAtSize(sizeId) {
  const size = SIZES[sizeId];
  const canvas = document.createElement('canvas');
  renderCover(canvas, state, images, size.w, size.h);
  return canvas;
}

function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(blob.size);
    }, 'image/png');
  });
}

async function exportOne(sizeId) {
  const canvas = renderAtSize(sizeId);
  const size = SIZES[sizeId];
  const bytes = await downloadCanvas(canvas, `vice-coast-${sizeId}-${size.w}x${size.h}.png`);
  setStatus(`Exported ${size.name} PNG (${Math.round(bytes / 1024)} KB).`);
  return canvas;
}

async function exportAll() {
  for (const id of Object.keys(SIZES)) {
    await exportOne(id);
    await new Promise((r) => setTimeout(r, 250));
  }
  setStatus('Exported all three sizes: square, story and wide.');
}

// ---- controls -------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function buildButtons(containerId, items, currentId, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (item.id === currentId ? ' active' : '');
    b.textContent = item.name;
    b.title = item.blurb || item.name;
    b.addEventListener('click', () => {
      pushHistory();
      onPick(item.id);
      syncControls();
      render();
    });
    box.appendChild(b);
  }
}

function panelGradeOptions() {
  return [{ id: null, name: 'Use cover grade' }, ...GRADES.map((g) => ({ id: g.id, name: g.name }))];
}

function syncControls() {
  buildButtons('layoutRow', LAYOUTS, state.layout, (id) => { state.layout = id; });
  buildButtons('gradeRow', GRADES, state.grade, (id) => { state.grade = id; });
  buildButtons('sizeRow', Object.entries(SIZES).map(([id, s]) => ({ id, name: s.name })), state.size, (id) => { state.size = id; });
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('heatInput').value = String(state.heat);
  $('heatValue').textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  // Selected panel controls.
  const panel = state.panels[selectedPanel];
  const layout = layoutById(state.layout);
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${layout.panels} — click a panel in the preview to pick it`;
  const photoSel = $('photoSelect');
  photoSel.innerHTML = '';
  for (const s of SAMPLES) {
    const o = document.createElement('option');
    o.value = s.key;
    o.textContent = 'Sample: ' + s.label;
    photoSel.appendChild(o);
  }
  for (const [id] of uploads) {
    const o = document.createElement('option');
    o.value = 'upload:' + id;
    o.textContent = 'Your upload #' + id;
    photoSel.appendChild(o);
  }
  photoSel.value = panel.photo;
  const gradeSel = $('panelGradeSelect');
  gradeSel.innerHTML = '';
  for (const g of panelGradeOptions()) {
    const o = document.createElement('option');
    o.value = g.id === null ? '' : g.id;
    o.textContent = g.name;
    gradeSel.appendChild(o);
  }
  gradeSel.value = panel.grade || '';
  $('zoomInput').value = String(panel.zoom);
  $('zoomValue').textContent = panel.zoom.toFixed(2) + 'x';
  $('oxInput').value = String(panel.ox);
  $('oyInput').value = String(panel.oy);
  refreshUndoButtons();
}

function refreshUndoButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

function bindControls() {
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('titleInput').addEventListener('change', pushHistory);
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('subtitleInput').addEventListener('change', pushHistory);
  $('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; render(); });
  $('badgeInput').addEventListener('change', pushHistory);
  $('heatInput').addEventListener('input', (e) => {
    state.heat = Number(e.target.value);
    $('heatValue').textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
    render();
  });
  $('heatInput').addEventListener('change', pushHistory);
  $('photoSelect').addEventListener('change', (e) => {
    pushHistory();
    state.panels[selectedPanel].photo = e.target.value;
    render();
  });
  $('panelGradeSelect').addEventListener('change', (e) => {
    pushHistory();
    state.panels[selectedPanel].grade = e.target.value || null;
    render();
  });
  $('zoomInput').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    $('zoomValue').textContent = state.panels[selectedPanel].zoom.toFixed(2) + 'x';
    render();
  });
  $('zoomInput').addEventListener('change', pushHistory);
  $('oxInput').addEventListener('input', (e) => { state.panels[selectedPanel].ox = Number(e.target.value); render(); });
  $('oxInput').addEventListener('change', pushHistory);
  $('oyInput').addEventListener('input', (e) => { state.panels[selectedPanel].oy = Number(e.target.value); render(); });
  $('oyInput').addEventListener('change', pushHistory);
  $('uploadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      uploadCount += 1;
      const key = 'upload:' + uploadCount;
      uploads.set(uploadCount, reader.result);
      images.set(key, await loadImage(reader.result));
      pushHistory();
      state.panels[selectedPanel].photo = key;
      syncControls();
      render();
      setStatus(`Loaded ${file.name} into panel ${selectedPanel + 1}.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
  $('fillAllBtn').addEventListener('click', () => {
    pushHistory();
    const photo = state.panels[selectedPanel].photo;
    for (const p of state.panels) p.photo = photo;
    render();
    setStatus('Filled every panel with the selected photo.');
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('shuffleBtn').addEventListener('click', () => {
    pushHistory();
    const layouts = LAYOUTS.map((l) => l.id);
    const grades = GRADES.map((g) => g.id);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.panels.forEach((p) => { p.photo = Math.random() < 0.5 ? 'pier' : 'boulevard'; });
    syncControls();
    render();
  });
  $('exportBtn').addEventListener('click', () => exportOne(state.size));
  $('exportAllBtn').addEventListener('click', exportAll);

  // Preview: click to select a panel, drag to pan it, wheel to zoom it.
  let dragging = null;
  preview.addEventListener('pointerdown', (e) => {
    const rect = preview.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * preview.width;
    const py = ((e.clientY - rect.top) / rect.height) * preview.height;
    const hit = panelAt(state.layout, preview.width, preview.height, px, py);
    if (hit >= 0) {
      selectedPanel = hit;
      dragging = { x: e.clientX, y: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
      preview.setPointerCapture(e.pointerId);
      syncControls();
    }
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = preview.getBoundingClientRect();
    const panel = state.panels[selectedPanel];
    panel.ox = Math.max(-1, Math.min(1, dragging.ox + ((e.clientX - dragging.x) / rect.width) * 2));
    panel.oy = Math.max(-1, Math.min(1, dragging.oy + ((e.clientY - dragging.y) / rect.height) * 2));
    $('oxInput').value = String(panel.ox);
    $('oyInput').value = String(panel.oy);
    render();
  });
  preview.addEventListener('pointerup', () => {
    if (dragging) {
      dragging = null;
      pushHistoryDebounced();
    }
  });
  preview.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[selectedPanel];
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    $('zoomInput').value = String(panel.zoom);
    $('zoomValue').textContent = panel.zoom.toFixed(2) + 'x';
    render();
    pushHistoryDebounced();
  }, { passive: false });
}

// ---- boot -----------------------------------------------------------------
export async function boot() {
  await ensureSamples();
  try {
    await document.fonts.load('40px Anton');
    await document.fonts.load('40px Pacifico');
    await document.fonts.ready;
  } catch {
    // Lettering falls back to sans-serif; the cover still renders.
  }
  bindControls();
  syncControls();
  render();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, {
      state,
      setState(next) { state = next; syncControls(); render(); },
      render,
      images,
      loadSample: async (key) => { await ensureSamples(); return images.get(key); },
      exportOne,
    });
  }
}

boot();
