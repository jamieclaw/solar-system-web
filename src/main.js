import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import {
  PLANETS, SUN, MOON,
  SUN_VISUAL_R, planetVisualRadius, orbitalRadius,
  moonOrbitRadius, moonVisualRadius,
} from './data.js';
import { makeSunTexture, makePlanetTexture, makeRingTexture, makeMoonTexture } from './textures.js';

// === J2000 epoch reference: Jan 1 2000 12:00 UTC
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;
const HOURS_PER_DAY = 24;

// === Scene setup
const container = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(0, 60, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 8000;

// === Lighting
const sunLight = new THREE.PointLight(0xffffff, 3.0, 0, 0); // no falloff for dramatic look
sunLight.position.set(0, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x222233, 0.35));

// === Sun
const sunTex = makeSunTexture();
const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_VISUAL_R, 64, 64), sunMat);
sunMesh.userData = { name: 'Sun', body: SUN };
scene.add(sunMesh);

// Sun glow (sprite)
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 256;
const gctx = glowCanvas.getContext('2d');
const grad = gctx.createRadialGradient(128, 128, 20, 128, 128, 128);
grad.addColorStop(0, 'rgba(255,220,140,0.9)');
grad.addColorStop(0.4, 'rgba(255,180,80,0.3)');
grad.addColorStop(1, 'rgba(255,140,40,0)');
gctx.fillStyle = grad;
gctx.fillRect(0, 0, 256, 256);
const glowTex = new THREE.CanvasTexture(glowCanvas);
const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
const glow = new THREE.Sprite(glowMat);
glow.scale.set(SUN_VISUAL_R * 4, SUN_VISUAL_R * 4, 1);
sunMesh.add(glow);

// === Build planets
const planetObjects = []; // { data, pivot, mesh, orbitLine, orbitR }

for (const p of PLANETS) {
  const orbitR = orbitalRadius(p);
  const visualR = planetVisualRadius(p);

  // pivot at sun, planet at orbitR
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const tex = makePlanetTexture(p.name);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(visualR, 48, 48), mat);
  mesh.position.set(orbitR, 0, 0);
  // axial tilt: rotate the mesh's local axis
  mesh.rotation.z = THREE.MathUtils.degToRad(p.tilt);
  mesh.userData = { name: p.name, body: p };
  pivot.add(mesh);

  // orbit line
  const orbitGeom = new THREE.BufferGeometry();
  const segs = 256;
  const pts = new Float32Array(segs * 3);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts[i * 3]     = Math.cos(a) * orbitR;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(a) * orbitR;
  }
  orbitGeom.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const orbitMat = new THREE.LineDashedMaterial({
    color: 0x445566, dashSize: 0.5, gapSize: 0.5, transparent: true, opacity: 0.6,
  });
  const orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
  orbitLine.computeLineDistances();
  scene.add(orbitLine);

  // Saturn ring
  let ring = null;
  if (p.name === 'Saturn') {
    const inner = visualR * 1.3;
    const outer = visualR * 2.2;
    const ringGeom = new THREE.RingGeometry(inner, outer, 96, 1);
    // Reorient UVs so the texture maps radially across the ring
    const pos = ringGeom.attributes.position;
    const uv = ringGeom.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      const u = (r - inner) / (outer - inner);
      uv.setXY(i, u, 0.5);
    }
    const ringTex = makeRingTexture();
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false,
    });
    ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = THREE.MathUtils.degToRad(p.tilt);
    mesh.add(ring);
  }

  planetObjects.push({ data: p, pivot, mesh, orbitLine, orbitR, visualR, ring });
}

// === Moon (Earth's)
const earthEntry = planetObjects.find((x) => x.data.name === 'Earth');
const moonPivot = new THREE.Object3D();
earthEntry.mesh.add(moonPivot);
const moonR = moonOrbitRadius(earthEntry.visualR);
const moonVR = moonVisualRadius(earthEntry.visualR);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(moonVR, 32, 32),
  new THREE.MeshStandardMaterial({ map: makeMoonTexture(), roughness: 1.0, metalness: 0 })
);
moonMesh.position.set(moonR, 0, 0);
moonMesh.userData = { name: 'Moon', body: MOON };
moonPivot.add(moonMesh);

