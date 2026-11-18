// Save / continue via localStorage. Only plain numbers and mission progress
// are stored — never a key, never a name the player did not type.
const KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.cash,
      health: state.health,
      ammo: state.ammo,
      missionIndex: state.missions.index,
      done: state.missions.done,
      px: state.px, py: state.py,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
