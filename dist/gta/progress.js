import { MISSIONS } from './world.js';
import { createGarageProgress, replayGarageProgress } from './garage.js';

export const STORAGE_KEY = 'hedo-gta-v1';
export function freshProgress() {
  return createGarageProgress();
}

// Purchases and mission completions are replayed into a projection. Owned-car
// health is a bounded snapshot; selection is only a preference, never a spawn.
// Position, active deliveries and cached money/customizations are not trusted.
export function sanitizeProgress(raw) {
  return replayGarageProgress(raw);
}

export function loadProgress(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return typeof raw === 'string' ? sanitizeProgress(JSON.parse(raw)) : freshProgress();
  } catch {
    return freshProgress();
  }
}

export function saveProgress(storage, progress) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    const serialized = JSON.stringify(sanitizeProgress(progress));
    storage.setItem(STORAGE_KEY, serialized);
    return typeof storage.getItem !== 'function' || storage.getItem(STORAGE_KEY) === serialized;
  } catch {
    return false;
  }
}

export function completeMission(progress, missionId) {
  const next = sanitizeProgress(progress);
  const mission = MISSIONS[next.completed.length];
  if (mission?.id !== missionId) return next;
  next.completed.push(mission.id);
  next.money += mission.reward;
  return next;
}
