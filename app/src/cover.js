// The cover engine: draws a whole cover onto a canvas from the editor state.
// Pure canvas 2D, no network, no library. Every cover is drawn the same way
// at preview size and at export size, so what you see is what the PNG holds.
import { layoutPanels } from './layouts.js';
import { gradeById, applyGradeToImageData, grainPattern, drawHalftoneBand, drawVignette } from './grades.js';

// Deterministic pseudo-random for skylines and palms, so a cover re-renders
// identically every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawStarPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// A palm silhouette: curved trunk, six drooping fronds.
export function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning.
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.55, x + s * 0.3, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.3;
  const topY = y - s * 0.95;
  // Fronds.
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * (0.08 + (i / 6) * 0.84);
    const len = s * (0.5 + (i % 3) * 0.08);
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.55 + s * 0.18;
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(ang) * len * 0.5, topY - s * 0.22, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// A dusk skyline: dark towers with a few lit windows.
export function drawSkyline(ctx, x, y, w, h, seed, color) {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = color;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.07);
    const bh = h * (0.35 + rnd() * 0.6);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // Lit windows.
    ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
    const cols = Math.max(1, Math.floor(bw / 14));
    const rows = Math.max(1, Math.floor(bh / 18));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.22) ctx.fillRect(bx + 4 + c * 14, y + h - bh + 6 + r * 18, 5, 7);
      }
    }
    ctx.fillStyle = color;
    bx += bw + 2;
  }
  ctx.restore();
}

function sunsetSky(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b0f4d');
  grad.addColorStop(0.35, '#8a1e63');
  grad.addColorStop(0.62, '#e8445a');
  grad.addColorStop(0.82, '#ff9a3d');
  grad.addColorStop(1, '#ffd76a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Low sun.
  const sun = ctx.createRadialGradient(W * 0.68, H * 0.62, 4, W * 0.68, H * 0.62, H * 0.22);
  sun.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
  sun.addColorStop(0.5, 'rgba(255, 190, 90, 0.55)');
  sun.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(W * 0.68, H * 0.62, H * 0.075, 0, Math.PI * 2);
  ctx.fill();
}

function darkBackdrop(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#160818');
  grad.addColorStop(0.7, '#1d0a26');
  grad.addColorStop(1, '#0d0412');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.12, 10, W * 0.5, H * 0.12, W * 0.6);
  glow.addColorStop(0, 'rgba(255, 94, 150, 0.14)');
  glow.addColorStop(1, 'rgba(255, 94, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

// Grade one photo into an offscreen canvas the size of its panel, then hand
// the canvas back so the caller can draw it rotated and framed.
function gradePhotoToCanvas(img, pw, ph, panel, grade) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(pw));
  off.height = Math.max(2, Math.round(ph));
  const octx = off.getContext('2d');
  // Cover-fit with the panel's zoom and pan (ox/oy are fractions of the
  // source image, -0.5..0.5).
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * (panel.zoom || 1);
  const sw = pw / scale;
  const sh = ph / scale;
  const sx = (img.naturalWidth - sw) / 2 + (panel.ox || 0) * img.naturalWidth * 0.4;
  const sy = (img.naturalHeight - sh) / 2 + (panel.oy || 0) * img.naturalHeight * 0.4;
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height);
  const data = octx.getImageData(0, 0, off.width, off.height);
  applyGradeToImageData(data, grade);
  octx.putImageData(data, 0, 0);
  return off;
}

function drawPanelFrame(ctx, x, y, w, h) {
  ctx.save();
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeStyle = '#f5efe4';
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeStyle = 'rgba(10, 4, 14, 0.9)';
  ctx.strokeRect(x - w * 0.004, y - w * 0.004, w + w * 0.008, h + w * 0.008);
  ctx.restore();
}

function drawOnePanel(ctx, img, panel, rect, grade) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  // Soft drop shadow under the snapshot.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = w * 0.04;
  ctx.shadowOffsetY = w * 0.015;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const graded = gradePhotoToCanvas(img, w, h, panel, grade);
  ctx.drawImage(graded, 0, 0, w, h);
  // Grain, halftone and vignette on top of the grade.
  ctx.save();
  ctx.globalAlpha = grade.grain || 0;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (grade.halftone) drawHalftoneBand(ctx, 0, h * 0.62, w, h * 0.38, 'rgba(20,4,24,0.5)');
  drawVignette(ctx, 0, 0, w, h, grade.vignette || 0.3);
  drawPanelFrame(ctx, 0, 0, w, h);
  ctx.restore();
}