// moon orbit line
const moonOrbitGeom = new THREE.BufferGeometry();
const moonSegs = 96;
const moonPts = new Float32Array(moonSegs * 3);
for (let i = 0; i < moonSegs; i++) {
  const a = (i / moonSegs) * Math.PI * 2;
  moonPts[i * 3] = Math.cos(a) * moonR;
  moonPts[i * 3 + 2] = Math.sin(a) * moonR;
}
moonOrbitGeom.setAttribute('position', new THREE.BufferAttribute(moonPts, 3));
const moonOrbitLine = new THREE.LineLoop(
  moonOrbitGeom,
  new THREE.LineBasicMaterial({ color: 0x666677, transparent: true, opacity: 0.4 })
);
moonPivot.add(moonOrbitLine);

// === Starfield (procedural sphere of points)
function makeStarfield(count, radius) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // uniform on sphere
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.7 + Math.random() * 0.3);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    // color: mostly white, occasional warm/cool
    const t = Math.random();
    let cr = 1, cg = 1, cb = 1;
    if (t < 0.15) { cr = 1.0; cg = 0.7; cb = 0.5; }       // red giants
    else if (t < 0.25) { cr = 0.6; cg = 0.7; cb = 1.0; }  // blue
    const intensity = 0.4 + Math.random() * 0.6;
    colors[i * 3] = cr * intensity;
    colors[i * 3 + 1] = cg * intensity;
    colors[i * 3 + 2] = cb * intensity;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.4, vertexColors: true, sizeAttenuation: false,
    transparent: true, opacity: 0.95, depthWrite: false,
  });
  return new THREE.Points(geom, mat);
}

scene.add(makeStarfield(8000, 12000));

// === Stardust (closer, slowly drifting particles)
function makeStardust(count, range) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * range;
    positions[i * 3 + 1] = (Math.random() - 0.5) * range * 0.3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * range;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xaabbcc, size: 0.35, sizeAttenuation: true,
    transparent: true, opacity: 0.45, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geom, mat);
}
const stardust = makeStardust(2500, 800);
scene.add(stardust);

// === Asteroid Belt (Mars–Jupiter, 2.2–3.3 AU)
// Hybrid: ~250 small mesh chunks (3D, rotate, hover-pickable) + 1800 particles for dust feel.
// Uses same auReal^0.6 mapping as planets: 2.2 AU → ~47, 3.3 AU → ~62 scene units.
const ASTEROID_INNER_AU = 2.2;
const ASTEROID_OUTER_AU = 3.3;
const ASTEROID_INNER_R = 30 * Math.pow(ASTEROID_INNER_AU, 0.6);
const ASTEROID_OUTER_R = 30 * Math.pow(ASTEROID_OUTER_AU, 0.6);

function makeAsteroidBelt() {
  const group = new THREE.Group();

  // Mesh chunks: shared geometry instanced via individual meshes (small N, fine).
  // Use a single rough geometry tweaked per-instance via scale.
  const rockGeom = new THREE.IcosahedronGeometry(0.35, 0);
  // perturb vertices once for non-spherical look
  const pos = rockGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const j = (Math.sin(i * 13.13) + 1) * 0.5; // deterministic 0-1
    pos.setXYZ(i, x * (0.7 + j * 0.5), y * (0.7 + j * 0.5), z * (0.7 + j * 0.5));
  }
  rockGeom.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 1.0, metalness: 0.0 });

  const N_MESHES = 250;
  // store animation data per chunk: { angle0, radius, period, mesh, spinAxis, spinSpeed }
  const chunks = [];
  for (let i = 0; i < N_MESHES; i++) {
    const r = ASTEROID_INNER_R + Math.random() * (ASTEROID_OUTER_R - ASTEROID_INNER_R);
    const angle0 = Math.random() * Math.PI * 2;
    const yJitter = (Math.random() - 0.5) * 1.6; // slight inclination
    const scale = 0.4 + Math.random() * 1.2;
    const m = new THREE.Mesh(rockGeom, rockMat);
    m.scale.setScalar(scale);
    m.userData = { name: 'Asteroid', body: { radiusKm: Math.round(scale * 50) + Math.floor(Math.random() * 100) } };
    chunks.push({
      mesh: m,
      angle0,
      radius: r,
      yJitter,
      // orbital period ~ Kepler: T ∝ r^1.5; reuse Earth=365 at r(1AU)=30 → period(days) = 365 * (au)^1.5
      // we have r, derive au back: au = (r/30)^(1/0.6)
      periodDays: 365.256 * Math.pow(Math.pow(r / 30, 1 / 0.6), 1.5),
      spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spinSpeed: (Math.random() * 2 - 1) * 0.5, // rad/sec at sim time? we'll scale per frame
    });
    group.add(m);
  }

  // Particle dust: 1800 points scattered in the same ring, with own slow orbit.
  const N_DUST = 1800;
  const dustGeom = new THREE.BufferGeometry();
  const dustPos = new Float32Array(N_DUST * 3);
  const dustData = new Float32Array(N_DUST * 3); // [angle0, radius, yJitter]
  for (let i = 0; i < N_DUST; i++) {
    const r = ASTEROID_INNER_R + Math.random() * (ASTEROID_OUTER_R - ASTEROID_INNER_R);
    const a = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 2.0;
    dustData[i * 3] = a;
    dustData[i * 3 + 1] = r;
    dustData[i * 3 + 2] = y;
    dustPos[i * 3]     = Math.cos(a) * r;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x9a8870, size: 0.45, sizeAttenuation: true,
    transparent: true, opacity: 0.65, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeom, dustMat);
  group.add(dust);

  return { group, chunks, dust, dustData };
}
const asteroidBelt = makeAsteroidBelt();
scene.add(asteroidBelt.group);

