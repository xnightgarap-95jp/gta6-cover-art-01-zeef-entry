// Vice City colour grades for Vice Coast Cover Studio.
// A grade is a gradient map: the photo's luminance is remapped through a
// sunset/neon ramp, then contrast and saturation are nudged. Each grade
// precomputes a 256-entry lookup table, so grading a panel is one pass over
// its pixels. Halftone and grain are drawn on top by the renderer.

export const GRADES = [
  {
    id: 'sunset',
    name: 'Vice Sunset',
    stops: [[0, 18, 6, 34], [0.35, 96, 22, 74], [0.6, 205, 62, 62], [0.8, 255, 142, 62], [1, 255, 224, 148]],
    contrast: 1.08, saturation: 1.15, halftone: false, grain: 0.05, vignette: 0.28,
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    stops: [[0, 5, 10, 30], [0.4, 22, 42, 92], [0.7, 162, 42, 142], [1, 255, 122, 202]],
    contrast: 1.1, saturation: 1.25, halftone: false, grain: 0.07, vignette: 0.32,
  },
  {
    id: 'noir',
    name: 'Palm Noir',
    stops: [[0, 10, 8, 8], [0.5, 112, 106, 100], [1, 246, 236, 220]],
    contrast: 1.25, saturation: 0, halftone: false, grain: 0.08, vignette: 0.4,
  },
  {
    id: 'drive',
    name: 'Ocean Drive',
    stops: [[0, 4, 20, 28], [0.5, 12, 92, 112], [1, 192, 242, 232]],
    contrast: 1.06, saturation: 1.1, halftone: false, grain: 0.05, vignette: 0.3,
  },
  {
    id: 'haze',
    name: 'Heat Haze',
    stops: [[0, 32, 5, 42], [0.45, 152, 22, 92], [0.75, 255, 112, 42], [1, 255, 232, 122]],
    contrast: 1.12, saturation: 1.3, halftone: true, grain: 0.06, vignette: 0.3,
  },
  {
    id: 'gold',
    name: 'Gold Hour',
    stops: [[0, 26, 15, 5], [0.5, 122, 76, 26], [1, 255, 212, 132]],
    contrast: 1.05, saturation: 1.2, halftone: false, grain: 0.04, vignette: 0.26,
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Build the 256-entry [r, g, b] table for a grade.
export function buildGradeLut(grade) {
  const lut = new Array(256);
  const stops = grade.stops;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s = 0;
    while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
    const a = stops[s];
    const b = stops[s + 1];
    const span = b[0] - a[0] || 1;
    const f = Math.max(0, Math.min(1, (t - a[0]) / span));
    lut[i] = [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
  }
  return lut;
}

const lutCache = new Map();
export function gradeLut(grade) {
  if (!lutCache.has(grade.id)) lutCache.set(grade.id, buildGradeLut(grade));
  return lutCache.get(grade.id);
}

// Grade an ImageData in place through the grade's lookup table, then apply
// the grade's contrast and saturation. Luminance is Rec. 709.
export function applyGradeToImageData(imageData, grade) {
  const data = imageData.data;
  const lut = gradeLut(grade);
  const contrast = grade.contrast;
  const sat = grade.saturation;
  for (let i = 0; i < data.length; i += 4) {
    const luma = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    const mapped = lut[luma];
    let r = mapped[0];
    let g = mapped[1];
    let b = mapped[2];
    // Contrast around mid grey, then saturation around the pixel's own luma.
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = grey + (r - grey) * sat;
    g = grey + (g - grey) * sat;
    b = grey + (b - grey) * sat;
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }
  return imageData;
}

// A tile of film grain, drawn with 'overlay' at low alpha over a panel.
let grainTile = null;
export function grainPattern(ctx) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 160;
    grainTile.height = 160;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 96 + Math.floor(Math.random() * 64);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

// Halftone dots along a band: dot radius grows with the band's sweep, the
// comic-print touch the Heat Haze grade wears.
export function drawHalftoneBand(ctx, x, y, w, h, color) {
  const step = Math.max(7, Math.round(w / 46));
  ctx.save();
  ctx.fillStyle = color;
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    const row = Math.floor((yy - y) / step);
    for (let xx = x + step / 2 + (row % 2 ? step / 2 : 0); xx < x + w; xx += step) {
      const depth = 1 - (yy - y) / h;
      const r = (step / 2) * (0.25 + 0.75 * depth);
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// A soft dark vignette inside a rect.
export function drawVignette(ctx, x, y, w, h, strength) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const radius = Math.hypot(w, h) / 2;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
