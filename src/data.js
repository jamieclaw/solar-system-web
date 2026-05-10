// Planet data — orbital periods (Earth days), rotation periods (hours),
// mean orbital radii (AU, real), axial tilt (degrees), and visual size factors
// for "教學比例" (didactic) display: distances compressed log-ish, sizes inflated.

export const PLANETS = [
  // name, color, real radius (km), real orbital radius (AU), orbital period (Earth days),
  // rotation period (hours, sidereal, can be negative for retrograde), axial tilt (deg)
  { name: 'Mercury', color: '#8c7853', radiusKm: 2440,   auReal: 0.387, periodDays: 87.969,    rotHours: 1407.6,  tilt: 0.034 },
  { name: 'Venus',   color: '#e6c97b', radiusKm: 6052,   auReal: 0.723, periodDays: 224.701,   rotHours: -5832.5, tilt: 177.4 },
  { name: 'Earth',   color: '#4f7fbf', radiusKm: 6371,   auReal: 1.000, periodDays: 365.256,   rotHours: 23.934,  tilt: 23.44 },
  { name: 'Mars',    color: '#c1440e', radiusKm: 3390,   auReal: 1.524, periodDays: 686.971,   rotHours: 24.623,  tilt: 25.19 },
  { name: 'Jupiter', color: '#d8ca9d', radiusKm: 69911,  auReal: 5.203, periodDays: 4332.59,   rotHours: 9.925,   tilt: 3.13  },
  { name: 'Saturn',  color: '#e3d8a8', radiusKm: 58232,  auReal: 9.537, periodDays: 10759.22,  rotHours: 10.656,  tilt: 26.73 },
  { name: 'Uranus',  color: '#9ad3d6', radiusKm: 25362,  auReal: 19.19, periodDays: 30688.5,   rotHours: -17.24,  tilt: 97.77 },
  { name: 'Neptune', color: '#3b67c4', radiusKm: 24622,  auReal: 30.07, periodDays: 60182,     rotHours: 16.11,   tilt: 28.32 },
];

// Sun
export const SUN = {
  name: 'Sun',
  color: '#fdb813',
  radiusKm: 696340,
  rotHours: 609.12, // ~25.38 days at equator
};

// Earth's Moon
export const MOON = {
  name: 'Moon',
  color: '#bbbbbb',
  radiusKm: 1737,
  // distance from Earth (km, real avg): 384400. We'll inflate visually.
  distanceKm: 384400,
  periodDays: 27.321661,
  rotHours: 655.72, // tidally locked
  tilt: 6.68,
};

// === Visual scaling for didactic mode ===
// Real Sun radius (km) -> 1 unit. Then planets scaled with a power curve so
// rocky planets remain visible while gas giants don't dwarf the scene.
const SUN_R_KM = SUN.radiusKm;

// Sun visual radius in scene units
export const SUN_VISUAL_R = 5.0;

// Planet sizes: use square root of true ratio, then a per-class multiplier
// so all planets visible when zoomed to system scale.
export function planetVisualRadius(p) {
  const ratio = p.radiusKm / SUN_R_KM;        // 0.0035 (Mercury) - 0.10 (Jupiter)
  const base = Math.sqrt(ratio) * SUN_VISUAL_R; // sqrt smooths
  // boost rocky inner planets so they aren't pinpricks
  const boost = p.radiusKm < 10000 ? 2.4 : 1.5;
  return base * boost;
}

// Orbital radii: 1 AU -> ORBIT_AU_UNIT scene units, but compressed for outer planets
// using a mild log-ish remap so Neptune isn't 30x further than Earth visually.
const ORBIT_AU_UNIT = 30; // Earth orbit at 30 units
export function orbitalRadius(p) {
  // remap: r = base * au^0.6  (compresses outer system ~3x)
  return ORBIT_AU_UNIT * Math.pow(p.auReal, 0.6);
}

// Moon visual: distance from Earth, inflated
export function moonOrbitRadius(earthVisualR) {
  return earthVisualR * 4.0; // not realistic but visible
}
export function moonVisualRadius(earthVisualR) {
  return earthVisualR * 0.27; // real ratio
}
