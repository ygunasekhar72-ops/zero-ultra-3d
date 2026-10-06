// ------------------------------------------------------------
// Procedural label wrap for the Zero Ultra can.
// Painted once to a canvas, then used as color + bump map.
// Texture space: x wraps the full 360° circumference,
// y runs bottom->top of the printed wall (image top = can top).
// The claw artwork is centered at x = W/2, which lands on the
// -Z side of the cylinder; the can group rests at rotation.y = PI
// so the claw faces the hero camera.
// ------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintFrost(ctx, W, H, rng, { bump = false } = {}) {
  // soft cloudy patches (depth in the frost)
  for (let i = 0; i < 46; i++) {
    const px = rng() * W;
    const py = rng() * H;
    const r = 70 + rng() * 240;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    const shade = bump ? (rng() > 0.5 ? 138 : 112) : (rng() > 0.5 ? 152 : 118);
    const a = bump ? 0.05 + rng() * 0.07 : 0.10 + rng() * 0.13;
    g.addColorStop(0, `rgba(${shade},${shade + 3},${shade + 9},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }

  // crystalline clusters — feathered shards radiating from centers
  for (let c = 0; c < 72; c++) {
    const cx = rng() * W;
    const cy = rng() * H;
    const n = 5 + Math.floor(rng() * 9);
    for (let s = 0; s < n; s++) {
      const ang = rng() * Math.PI * 2;
      const len = 14 + rng() * 64;
      const wobble = (rng() - 0.5) * 0.6;
      const ex = cx + Math.cos(ang + wobble) * len;
      const ey = cy + Math.sin(ang + wobble) * len;
      const mx = cx + Math.cos(ang + wobble * 0.4) * len * 0.5 + (rng() - 0.5) * 10;
      const my = cy + Math.sin(ang + wobble * 0.4) * len * 0.5 + (rng() - 0.5) * 10;
      const dark = rng() > 0.6 && !bump; // some silver-gray shards
      const alpha = 0.10 + rng() * 0.22;
      ctx.strokeStyle = bump
        ? `rgba(255,255,255,${alpha * 0.9})`
        : dark
          ? `rgba(126,134,148,${alpha * 0.8})`
          : `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 0.8 + rng() * 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // tiny ice facets at some tips
      if (rng() > 0.68) {
        const fs = 2 + rng() * 5;
        ctx.fillStyle = bump
          ? 'rgba(255,255,255,0.5)'
          : dark
            ? `rgba(130,138,152,${0.12 + rng() * 0.16})`
            : `rgba(255,255,255,${0.16 + rng() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(ex, ey - fs);
        ctx.lineTo(ex + fs * 0.7, ey);
        ctx.lineTo(ex, ey + fs);
        ctx.lineTo(ex - fs * 0.7, ey);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // fine speckle
  for (let i = 0; i < 900; i++) {
    const px = rng() * W;
    const py = rng() * H;
    ctx.fillStyle = bump
      ? `rgba(255,255,255,${0.15 + rng() * 0.2})`
      : (rng() > 0.5
        ? `rgba(255,255,255,${0.08 + rng() * 0.14})`
        : `rgba(128,136,150,${0.06 + rng() * 0.10})`);
    ctx.fillRect(px, py, 1 + rng() * 1.6, 1 + rng() * 1.2);
  }
}

function drawTalon(ctx, cx, baseY, h, w, lean, bow, flip = false) {
  // one curved, tapered claw gash: base point -> bulge -> pointed tip.
  // Bulges toward -x; pass flip=true for the mirrored right talon.
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(lean);
  if (flip) ctx.scale(-1, 1);
  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  grad.addColorStop(0.00, '#08090b');
  grad.addColorStop(0.38, '#33373d');
  grad.addColorStop(0.62, '#454a52');
  grad.addColorStop(0.85, '#121317');
  grad.addColorStop(1.00, '#08090b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * (1.0 + bow), -h * 0.30, -w * (0.55 + bow * 0.6), -h * 0.80, -w * 0.12, -h);
  ctx.bezierCurveTo(w * (0.42 + bow * 0.5), -h * 0.74, w * (0.85 - bow * 0.4), -h * 0.32, 0, 0);
  ctx.closePath();
  ctx.fill();
  // chrome edge kiss on the lit side
  ctx.strokeStyle = 'rgba(215, 225, 240, 0.5)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.04);
  ctx.bezierCurveTo(-w * (0.55 + bow * 0.6), -h * 0.80, -w * (0.55 + bow * 0.6) * 0.98, -h * 0.62, -w * 0.12, -h * 0.985);
  ctx.stroke();
  ctx.restore();
}

function drawClaw(ctx, cx, topY, scale) {
  // three claw gashes packed tightly (edge gap ≈ 25-40 texture px),
  // bottoms sharing a base line, middle extending highest.
  // Note: texture px map to arc angle — 2048px = 360°, so keep the
  // whole block within ~±30° of arc or it wraps visibly around the can.
  const midH = 380 * scale;
  const sideH = 300 * scale;
  const gap = 158 * scale;
  const bottomY = topY + midH;
  drawTalon(ctx, cx - gap, bottomY + 10 * scale, sideH, 60 * scale, -0.10, 0.5);
  drawTalon(ctx, cx + gap, bottomY + 10 * scale, sideH, 60 * scale, 0.10, 0.5, true);
  drawTalon(ctx, cx, bottomY, midH, 54 * scale, -0.06, 0.3);
}

function drawWordmark(ctx, cx, baselineY, size) {
  // M∅NSTER — Impact caps with a slashed-O glyph
  ctx.save();
  ctx.fillStyle = '#101216';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px Impact, "Arial Black", "Haettenschweiler", sans-serif`;

  const track = size * 0.14;
  const word = 'M?NSTER'; // ? = slashed O, drawn manually
  // measure
  let total = 0;
  const widths = [];
  for (const ch of word) {
    const w = ch === '?' ? size * 0.74 : ctx.measureText(ch).width;
    widths.push(w);
    total += w + track;
  }
  total -= track;

  let pen = cx - total / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const w = widths[i];
    if (ch === '?') {
      const r = size * 0.34;
      const ccx = pen + r + size * 0.03;
      const ccy = baselineY - size * 0.36;
      ctx.strokeStyle = '#101216';
      ctx.lineWidth = size * 0.155;
      ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.stroke();
      const a = Math.PI * 0.75;
      ctx.beginPath();
      ctx.moveTo(ccx - Math.cos(a) * r * 1.25, ccy + Math.sin(a) * r * 1.25);
      ctx.lineTo(ccx + Math.cos(a) * r * 1.25, ccy - Math.sin(a) * r * 1.25);
      ctx.stroke();
    } else {
      ctx.fillText(ch, pen, baselineY);
    }
    pen += w + track;
  }
  ctx.restore();
}

function drawTracked(ctx, text, cx, baselineY, size, weight, color, track, font) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let total = 0;
  const ws = [];
  for (const ch of text) { const w = ctx.measureText(ch).width; ws.push(w); total += w + track; }
  total -= track;
  let pen = cx - total / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], pen, baselineY);
    pen += ws[i] + track;
  }
  ctx.restore();
}

