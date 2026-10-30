import { STORAGE_KEY, freshProgress, sanitizeProgress } from './model.js';

// Resolve the browser adapter inside try/catch: accessing localStorage itself
// may throw in restricted browsing contexts. An optional adapter supports tests.
function storageAdapter(supplied) {
  return supplied === undefined ? globalThis.localStorage : supplied;
}

export function loadProgress(supplied) {
  try {
    const storage = storageAdapter(supplied);
    if (typeof storage?.getItem !== 'function') return { progress: freshProgress(), available: false };
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { progress: freshProgress(), available: true };
    if (typeof raw !== 'string' || raw.length > 4096) return { progress: freshProgress(), available: true };
    try {
      return { progress: sanitizeProgress(JSON.parse(raw)), available: true };
    } catch {
      return { progress: freshProgress(), available: true };
    }
  } catch {
    return { progress: freshProgress(), available: false };
  }
}

export function saveProgress(progress, supplied) {
  try {
    const storage = storageAdapter(supplied);
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProgress(progress)));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(supplied) {
  try {
    const storage = storageAdapter(supplied);
    if (typeof storage?.removeItem !== 'function') return false;
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
