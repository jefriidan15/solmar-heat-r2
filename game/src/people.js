// people.js — the living city: pedestrians on the sidewalks, police
// officers who chase and bust the player on foot, the Vipers gang at the
// docks, and the bullets both sides fire.
import { ROADS, ROAD_HALF, WORLD, resolveCircle } from './city.js';
import { clamp, dist, angleTo } from './rng.js';

const PED_COLORS = ['#e8c85a', '#7fb0d0', '#d08a7f', '#8fd07f', '#c07fd0', '#e8e8e8', '#d07f3f'];
const BULLET_SPEED = 620;
const BULLET_LIFE = 1.1;

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(ROADS);
    const along = 60 + rng.next() * (WORLD - 120);
    const side = (rng.chance(0.5) ? 1 : -1) * (ROAD_HALF + 12);
    peds.push({
      x: vertical ? road + side : along,
      y: vertical ? along : road + side,
      tx: 0, ty: 0,
      speed: 42 + rng.next() * 30,
      color: rng.pick(PED_COLORS),
      panic: 0,
      wait: 0,
    });
  }
  return peds;
}

function pedTarget(S, ped) {
  const rng = S.rng;
  const vertical = rng.chance(0.5);
  const road = rng.pick(ROADS);
  const along = 60 + rng.next() * (WORLD - 120);
  const side = (rng.chance(0.5) ? 1 : -1) * (ROAD_HALF + 12);
  ped.tx = vertical ? road + side : along;
  ped.ty = vertical ? along : road + side;
}

export function updatePeds(S, dt) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.panic > 0) ped.panic -= dt;
    const dPlayer = dist(ped.x, ped.y, p.x, p.y);
    if (dPlayer < 90 && (p.car || S.shotsFiredAt > S.time - 1.5)) ped.panic = 1.6;
    let tx = ped.tx;
    let ty = ped.ty;
    if (ped.panic > 0) {
      // Flee directly away from the player.
      const a = angleTo(p.x, p.y, ped.x, ped.y);
      tx = ped.x + Math.cos(a) * 120;
      ty = ped.y + Math.sin(a) * 120;
    } else if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    } else if (dist(ped.x, ped.y, tx, ty) < 14 || (tx === 0 && ty === 0)) {
      pedTarget(S, ped);
      if (S.rng.chance(0.3)) ped.wait = 1 + S.rng.next() * 3;
      continue;
    }
    const a = angleTo(ped.x, ped.y, tx, ty);
    const speed = ped.speed * (ped.panic > 0 ? 2.4 : 1);
    const nx = ped.x + Math.cos(a) * speed * dt;
    const ny = ped.y + Math.sin(a) * speed * dt;
    const fixed = resolveCircle(S.city, nx, ny, 10);
    ped.x = clamp(fixed.x, 20, WORLD - 20);
    ped.y = clamp(fixed.y, 20, WORLD - 20);
  }
}

export function spawnOfficer(S) {
  const rng = S.rng;
  const a = rng.next() * Math.PI * 2;
  const r = 320 + rng.next() * 160;
  return {
    x: clamp(S.player.x + Math.cos(a) * r, 40, WORLD - 40),
    y: clamp(S.player.y + Math.sin(a) * r, 40, WORLD - 40),
    speed: 175,
    color: '#20242e',
  };
}

// Officers only hunt the player on foot. One touching the player for
// 1.2s makes the bust; in a car the player is safe from them.
export function updateCops(S, dt) {
  const p = S.player;
  if (p.car) {
    p.bust = 0;
    return;
  }
  let touching = false;
  for (const cop of S.cops) {
    const a = angleTo(cop.x, cop.y, p.x, p.y);
    const nx = cop.x + Math.cos(a) * cop.speed * dt;
    const ny = cop.y + Math.sin(a) * cop.speed * dt;
    const fixed = resolveCircle(S.city, nx, ny, 11);
    cop.x = fixed.x;
    cop.y = fixed.y;
    if (dist(cop.x, cop.y, p.x, p.y) < 28) touching = true;
  }
  if (touching) {
    p.bust += dt;
    if (p.bust > 1.2) {
      S.busted();
    }
  } else {
    p.bust = Math.max(0, p.bust - dt * 2);
  }
}

// The Vipers: four gang members holding the docks. They stand their
// ground, take three hits each, and shoot back when the player closes in.
export function spawnVipers(S) {
  const spots = [
    { x: 600, y: 2280 },
    { x: 630, y: 2290 },
    { x: 595, y: 2340 },
    { x: 625, y: 2360 },
  ];
  S.vipers = spots.map((s) => ({
    x: s.x, y: s.y, hp: 3, shootCd: 1 + S.rng.next(), color: '#8e2f8e', dead: false,
  }));
}

export function updateVipers(S, dt) {
  const p = S.player;
  for (const v of S.vipers) {
    if (v.dead) continue;
    v.shootCd -= dt;
    const d = dist(v.x, v.y, p.x, p.y);
    if (v.shootCd <= 0 && d < 420) {
      v.shootCd = 1.1 + S.rng.next() * 0.7;
      const a = angleTo(v.x, v.y, p.x, p.y) + (S.rng.next() - 0.5) * 0.22;
      S.bullets.push({
        x: v.x, y: v.y,
        vx: Math.cos(a) * BULLET_SPEED * 0.7,
        vy: Math.sin(a) * BULLET_SPEED * 0.7,
        life: BULLET_LIFE, friendly: false,
      });
      S.audio.enemyShot();
      S.fx.push({ kind: 'flash', x: v.x, y: v.y, life: 0.12, max: 0.12 });
    }
  }
}

export function fireBullet(S, fromX, fromY, angle, friendly) {
  S.bullets.push({
    x: fromX + Math.cos(angle) * 20,
    y: fromY + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_LIFE, friendly,
  });
}

export function updateBullets(S, dt) {
  const p = S.player;
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD;
    if (!dead && b.friendly) {
      for (const v of S.vipers) {
        if (!v.dead && dist(b.x, b.y, v.x, v.y) < 15) {
          v.hp -= 1;
          dead = true;
          S.fx.push({ kind: 'hit', x: b.x, y: b.y, life: 0.3, max: 0.3 });
          if (v.hp <= 0) {
            v.dead = true;
            S.stats.kills += 1;
            S.audio.thud();
            S.fx.push({ kind: 'down', x: v.x, y: v.y, life: 0.6, max: 0.6 });
          }
          break;
        }
      }
      if (!dead) {
        for (const cop of S.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            dead = true;
            S.fx.push({ kind: 'hit', x: b.x, y: b.y, life: 0.3, max: 0.3 });
            break;
          }
        }
      }
    }
    if (!dead && !b.friendly) {
      if (dist(b.x, b.y, p.x, p.y) < (p.car ? 18 : 13)) {
        dead = true;
        p.hp -= 8;
        S.audio.thud();
        S.fx.push({ kind: 'hit', x: p.x, y: p.y, life: 0.3, max: 0.3 });
        if (p.hp <= 0) S.wasted();
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}
