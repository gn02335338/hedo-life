import { MISSIONS } from './world.js';

export const STORAGE_KEY = 'hedo-gta-v1';
const STARTING_MONEY = 500;

export function freshProgress() {
  return { version: 1, completed: [], money: STARTING_MONEY };
}

// Local progress is only a small list of finished errands. Position, active
// deliveries, text and money supplied by a stored record are never trusted.
export function sanitizeProgress(raw) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
      || !Object.hasOwn(raw, 'version') || raw.version !== 1
      || !Object.hasOwn(raw, 'completed') || !Array.isArray(raw.completed)) return freshProgress();
    const savedIds = new Set(raw.completed.filter(id => typeof id === 'string'));
    const progress = freshProgress();
    // Missions unlock sequentially; a forged later ID cannot skip an earlier job.
    for (const mission of MISSIONS) {
      if (!savedIds.has(mission.id)) break;
      progress.completed.push(mission.id);
      progress.money += mission.reward;
    }
    return progress;
  } catch {
    return freshProgress();
  }
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
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProgress(progress)));
    return true;
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