// === Kuiper Belt (beyond Neptune, ~30–50 AU)
// Pure particles — too distant for individual meshes to matter visually.
const KUIPER_INNER_AU = 30;
const KUIPER_OUTER_AU = 50;
const KUIPER_INNER_R = 30 * Math.pow(KUIPER_INNER_AU, 0.6);
const KUIPER_OUTER_R = 30 * Math.pow(KUIPER_OUTER_AU, 0.6);

function makeKuiperBelt() {
  const N = 5000;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const data = new Float32Array(N * 3); // [angle0, radius, yJitter]
  const colors = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = KUIPER_INNER_R + Math.random() * (KUIPER_OUTER_R - KUIPER_INNER_R);
    const a = Math.random() * Math.PI * 2;
    // Kuiper belt has more vertical scatter than asteroid belt
    const y = (Math.random() - 0.5) * 8.0;
    data[i * 3] = a;
    data[i * 3 + 1] = r;
    data[i * 3 + 2] = y;
    pos[i * 3]     = Math.cos(a) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r;
    // icy bluish-white tint, varying brightness
    const b = 0.5 + Math.random() * 0.5;
    colors[i * 3]     = b * 0.85;
    colors[i * 3 + 1] = b * 0.92;
    colors[i * 3 + 2] = b * 1.0;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.6, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.7, depthWrite: false,
  });
  const points = new THREE.Points(geom, mat);
  return { points, data, count: N };
}
const kuiperBelt = makeKuiperBelt();
scene.add(kuiperBelt.points);

// === Meteor streaks (random shooting stars in the background)
// Each meteor: a fading line/trail traveling across distant space.
// Avg interval 5-8s, lifetime ~1-1.5s, spawned at random direction far from origin.
const METEOR_POOL_SIZE = 6;
const METEOR_TRAIL_SEGMENTS = 16;

function makeMeteor() {
  const positions = new Float32Array(METEOR_TRAIL_SEGMENTS * 3);
  const colors = new Float32Array(METEOR_TRAIL_SEGMENTS * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.Line(geom, mat);
  line.visible = false;
  return {
    line,
    positions,
    colors,
    active: false,
    age: 0,
    lifetime: 1.0,
    start: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
  };
}
const meteors = [];
for (let i = 0; i < METEOR_POOL_SIZE; i++) {
  const m = makeMeteor();
  meteors.push(m);
  scene.add(m.line);
}
let nextMeteorAt = performance.now() + 2000 + Math.random() * 4000;

function spawnMeteor() {
  const m = meteors.find((x) => !x.active);
  if (!m) return;
  // Spawn closer to camera so they're visually obvious.
  // Camera defaults to z~120, system extends to ~315 (Kuiper outer); we want
  // meteors visible against starfield but close enough to see length.
  const radius = 180 + Math.random() * 220;  // 180-400
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  m.start.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta) * 0.6, // squashed vertically
    radius * Math.cos(phi)
  );
  // velocity: random direction, magnitude ~80-160 units/sec (slower than before
  // since they're closer; same visual angular speed)
  const speed = 80 + Math.random() * 80;
  m.velocity.set(
    (Math.random() - 0.5),
    (Math.random() - 0.5) * 0.3,
    (Math.random() - 0.5)
  ).normalize().multiplyScalar(speed);
  m.lifetime = 1.0 + Math.random() * 0.8;
  m.age = 0;
  m.active = true;
  m.line.visible = true;
  // pick a tint
  const warm = Math.random() < 0.5;
  m.tintR = warm ? 1.0 : 0.85;
  m.tintG = warm ? 0.85 : 0.95;
  m.tintB = warm ? 0.6  : 1.0;
}

