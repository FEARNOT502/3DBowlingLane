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
