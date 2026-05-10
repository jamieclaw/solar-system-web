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
  pickables = [sunMesh, moonMesh, ...planetObjects.map((p) => p.mesh)];
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
animate();
