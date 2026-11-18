// Solmar city layout: a street grid, beach + pier on the south edge, suburbs
// north, a highway ring, and the named places missions point at.
// Coordinates are world pixels. Streets run every 400 px; blocks hold buildings.
import { makeRng, range, intRange, pick } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const BEACH_Y = 1980;   // sand starts here
export const WATER_Y = 2220;   // sea starts here
export const STREET = 400;     // grid spacing
export const ROAD_W = 92;      // road width (incl. sidewalks)

const PALETTES = [
  ['#c96a3b', '#d98a4a', '#b5543a'], // brick / terracotta downtown
  ['#7d8ba3', '#5d6f8c', '#94a3b8'], // glass towers
  ['#e0c184', '#d4a95e', '#c98f4e'], // stucco suburbs
  ['#8a6f5c', '#a08a76', '#6f5a48'], // old town
];

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Named places (mission targets). Garage is Rosa's, west side.
  const places = {
    garage:     { x: 430,  y: 430,  label: "Rosa's Garage" },
    safehouse:  { x: 2760, y: 360,  label: 'Safehouse' },
    courierHub: { x: 2760, y: 1560, label: 'Courier Depot' },
    pier:       { x: 1600, y: 2080, label: 'Solmar Pier' },
    docks:      { x: 2900, y: 1900, label: 'East Docks' },
    beach:      { x: 900,  y: 2120, label: 'Solmar Beach' },
    plaza:      { x: 1600, y: 1200, label: 'Plaza del Sol' },
  };

  // Buildings fill each block between streets, skipping the plaza block,
  // the garage block, and anything south of the beach line.
  const keepOut = [
    { x: 200, y: 200, w: 560, h: 560 },   // garage block
    { x: 1400, y: 1000, w: 400, h: 400 }, // plaza block
    { x: 2560, y: 160, w: 480, h: 480 },  // safehouse block
    { x: 2700, y: 1700, w: 400, h: 260 }, // docks block
  ];
  const inside = (x, y, w, h, r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;

  for (let gx = 0; gx < 8; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      // Block interior starts past the road (ROAD_W) plus a sidewalk gap,
      // so buildings never intrude into the drivable road bands.
      const bx = gx * STREET + ROAD_W + 18;
      const by = gy * STREET + ROAD_W + 18;
      if (by + 260 > BEACH_Y) continue;
      const palette = pick(rng, PALETTES);
      const n = intRange(rng, 1, 2);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 110, 190);
        const h = range(rng, 110, 190);
        const x = bx + (k === 0 ? 0 : 276 - w - 18);
        const y = by + (k === 0 ? 0 : 276 - h - 18);
        if (keepOut.some((r) => inside(x, y, w, h, r))) continue;
        const downtown = gx >= 2 && gx <= 5 && gy <= 2;
        buildings.push({
          x, y, w, h,
          color: pick(rng, palette),
          roof: pick(rng, ['#3d4450', '#4a3f35', '#2f3a44', '#5a5148']),
          tall: downtown ? range(rng, 1.6, 2.6) : range(rng, 0.8, 1.3),
          windows: intRange(rng, 2, 4),
        });
      }
      // A couple of palms / trees per block, off the roads.
      for (let t = 0; t < 2; t++) {
        trees.push({ x: bx + range(rng, 0, 250), y: by + range(rng, 0, 250), palm: rng() < 0.6 });
      }
    }
  }
  // Street lamps along every vertical street, every 400 px.
  for (let gx = 0; gx <= 8; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      lamps.push({ x: gx * STREET + ROAD_W / 2 + 6, y: gy * STREET + 200 });
    }
  }

  // Solid named structures (drawn specially in render.js, but they must
  // block movement just like any other building).
  const solids = [
    { x: 320, y: 340, w: 220, h: 150 },   // Rosa's Garage
    { x: 2700, y: 310, w: 120, h: 100 },  // Safehouse
    { x: 2810, y: 1860, w: 180, h: 90 },  // East Docks
    { x: 2690, y: 1510, w: 140, h: 100 }, // Courier Depot
  ];

  return { buildings, solids, trees, lamps, places, rng };
}

// Is a point on a road (drivable)? Roads are the grid bands + highway ring.
export function onRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return false;
  const near = (v, step) => {
    const m = ((v % step) + step) % step;
    return m < ROAD_W || m > step - 6;
  };
  if (near(x, STREET) || near(y, STREET)) return true;
  // Highway ring hugging the map edge.
  if (x < 60 || x > WORLD_W - 60 || y < 60 || y > WORLD_H - 60) return true;
  return false;
}

// Circle (x,y,r) vs building rects and solid structures: push the circle
// out, return true if hit.
export function collideBuildings(world, x, y, r) {
  let hit = false;
  const solids = world.solids ? world.buildings.concat(world.solids) : world.buildings;
  for (const b of solids) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push; y += dy * push;
      } else {
        y = b.y - r;
      }
    }
  }
  return { x, y, hit };
}

// Nearest point on the road grid to (x,y) — used to snap traffic spawns.
export function snapToRoad(x, y) {
  const snap = (v) => Math.round(v / STREET) * STREET + ROAD_W / 2;
  const dx = Math.abs(x - snap(x));
  const dy = Math.abs(y - snap(y));
  if (dx < dy) return { x: snap(x), y };
  return { x, y: snap(y) };
}