function updateMeteors(dtRealSec, nowMs) {
  // spawn schedule
  if (nowMs >= nextMeteorAt) {
    spawnMeteor();
    nextMeteorAt = nowMs + 1500 + Math.random() * 4500; // 1.5-6s next
  }
  for (const m of meteors) {
    if (!m.active) continue;
    m.age += dtRealSec;
    if (m.age >= m.lifetime) {
      m.active = false;
      m.line.visible = false;
      continue;
    }
    // Compute trail: head is current position, tail trails behind along -velocity
    const headT = m.age;
    const head = new THREE.Vector3().copy(m.start).addScaledVector(m.velocity, headT);
    const tailLength = 0.6; // seconds of travel behind head — longer = more visible streak
    const fadeFactor = 1 - (m.age / m.lifetime); // 1 → 0 over lifetime
    // Brightness boost: meteor heads should be punchy on first sight, then fade.
    const headBoost = Math.min(1.0, m.age * 6); // ramp in over 0.16s
    for (let i = 0; i < METEOR_TRAIL_SEGMENTS; i++) {
      const u = i / (METEOR_TRAIL_SEGMENTS - 1); // 0=tail, 1=head
      const tBack = (1 - u) * tailLength;
      const p = new THREE.Vector3().copy(head).addScaledVector(m.velocity, -tBack);
      m.positions[i * 3]     = p.x;
      m.positions[i * 3 + 1] = p.y;
      m.positions[i * 3 + 2] = p.z;
      // Sharper falloff: u^2 keeps the head bright while making the tail fade fast.
      const a = u * u * fadeFactor * headBoost * 1.6;
      m.colors[i * 3]     = m.tintR * a;
      m.colors[i * 3 + 1] = m.tintG * a;
      m.colors[i * 3 + 2] = m.tintB * a;
    }
    m.line.geometry.attributes.position.needsUpdate = true;
    m.line.geometry.attributes.color.needsUpdate = true;
  }
}

// === Update belts each frame: rotate based on simTimeMs (Keplerian period)
function updateBelts(daysSinceJ2000, dtRealSec) {
  // Asteroid mesh chunks
  for (const c of asteroidBelt.chunks) {
    const angle = c.angle0 + (daysSinceJ2000 / c.periodDays) * Math.PI * 2;
    c.mesh.position.set(Math.cos(angle) * c.radius, c.yJitter, Math.sin(angle) * c.radius);
    // self-spin (cosmetic, frame-rate based, not sim-time based to avoid going dizzy at high time-scale)
    c.mesh.rotateOnAxis(c.spinAxis, c.spinSpeed * dtRealSec);
  }
  // Asteroid dust particles
  const dPos = asteroidBelt.dust.geometry.attributes.position.array;
  const dData = asteroidBelt.dustData;
  for (let i = 0; i < dData.length / 3; i++) {
    const r = dData[i * 3 + 1];
    const a0 = dData[i * 3];
    const y = dData[i * 3 + 2];
    // approx Kepler period for this radius
    const au = Math.pow(r / 30, 1 / 0.6);
    const period = 365.256 * Math.pow(au, 1.5);
    const a = a0 + (daysSinceJ2000 / period) * Math.PI * 2;
    dPos[i * 3]     = Math.cos(a) * r;
    dPos[i * 3 + 1] = y;
    dPos[i * 3 + 2] = Math.sin(a) * r;
  }
  asteroidBelt.dust.geometry.attributes.position.needsUpdate = true;

  // Kuiper belt particles (very slow — periods 165yr-350yr)
  const kPos = kuiperBelt.points.geometry.attributes.position.array;
  const kData = kuiperBelt.data;
  for (let i = 0; i < kuiperBelt.count; i++) {
    const r = kData[i * 3 + 1];
    const a0 = kData[i * 3];
    const y = kData[i * 3 + 2];
    const au = Math.pow(r / 30, 1 / 0.6);
    const period = 365.256 * Math.pow(au, 1.5);
    const a = a0 + (daysSinceJ2000 / period) * Math.PI * 2;
    kPos[i * 3]     = Math.cos(a) * r;
    kPos[i * 3 + 1] = y;
    kPos[i * 3 + 2] = Math.sin(a) * r;
  }
  kuiperBelt.points.geometry.attributes.position.needsUpdate = true;
}

