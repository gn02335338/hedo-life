import { normalizeProgress } from './engine.js';

export const STORAGE_KEY = 'hedo-arpg-v1';
const MAX_SAVE_BYTES = 100_000;

// This standalone game never reads the career game's saves or anonymous key.
// The engine owns the item schema so loading cannot silently strip equipment.
export function readProgress(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (typeof raw !== 'string' || raw.length > MAX_SAVE_BYTES) return null;
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeProgress(storage, value) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    const progress = normalizeProgress(value);
    if (!progress) return false;
    const raw = JSON.stringify(progress);
    if (raw.length > MAX_SAVE_BYTES) return false;
    storage.setItem(STORAGE_KEY, raw);
    return true;
  } catch {
    // Quota limits, private browsing and disabled storage do not stop play.
    return false;
  }
}

export function clearProgress(storage) {
  try {
    if (typeof storage?.removeItem !== 'function') return false;
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
