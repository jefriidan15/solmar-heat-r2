// missions.js — Rosa's five jobs plus courier side work for Solmar Heat.
// Each mission is a small stage machine with a map marker and a plain
// objective line; completing one pays cash, refills ammo, and advances
// the story. Failing a timed job resets that job, never the story.
import { GARAGE, SAFEHOUSE, DEPOT, PIER } from './city.js';
import { dist } from './rng.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    brief: 'Steal a car and bring it to Rosa\u2019s Garage.',
    reward: 400,
  },
  {
    id: 'sunset-courier',
    name: 'Sunset Courier',
    brief: 'Pick up the package at the garage, deliver to the North Depot in 90s.',
    reward: 600,
  },
  {
    id: 'pier-showdown',
    name: 'Pier Showdown',
    brief: 'The Vipers hold the docks. Clear all four of them.',
    reward: 800,
  },
  {
    id: 'heat-run',
    name: 'Heat Run',
    brief: 'Draw 3 stars of heat, then shake it off and reach the safehouse.',
    reward: 1000,
  },
  {
    id: 'night-run',
    name: 'Night Run',
    brief: 'One last delivery to the North Depot, after dark. Don\u2019t get caught.',
    reward: 1500,
  },
];

export function freshMissionState() {
  return {
    index: 0,
    done: [],
    stage: 'steal',
    timer: 0,
    target: null,
    text: MISSIONS[0].brief,
    failed: false,
  };
}

function setTarget(S, x, y, r, label) {
  S.mission.target = { x, y, r, label };
}

export function startMission(S, index) {
  const m = S.mission;
  m.index = index;
  m.failed = false;
  const job = MISSIONS[index];
  if (!job) {
    m.text = 'Solmar is yours. Free roam — courier work pays on the side.';
    m.target = null;
    return;
  }
  if (index === 0) {
    m.stage = 'steal';
    m.text = job.brief;
    setTarget(S, GARAGE.mx, GARAGE.my, GARAGE.mr, GARAGE.name);
  } else if (index === 1) {
    m.stage = 'pickup';
    m.text = job.brief;
    setTarget(S, GARAGE.mx, GARAGE.my, GARAGE.mr, 'Pickup: ' + GARAGE.name);
  } else if (index === 2) {
    m.stage = 'goto';
    m.text = job.brief;
    setTarget(S, PIER.mx, PIER.my, PIER.mr, PIER.name);
  } else if (index === 3) {
    m.stage = 'heat';
    m.text = job.brief;
    setTarget(S, SAFEHOUSE.mx, SAFEHOUSE.my, SAFEHOUSE.mr, SAFEHOUSE.name);
  } else if (index === 4) {
    m.stage = 'drive';
    S.timeOfDay = 'night';
    m.text = job.brief;
    setTarget(S, DEPOT.mx, DEPOT.my, DEPOT.mr, DEPOT.name + ' (night)');
  }
}

export function completeMission(S) {
  const job = MISSIONS[S.mission.index];
  if (!job) return;
  S.player.cash += job.reward;
  S.player.ammo = 24;
  S.mission.done.push(job.id);
  S.audio.jingle();
  S.banner = job.name + ' complete — +$' + job.reward;
  S.bannerT = 3;
  S.mission.index += 1;
  startMission(S, S.mission.index);
  S.saveGame();
}

function failMission(S, why) {
  S.banner = 'Job failed: ' + why + ' — Rosa will give you another shot.';
  S.bannerT = 3;
  S.audio.bust();
  startMission(S, S.mission.index);
}