export function paintLabel() {
  const W = 4096, H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(20261006);

  // ---- silver metallic base ----
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0.00, '#f0f2f4');
  base.addColorStop(0.35, '#e6e8eb');
  base.addColorStop(0.70, '#d8dadd');
  base.addColorStop(1.00, '#c8cacd');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // gentle horizontal banding so the metal reads brushed
  for (let i = 0; i < 40; i++) {
    const y = rng() * H;
    ctx.fillStyle = `rgba(${rng() > 0.5 ? 255 : 150},155,165,${0.015 + rng() * 0.02})`;
    ctx.fillRect(0, y, W, 1 + rng() * 2);
  }
  // darkening toward the wrap seam so the seam disappears
  const seamL = ctx.createLinearGradient(0, 0, W * 0.09, 0);
  seamL.addColorStop(0, 'rgba(90,95,105,0.35)');
  seamL.addColorStop(1, 'rgba(90,95,105,0)');
  ctx.fillStyle = seamL; ctx.fillRect(0, 0, W * 0.09, H);
  const seamR = ctx.createLinearGradient(W, 0, W * 0.91, 0);
  seamR.addColorStop(0, 'rgba(90,95,105,0.35)');
  seamR.addColorStop(1, 'rgba(90,95,105,0)');
  ctx.fillStyle = seamR; ctx.fillRect(W * 0.91, 0, W * 0.09, H);

  paintFrost(ctx, W, H, rng);

  // ---- back-of-can small print (opposite the claw, near the seam) ----
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#3a3f47';
  const backX = W * 0.045;
  for (let b = 0; b < 3; b++) {
    const by = H * (0.42 + b * 0.09);
    for (let l = 0; l < 4; l++) {
      ctx.fillRect(backX, by + l * 9, 60 + rng() * 110, 3);
    }
  }
  ctx.restore();

  // ---- artwork: composited from the reference photo (async, see
  // compositeReferenceLabel). The base stays bare frost silver so the
  // photo's ink layer sits on the SAME metal as the back of the can.
  // If the photo never loads, paintProceduralArtwork() adds a fallback.
  return canvas;
}