// The title block: badge ribbon, big Anton title, neon Pacifico subtitle and
// the star heat meter. zone is in fractions; align follows the layout.
function drawTitleBlock(ctx, state, zone, W, H) {
  const zx = zone.x * W;
  const zy = zone.y * H;
  const zw = zone.w * W;
  const zh = zone.h * H;
  const titleSize = Math.min(zh * 0.52, (zw / Math.max(4, state.title.length)) * 1.9);
  ctx.save();
  // Badge ribbon, tilted, top-left of the title zone.
  if (state.badge) {
    ctx.save();
    ctx.translate(zx + zw * 0.09, zy + zh * 0.16);
    ctx.rotate(-0.06);
    const bw = Math.min(zw * 0.34, state.badge.length * titleSize * 0.42 + titleSize * 0.9);
    const bh = titleSize * 0.52;
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(-bw / 2, -bh / 2);
    ctx.lineTo(bw / 2, -bh / 2);
    ctx.lineTo(bw / 2 + bh * 0.35, 0);
    ctx.lineTo(bw / 2, bh / 2);
    ctx.lineTo(-bw / 2, bh / 2);
    ctx.lineTo(-bw / 2 - bh * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, titleSize * 0.03);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(titleSize * 0.34)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.badge.toUpperCase(), 0, titleSize * 0.02);
    ctx.restore();
  }
  // Heat meter: five stars, top-right of the title zone.
  const starR = Math.max(8, zh * 0.09);
  const gap = starR * 2.3;
  const startX = zx + zw - gap * 4 - starR;
  const starY = zy + zh * 0.16;
  for (let i = 0; i < 5; i++) {
    const cx = startX + i * gap;
    drawStarPath(ctx, cx, starY, starR);
    if (i < state.heat) {
      ctx.fillStyle = '#ffd23e';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, starR * 0.12);
      ctx.strokeStyle = '#241006';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, starR * 0.12);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
    }
  }
  // Neon script subtitle, above the title.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const subSize = titleSize * 0.42;
  ctx.font = `${Math.round(subSize)}px Pacifico, cursive`;
  ctx.save();
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = subSize * 0.5;
  ctx.fillStyle = '#ff7ad0';
  ctx.fillText(state.subtitle, zx + zw * 0.02, zy + zh * 0.42);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe3f4';
  ctx.fillText(state.subtitle, zx + zw * 0.02, zy + zh * 0.42);
  ctx.restore();
  // Big title: gradient fill, heavy black outline, a slight lean.
  let size = titleSize;
  ctx.font = `${Math.round(size)}px Anton, sans-serif`;
  const maxW = zw * 0.98;
  while (size > 12 && ctx.measureText(state.title).width > maxW) {
    size *= 0.94;
    ctx.font = `${Math.round(size)}px Anton, sans-serif`;
  }
  ctx.save();
  ctx.translate(zx + zw * 0.02, zy + zh * 0.92);
  ctx.rotate(-0.012);
  const grad = ctx.createLinearGradient(0, -size, 0, 0);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#ffe9a8');
  grad.addColorStop(1, '#ff8a3d');
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.1);
  ctx.strokeStyle = '#160818';
  ctx.strokeText(state.title.toUpperCase(), 0, 0);
  ctx.fillStyle = grad;
  ctx.fillText(state.title.toUpperCase(), 0, 0);
  ctx.restore();
  ctx.restore();
}

// Draw the whole cover. state: { layout, grade, title, subtitle, badge,
// heat, panels: [{ photo, zoom, ox, oy, grade }] }. images: Map key ->
// HTMLImageElement. W, H: output pixels.
export function renderCover(canvas, state, images, W, H) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { panels, title, bg } = layoutPanels(state.layout, W, H);
  if (bg === 'sunset') {
    sunsetSky(ctx, W, H);
    drawSkyline(ctx, 0, H * 0.78, W, H * 0.22, 20261119, 'rgba(26, 8, 34, 0.9)');
    drawPalm(ctx, W * 0.04, H * 0.82, H * 0.2, 'rgba(18, 5, 24, 0.92)');
    drawPalm(ctx, W * 0.96, H * 0.8, H * 0.17, 'rgba(18, 5, 24, 0.92)');
  } else if (bg === 'photo') {
    darkBackdrop(ctx, W, H);
  } else {
    darkBackdrop(ctx, W, H);
  }
  const defaultGrade = gradeById(state.grade);
  panels.forEach((rect, i) => {
    const panel = state.panels[i] || state.panels[0];
    const img = images.get(panel.photo) || images.get('pier') || [...images.values()][0];
    if (!img) return;
    const grade = panel.grade ? gradeById(panel.grade) : defaultGrade;
    drawOnePanel(ctx, img, panel, { x: rect.x * W, y: rect.y * H, w: rect.w * W, h: rect.h * H, rot: rect.rot }, grade);
  });
  if (state.layout === 'fullbleed') {
    // A dark wash at the bottom so the lettering reads over any photo.
    const wash = ctx.createLinearGradient(0, H * 0.55, 0, H);
    wash.addColorStop(0, 'rgba(10,4,14,0)');
    wash.addColorStop(1, 'rgba(10,4,14,0.72)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }
  // Palm silhouettes creeping in from the bottom corners of the title zone.
  if (state.layout !== 'tilted' && state.layout !== 'fullbleed') {
    drawPalm(ctx, W * 0.015, H * 0.995, H * 0.16, 'rgba(12, 4, 18, 0.9)');
    drawPalm(ctx, W * 0.985, H * 0.995, H * 0.13, 'rgba(12, 4, 18, 0.9)');
  }
  drawTitleBlock(ctx, state, title, W, H);
  return canvas;
}
