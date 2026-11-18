// vehicles.js — cars of Solmar Heat: parked cars to steal, traffic that
// drives the road grid, police interceptors that chase the player, and
// the driving model (accelerate, steer, handbrake, off-road slowdown).
// Every car is a circle of radius 16 against buildings, so no car ever
// ghosts through a wall.
import { ROADS, ROAD_HALF, WORLD, onRoad, resolveCircle } from './city.js';
import { clamp, dist, angleDelta } from './rng.js';

export const CAR_MODELS = [
  { name: 'Comet GT', color: '#d8443c', max: 380, accel: 300 },
  { name: 'Solmar Cab', color: '#e8b73a', max: 320, accel: 250 },
  { name: 'Vagabond', color: '#3f7fd0', max: 340, accel: 260 },
  { name: 'Palm Runner', color: '#e07fb0', max: 360, accel: 280 },
  { name: 'Dune Buggy', color: '#7fae4c', max: 330, accel: 270 },
  { name: 'Night Hawk', color: '#2e2e38', max: 400, accel: 320 },
];

export const POLICE_COLOR = '#20242e';
export const CAR_RADIUS = 16;

export function makeCar(model, x, y, angle, kind) {
  return {
    model: model.name,
    color: model.color,
    max: model.max,
    accel: model.accel,
    x, y, angle,
    speed: 0,
    kind: kind || 'parked',
    // Traffic fields:
    road: null, vertical: false, dir: 1, lane: 0, cruise: 120,
    // Police fields:
    stuck: 0,
  };
}

// Parked cars line the roads near the spawn and scatter across the map.
// The first one sits on the 1200 road facing east, straight toward
// Rosa's Garage, so the first mission is a straight drive.
export function spawnParkedCars(rng) {
  const cars = [];
  const spots = [
    { x: 1250, y: 1200, angle: 0, model: 0 },
    { x: 1330, y: 1200, angle: 0, model: 2 },
    { x: 1200, y: 1330, angle: Math.PI / 2, model: 1 },
    { x: 900, y: 1080, angle: -Math.PI / 2, model: 3 },
    { x: 1500, y: 900, angle: 0, model: 4 },
    { x: 600, y: 1500, angle: Math.PI, model: 5 },
    { x: 1800, y: 1530, angle: Math.PI / 2, model: 1 },
    { x: 2100, y: 630, angle: -Math.PI / 2, model: 2 },
  ];
  for (const s of spots) {
    cars.push(makeCar(CAR_MODELS[s.model], s.x, s.y, s.angle, 'parked'));
  }
  for (let i = 0; i < 10; i++) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(ROADS);
    const along = 120 + rng.next() * (WORLD - 240);
    const lane = (rng.chance(0.5) ? 1 : -1) * (ROAD_HALF - 12);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    cars.push(makeCar(rng.pick(CAR_MODELS), x, y, angle, 'parked'));
  }
  return cars;
}

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(ROADS);
    const along = 80 + rng.next() * (WORLD - 160);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir * (ROAD_HALF - 13);
    const car = makeCar(rng.pick(CAR_MODELS), 0, 0, 0, 'traffic');
    car.vertical = vertical;
    car.road = road;
    car.dir = dir;
    car.lane = lane;
    car.cruise = 95 + rng.next() * 55;
    car.speed = car.cruise;
    if (vertical) {
      car.x = road + lane;
      car.y = along;
      car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = along;
      car.y = road + lane;
      car.angle = dir > 0 ? 0 : Math.PI;
    }
    cars.push(car);
  }
  return cars;
}

function carAhead(cars, self, gap) {
  let best = null;
  let bestD = gap;
  for (const other of cars) {
    if (other === self) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const forward = dx * Math.cos(self.angle) + dy * Math.sin(self.angle);
    if (forward <= 0 || forward > gap) continue;
    const side = Math.abs(-dx * Math.sin(self.angle) + dy * Math.cos(self.angle));
    if (side > 26) continue;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = other;
    }
  }
  return best;
}

// Traffic follows its road lane and wraps around the world edge; a car
// ahead makes it ease off instead of piling up.
export function updateTraffic(S, dt) {
  const all = [...S.cars.traffic, ...S.cars.police];
  if (S.player.car) all.push(S.player.car);
  for (const car of S.cars.traffic) {
    const ahead = carAhead(all, car, 64);
    const target = ahead ? Math.min(car.cruise, Math.max(0, ahead.speed - 20)) : car.cruise;
    car.speed += clamp(target - car.speed, -260 * dt, 140 * dt);
    if (car.vertical) {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = car.road + car.lane;
      if (car.y > WORLD + 40) car.y = -40;
      if (car.y < -40) car.y = WORLD + 40;
    } else {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = car.road + car.lane;
      if (car.x > WORLD + 40) car.x = -40;
      if (car.x < -40) car.x = WORLD + 40;
    }
  }
}

