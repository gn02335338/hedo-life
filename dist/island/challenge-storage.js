import { ISLAND_CAST } from './cast.js';

// Only storage names and plain roster IDs live here. Domain migration can carry
// challenge records without importing story copy, portraits or battle code.
export const CHALLENGE_STORAGE_KEY = 'hedo-island-challenge-v1';
const bosses = ['rick', 'spencer', 'wing'];
const ids = [...ISLAND_CAST.map(person => person.id).filter(id => !bosses.includes(id)), ...bosses, 'hidden-visitor'];
export const CHALLENGE_RECEIPT_KEYS = Object.freeze(Object.fromEntries(ids.map(id => [id, `${CHALLENGE_STORAGE_KEY}:win:${id}`])));
export const CHALLENGE_INVITATION_KEY = `${CHALLENGE_STORAGE_KEY}:invitation`;
export const CHALLENGE_STORAGE_KEYS = Object.freeze([CHALLENGE_STORAGE_KEY, ...Object.values(CHALLENGE_RECEIPT_KEYS), CHALLENGE_INVITATION_KEY]);
