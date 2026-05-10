// Procedural texture generation — avoids shipping/loading external NASA assets.
// Each function returns a THREE.CanvasTexture.

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function noise2D(x, y) {
  // cheap deterministic hash-noise
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fbm(x, y, octaves = 5) {
  let v = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2D(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return v / norm;
}

function texFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Mix two hex colors based on t in [0,1]
function mix(a, b, t) {
  const A = parseHex(a), B = parseHex(b);
  return rgb(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
}
function parseHex(h) {
  const x = h.replace('#', '');
  return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
}
function rgb(r, g, b) { return `rgb(${r|0},${g|0},${b|0})`; }

// === Sun: bright yellow with subtle granulation
export function makeSunTexture() {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.02, y * 0.02, 4);
      const v = 0.85 + n * 0.3;
      const r = Math.min(255, 255 * v);
      const g = Math.min(255, 200 * v);
      const b = Math.min(255, 80 * v * 0.7);
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return texFromCanvas(c);
}

// === Generic noisy rocky planet (Mercury, Mars-ish)
export function makeRockyTexture(baseColor, accentColor, contrast = 0.4) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.03, y * 0.03, 5);
      const t = Math.min(1, Math.max(0, (n - 0.5) * contrast + 0.5));
      ctx.fillStyle = mix(baseColor, accentColor, t);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // sprinkle craters
  for (let i = 0; i < 80; i++) {
    const cx = Math.random() * W, cy = Math.random() * H;
    const r = 2 + Math.random() * 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
    ctx.fill();
  }
  return texFromCanvas(c);
}

// === Earth-like: oceans + continents + clouds
export function makeEarthTexture() {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lat = (y / H - 0.5) * Math.PI;
      const n = fbm(x * 0.018, y * 0.018, 6);
      const isLand = n > 0.52;
      let color;
      if (!isLand) {
        // ocean: deeper blue near poles
        const depth = 0.5 + (n - 0.3) * 0.6;
        color = mix('#0a3a6e', '#3b78b8', depth);
      } else {
        // land: green/brown, snow at high lat
        const polar = Math.abs(lat) > 1.0;
        if (polar) color = mix('#e8eef2', '#a8b4c0', n);
        else color = mix('#3a6b2e', '#a08a4a', (n - 0.52) * 3);
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // ice caps
  ctx.fillStyle = 'rgba(240,245,250,0.85)';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillRect(0, H - 18, W, 18);
  return texFromCanvas(c);
}

// === Gas giant bands (Jupiter, Saturn)
export function makeGasGiantTexture(baseColor, bandColor, bandColor2) {
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    const lat = y / H;
    // banding via sin
    const band = (Math.sin(lat * Math.PI * 12) + 1) * 0.5;
    const turbulence = fbm(0.5, lat * 12, 4);
    const t = Math.min(1, Math.max(0, band * 0.7 + turbulence * 0.3));
    const baseRow = mix(baseColor, bandColor, t);
    for (let x = 0; x < W; x++) {
      // horizontal turbulence per pixel
      const stir = fbm(x * 0.01, y * 0.04, 4);
      ctx.fillStyle = mix(baseRow, bandColor2, stir * 0.4);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return texFromCanvas(c);
}

// === Ice giant smooth (Uranus, Neptune)
export function makeIceGiantTexture(baseColor, hiColor) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.012, y * 0.025, 4);
      ctx.fillStyle = mix(baseColor, hiColor, n * 0.55);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return texFromCanvas(c);
}

// === Venus thick clouds
export function makeVenusTexture() {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x * 0.02, y * 0.04, 5);
      ctx.fillStyle = mix('#c9a560', '#f4e2a4', n);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return texFromCanvas(c);
}

// === Saturn ring texture (radial stripes)
export function makeRingTexture() {
  const W = 1024, H = 64;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  // gradient base: brighter middle
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const n = fbm(u * 12, 0.5, 4);
    // gap (Cassini division) around u=0.65
    const cassini = Math.exp(-Math.pow((u - 0.65) / 0.02, 2)) * 0.85;
    const alpha = (0.55 + n * 0.4) * (1 - cassini);
    const tone = 0.7 + n * 0.3;
    const r = 220 * tone, g = 200 * tone, b = 160 * tone;
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// === Moon
export function makeMoonTexture() {
  return makeRockyTexture('#9a9a98', '#5a5a58', 0.5);
}

// === Per-planet dispatch
export function makePlanetTexture(name) {
  switch (name) {
    case 'Mercury': return makeRockyTexture('#8c7853', '#3a2e22', 0.5);
    case 'Venus':   return makeVenusTexture();
    case 'Earth':   return makeEarthTexture();
    case 'Mars':    return makeRockyTexture('#c1440e', '#5a1a04', 0.4);
    case 'Jupiter': return makeGasGiantTexture('#d8ca9d', '#a07b4a', '#e8d8a8');
    case 'Saturn':  return makeGasGiantTexture('#e3d8a8', '#a08858', '#f0e8c0');
    case 'Uranus':  return makeIceGiantTexture('#9ad3d6', '#c8eef0');
    case 'Neptune': return makeIceGiantTexture('#3b67c4', '#7da8e0');
    default:        return makeRockyTexture('#888', '#333');
  }
}
