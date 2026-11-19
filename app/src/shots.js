// Fixed scenes for screenshots: ?shot=cover draws the cover alone at full
// export size; ?shot=editor shows the editor with a sample photo loaded.
// `layout`, `size`, `grade`, `photo`, `caption`, `subtitle`, `badge` and
// `heat` come from the query string. window.__shotReady is set once painted.
import { renderCover } from './cover.js';
import { SIZES } from './main.js';

export async function runShot(shot, query, api) {
  const preview = document.getElementById('preview');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const next = api.state;
    next.layout = query.get('layout') || 'grid4';
    next.grade = query.get('grade') || 'sunset';
    next.title = query.get('caption') || 'VICE COAST';
    next.subtitle = query.get('subtitle') || 'Sunset Heist';
    next.badge = query.get('badge') || 'VICE CITY';
    next.heat = Number(query.get('heat') || 4);
    next.size = query.get('size') || 'square';
    const photo = query.get('photo') || 'pier';
    const other = photo === 'pier' ? 'boulevard' : 'pier';
    next.panels.forEach((p, i) => { p.photo = i % 2 === 0 ? photo : other; });
    api.setState(next);
    const size = SIZES[next.size];
    renderCover(preview, api.state, api.images, size.w, size.h);
    preview.style.width = '100vw';
    preview.style.height = '100vh';
    preview.style.objectFit = 'contain';
  } else if (shot === 'editor') {
    const next = api.state;
    next.layout = query.get('layout') || 'grid4';
    next.grade = query.get('grade') || 'sunset';
    next.title = query.get('caption') || 'VICE COAST';
    next.subtitle = query.get('subtitle') || 'Sunset Heist';
    next.size = query.get('size') || 'square';
    api.setState(next);
    document.getElementById('titleInput').value = next.title;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
