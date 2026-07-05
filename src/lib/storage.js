// Persistence for user-imported patterns, kept in the browser's localStorage so
// they survive reloads (and work on a static GitHub Pages deploy — no backend).
// Each entry stores the pattern NAME plus everything needed to re-render it.

const KEY = 'lane-oil-patterns-v1';

export function loadSavedPatterns() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore, in-memory state still works this session */
  }
}

// Adds or updates a pattern (matched by id, falling back to name) and returns the
// new list. Entry shape: { id, name, meta, forwardText, reverseText, trackZones }.
export function savePattern(pattern) {
  const list = loadSavedPatterns();
  const id = pattern.id || `saved-${Date.now()}`;
  const entry = { ...pattern, id, savedAt: Date.now() };
  const i = list.findIndex((p) => p.id === id || (p.name && p.name === pattern.name));
  if (i >= 0) list[i] = entry;
  else list.unshift(entry);
  persist(list);
  return list;
}

export function deletePattern(id) {
  const list = loadSavedPatterns().filter((p) => p.id !== id);
  persist(list);
  return list;
}

// ---------------------------------------------------------------------------
// Arsenal — saved bowler/ball spec + line "setups"
// ---------------------------------------------------------------------------
// A setup bundles everything the 플레이 tab needs to reproduce a shot: the
// bowler + ball spec AND the line (laydown/target). Stored separately from
// patterns so a player can flip through their arsenal against any pattern.
const SETUP_KEY = 'lane-oil-setups-v1';

export function loadSetups() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persistSetups(list) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
}

// Entry shape: { id, name, spec:{hand,speedKmh,revRpm,rg,diff,psa,axisRotDeg,
// axisTiltDeg}, line:{laydownBoard,targetBoard} }.
export function saveSetup(setup) {
  const list = loadSetups();
  const id = setup.id || `setup-${Date.now()}`;
  const entry = { ...setup, id, savedAt: Date.now() };
  const i = list.findIndex((s) => s.id === id || (s.name && s.name === setup.name));
  if (i >= 0) list[i] = entry;
  else list.unshift(entry);
  persistSetups(list);
  return list;
}

export function deleteSetup(id) {
  const list = loadSetups().filter((s) => s.id !== id);
  persistSetups(list);
  return list;
}
