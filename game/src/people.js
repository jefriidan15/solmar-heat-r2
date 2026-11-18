// People: pedestrians strolling the sidewalks, police officers on foot,
// and Viper gang members who fight back. All share a simple walker body.
import { makeRng, range, intRange, pick, clamp, turnToward, angleTo, dist2 } from './rng.js';
import { collideBuildings, WORLD_W } from './world.js';

const SHIRTS = ['#e8e4da', '#d94f3d', '#3d7dd9', '#e8c33a', '#3aa655', '#c2337f', '#7a4fd9', '#e07b2e'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#a06a42'];

export function makePerson(x, y, kind, rng) {
  return {
    x, y, kind, // 'ped' | 'cop' | 'viper'
    angle: rng ? rng() * Math.PI * 2 : 0,
    speed: 0,
    health: kind === 'viper' ? 60 : kind === 'cop' ? 80 : 40,
    shirt: kind === 'cop' ? '#24344d' : kind === 'viper' ? '#7a1f2b' : pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    targetX: x, targetY: y,
    wait: rng ? range(rng, 0, 2) : 0,
    fleeing: false,
    shootCd: 0,
    dead: false,
    stun: 0,
  };
}

export function spawnPedestrians(rng, world, count) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < 500) {
    tries++;
    const x = range(rng, 150, WORLD_W - 150);
    const y = range(rng, 150, 1900);
    if (world.buildings.some((b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20)) continue;
    if (peds.some((p) => dist2(p.x, p.y, x, y) < 60 * 60)) continue;
    peds.push(makePerson(x, y, 'ped', rng));
  }
  return peds;
}

export function spawnVipers(rng, x, y, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const v = makePerson(x + range(rng, -90, 90), y + range(rng, -60, 60), 'viper', rng);
    out.push(v);
  }
  return out;
}

export function spawnCop(rng, tx, ty) {
  const a = rng() * Math.PI * 2;
  const c = makePerson(clamp(tx + Math.cos(a) * 520, 60, WORLD_W - 60), clamp(ty + Math.sin(a) * 520, 60, 1950), 'cop', rng);
  return c;
}

// Pedestrian wander: pick a nearby sidewalk point, walk to it, idle, repeat.
// Fleeing peds run away from (fx, fy).
export function updatePedestrians(dt, peds, world, fx, fy) {
  for (const p of peds) {
    if (p.dead) continue;
    if (p.stun > 0) { p.stun -= dt; continue; }
    const d2 = dist2(p.x, p.y, fx, fy);
    if (d2 < 260 * 260) p.fleeing = true;
    if (p.fleeing) {
      p.angle = angleTo(fx, fy, p.x, p.y);
      p.speed = 210;
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (d2 > 500 * 500) p.fleeing = false;
    } else if (p.wait > 0) {
      p.wait -= dt; p.speed = 0;
      if (p.wait <= 0) {
        p.targetX = clamp(p.x + range(Math.random, -260, 260), 60, WORLD_W - 60);
        p.targetY = clamp(p.y + range(Math.random, -260, 260), 60, 1930);
        p.angle = angleTo(p.x, p.y, p.targetX, p.targetY);
      }
    } else {
      const d = Math.sqrt(dist2(p.x, p.y, p.targetX, p.targetY));
      if (d < 14) { p.wait = range(Math.random, 1, 4); p.speed = 0; }
      else {
        p.angle += turnToward(p.angle, angleTo(p.x, p.y, p.targetX, p.targetY), dt * 4);
        p.speed = 55;
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
    }
    const fixed = collideBuildings(world, p.x, p.y, 13);
    p.x = clamp(fixed.x, 30, WORLD_W - 30);
    p.y = clamp(fixed.y, 30, 2360);
  }
}

// Cops chase the player on foot; close enough and they start a bust timer
// (handled by the game). Vipers advance and shoot when in range.
export function updateEnemies(dt, list, tx, ty, world, onShoot) {
  for (const e of list) {
    if (e.dead) continue;
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.shootCd -= dt;
    const d = Math.sqrt(dist2(e.x, e.y, tx, ty));
    const want = angleTo(e.x, e.y, tx, ty);
    if (e.kind === 'cop') {
      e.angle += turnToward(e.angle, want, dt * 5);
      e.speed = d > 34 ? 235 : 0;
    } else {
      // Viper: close to ~230 px, then hold and fire.
      e.angle += turnToward(e.angle, want, dt * 4);
      e.speed = d > 240 ? 170 : 0;
      if (d < 340 && e.shootCd <= 0) {
        e.shootCd = 1.4;
        if (onShoot) onShoot(e, d);
      }
    }
    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;
    const fixed = collideBuildings(world, e.x, e.y, 13);
    e.x = fixed.x; e.y = fixed.y;
  }
}

// Bullet-ish hit test: a shot from (sx,sy) toward angle hits the first person
// within 12 px of the ray and inside 520 px. Returns the victim or null.
export function rayHit(sx, sy, angle, people, maxDist) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null, bestT = maxDist || 520;
  for (const p of people) {
    if (p.dead) continue;
    const rx = p.x - sx, ry = p.y - sy;
    const t = rx * dx + ry * dy;
    if (t < 0 || t > bestT) continue;
    const perp = Math.abs(rx * dy - ry * dx);
    if (perp < 16) { best = p; bestT = t; }
  }
  return best;
}
