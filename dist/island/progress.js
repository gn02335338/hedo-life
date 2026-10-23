import { DISTRICTS } from './content.js';

export const STORAGE_KEY = 'hedo-island-v1';
const districtIds = new Set(DISTRICTS.map(district => district.id));

export function freshProgress() {
  return { version: 1, visited: [], choices: {} };
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Project onto known district IDs instead of copying arbitrary saved keys.
// A choice without a matching visit is discarded, never promoted to a visit.
function validatedProgress(value) {
  try {
    if (!isRecord(value) || !Object.hasOwn(value, 'version') || value.version !== 1
      || !Object.hasOwn(value, 'visited') || !Array.isArray(value.visited)
      || !Object.hasOwn(value, 'choices') || !isRecord(value.choices)) return freshProgress();

    const progress = freshProgress();
    const seen = new Set();
    for (const id of value.visited) {
      if (typeof id !== 'string' || !districtIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      progress.visited.push(id);
      if (seen.size === districtIds.size) break;
    }
    for (const id of progress.visited) {
      if (!Object.hasOwn(value.choices, id)) continue;
      const choice = value.choices[id];
      if (Number.isInteger(choice) && choice >= 0 && choice <= 2) progress.choices[id] = choice;
    }
    return progress;
  } catch {
    // Storage adapters, proxies and supplied objects may expose throwing getters.
    return freshProgress();
  }
}

export function readProgress(storage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return typeof saved === 'string' ? validatedProgress(JSON.parse(saved)) : freshProgress();
  } catch {
    return freshProgress();
  }
}

export function writeProgress(storage, progress) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(validatedProgress(progress)));
    return true;
  } catch {
    return false;
  }
}
