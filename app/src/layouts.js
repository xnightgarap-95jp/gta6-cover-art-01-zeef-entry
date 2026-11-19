// Panel layouts for Vice Coast Cover Studio.
// Every layout is a pure function of the cover size: it returns the panels
// (normalised rects, rotation in degrees) and the title zone, so the same
// layout draws identically at preview size and at any export size.
// Panel rects are fractions of the cover width/height; the renderer scales
// them. A layout names how many photos it uses; extra state panels are
// ignored, missing ones fall back to the first sample.

export const LAYOUTS = [
  { id: 'grid4', name: 'Four-panel grid', panels: 4, blurb: 'The classic poster grid' },
  { id: 'hero3', name: 'Hero and three', panels: 4, blurb: 'One big moment, three beats' },
  { id: 'fullbleed', name: 'Full-bleed', panels: 1, blurb: 'One photo, edge to edge' },
  { id: 'tilted', name: 'Tilted snapshot collage', panels: 3, blurb: 'Snaps tossed on the sunset' },
  { id: 'nine', name: 'Nine-panel grid', panels: 9, blurb: 'A whole night in nine frames' },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Title zone: where the caption lettering, ribbon and heat meter live.
// { x, y, w, h } in fractions, plus where the title baseline sits.
function titleZone(kind) {
  if (kind === 'top') return { x: 0.03, y: 0.02, w: 0.94, h: 0.17, align: 'left' };
  return { x: 0.03, y: 0.735, w: 0.94, h: 0.235, align: 'left' };
}

export function layoutPanels(layoutId, W, H) {
  const g = 0.014; // gutter, as a fraction of the short side
  const m = 0.02; // outer margin
  const panels = [];
  if (layoutId === 'grid4') {
    const pw = (1 - m * 2 - g) / 2;
    const ph = (0.72 - m - g) / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        panels.push({ x: m + c * (pw + g), y: m + r * (ph + g), w: pw, h: ph, rot: 0 });
      }
    }
    return { panels, title: titleZone('bottom'), bg: 'dark' };
  }
  if (layoutId === 'hero3') {
    const heroW = 0.6;
    const sideX = m + heroW + g;
    const sideW = 1 - sideX - m;
    const sideH = (0.72 - m - g * 2) / 3;
    panels.push({ x: m, y: m, w: heroW, h: 0.72 - m, rot: 0 });
    for (let i = 0; i < 3; i++) {
      panels.push({ x: sideX, y: m + i * (sideH + g), w: sideW, h: sideH, rot: 0 });
    }
    return { panels, title: titleZone('bottom'), bg: 'dark' };
  }
  if (layoutId === 'fullbleed') {
    panels.push({ x: 0, y: 0, w: 1, h: 1, rot: 0 });
    return { panels, title: { x: 0.04, y: 0.72, w: 0.92, h: 0.24, align: 'left' }, bg: 'photo' };
  }
  if (layoutId === 'tilted') {
    // Three snapshots tossed on a sunset gradient, title across the top.
    panels.push({ x: 0.06, y: 0.24, w: 0.44, h: 0.42, rot: -6 });
    panels.push({ x: 0.52, y: 0.20, w: 0.42, h: 0.46, rot: 4 });
    panels.push({ x: 0.28, y: 0.58, w: 0.46, h: 0.34, rot: -2 });
    return { panels, title: titleZone('top'), bg: 'sunset' };
  }
  // nine: 3x3 grid
  const pw = (1 - m * 2 - g * 2) / 3;
  const ph = (0.72 - m - g * 2) / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      panels.push({ x: m + c * (pw + g), y: m + r * (ph + g), w: pw, h: ph, rot: 0 });
    }
  }
  return { panels, title: titleZone('bottom'), bg: 'dark' };
}

// Panel hit-testing in preview pixels: given a click at (px, py) on a canvas
// of size W x H, return the panel index under it, or -1.
export function panelAt(layoutId, W, H, px, py) {
  const { panels } = layoutPanels(layoutId, W, H);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    const cx = p.x * W + (p.w * W) / 2;
    const cy = p.y * H + (p.h * H) / 2;
    const dx = px - cx;
    const dy = py - cy;
    const rad = (-p.rot * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(rx) <= (p.w * W) / 2 && Math.abs(ry) <= (p.h * H) / 2) return i;
  }
  return -1;
}