// === Simulation state
const simState = {
  // current simulated date as ms since epoch
  simTimeMs: Date.now(),
  // time scale: simulated seconds per real second
  // default: 1 real sec = 1 simulated day
  timeScale: 86400, // sec/sec → 1 day per real second
  paused: false,
  showOrbits: true,
};

// === GUI
const gui = new GUI({ title: 'Solar System' });
gui.domElement.style.zIndex = '60';

// Date input as a string (yyyy-mm-dd)
const dateProxy = {
  date: new Date(simState.simTimeMs).toISOString().slice(0, 10),
  setToNow: () => {
    simState.simTimeMs = Date.now();
    dateProxy.date = new Date(simState.simTimeMs).toISOString().slice(0, 10);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  },
  setToJ2000: () => {
    simState.simTimeMs = J2000_MS;
    dateProxy.date = new Date(simState.simTimeMs).toISOString().slice(0, 10);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  },
};

const fTime = gui.addFolder('Time');
fTime.add(dateProxy, 'date').name('Date (YYYY-MM-DD)').onFinishChange((v) => {
  const t = Date.parse(v + 'T12:00:00Z');
  if (!Number.isNaN(t)) simState.simTimeMs = t;
});
// time-scale slider — log scale via string presets
const timeScalePresets = {
  '1 sec / sec':       1,
  '1 min / sec':       60,
  '1 hour / sec':      3600,
  '1 day / sec':       86400,
  '1 week / sec':      86400 * 7,
  '1 month / sec':     86400 * 30,
  '6 months / sec':    86400 * 180,
  '1 year / sec':      86400 * 365,
  '5 years / sec':     86400 * 365 * 5,
};
const tsProxy = { speed: '1 day / sec' };
fTime.add(tsProxy, 'speed', Object.keys(timeScalePresets)).name('Time scale').onChange((k) => {
  simState.timeScale = timeScalePresets[k];
});
fTime.add(simState, 'paused').name('Pause');
fTime.add(dateProxy, 'setToNow').name('▶ Set to now');
fTime.add(dateProxy, 'setToJ2000').name('▶ Set to J2000');
fTime.open();

const fView = gui.addFolder('View');
fView.add(simState, 'showOrbits').name('Show orbits').onChange((v) => {
  for (const po of planetObjects) po.orbitLine.visible = v;
  moonOrbitLine.visible = v;
});
const focusProxy = { focus: 'Sun' };
const focusOptions = ['Sun', ...PLANETS.map((p) => p.name), 'Moon'];
fView.add(focusProxy, 'focus', focusOptions).name('Focus').onChange((name) => {
  focusOn(name);
});
fView.open();

function focusOn(name) {
  let target = sunMesh;
  if (name === 'Moon') target = moonMesh;
  else {
    const found = planetObjects.find((p) => p.data.name === name);
    if (found) target = found.mesh;
  }
  // use world position
  const wp = new THREE.Vector3();
  target.getWorldPosition(wp);
  controls.target.copy(wp);
  // position camera at a sensible offset based on target size
  const r = target.geometry?.parameters?.radius ?? SUN_VISUAL_R;
  const dist = Math.max(r * 8, 20);
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  if (dir.lengthSq() < 0.001) dir.set(0, 0.4, 1).normalize();
  camera.position.copy(wp).addScaledVector(dir, dist);
  controls.update();
}

