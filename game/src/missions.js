// Missions: Rosa's five jobs, plus repeatable courier pickups for side cash.
// A mission is a small state machine driven by the game's update loop; the
// game owns the player and the world, missions only read positions and set
// the current objective marker + text.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', pay: 400,
    brief: "Rosa: Dana, first test. Steal any car and bring it to my garage. Don't scratch it. Much.",
    objective: 'Steal a car, then drive it to Rosa\'s Garage',
    hint: 'Walk up to a parked car and press E.',
  },
  {
    id: 2, name: 'Sunset Courier', pay: 600,
    brief: "Rosa: A client needs a package across town before sunset. 90 seconds. The depot is marked — go!",
    objective: 'Deliver the package to the Courier Depot before the timer runs out',
    hint: 'Drive fast. The timer is ticking.',
    timed: 90,
  },
  {
    id: 3, name: 'Pier Showdown', pay: 800,
    brief: "Rosa: The Vipers are shaking down my pier crew. Go down there and send them packing. Pistol's loaded.",
    objective: 'Clear the Vipers off Solmar Pier',
    hint: 'Aim with the mouse, click to shoot.',
  },
  {
    id: 4, name: 'Heat Run', pay: 900,
    brief: "Rosa: The heat is on you, Dana. Lose the cops, then slip to the safehouse up north. Stay out of sight.",
    objective: 'Lose your wanted level, then reach the Safehouse',
    hint: 'Hide until the stars fade, then drive north.',
  },
  {
    id: 5, name: 'Night Run', pay: 1500,
    brief: "Rosa: Last one. A hot car for the East Docks, tonight, cops or no cops. Do this and you're family, Dana.",
    objective: 'Deliver a car to the East Docks after dark',
    hint: 'Steal a car, reach the docks. The city is watching.',
  },
];

export function makeMissionState() {
  return {
    index: 0,            // 0-based into MISSIONS
    stage: 'go',         // per-mission stage string
    timer: 0,            // timed missions
    vipersLeft: 0,
    delivered: false,
    failed: false,
    done: false,         // all five finished
    courier: null,       // active side pickup {x,y} or null
    courierCd: 0,
  };
}

// Where the objective marker should point right now. Returns {x, y, label}
// or null when there is no marker (e.g. waiting for the player to steal).
export function missionMarker(m, world, player, inCar) {
  const cur = MISSIONS[m.index];
  if (!cur || m.done) return null;
  const P = world.places;
  switch (cur.id) {
    case 1:
      return inCar ? { x: P.garage.x, y: P.garage.y, label: "Rosa's Garage" } : null;
    case 2:
      return { x: P.courierHub.x, y: P.courierHub.y, label: 'Courier Depot' };
    case 3:
      return { x: P.pier.x, y: P.pier.y, label: 'Solmar Pier' };
    case 4:
      return { x: P.safehouse.x, y: P.safehouse.y, label: 'Safehouse' };
    case 5:
      return inCar ? { x: P.docks.x, y: P.docks.y, label: 'East Docks' } : null;
    default:
      return null;
  }
}

export function missionObjectiveText(m) {
  if (m.done) return 'All jobs done — Solmar is yours, Dana. Free roam!';
  const cur = MISSIONS[m.index];
  if (!cur) return '';
  let t = `Job ${cur.id}/5: ${cur.name} — ${cur.objective}`;
  if (cur.id === 2 && m.timer > 0) t += ` (${Math.ceil(m.timer)}s)`;
  if (cur.id === 3 && m.vipersLeft > 0) t += ` (${m.vipersLeft} Vipers left)`;
  return t;
}

// Called when a mission starts (index changes or fresh game).
export function startMission(m, game) {
  const cur = MISSIONS[m.index];
  if (!cur) { m.done = true; return; }
  m.stage = 'go';
  m.failed = false;
  m.delivered = false;
  m.timer = cur.timed || 0;
  m.vipersLeft = 0;
  if (cur.id === 3) {
    game.spawnVipersAtPier();
    m.vipersLeft = game.vipersAlive();
  }
  if (cur.id === 4) {
    game.forceWanted(3);
  }
  if (cur.id === 5) {
    game.setNight(true);
  }
}

// Per-frame mission progress. `ev` carries game facts; returns 'paid' | 'failed' | null.
export function updateMission(m, ev) {
  const cur = MISSIONS[m.index];
  if (!cur || m.done) return null;
  const near = (tx, ty, r) => {
    const dx = ev.px - tx, dy = ev.py - ty;
    return dx * dx + dy * dy < r * r;
  };
  switch (cur.id) {
    case 1:
      if (ev.inCar && near(ev.garage.x, ev.garage.y, 140)) return 'paid';
      break;
    case 2:
      if (m.timer > 0) {
        m.timer -= ev.dt;
        if (m.timer <= 0) { m.failed = true; return 'failed'; }
      }
      if (near(ev.depot.x, ev.depot.y, 80)) return 'paid';
      break;
    case 3:
      m.vipersLeft = ev.vipersAlive;
      if (m.vipersLeft === 0 && ev.vipersSpawned) return 'paid';
      break;
    case 4:
      if (ev.wanted === 0 && near(ev.safehouse.x, ev.safehouse.y, 90)) return 'paid';
      break;
    case 5:
      if (ev.inCar && near(ev.docks.x, ev.docks.y, 90)) return 'paid';
      break;
  }
  return null;
}

export function advanceMission(m, game) {
  m.index++;
  if (m.index >= MISSIONS.length) { m.done = true; return; }
  startMission(m, game);
}

export function retryMission(m, game) {
  m.failed = false;
  startMission(m, game);
}
