// city.js — Solmar City: procedural grid, beach, pier, districts, collision.
// The city is a 2400x2400 island. Roads run on a 300px grid (64px wide);
// every building sits inside its block with an 18px margin clear of the
// road bands, so traffic never scrapes a wall. Named story buildings are
// placed by hand and are solid, like every other building.
import { makeRng, clamp } from './rng.js';

export const WORLD = 2400;
export const ROAD_W = 64;
export const ROAD_HALF = ROAD_W / 2;
export const ROADS = [300, 600, 900, 1200, 1500, 1800, 2100];
export const BEACH_Y = 2200;
export const WATER_Y = 2330;

// Story locations. Each has a building rect (solid) and a marker on the
// road in front of it where missions complete.
export const GARAGE = {
  name: "Rosa's Garage",
  bx: 1860, by: 980, bw: 170, bh: 130,
  mx: 1935, my: 1200, mr: 80,
};
export const SAFEHOUSE = {
  name: 'Safehouse',
  bx: 380, by: 1560, bw: 150, bh: 110,
  mx: 450, my: 1500, mr: 70,
};
export const DEPOT = {
  name: 'North Depot',
  bx: 1260, by: 380, bw: 160, bh: 120,
  mx: 1350, my: 600, mr: 70,
};
export const PIER = { name: 'The Docks', mx: 610, my: 2260, mr: 95 };
export const SPAWN = { x: 1100, y: 1120 };

const PALETTES = {
  downtown: ['#7d8aa0', '#5f7089', '#93a3b8', '#6b7f95', '#8494a8'],
  oldtown: ['#a9805e', '#96705a', '#b08a68', '#8a6a52'],
  harbor: ['#5e8a94', '#4f7d84', '#6b97a3', '#557a82'],
  northside: ['#8a94a0', '#75808e', '#9aa5b1'],
  beachfront: ['#d9c08a', '#cbb27e', '#e0cda0'],
};

export function districtAt(x, y) {
  if (y >= BEACH_Y) return 'beachfront';
  if (x >= 900 && x < 1800 && y >= 900 && y < 1800) return 'downtown';
  if (x >= 1800) return 'harbor';
  if (y < 900) return 'northside';
  return 'oldtown';
}

export function onRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) <= ROAD_HALF + 2) return true;
    if (Math.abs(y - r) <= ROAD_HALF + 2) return true;
  }
  return false;
}

// Push a circle (x, y, r) out of every solid rect it overlaps.
// Returns the corrected position plus whether anything blocked it.
export function resolveCircle(city, x, y, r) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of city.solids) {
      const cx = clamp(x, s.x, s.x + s.w);
      const cy = clamp(y, s.y, s.y + s.h);
      let dx = x - cx;
      let dy = y - cy;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 < 0.0001) {
        // Centre inside the rect: shove out along the shallowest side.
        const left = x - s.x;
        const right = s.x + s.w - x;
        const top = y - s.y;
        const bottom = s.y + s.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = s.x - r;
        else if (m === right) x = s.x + s.w + r;
        else if (m === top) y = s.y - r;
        else y = s.y + s.h + r;
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push;
        y += dy * push;
      }
    }
  }
  return { x, y, hit };
}

export function circleHitsSolid(city, x, y, r) {
  for (const s of city.solids) {
    const cx = clamp(x, s.x, s.x + s.w);
    const cy = clamp(y, s.y, s.y + s.h);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return s;
  }
  return null;
}

function addBuilding(city, x, y, w, h, district, name) {
  const palette = PALETTES[district] || PALETTES.downtown;
  const color = palette[Math.floor(city.rng.next() * palette.length)];
  const b = { x, y, w, h, color, district, name: name || null };
  city.buildings.push(b);
  city.solids.push({ x, y, w, h, kind: 'building', name: b.name });
  return b;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = { seed, rng, buildings: [], trees: [], parks: [], solids: [] };

  // Hand-placed story buildings first, so generated blocks never cover them.
  addBuilding(city, GARAGE.bx, GARAGE.by, GARAGE.bw, GARAGE.bh, 'harbor', GARAGE.name);
  addBuilding(city, SAFEHOUSE.bx, SAFEHOUSE.by, SAFEHOUSE.bw, SAFEHOUSE.bh, 'oldtown', SAFEHOUSE.name);
  addBuilding(city, DEPOT.bx, DEPOT.by, DEPOT.bw, DEPOT.bh, 'northside', DEPOT.name);
  // Plaza offices stand just north of the spawn point — the first wall a
  // new player walks into, and a solid one.
  addBuilding(city, 990, 970, 150, 90, 'downtown', 'Plaza Offices');
  // Dock warehouse flanks the pier so the showdown has cover.
  addBuilding(city, 470, 2240, 90, 70, 'harbor', 'Dock Warehouse');

  const bounds = [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400];
  const namedBlocks = new Set(['6,3', '1,5', '4,1', '3,3']);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const key = i + ',' + j;
      if (namedBlocks.has(key)) continue;
      // The beach band (y >= 2100) stays open sand, no buildings.
      if (bounds[j] >= 2100) continue;
      const ix0 = bounds[i] + (bounds[i] === 0 ? 18 : 50);
      const ix1 = bounds[i + 1] - (bounds[i + 1] === 2400 ? 18 : 50);
      const iy0 = bounds[j] + (bounds[j] === 0 ? 18 : 50);
      const iy1 = bounds[j + 1] - (bounds[j + 1] === 2400 ? 18 : 50);
      const iw = ix1 - ix0;
      const ih = iy1 - iy0;
      if (iw < 60 || ih < 60) continue;
      const roll = rng.next();
      const cx = (bounds[i] + bounds[i + 1]) / 2;
      const cy = (bounds[j] + bounds[j + 1]) / 2;
      const district = districtAt(cx, cy);
      if (roll < 0.14) {
        // Park: trees only, open ground.
        city.parks.push({ x: ix0, y: iy0, w: iw, h: ih });
        const n = rng.int(3, 6);
        for (let t = 0; t < n; t++) {
          city.trees.push({
            x: ix0 + 14 + rng.next() * (iw - 28),
            y: iy0 + 14 + rng.next() * (ih - 28),
            r: 9 + rng.next() * 7,
          });
        }
        continue;
      }
      if (roll < 0.26) {
        // Parking lot: flat asphalt, no buildings.
        city.parks.push({ x: ix0, y: iy0, w: iw, h: ih, lot: true });
        continue;
      }
      // Split the block into a 2x2 slot grid and fill 1-3 slots.
      const gap = 12;
      const sw = (iw - gap) / 2;
      const sh = (ih - gap) / 2;
      const slots = [0, 1, 2, 3].sort(() => rng.next() - 0.5);
      const count = rng.int(1, 3);
      for (let s = 0; s < count; s++) {
        const slot = slots[s];
        const sx = ix0 + (slot % 2) * (sw + gap) + 5;
        const sy = iy0 + Math.floor(slot / 2) * (sh + gap) + 5;
        addBuilding(city, sx, sy, sw - 10, sh - 10, district);
      }
      if (rng.chance(0.5)) {
        city.trees.push({
          x: ix0 + 12 + rng.next() * (iw - 24),
          y: iy0 + 12 + rng.next() * (ih - 24),
          r: 8 + rng.next() * 6,
        });
      }
    }
  }
  return city;
}
