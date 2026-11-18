// Solmar Heat — core game: player, driving, combat, wanted level, police,
// missions, courier side jobs, save/continue, and the screenshot hooks.
// Dana, a newcomer driver, proves herself to Rosa, a garage owner, while
// the Vipers and the Solmar police make her life difficult.
import { makeRng, clamp, angleTo, dist2 } from './rng.js';
import { buildWorld, collideBuildings, WORLD_W, WORLD_H, STREET } from './world.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makeRenderer } from './render.js';
import {
  spawnParked, spawnTraffic, updateTraffic, updatePlayerCar,
  updatePoliceCar, spawnPoliceCar, makeCar,
} from './vehicles.js';
import {
  spawnPedestrians, spawnVipers, spawnCop, updatePedestrians,
  updateEnemies, rayHit,
} from './people.js';
import {
  MISSIONS, makeMissionState, missionMarker, missionObjectiveText,
  startMission, updateMission, advanceMission, retryMission,
} from './missions.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const mini = document.getElementById('mini');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const briefEl = document.getElementById('brief');
const continueBtn = document.getElementById('continue-btn');
const newBtn = document.getElementById('new-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const menuNote = document.getElementById('menu-note');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261118);
const shot = params.get('shot') || null;

const rng = makeRng(seed);
const world = buildWorld(seed);
const input = makeInput(canvas);
const audio = makeAudio();
const renderer = makeRenderer(canvas, mini);

const state = {
  mode: 'menu', // menu | playing | paused | busted | wasted
  px: world.places.garage.x, py: world.places.garage.y + 130,
  aim: -Math.PI / 2, pSpeed: 0,
  vx: 0, vy: 0, dt: 0.016,
  health: 100, cash: 0, ammo: 24,
  wanted: 0, cleanTime: 0, crimeCd: 0,
  inCar: false, playerCar: null, speedKmh: 0,
  parked: [], traffic: [], policeCars: [], peds: [], enemies: [],
  effects: [], bullets: [],
  missions: makeMissionState(),
  night: false, dusk: false,
  toast: '', toastT: 0,
  bustT: 0, shootCd: 0, interactCd: 0,
  vipersSpawned: false,
  fps: 0, frames: 0, fpsT: 0,
  errors: [],
};

window.addEventListener('error', (e) => state.errors.push(String(e.message || e.error)));

function toast(msg, secs) {
  state.toast = msg; state.toastT = secs || 3;
}

function setWanted(n) {
  state.wanted = clamp(Math.round(n), 0, 5);
  state.cleanTime = 0;
  audio.setSiren(state.wanted >= 2);
}

function addWanted(n) {
  if (state.wanted < 5) setWanted(state.wanted + n);
  state.crimeCd = 2;
}

function newGame(fromSave) {
  const s = fromSave ? loadGame() : null;
  state.parked = spawnParked(rng, world, 14);
  state.traffic = spawnTraffic(rng, 10);
  state.peds = spawnPedestrians(rng, world, 16);
  state.policeCars = [];
  state.enemies = [];
  state.effects = [];
  state.missions = makeMissionState();
  state.night = false; state.dusk = false;
  state.vipersSpawned = false;
  state.bustT = 0;
  if (s) {
    state.cash = s.cash; state.health = s.health; state.ammo = s.ammo;
    state.px = s.px; state.py = s.py;
    state.missions.index = Math.min(s.missionIndex, MISSIONS.length - 1);
    state.missions.done = !!s.done;
  } else {
    state.cash = 0; state.health = 100; state.ammo = 24;
    state.px = world.places.garage.x; state.py = world.places.garage.y + 130;
  }
  state.wanted = 0;
  state.inCar = false; state.playerCar = null;
  startMission(state.missions, gameApi);
  state.mode = 'playing';
  menuEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  const cur = MISSIONS[state.missions.index];
  showBrief(cur ? cur.brief : 'Free roam, Dana.');
  toast(cur ? `Job ${cur.id}/5: ${cur.name}` : 'Free roam', 3);
  audio.unlock();
}

function showBrief(text) {
  briefEl.textContent = text;
  briefEl.classList.remove('hidden');
  setTimeout(() => briefEl.classList.add('hidden'), 7000);
}

function endRun(kind) {
  state.mode = kind; // 'busted' | 'wasted'
  state.wanted = 0;
  audio.setSiren(false);
  if (kind === 'busted') state.cash = Math.max(0, state.cash - 100);
  saveGame(state);
}

function respawn() {
  state.health = 100;
  state.px = world.places.garage.x;
  state.py = world.places.garage.y + 130;
  state.inCar = false;
  if (state.playerCar) { state.playerCar.parked = true; state.parked.push(state.playerCar); state.playerCar = null; }
  state.policeCars = [];
  state.enemies = [];
  state.vipersSpawned = false;
  state.bustT = 0;
  state.mode = 'playing';
  // Restart the current job fresh so a failed fight is retryable.
  retryMission(state.missions, gameApi);
  const cur = MISSIONS[state.missions.index];
  if (cur) showBrief(cur.brief);
}

// ---- mission hooks used by missions.js ----
const gameApi = {
  spawnVipersAtPier() {
    const p = world.places.pier;
    state.enemies = spawnVipers(rng, p.x, p.y - 40, 4);
    state.vipersSpawned = true;
  },
  vipersAlive() {
    return state.enemies.filter((e) => e.kind === 'viper' && !e.dead).length;
  },
  forceWanted(n) { setWanted(n); },
  setNight(on) { state.night = on; state.dusk = false; },
};

function payMission() {
  const cur = MISSIONS[state.missions.index];
  state.cash += cur.pay;
  audio.cash();
  toast(`Job complete! +$${cur.pay} — ${cur.name}`, 4);
  saveGame(state);
  advanceMission(state.missions, gameApi);
  const next = MISSIONS[state.missions.index];
  if (next) showBrief(next.brief);
  else toast('All jobs done — Solmar is yours!', 6);
}

function failMission() {
  toast('Job failed — Rosa is giving you another shot.', 4);
  retryMission(state.missions, gameApi);
  const cur = MISSIONS[state.missions.index];
  if (cur) showBrief(cur.brief);
}

// ---- combat ----
function shoot() {
  if (state.ammo <= 0) { audio.blip(180); toast('Out of ammo — find Rosa, she reloads you.', 2); return; }
  state.ammo--;
  state.shootCd = 0.25;
  audio.shot();
  const sx = state.px + Math.cos(state.aim) * 22;
  const sy = state.py + Math.sin(state.aim) * 22;
  state.effects.push({ kind: 'muzzle', x: sx, y: sy, life: 1 });
  const targets = [...state.enemies, ...state.peds];
  const hit = rayHit(sx, sy, state.aim, targets, 520);
  if (hit) {
    hit.health -= 34;
    state.effects.push({ kind: 'blood', x: hit.x, y: hit.y, life: 1 });
    if (hit.health <= 0) {
      hit.dead = true;
      if (hit.kind === 'ped') addWanted(1);
      if (hit.kind === 'cop') addWanted(2);
    }
  }
  addWanted(0); // shooting is a crime even on a miss
  state.wanted = Math.max(state.wanted, 1);
  state.cleanTime = 0;
}

function enemyShoot(e, d) {
  audio.shot();
  state.effects.push({ kind: 'muzzle', x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20, life: 1 });
  // Hit chance falls with distance; Dana takes 6-12 damage per hit.
  if (Math.random() < clamp(0.75 - d / 600, 0.15, 0.7)) {
    state.health -= 6 + Math.random() * 6;
    audio.thud();
    if (state.health <= 0) endRun('wasted');
  }
}

// ---- per-frame update ----
function update(dt) {
  state.dt = dt;
  state.crimeCd = Math.max(0, state.crimeCd - dt);
  state.shootCd = Math.max(0, state.shootCd - dt);
  state.interactCd = Math.max(0, state.interactCd - dt);
  if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }

  // Pause / mute keys (checked even when paused, via keydown handler below).
  const px = state.px, py = state.py;

  if (state.inCar && state.playerCar) {
    const car = state.playerCar;
    const res = updatePlayerCar(dt, car, input, world);
    state.speedKmh = res.speedKmh;
    state.px = car.x; state.py = car.y;
    state.vx = Math.cos(car.angle) * car.speed;
    state.vy = Math.sin(car.angle) * car.speed;
    audio.setEngine(Math.abs(car.speed) / 460, true);
    // Run over a pedestrian at speed: a crime.
    for (const p of state.peds) {
      if (!p.dead && dist2(p.x, p.y, car.x, car.y) < 30 * 30 && Math.abs(car.speed) > 120) {
        p.dead = true;
        audio.thud();
        addWanted(1);
        toast('You hit a pedestrian! The heat is on.', 2.5);
      }
    }
    // Exit the car.
    if (input.down('KeyE') && state.interactCd <= 0 && Math.abs(car.speed) < 40) {
      state.interactCd = 0.4;
      state.inCar = false;
      state.px = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      state.py = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      car.parked = true;
      state.parked.push(car);
      state.playerCar = null;
      state.speedKmh = 0;
    }
  } else {
    // On foot.
    let mx = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    let my = (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const spd = run ? 300 : 175;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    state.pSpeed = len > 0 ? spd : 0;
    state.px += mx * spd * dt;
    state.py += my * spd * dt;
    state.vx = mx * spd; state.vy = my * spd;
    const fixed = collideBuildings(world, state.px, state.py, 13);
    state.px = clamp(fixed.x, 30, WORLD_W - 30);
    state.py = clamp(fixed.y, 30, WORLD_H - 40);
    // Aim at the mouse.
    const wx = state.px + (input.mouseX - canvas.width / 2);
    const wy = state.py + (input.mouseY - canvas.height / 2);
    state.aim = angleTo(state.px, state.py, wx, wy);
    audio.setEngine(0, false);
    // Steal a parked car.
    if (input.down('KeyE') && state.interactCd <= 0) {
      const near = state.parked.find((c) => dist2(c.x, c.y, state.px, state.py) < 70 * 70);
      if (near) {
        state.interactCd = 0.4;
        state.parked = state.parked.filter((c) => c !== near);
        near.parked = false;
        state.playerCar = near;
        state.inCar = true;
        addWanted(1);
        audio.blip(520);
        toast('Car stolen! +1 star. Get to the marker.', 2.5);
      }
    }
    // Shoot.
    if (input.clicked && state.shootCd <= 0) shoot();
  }

  // Traffic + pedestrians.
  updateTraffic(dt, state.traffic, state.playerCar);
  updatePedestrians(dt, state.peds, world, state.px, state.py);

  // Wanted decay: stay clean and out of sight and the heat fades.
  const policeNear = state.policeCars.some((c) => dist2(c.x, c.y, state.px, state.py) < 420 * 420)
    || state.enemies.some((e) => e.kind === 'cop' && !e.dead && dist2(e.x, e.y, state.px, state.py) < 380 * 380);
  if (state.wanted > 0 && state.crimeCd <= 0 && !policeNear) {
    state.cleanTime += dt;
    if (state.cleanTime > 12) { setWanted(state.wanted - 1); toast('The heat is fading…', 2); }
  } else if (policeNear) {
    state.cleanTime = 0;
  }

  // Police response scales with wanted level.
  const wantCars = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
  while (state.policeCars.length < wantCars) state.policeCars.push(spawnPoliceCar(rng, state.px, state.py));
  while (state.policeCars.length > wantCars) state.policeCars.pop();
  const wantCops = state.wanted >= 3 ? Math.min(state.wanted - 2, 3) : 0;
  const cops = state.enemies.filter((e) => e.kind === 'cop' && !e.dead);
  while (cops.length < wantCops) { const c = spawnCop(rng, state.px, state.py); state.enemies.push(c); cops.push(c); }
  for (const c of state.policeCars) {
    const d = updatePoliceCar(dt, c, state.px, state.py);
    // Ram: damage on contact, worse on foot.
    if (d < 46) {
      if (state.inCar) { state.playerCar.speed *= 0.6; }
      else { state.health -= 25 * dt * 4; if (state.health <= 0) endRun('wasted'); }
    }
  }
  updateEnemies(dt, state.enemies, state.px, state.py, world, enemyShoot);

  // Busted: a cop stays on top of Dana on foot at high wanted.
  if (!state.inCar && state.wanted >= 3) {
    const close = state.enemies.some((e) => e.kind === 'cop' && !e.dead && dist2(e.x, e.y, state.px, state.py) < 36 * 36);
    if (close) {
      state.bustT += dt;
      if (state.bustT > 1.2) endRun('busted');
    } else state.bustT = Math.max(0, state.bustT - dt * 2);
  }

  // Courier side pickup.
  state.missions.courierCd -= dt;
  if (!state.missions.courier && state.missions.courierCd <= 0 && state.missions.index >= 0) {
    const gx = Math.floor(rng() * 8) * STREET + 46;
    const gy = Math.floor(rng() * 5) * STREET + 46;
    state.missions.courier = { x: gx, y: gy };
  }
  if (state.missions.courier && dist2(state.px, state.py, state.missions.courier.x, state.missions.courier.y) < 46 * 46) {
    state.cash += 150;
    audio.cash();
    toast('Courier pickup +$150', 2.5);
    state.missions.courier = null;
    state.missions.courierCd = 25;
    saveGame(state);
  }

  // Mission progress.
  const ev = {
    dt, px: state.px, py: state.py, inCar: state.inCar, wanted: state.wanted,
    garage: world.places.garage, depot: world.places.courierHub,
    safehouse: world.places.safehouse, docks: world.places.docks,
    vipersAlive: gameApi.vipersAlive(), vipersSpawned: state.vipersSpawned,
  };
  const res = updateMission(state.missions, ev);
  if (res === 'paid') payMission();
  else if (res === 'failed') failMission();

  // Effects decay.
  for (const e of state.effects) e.life -= dt * 2.2;
  state.effects = state.effects.filter((e) => e.life > 0);

  // Autosave every ~10 s while playing.
  state.saveT = (state.saveT || 0) + dt;
  if (state.saveT > 10) { state.saveT = 0; saveGame(state); }
}

function renderState() {
  return {
    world, px: state.px, py: state.py, vx: state.vx, vy: state.vy, dt: state.dt,
    aim: state.aim, pSpeed: state.pSpeed, inCar: state.inCar, playerCar: state.playerCar,
    parked: state.parked, traffic: state.traffic, policeCars: state.policeCars,
    peds: state.peds, enemies: state.enemies, effects: state.effects,
    cash: state.cash, health: state.health, ammo: state.ammo, wanted: state.wanted,
    speedKmh: state.speedKmh, night: state.night, dusk: state.dusk,
    objective: missionObjectiveText(state.missions),
    marker: missionMarker(state.missions, world, { x: state.px, y: state.py }, state.inCar),
    courier: state.missions.courier,
    toast: state.toast,
    busted: state.mode === 'busted', wasted: state.mode === 'wasted',
    allDone: state.missions.done,
  };
}

// ---- screenshot scene hooks (?shot=...) ----
function applyShot() {
  if (!shot) return;
  const P = world.places;
  if (shot === 'cover') {
    // Downtown chase: driving a sport car, 3 stars, cruisers closing in.
    const car = makeCar(1600, 1200, 0, { color: '#d94f3d', model: 'sport' });
    state.playerCar = car; state.inCar = true;
    car.speed = 320;
    state.px = car.x; state.py = car.y;
    setWanted(3);
    state.policeCars = [spawnPoliceCar(rng, 1500, 1100), spawnPoliceCar(rng, 1750, 1300)];
    state.policeCars[0].x = 1420; state.policeCars[0].y = 1180;
    state.policeCars[1].x = 1780; state.policeCars[1].y = 1300;
    state.dusk = false;
  } else if (shot === 'street') {
    state.px = P.plaza.x; state.py = P.plaza.y + 60;
    state.aim = -Math.PI / 2;
  } else if (shot === 'pier') {
    state.missions.index = 2;
    startMission(state.missions, gameApi);
    state.px = P.pier.x; state.py = P.pier.y - 160;
    state.aim = Math.PI / 2;
    state.ammo = 24;
    showBrief(MISSIONS[2].brief);
  } else if (shot === 'dusk') {
    const car = makeCar(900, 2050, 0, { color: '#e8c33a', model: 'sport' });
    state.playerCar = car; state.inCar = true;
    car.speed = 300;
    state.px = car.x; state.py = car.y;
    state.dusk = true;
    setWanted(1);
  }
  // Let the world settle a few frames so traffic/peds are in view.
  for (let i = 0; i < 40; i++) update(0.05);
  // The settle loop costs health (Vipers shoot), so restore a clean frame
  // and hold their fire for a few seconds.
  state.health = 100;
  for (const e of state.enemies) e.shootCd = 3;
  // Chase scenes keep cruising: hold W for the screenshot, so the car is
  // mid-drive (not parked) when the frame is taken.
  if ((shot === 'cover' || shot === 'dusk') && state.playerCar) input.keys.add('KeyW');
  state.mode = 'playing';
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  state.frames++;
  if (now - state.fpsT > 1000) { state.fps = state.frames * 1000 / (now - state.fpsT); state.frames = 0; state.fpsT = now; }
  if (state.mode === 'playing') update(dt);
  renderer.draw(renderState(), now / 1000);
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---- menu wiring ----
if (hasSave()) {
  continueBtn.classList.remove('hidden');
  const s = loadGame();
  menuNote.textContent = `Save found: $${s.cash}, Job ${Math.min(s.missionIndex + 1, 5)}/5.`;
}
newBtn.addEventListener('click', () => { clearSave(); newGame(false); });
continueBtn.addEventListener('click', () => newGame(true));
resumeBtn.addEventListener('click', () => {
  state.mode = 'playing';
  pauseEl.classList.add('hidden');
  audio.unlock();
});
restartBtn.addEventListener('click', () => {
  pauseEl.classList.add('hidden');
  clearSave();
  newGame(false);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && (state.mode === 'playing' || state.mode === 'paused')) {
    if (state.mode === 'playing') { state.mode = 'paused'; pauseEl.classList.remove('hidden'); }
    else { state.mode = 'playing'; pauseEl.classList.add('hidden'); }
  }
  if (e.code === 'KeyM') {
    const m = audio.toggleMute();
    toast(m ? 'Sound muted (M to unmute)' : 'Sound on', 1.5);
  }
  if (e.code === 'Enter' && (state.mode === 'busted' || state.mode === 'wasted')) respawn();
  if (e.code === 'Enter' && state.mode === 'menu') newGame(hasSave());
  if (['KeyE', 'Space'].includes(e.code)) audio.unlock();
});
canvas.addEventListener('mousedown', () => audio.unlock());

// Test + screenshot hook: window.__solmar exposes live state for automation.
window.__solmar = {
  state,
  newGame: (fromSave) => newGame(fromSave),
  applyShot,
  saveGame: () => saveGame(state),
  version: 'solmar-heat-r2',
};

// Auto-start when a ?shot= scene is requested (no menu click needed).
if (shot) {
  newGame(false);
  applyShot();
} else {
  renderer.draw(renderState(), 0);
}
requestAnimationFrame(frame);
