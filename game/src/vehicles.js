// Vehicles: parked cars the player can steal, traffic cars cruising the
// street grid, and police cruisers that chase at wanted level 2+.
import { makeRng, range, intRange, pick, clamp, turnToward, angleTo, dist2 } from './rng.js';
import { snapToRoad, collideBuildings, WORLD_W, WORLD_H, STREET, ROAD_W } from './world.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#3aa655', '#e8e4da', '#7a4fd9', '#e07b2e', '#2ec4b6', '#c2337f', '#8a8f98'];
const MODELS = ['sedan', 'hatch', 'pickup', 'van', 'sport'];

export function makeCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    x, y, angle,
    speed: 0,
    color: o.color || '#d94f3d',
    model: o.model || 'sedan',
    parked: !!o.parked,
    police: !!o.police,
    traffic: !!o.traffic,
    targetAngle: angle,
    wait: 0,
    w: o.model === 'van' ? 52 : 46,
    h: 22,
    id: o.id || 0,
  };
}

export function spawnParked(rng, world, count) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 400) {
    tries++;
    const gx = intRange(rng, 0, 7);
    const gy = intRange(rng, 0, 4);
    const along = rng() < 0.5;
    const x = along ? gx * STREET + range(rng, 120, 280) : gx * STREET + ROAD_W / 2 + 14;
    const y = along ? gy * STREET + ROAD_W / 2 + 14 : gy * STREET + range(rng, 120, 280);
    if (y > 1960) continue;
    const angle = along ? 0 : Math.PI / 2;
    if (cars.some((c) => dist2(c.x, c.y, x, y) < 90 * 90)) continue;
    if (world.buildings.some((b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30)) continue;
    cars.push(makeCar(x, y, angle, { color: pick(rng, CAR_COLORS), model: pick(rng, MODELS), parked: true, id: cars.length }));
  }
  return cars;
}

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = snapToRoad(range(rng, 200, WORLD_W - 200), range(rng, 200, 1900));
    const horizontal = Math.abs(p.y % STREET - ROAD_W / 2) > 1;
    cars.push(makeCar(p.x, p.y, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      { color: pick(rng, CAR_COLORS), model: pick(rng, MODELS), traffic: true, id: 100 + i }));
    cars[i].speed = range(rng, 90, 150);
  }
  return cars;
}

// Traffic: follow the road, turn at intersections, stop briefly sometimes.
export function updateTraffic(dt, cars, playerCar) {
  for (const c of cars) {
    if (c.wait > 0) { c.wait -= dt; c.speed *= 0.9; continue; }
    const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
    const aheadX = c.x + fx * 70, aheadY = c.y + fy * 70;
    const onGridX = Math.abs(((aheadX % STREET) + STREET) % STREET - ROAD_W / 2) < 30;
    const onGridY = Math.abs(((aheadY % STREET) + STREET) % STREET - ROAD_W / 2) < 30;
    // At an intersection, sometimes pick a new heading.
    if (onGridX && onGridY && Math.random() < dt * 0.5) {
      const opts = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(a - c.angle) > 0.1);
      c.targetAngle = opts[Math.floor(Math.random() * opts.length)];
      if (Math.random() < 0.15) c.wait = 1.2;
    }
    c.angle += turnToward(c.angle, c.targetAngle, dt * 2.2);
    // Ease back onto the road centre line.
    const snap = snapToRoad(c.x, c.y);
    c.x += (snap.x - c.x) * dt * 0.4;
    c.y += (snap.y - c.y) * dt * 0.4;
    c.speed += (130 - c.speed) * dt * 0.5;
    // Don't rear-end the player's car.
    if (playerCar && dist2(c.x, c.y, playerCar.x, playerCar.y) < 70 * 70) c.speed *= 0.85;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 40) { c.x = 40; c.targetAngle = 0; }
    if (c.x > WORLD_W - 40) { c.x = WORLD_W - 40; c.targetAngle = Math.PI; }
    if (c.y < 40) { c.y = 40; c.targetAngle = Math.PI / 2; }
    if (c.y > 1960) { c.y = 1960; c.targetAngle = -Math.PI / 2; }
  }
}

// Player driving physics: arcade, with handbrake drift.
export function updatePlayerCar(dt, car, input, world) {
  const fwd = (input.down('KeyW') || input.down('ArrowUp')) ? 1 : 0;
  const back = (input.down('KeyS') || input.down('ArrowDown')) ? 1 : 0;
  const left = (input.down('KeyA') || input.down('ArrowLeft')) ? 1 : 0;
  const right = (input.down('KeyD') || input.down('ArrowRight')) ? 1 : 0;
  const brake = input.down('Space');
  const maxSpeed = car.model === 'sport' ? 460 : car.model === 'van' ? 300 : 380;
  if (fwd) car.speed += 320 * dt;
  if (back) car.speed -= car.speed > 20 ? 420 * dt : 180 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
  car.speed = clamp(car.speed, -140, maxSpeed);
  const steer = (right - left) * (car.speed >= 0 ? 1 : -1);
  const grip = brake ? 1.6 : 2.6;
  car.angle += steer * grip * dt * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car (no ghosting through walls).
  if (world) {
    const fixed = collideBuildings(world, car.x, car.y, 20);
    if (fixed.hit) { car.x = fixed.x; car.y = fixed.y; car.speed *= 0.45; }
  }
  // Stay in the world; beach sand slows the car.
  if (car.x < 30) { car.x = 30; car.speed *= 0.4; }
  if (car.x > WORLD_W - 30) { car.x = WORLD_W - 30; car.speed *= 0.4; }
  if (car.y < 30) { car.y = 30; car.speed *= 0.4; }
  if (car.y > WORLD_H - 40) { car.y = WORLD_H - 40; car.speed *= 0.4; }
  if (car.y > 2000) car.speed *= (1 - 0.25 * dt);
  return { speedKmh: Math.abs(car.speed) * 0.32 };
}

// Police cruiser chase: steer toward the target, ram gently.
export function updatePoliceCar(dt, car, tx, ty) {
  const want = angleTo(car.x, car.y, tx, ty);
  car.angle += turnToward(car.angle, want, dt * 3.0);
  const d = Math.sqrt(dist2(car.x, car.y, tx, ty));
  const targetSpeed = d > 260 ? 400 : d > 90 ? 300 : 140;
  car.speed += (targetSpeed - car.speed) * dt * 0.8;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return d;
}

export function spawnPoliceCar(rng, tx, ty) {
  const a = rng() * Math.PI * 2;
  const x = clamp(tx + Math.cos(a) * 700, 60, WORLD_W - 60);
  const y = clamp(ty + Math.sin(a) * 700, 60, 1950);
  const c = makeCar(x, y, angleTo(x, y, tx, ty), { color: '#1c2f4a', model: 'sedan', police: true });
  c.speed = 200;
  return c;
}