// === Update orbital + rotational state from current simTimeMs
function updateBodies() {
  const tMs = simState.simTimeMs;
  const daysSinceJ2000 = (tMs - J2000_MS) / MS_PER_DAY;

  // planets: angle = 2π * (days / period). At J2000, set planets along +X (zero phase).
  // Real phases at J2000 are different but user explicitly chose "簡化".
  for (const po of planetObjects) {
    const orbitalAngle = (daysSinceJ2000 / po.data.periodDays) * Math.PI * 2;
    po.pivot.rotation.y = orbitalAngle;

    // axial rotation: hours since J2000 / rotation period
    const hoursSinceJ2000 = daysSinceJ2000 * HOURS_PER_DAY;
    const rotAngle = (hoursSinceJ2000 / po.data.rotHours) * Math.PI * 2;
    // apply rotation around the body's local axis (already tilted on z)
    po.mesh.rotation.y = rotAngle;
  }

  // Moon: orbit Earth (centered on Earth pivot frame)
  const moonOrbitalAngle = (daysSinceJ2000 / MOON.periodDays) * Math.PI * 2;
  moonPivot.rotation.y = moonOrbitalAngle;
  const moonRotAngle = (daysSinceJ2000 * HOURS_PER_DAY / MOON.rotHours) * Math.PI * 2;
  moonMesh.rotation.y = moonRotAngle;

  // Sun rotation (visual only)
  const sunRotAngle = (daysSinceJ2000 * HOURS_PER_DAY / SUN.rotHours) * Math.PI * 2;
  sunMesh.rotation.y = sunRotAngle;
}

// === Raycaster tooltip
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltipEl = document.getElementById('tooltip');
let pickables = [];
function rebuildPickables() {
  pickables = [
    sunMesh,
    moonMesh,
    ...planetObjects.map((p) => p.mesh),
    ...asteroidBelt.chunks.map((c) => c.mesh),
  ];
}
rebuildPickables();

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  tooltipEl.style.left = e.clientX + 'px';
  tooltipEl.style.top = e.clientY + 'px';
});

function checkHover() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    const obj = hits[0].object;
    const ud = obj.userData;
    let html = `<div class="name">${ud.name}</div>`;
    const b = ud.body;
    if (b) {
      if (b.radiusKm) html += `<div class="row">Radius: ${b.radiusKm.toLocaleString()} km</div>`;
      if (b.periodDays) html += `<div class="row">Year: ${b.periodDays.toFixed(1)} days</div>`;
      if (b.rotHours) html += `<div class="row">Day: ${Math.abs(b.rotHours).toFixed(2)} h${b.rotHours < 0 ? ' (retrograde)' : ''}</div>`;
      if (b.auReal) html += `<div class="row">Distance: ${b.auReal.toFixed(2)} AU</div>`;
      if (b.tilt !== undefined) html += `<div class="row">Tilt: ${b.tilt.toFixed(1)}°</div>`;
    }
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add('show');
  } else {
    tooltipEl.classList.remove('show');
  }
}

// === Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Animation loop
let lastT = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dtRealSec = Math.min(0.1, (now - lastT) / 1000); // clamp
  lastT = now;

  if (!simState.paused) {
    simState.simTimeMs += dtRealSec * simState.timeScale * 1000;
    // keep date display roughly synced
    const newDate = new Date(simState.simTimeMs).toISOString().slice(0, 10);
    if (newDate !== dateProxy.date) {
      dateProxy.date = newDate;
      // update GUI date controller without firing onChange
      gui.controllersRecursive().forEach((c) => {
        if (c.property === 'date') c.updateDisplay();
      });
    }
  }

  updateBodies();

  // Belts (asteroid + Kuiper) orbit using same simTime
  const daysSinceJ2000Anim = (simState.simTimeMs - J2000_MS) / MS_PER_DAY;
  updateBelts(daysSinceJ2000Anim, dtRealSec);

  // Meteors (real-time, not sim-time)
  updateMeteors(dtRealSec, now);

  // stardust slow rotation
  stardust.rotation.y += dtRealSec * 0.005;

  // hover
  checkHover();

  controls.update();
  renderer.render(scene, camera);
}

// initial body update so first frame is correct
updateBodies();
// hide loading
document.getElementById('loading').classList.add('hidden');

// Debug hook — exposes meteor state for live inspection
window.__solarDebug = { meteors, scene, camera, renderer, simState };

animate();
