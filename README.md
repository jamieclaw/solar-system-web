# solar-system-web

Three.js solar system simulation, deployed at https://jamieclaw.github.io/solar-system-web/

## Features

- 8 planets + Sun + Earth's Moon + Saturn rings, all with procedurally-generated textures
- Real orbital periods and rotation periods (didactic distance/size scaling for visibility)
- Free pan / zoom / rotate via OrbitControls
- Starfield (8000 stars) + drifting stardust particles
- Control panel (lil-gui):
  - Date input (YYYY-MM-DD) — anchored at J2000 epoch
  - Time scale: 1 sec/sec → 5 years/sec
  - Pause
  - Toggle orbit lines
  - Focus on any body (camera jumps + zooms appropriately)
- Hover any body for radius / year length / day length / distance / axial tilt

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`. CI builds and deploys via `.github/workflows/deploy.yml`.

## Stack

- Vite (build tool)
- Three.js (3D engine)
- lil-gui (control panel)

No external assets — all planet/star textures are generated at runtime via canvas.
