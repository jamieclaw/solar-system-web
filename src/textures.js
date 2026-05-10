// Texture loading + procedural fallbacks.
//
// Real 2K WebP maps from Solar System Scope (CC-BY-4.0) live in /public/textures/.
// We load them async via a shared LoadingManager so a progress bar can track
// completion. While a real texture is loading the meshes show a 1×1 procedural
// placeholder colour so first frame isn't ugly.

import * as THREE from 'three';

// --------------------------------------------------------------------------
// Procedural helpers (kept for fallbacks: asteroids, debug, low-quality mode)
// --------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function noise2D(x, y) {
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

function texFromCanvas(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 1×1 solid colour texture used as placeholder while real map loads
function solidColorTexture(hex) {
  const c = makeCanvas(1, 1);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 1, 1);
  return texFromCanvas(c);
}

// --------------------------------------------------------------------------
// Real texture loading
// --------------------------------------------------------------------------

// Vite resolves base path automatically; in production the prefix is
// /solar-system-web/textures/, in dev it's /textures/.
function texUrl(name) {
  return `${import.meta.env.BASE_URL}textures/${name}`;
}

// Single shared loading manager so a UI progress bar can subscribe.
export const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

/**
 * Load a real WebP texture. Returns the THREE.Texture immediately (it will
 * be empty until the file finishes loading) plus a promise that resolves
 * to the same texture once loaded. This lets us assign the texture to a
 * material right away, then have it light up when the bytes arrive.
 *
 * @param {string} filename — file in /public/textures/
 * @param {object} opts — { linear: bool (NoColorSpace, for data maps), srgb: bool }
 */
export function loadRealTexture(filename, opts = {}) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      texUrl(filename),
      (tex) => {
        tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        if (opts.flipY === false) tex.flipY = false;
        if (opts.wrapS) tex.wrapS = opts.wrapS;
        if (opts.wrapT) tex.wrapT = opts.wrapT;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

/**
 * Load all bodies' textures in parallel. Returns { textures, promise }.
 * - textures: object keyed by body name with placeholder THREE.Texture instances
 *   that get .image set + needsUpdate=true once the real WebP arrives.
 * - promise: resolves once every texture is loaded (or fails).
 */
export async function loadAllRealTextures() {
  const targets = {
    sunMap:        { file: '2k_sun.webp' },
    mercuryMap:    { file: '2k_mercury.webp' },
    venusMap:      { file: '2k_venus_atmosphere.webp' },
    earthDayMap:   { file: '2k_earth_daymap.webp' },
    earthNightMap: { file: '2k_earth_nightmap.webp' },
    earthCloudsMap:{ file: '2k_earth_clouds.webp' },
    earthSpecMap:  { file: '2k_earth_specular.webp', linear: true },
    marsMap:       { file: '2k_mars.webp' },
    jupiterMap:    { file: '2k_jupiter.webp' },
    saturnMap:     { file: '2k_saturn.webp' },
    saturnRingMap: { file: '2k_saturn_ring_alpha.webp' },
    uranusMap:     { file: '2k_uranus.webp' },
    neptuneMap:    { file: '2k_neptune.webp' },
    moonMap:       { file: '2k_moon.webp' },
  };

  const out = {};
  const promises = [];
  for (const [key, cfg] of Object.entries(targets)) {
    const p = loadRealTexture(cfg.file, { linear: cfg.linear });
    promises.push(p);
    p.then((tex) => { out[key] = tex; }).catch((e) => {
      console.warn(`Failed to load ${cfg.file}:`, e);
      out[key] = null;
    });
  }
  await Promise.allSettled(promises);
  return out;
}

// --------------------------------------------------------------------------
// Procedural fallbacks (kept for asteroid belt + emergency)
// --------------------------------------------------------------------------

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

export function makeRockyTexture(baseColor, accentColor, contrast = 0.4) {
  const W = 256, H = 128;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);
  return texFromCanvas(c);
}

export function makeMoonTexture() {
  return makeRockyTexture('#9a9a98', '#5a5a58', 0.5);
}

export function makeRingTexture() {
  const W = 1024, H = 64;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const n = fbm(u * 12, 0.5, 4);
    const cassini = Math.exp(-Math.pow((u - 0.65) / 0.02, 2)) * 0.85;
    const alpha = (0.55 + n * 0.4) * (1 - cassini);
    const tone = 0.7 + n * 0.3;
    const r = 220 * tone, g = 200 * tone, b = 160 * tone;
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, H);
  }
  return texFromCanvas(c);
}

// Placeholder dispatch — main.js no longer uses these for real bodies, but
// kept for asteroid/meteor fallback paths.
export function makePlanetTexture(name) {
  switch (name) {
    case 'Mercury': return solidColorTexture('#8c7853');
    case 'Venus':   return solidColorTexture('#c9a560');
    case 'Earth':   return solidColorTexture('#1f5b9a');
    case 'Mars':    return solidColorTexture('#c1440e');
    case 'Jupiter': return solidColorTexture('#d8ca9d');
    case 'Saturn':  return solidColorTexture('#e3d8a8');
    case 'Uranus':  return solidColorTexture('#9ad3d6');
    case 'Neptune': return solidColorTexture('#3b67c4');
    default:        return solidColorTexture('#888');
  }
}
