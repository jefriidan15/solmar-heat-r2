// save.js — localStorage save / continue for Solmar Heat. One slot,
// one key, plain JSON. Saving never throws: a full or blocked storage
// just means the run is not persisted.
export const SAVE_KEY = 'solmar-heat-save-v1';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch (_e) {
    return false;
  }
}

export function writeSave(S) {
  try {
    const p = S.player;
    const data = {
      v: 1,
      cash: p.cash,
      hp: p.hp,
      ammo: p.ammo,
      x: p.x,
      y: p.y,
      missionIndex: S.mission.index,
      done: S.mission.done,
      timeOfDay: S.timeOfDay,
      kills: S.stats.kills,
      carsStolen: S.stats.carsStolen,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (_e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch (_e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (_e) {}
}