export function updateMission(S, dt) {
  const m = S.mission;
  const p = S.player;
  if (m.index >= MISSIONS.length) return;
  const job = MISSIONS[m.index];
  if (m.index === 0) {
    if (m.stage === 'steal') {
      if (p.car) {
        m.stage = 'drive';
        m.text = 'Now drive it to Rosa\u2019s Garage, east on the 1200 road.';
      }
    } else if (p.car && dist(p.x, p.y, GARAGE.mx, GARAGE.my) < GARAGE.mr) {
      completeMission(S);
    }
  } else if (m.index === 1) {
    if (m.stage === 'pickup') {
      if (dist(p.x, p.y, GARAGE.mx, GARAGE.my) < GARAGE.mr) {
        m.stage = 'deliver';
        m.timer = 90;
        m.text = 'Package aboard — 90 seconds to the North Depot!';
        setTarget(S, DEPOT.mx, DEPOT.my, DEPOT.mr, 'Deliver: ' + DEPOT.name);
        S.audio.chime();
      }
    } else if (m.stage === 'deliver') {
      m.timer -= dt;
      m.text = 'Deliver to the North Depot — ' + Math.max(0, Math.ceil(m.timer)) + 's left!';
      if (dist(p.x, p.y, DEPOT.mx, DEPOT.my) < DEPOT.mr) {
        completeMission(S);
      } else if (m.timer <= 0) {
        failMission(S, 'the package is late');
      }
    }
  } else if (m.index === 2) {
    if (m.stage === 'goto') {
      if (dist(p.x, p.y, PIER.mx, PIER.my) < PIER.mr) {
        m.stage = 'fight';
        m.text = 'Four Vipers on the pier. Take them all down!';
        S.spawnVipers();
        S.audio.chime();
      }
    } else if (m.stage === 'fight') {
      const left = S.vipers.filter((v) => !v.dead).length;
      m.text = 'Clear the docks — ' + left + ' Viper' + (left === 1 ? '' : 's') + ' left.';
      if (left === 0) completeMission(S);
    }
  } else if (m.index === 3) {
    if (m.stage === 'heat') {
      m.text = 'Draw heat: steal cars, fire shots — get to 3 stars!';
      if (p.wanted >= 3) {
        m.stage = 'evade';
        m.text = '3 stars! Now shake the heat and reach the safehouse.';
        S.audio.chime();
      }
    } else if (m.stage === 'evade') {
      m.text = 'Stay out of sight until the heat drops, then reach the safehouse.';
      if (p.wanted <= 0) {
        m.stage = 'safehouse';
        m.text = 'Heat is off — get to the safehouse, west on the 1500 road.';
      }
    } else if (p.wanted <= 0 && dist(p.x, p.y, SAFEHOUSE.mx, SAFEHOUSE.my) < SAFEHOUSE.mr) {
      completeMission(S);
    }
  } else if (m.index === 4) {
    m.text = 'Night Run: deliver to the North Depot. Keep it quiet.';
    if (dist(p.x, p.y, DEPOT.mx, DEPOT.my) < DEPOT.mr) {
      completeMission(S);
      S.mode = 'complete';
    }
  }
}

// Courier side work: a paying drop spawns on a road marker every so
// often while the player free-roams. Small money, no story stakes.
export function updateSideJob(S, dt) {
  const side = S.side;
  if (!side.active) {
    side.cooldown -= dt;
    if (side.cooldown <= 0 && S.mission.index < MISSIONS.length) {
      const rng = S.rng;
      const vertical = rng.chance(0.5);
      const road = rng.pick([600, 900, 1500, 1800]);
      const along = 500 + rng.next() * 1400;
      side.active = true;
      side.timer = 60;
      side.reward = 75 + rng.int(0, 3) * 25;
      side.target = {
        x: vertical ? road : along,
        y: vertical ? along : road,
        r: 55,
        label: 'Courier drop +$' + side.reward,
      };
      S.audio.chime();
    }
    return;
  }
  side.timer -= dt;
  const p = S.player;
  if (dist(p.x, p.y, side.target.x, side.target.y) < side.target.r) {
    p.cash += side.reward;
    S.banner = 'Courier drop done — +$' + side.reward;
    S.bannerT = 2.5;
    S.audio.jingle();
    side.active = false;
    side.cooldown = 40 + S.rng.next() * 30;
    S.saveGame();
  } else if (side.timer <= 0) {
    side.active = false;
    side.cooldown = 30;
  }
}

export function objectiveText(S) {
  const lines = [];
  const m = S.mission;
  if (m.index < MISSIONS.length) {
    lines.push(MISSIONS[m.index].name + ': ' + m.text);
  } else {
    lines.push('Free roam — Solmar is yours.');
  }
  if (S.side.active) {
    lines.push('Side: ' + S.side.target.label + ' (' + Math.ceil(S.side.timer) + 's)');
  }
  return lines;
}
