// Shared small helpers used across lib and components.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// km/h → ft/s (1 km/h = 0.911344 ft/s)
export const KMH_TO_FTS = 0.911344;

// True when the keyboard focus is inside a text-entry element,
// so global shortcuts (spacebar play/pause etc.) should be ignored.
export const isTypingTarget = () =>
  ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
