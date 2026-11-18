// game.js — Solmar Heat core: boot, state, the main loop, on-foot
// movement, stealing and shooting, wanted heat, busted/wasted, and the
// menu wiring. Systems live in their own modules; this file only runs
// them in the right order.
import { buildCity, SPAWN, GARAGE, WORLD, resolveCircle } from './city.js';
import { makeRng, clamp, dist, angleTo } from './rng.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import {
  spawnParkedCars, spawnTraffic, updateTraffic, spawnPoliceCar,
  updatePoliceCars, updateDriving,
} from './vehicles.js';
import {
  spawnPeds, updatePeds, updateCops, spawnVipers, spawnOfficer,
  updateVipers, fireBullet, updateBullets,
} from './people.js';
import {
  freshMissionState, startMission, updateMission, updateSideJob,
} from './missions.js';
import { render } from './render.js';
import { hasSave, writeSave, readSave, clearSave } from './save.js';
import { setupShot } from './shots.js';

const WALK_SPEED = 165;
const RUN_SPEED = 265;
const FIRE_INTERVAL = 0.18;

function createState(seed) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    time: 0,
    mode: 'menu',
    timeOfDay: 'day',
    city: buildCity(seed),
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2,
      hp: 100, ammo: 24, cash: 0,
      heat: 0, wanted: 0, bust: 0,
      car: null, speed: 0, walkBlocked: false,
    },
    cars: {
      parked: spawnParkedCars(rng),
      traffic: spawnTraffic(rng, 14),
      police: [],
    },
    peds: spawnPeds(rng, 22),
    cops: [],
    vipers: [],
    bullets: [],
    fx: [],
    mission: freshMissionState(),
    side: { active: false, cooldown: 25, timer: 0, reward: 0, target: null },
    cam: { x: 0, y: 0 },
    banner: '',
    bannerT: 0,
    lastCrimeAt: -100,
    shotsFiredAt: -100,
    fireCd: 0,
    policeTimer: 0,
    saveTimer: 0,
    autoDrive: false,
    shot: null,
    shotFrames: 0,
    fps: 0,
    stats: { kills: 0, carsStolen: 0 },
    // Bound by game.js after construction; modules call these.
    busted: null,
    wasted: null,
    saveGame: null,
    spawnVipers: null,
  };
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new SoundBank();
    const params = new URLSearchParams(window.location.search);
    this.seed = params.get('seed') || String(Date.now());
    this.shotName = params.get('shot');
    this.state = createState(this.seed);
    const S = this.state;
    S.busted = () => this.busted();
    S.wasted = () => this.wasted();
    S.saveGame = () => this.saveGame();
    S.spawnVipers = () => spawnVipers(S);
    S.audio = this.audio;
    S.input = this.input;
    this.last = 0;
    this.frames = 0;
    this.fpsTime = 0;
    this.wireMenu();
    // Debug hook for the automated playtest: read-only state plus the
    // same start functions the menu buttons call. The game never reads it.
    window.__solmar = {
      state: S,
      startNew: () => this.newGame(),
      startContinue: () => this.continueGame(),
      resume: () => this.resume(),
    };
    if (this.shotName) {
      document.getElementById('menu').style.display = 'none';
      this.newGame();
      // NB: newGame() replaces this.state, so the scene must be built on
      // the fresh state, not the constructor's first one.
      setupShot(this.state, this.shotName);
    } else {
      this.showMenu();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  wireMenu() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => {
      this.audio.unlock();
      this.newGame();
    });
    $('btn-continue').addEventListener('click', () => {
      this.audio.unlock();
      this.continueGame();
    });
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => {
      this.audio.unlock();
      this.newGame();
    });
    $('btn-quit').addEventListener('click', () => this.showMenu());
    $('btn-back').addEventListener('click', () => {
      this.audio.unlock();
      this.respawnAfterEnd();
    });
    $('btn-end-menu').addEventListener('click', () => this.showMenu());
    $('btn-roam').addEventListener('click', () => {
      $('overlay-complete').style.display = 'none';
      this.state.mode = 'playing';
    });
    $('btn-complete-menu').addEventListener('click', () => this.showMenu());
  }

  showMenu() {
    const S = this.state;
    S.mode = 'menu';
    this.audio.stopAll();
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('overlay-end').style.display = 'none';
    document.getElementById('overlay-complete').style.display = 'none';
    document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
  }

  newGame() {
    clearSave();
    this.state = createState(this.seed);
    const S = this.state;
    S.busted = () => this.busted();
    S.wasted = () => this.wasted();
    S.saveGame = () => this.saveGame();
    S.spawnVipers = () => spawnVipers(S);
    S.audio = this.audio;
    S.input = this.input;
    window.__solmar.state = S;
    startMission(S, 0);
    S.mode = 'playing';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('overlay-end').style.display = 'none';
    document.getElementById('overlay-complete').style.display = 'none';
    this.saveGame();
  }

  continueGame() {
    const data = readSave();
    this.newGame();
    if (!data) return;
    const S = this.state;
    const p = S.player;
    p.cash = data.cash;
    p.hp = data.hp;
    p.ammo = data.ammo;
    p.x = data.x;
    p.y = data.y;
    S.timeOfDay = data.timeOfDay || 'day';
    S.stats.kills = data.kills || 0;
    S.stats.carsStolen = data.carsStolen || 0;
    S.mission.done = data.done || [];
    startMission(S, data.missionIndex || 0);
    if (data.missionIndex >= 5) S.mission.done = ['first-wheels', 'sunset-courier', 'pier-showdown', 'heat-run', 'night-run'];
    S.mode = 'playing';
  }

  resume() {
    if (this.state.mode !== 'paused') return;
    this.state.mode = 'playing';
    document.getElementById('pause').style.display = 'none';
  }

  pause() {
    if (this.state.mode !== 'playing') return;
    this.state.mode = 'paused';
    this.audio.engine(false, 0);
    this.audio.siren(false, 0);
    document.getElementById('pause').style.display = 'flex';
    this.saveGame();
  }

  busted() {
    const S = this.state;
    if (S.mode !== 'playing') return;
    S.mode = 'busted';
    S.player.cash = Math.max(0, S.player.cash - 100);
    S.player.heat = 0;
    S.player.wanted = 0;
    S.player.bust = 0;
    S.cars.police = [];
    S.cops = [];
    this.audio.bust();
    this.audio.engine(false, 0);
    this.audio.siren(false, 0);
    document.getElementById('end-title').textContent = 'BUSTED';
    document.getElementById('end-text').textContent =
      'The Solmar PD caught up with Dana. $100 bail, and the heat is off — for now.';
    document.getElementById('overlay-end').style.display = 'flex';
    this.saveGame();
  }

  wasted() {
    const S = this.state;
    if (S.mode !== 'playing') return;
    S.mode = 'wasted';
    S.player.cash = Math.max(0, S.player.cash - 150);
    S.player.heat = 0;
    S.player.wanted = 0;
    S.player.bust = 0;
    S.cars.police = [];
    S.cops = [];
    this.audio.bust();
    this.audio.engine(false, 0);
    this.audio.siren(false, 0);
    document.getElementById('end-title').textContent = 'WASTED';
    document.getElementById('end-text').textContent =
      'Dana is down. The medics patch her up for $150 and drop her back on the streets.';
    document.getElementById('overlay-end').style.display = 'flex';
    this.saveGame();
  }

  respawnAfterEnd() {
    const S = this.state;
    const p = S.player;
    p.hp = 100;
    p.ammo = 24;
    p.car = null;
    p.x = GARAGE.mx;
    p.y = GARAGE.my + 60;
    p.angle = -Math.PI / 2;
    S.bullets = [];
    S.vipers = [];
    document.getElementById('overlay-end').style.display = 'none';
    S.mode = 'playing';
    this.saveGame();
  }

  saveGame() {
    writeSave(this.state);
  }

  commitCrime(heat) {
    const S = this.state;
    S.player.heat = Math.min(10, S.player.heat + heat);
    S.lastCrimeAt = S.time;
  }

  stealOrExit() {
    const S = this.state;
    const p = S.player;
    if (p.car) {
      // Step out: the car stays where it is, parked.
      const car = p.car;
      car.kind = 'parked';
      car.speed = 0;
      S.cars.parked.push(car);
      p.car = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
      const fixed = resolveCircle(S.city, p.x, p.y, 12);
      p.x = fixed.x;
      p.y = fixed.y;
      this.audio.engine(false, 0);
      return;
    }
    let best = null;
    let bestD = 52;
    for (const car of S.cars.parked) {
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    S.cars.parked = S.cars.parked.filter((c) => c !== best);
    best.kind = 'player';
    p.car = best;
    p.x = best.x;
    p.y = best.y;
    p.angle = best.angle;
    p.speed = 0;
    S.stats.carsStolen += 1;
    this.commitCrime(2);
    this.audio.chime();
    this.saveGame();
  }

  shoot() {
    const S = this.state;
    const p = S.player;
    if (S.fireCd > 0 || p.ammo <= 0) return;
    S.fireCd = FIRE_INTERVAL;
    const wx = this.input.mouseX + S.cam.x;
    const wy = this.input.mouseY + S.cam.y;
    const angle = angleTo(p.x, p.y, wx, wy);
    p.angle = angle;
    fireBullet(S, p.x, p.y, angle, true);
    p.ammo -= 1;
    S.shotsFiredAt = S.time;
    this.commitCrime(1);
    this.audio.shot();
    S.fx.push({ kind: 'flash', x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22, life: 0.1, max: 0.1 });
  }

  updateOnFoot(dt) {
    const S = this.state;
    const p = S.player;
    const input = this.input;
    const axis = input.moveAxis();
    const running = input.down('ShiftLeft', 'ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;
    let moved = false;
    if (axis.x !== 0 || axis.y !== 0) {
      const len = Math.hypot(axis.x, axis.y);
      const nx = p.x + (axis.x / len) * speed * dt;
      const ny = p.y + (axis.y / len) * speed * dt;
      const fixed = resolveCircle(S.city, nx, ny, 12);
      p.walkBlocked = fixed.hit;
      p.x = clamp(fixed.x, 20, WORLD - 20);
      p.y = clamp(fixed.y, 20, WORLD - 20);
      moved = true;
    } else {
      p.walkBlocked = false;
    }
    // Face the mouse when it moved recently, else the walk direction.
    if (S.time - input.mouseMovedAt < 2) {
      p.angle = angleTo(p.x, p.y, input.mouseX + S.cam.x, input.mouseY + S.cam.y);
    } else if (moved) {
      p.angle = angleTo(0, 0, axis.x, axis.y);
    }
    p.speed = moved ? speed : 0;
  }

  update(dt) {
    const S = this.state;
    const p = S.player;
    S.time += dt;
    S.fireCd = Math.max(0, S.fireCd - dt);
    if (S.bannerT > 0) S.bannerT -= dt;

    if (this.input.justPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
    }
    if (this.input.justPressed('KeyP')) {
      if (S.mode === 'playing') this.pause();
      else if (S.mode === 'paused') this.resume();
      return;
    }
    if (S.mode !== 'playing') return;

    if (this.input.justPressed('KeyE')) this.stealOrExit();
    if (this.input.clickConsumed()) this.shoot();

    if (p.car) updateDriving(S, dt);
    else this.updateOnFoot(dt);

    updateTraffic(S, dt);
    updatePoliceCars(S, dt);
    updatePeds(S, dt);
    updateCops(S, dt);
    updateVipers(S, dt);
    updateBullets(S, dt);

    // Wanted: heat decays only when the player has been quiet and no
    // police car is close. Wanted level is the ceiling of heat / 2.
    const nearPolice = S.cars.police.some((c) => dist(c.x, c.y, p.x, p.y) < 320);
    if (S.time - S.lastCrimeAt > 5 && !nearPolice && p.heat > 0) {
      p.heat = Math.max(0, p.heat - dt / 6);
    }
    p.wanted = Math.min(5, Math.ceil(p.heat / 2));

    // Police presence follows the wanted level, one spawn a second.
    S.policeTimer -= dt;
    const wantCars = Math.min(p.wanted, 3);
    if (S.cars.police.length < wantCars && S.policeTimer <= 0) {
      spawnPoliceCar(S);
      S.policeTimer = 1;
    }
    while (S.cars.police.length > wantCars) S.cars.police.pop();
    const wantCops = p.wanted >= 2 ? Math.min(p.wanted - 1, 3) : 0;
    if (S.cops.length < wantCops && S.policeTimer <= 0) {
      S.cops.push(spawnOfficer(S));
      S.policeTimer = 1;
    }
    while (S.cops.length > wantCops) S.cops.pop();

    updateMission(S, dt);
    updateSideJob(S, dt);

    for (let i = S.fx.length - 1; i >= 0; i--) {
      S.fx[i].life -= dt;
      if (S.fx[i].life <= 0) S.fx.splice(i, 1);
    }
    if (!p.car) this.audio.engine(false, 0);
    this.audio.siren(p.wanted > 0, dt);

    S.saveTimer -= dt;
    if (S.saveTimer <= 0) {
      S.saveTimer = 8;
      this.saveGame();
    }
  }

  loop(t) {
    const dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    const S = this.state;
    this.frames += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      S.fps = this.frames / this.fpsTime;
      this.frames = 0;
      this.fpsTime = 0;
    }
    if (S.mode === 'menu') {
      S.time += dt;
    } else {
      this.update(dt);
    }
    if (S.mode === 'complete') {
      document.getElementById('overlay-complete').style.display = 'flex';
    }
    render(this.ctx, S);
    this.input.endFrame(S.time);
    if (S.shot) {
      S.shotFrames += 1;
      if (S.shotFrames === 100) window.__shotReady = true;
    }
    requestAnimationFrame((nt) => this.loop(nt));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  new Game(canvas);
});