// Police interceptors spawn on a road near the player and pursue: steer
// toward the player, ram speed when close, and get unstuck from walls.
export function spawnPoliceCar(S) {
  const rng = S.rng;
  const vertical = rng.chance(0.5);
  const road = rng.pick(ROADS);
  const near = rng.chance(0.5);
  let x;
  let y;
  if (vertical) {
    x = road + (rng.chance(0.5) ? 14 : -14);
    y = clamp(S.player.y + (near ? -1 : 1) * (380 + rng.next() * 220), 60, WORLD - 60);
  } else {
    y = road + (rng.chance(0.5) ? 14 : -14);
    x = clamp(S.player.x + (near ? -1 : 1) * (380 + rng.next() * 220), 60, WORLD - 60);
  }
  const car = makeCar(
    { name: 'Interceptor', color: POLICE_COLOR, max: 390, accel: 330 },
    x, y, 0, 'police',
  );
  S.cars.police.push(car);
  return car;
}

export function updatePoliceCars(S, dt) {
  const p = S.player;
  for (const car of S.cars.police) {
    const d = dist(car.x, car.y, p.x, p.y);
    const want = Math.atan2(p.y - car.y, p.x - car.x);
    const turn = clamp(angleDelta(car.angle, want), -2.6 * dt, 2.6 * dt);
    car.angle += turn;
    const target = d > 60 ? car.max : car.max * 0.55;
    car.speed += clamp(target - car.speed, -320 * dt, car.accel * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveCircle(S.city, nx, ny, CAR_RADIUS);
    if (fixed.hit) {
      car.speed *= 0.45;
      car.stuck += dt;
      if (car.stuck > 1.1) {
        // Reverse out of the wall, then re-aim.
        car.angle += Math.PI * 0.7;
        car.stuck = 0;
      }
    } else {
      car.stuck = 0;
    }
    car.x = clamp(fixed.x, 20, WORLD - 20);
    car.y = clamp(fixed.y, 20, WORLD - 20);
    // Ram: a police car touching the player's car shoves it and slows it.
    if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < CAR_RADIUS * 2 + 4) {
      p.car.speed *= 1 - 1.6 * dt;
      S.audio.thud();
    }
  }
}

// Drive the player's car. Returns nothing; mutates S.player.car.
export function updateDriving(S, dt) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  const input = S.input;
  // Screenshot scenes cruise on their own: full throttle, no steering.
  const axis = S.autoDrive ? { x: 0, y: -1 } : input.moveAxis();
  const handbrake = S.autoDrive ? false : input.down('Space');
  const offroad = !onRoad(car.x, car.y) && car.y < 2180;
  const top = car.max * (offroad ? 0.45 : 1);
  if (axis.y < 0) car.speed += car.accel * dt;
  else if (axis.y > 0) car.speed -= car.accel * 1.1 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 620 * dt);
  }
  car.speed = clamp(car.speed, -130, top);
  const steer = axis.x * (handbrake ? 3.4 : 2.3) * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCircle(S.city, nx, ny, CAR_RADIUS);
  if (fixed.hit) {
    car.speed *= 0.4;
    S.audio.thud();
    S.fx.push({ kind: 'spark', x: fixed.x, y: fixed.y, life: 0.35, max: 0.35 });
  }
  car.x = clamp(fixed.x, 20, WORLD - 20);
  car.y = clamp(fixed.y, 20, WORLD - 20);
  p.x = car.x;
  p.y = car.y;
  p.speed = Math.abs(car.speed);
  p.angle = car.angle;
  // Soft car-to-car push so traffic and parked cars cannot overlap the
  // player. A rammed car takes the player's speed instead of acting as a
  // wall; a parked car is shoved aside, so the player never crawls while
  // pushing one down the road.
  for (const other of [...S.cars.traffic, ...S.cars.police, ...S.cars.parked]) {
    const d = dist(car.x, car.y, other.x, other.y);
    if (d > 0.01 && d < CAR_RADIUS * 2 + 2) {
      const push = (CAR_RADIUS * 2 + 2 - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      if (other.kind === 'parked') {
        other.x -= ux * push * 2;
        other.y -= uy * push * 2;
        car.speed *= 0.98;
      } else {
        car.x += ux * push;
        car.y += uy * push;
        other.x -= ux * push;
        other.y -= uy * push;
        other.speed = Math.max(other.speed, car.speed * 0.85);
        car.speed *= 0.98;
      }
    }
  }
  S.audio.engine(true, Math.abs(car.speed) / car.max);
}