// Procedural artwork fallback (used only when the reference photo
// cannot be loaded) + the frost pass that unifies front and back.
export function paintProceduralArtwork(canvas) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(31337);
  const cx = W * 0.5;
  drawClaw(ctx, cx, H * 0.150, 1.0);
  drawWordmark(ctx, cx, H * 0.622, 108);
  drawTracked(ctx, 'ENERGY', cx, H * 0.672, 40, 700, '#1f6fd0', 17, 'Bahnschrift, "Segoe UI", Arial, sans-serif');
  drawTracked(ctx, 'ZERO ULTRA', cx, H * 0.758, 72, 800, '#0e1013', 20, 'Impact, "Arial Black", sans-serif');
  ctx.save();
  ctx.globalAlpha = 0.5;
  paintFrost(ctx, W, H * 0.62, rng);
  ctx.restore();
}

// ------------------------------------------------------------
// Reference-photo label: loads the supplied product photo,
// finds the can, crops the printed wall and re-projects it
// onto the cylinder wrap with arc correction. The procedural
// frost base stays underneath (back of can + seam blending).
// ------------------------------------------------------------

export function loadReferenceImage(url = './assets/reference.webp') {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Locate the can silhouette in the photo (light background assumed).
function detectCan(img) {
  const work = document.createElement('canvas');
  work.width = img.naturalWidth;
  work.height = img.naturalHeight;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.drawImage(img, 0, 0);
  const data = wctx.getImageData(0, 0, work.width, work.height).data;
  const lum = (x, y) => {
    const i = ((y | 0) * work.width + (x | 0)) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  // rows containing the can: a big share of the middle strip is non-white
  const x0 = Math.floor(work.width * 0.2);
  const x1 = Math.floor(work.width * 0.8);
  let top = -1, bot = -1;
  for (let y = 0; y < work.height; y++) {
    let cnt = 0, tot = 0;
    for (let x = x0; x < x1; x += 2) { tot++; if (lum(x, y) < 224) cnt++; }
    if (cnt / tot > 0.3) { if (top < 0) top = y; bot = y; }
  }
  if (top < 0 || bot - top < 40) return null;
  // horizontal extent measured across the lid band (wide, unambiguous)
  const lidY = Math.round(top + (bot - top) * 0.06);
  let left = Math.floor(work.width / 2), right = left;
  while (left > 0 && lum(left - 1, lidY) < 238) left--;
  while (right < work.width - 1 && lum(right + 1, lidY) < 238) right++;
  if (right - left < 20) return null;
  // true horizontal center: centroid of the claw's near-black pixels
  // (the lid scan can drift with background vignetting)
  const cTop = Math.round(top + (bot - top) * 0.25);
  const cBot = Math.round(top + (bot - top) * 0.5);
  let sum = 0, wsum = 0;
  for (let y = cTop; y < cBot; y += 2) {
    for (let x = left; x <= right; x += 1) {
      const l = lum(x, y);
      if (l < 70) { const w = 70 - l; sum += x * w; wsum += w; }
    }
  }
  const clawCx = wsum > 0 ? sum / wsum : (left + right) / 2;
  return { top, bot, left, right, clawCx, work };
}

// Re-project the photo's visible face (≈180° of arc) onto the texture as
// an INK layer: only the artwork's darks stay; the photo's whites become
// transparent so the same live frost-silver metal as the back of the can
// shows through. Baked photo lighting is normalized out (row de-light +
// edge gain), so nothing reads as a pasted decal.
export function compositeReferenceLabel(baseCanvas, img) {
  const det = detectCan(img);
  if (!det) return false;
  const { top, bot, left, right, work } = det;
  const W = baseCanvas.width, H = baseCanvas.height;
  const ctx = baseCanvas.getContext('2d');

  const canH = bot - top;
  const wallTop = Math.round(top + canH * 0.155);   // below neck/shoulder
  const wallBot = Math.round(bot - canH * 0.05);    // above bottom chime
  const wallH = wallBot - wallTop;
  // inset past the photo's silhouette shading — those dark edge pixels
  // stretch into wide streaks once arc-corrected onto the wrap
  const halfW = ((right - left) / 2 - 1) * 0.93;
  const ccx = det.clawCx ?? (left + right) / 2;

  // --- arc-corrected resample into an offscreen panel ---
  const pw = W >> 1, pH = H;
  const panel = document.createElement('canvas');
  panel.width = pw; panel.height = pH;
  const pctx = panel.getContext('2d', { willReadFrequently: true });
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  const strip = 2;
  for (let px = 0; px < pw; px += strip) {
    const theta = ((px + strip / 2) / pw - 0.5) * Math.PI;
    const sx = ccx + Math.sin(theta) * halfW;
    const sw = Math.max(0.4, Math.cos(theta) * halfW * (Math.PI / pw) * strip);
    pctx.drawImage(work, sx, wallTop, sw, wallH, px, 0, strip, pH);
  }

  // --- pixel pass: de-light, edge-gain, ink extraction ---
  const region = pctx.getImageData(0, 0, pw, pH);
  const rd = region.data;
  const lumAt = (i) => 0.2126 * rd[i] + 0.7152 * rd[i + 1] + 0.0722 * rd[i + 2];

  // 1) row de-light: normalize each row's bright-pixel mean so the
  //    photo's baked vertical lighting doesn't tint the metal
  for (let iy = 0; iy < pH; iy++) {
    let sum = 0, n = 0;
    for (let ix = 0; ix < pw; ix += 3) {
      const l = lumAt((iy * pw + ix) * 4) / 255;
      if (l > 0.62) { sum += l; n++; }
    }
    if (n < 12) continue;
    const gain = Math.min(1.3, Math.max(0.82, 0.88 / (sum / n)));
    if (Math.abs(gain - 1) < 0.02) continue;
    for (let ix = 0; ix < pw; ix++) {
      const i = (iy * pw + ix) * 4;
      rd[i] = Math.min(255, rd[i] * gain);
      rd[i + 1] = Math.min(255, rd[i + 1] * gain);
      rd[i + 2] = Math.min(255, rd[i + 2] * gain);
    }
  }

  // 2) extract ink: alpha rises as luminance falls — the claw/text/prints
  //    stay, whites vanish, and frost midtones ghost through faintly
  for (let iy = 0; iy < pH; iy++) {
    // soft edge fades so any residual paste boundary is invisible
    const ex = Math.min(1, iy / 20, (pH - 1 - iy) / 20);
    for (let ix = 0; ix < pw; ix++) {
      const i = (iy * pw + ix) * 4;
      // edge-of-face gain: counter the photo's grazing shading
      const theta = Math.abs((ix / pw - 0.5) * Math.PI);
      const gain = 1 + 0.4 * Math.pow(theta / (Math.PI / 2), 1.8);
      const l = Math.min(1, (lumAt(i) * gain) / 255);
      const alpha = Math.pow(1 - smoothstep(0.5, 0.95, l), 1.15) * 0.95;
      const e = Math.min(ex, Math.min(1, ix / 26, (pw - 1 - ix) / 26));
      rd[i + 3] = Math.round(alpha * e * 255);
    }
  }
  pctx.putImageData(region, 0, 0);

  // ink sits on the shared metal
  ctx.drawImage(panel, W * 0.25, 0);

  // 3) frost over the print — same surface treatment as the back
  const rng = mulberry32(4242);
  ctx.save();
  ctx.globalAlpha = 0.45;
  paintFrost(ctx, W, H * 0.62, rng);
  ctx.restore();
  return true;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function paintLabelBump() {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(777);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  paintFrost(ctx, W, H, rng, { bump: true });
  return canvas;
}
