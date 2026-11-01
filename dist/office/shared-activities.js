import { getOfficeGameActions } from './events.js';

export const SHARED_OFFICE_ROUND_MS = 45_000;
export function sharedOfficeActionIds(type) { return getOfficeGameActions(type).map(action => action.id); }

export function createSharedOfficeGame(type) {
  if (!sharedOfficeActionIds(type).length) throw new TypeError('無效的共享活動類型。');
  return { version: 1, type, round: 0, maxRounds: type === 'coffee' ? 4 : 8, status: 'playing', scores: [0, 0], energy: [2, 2], history: [], winner: null };
}

function armMove(action, energy) {
  if (action === 'power') return { force: 2 + Math.min(3, energy), energy: Math.max(0, energy - 2) };
  if (action === 'steady') return { force: 2, energy: Math.min(6, energy + 1) };
  return { force: 1, energy: Math.min(6, energy + 2) };
}

// Both actions must already have been sealed by the server. There is no RNG,
// synthetic opponent, browser score, or early projection of the other action.
export function resolveSharedOfficeRound(state, actions) {
  const options = sharedOfficeActionIds(state?.type);
  if (!state || state.version !== 1 || !options.length || state.status !== 'playing' || !Number.isInteger(state.round) || state.round < 0 || state.maxRounds !== (state.type === 'coffee' ? 4 : 8) || state.round >= state.maxRounds
    || !Array.isArray(state.history) || state.history.length !== state.round || !Array.isArray(state.scores) || state.scores.length !== 2 || !state.scores.every(value => Number.isInteger(value) && value >= 0 && value <= state.round * 2)
    || !Array.isArray(state.energy) || state.energy.length !== 2 || !state.energy.every(value => Number.isInteger(value) && value >= 0 && value <= 6)
    || !Array.isArray(actions) || actions.length !== 2 || actions.some(action => !options.includes(action))) throw new TypeError('共享活動回合資料無效。');
  let comparison, energy = [...state.energy];
  if (state.type === 'arm-wrestling') {
    const moves = actions.map((action, index) => armMove(action, energy[index]));
    const forces = moves.map((move, index) => move.force - (actions[index] === 'power' && actions[1 - index] === 'steady' ? 1 : 0));
    energy = moves.map(move => move.energy); comparison = Math.sign(forces[0] - forces[1]);
  } else {
    const [a, b] = actions.map(action => options.indexOf(action));
    comparison = a === b ? 0 : ((a - b) % 3 + 3) % 3 === 1 ? 1 : -1;
  }
  const points = comparison === 0 ? [1, 1] : comparison > 0 ? [2, 0] : [0, 2];
  const scores = state.scores.map((score, index) => score + points[index]);
  const row = { round: state.round + 1, actions: [...actions], points, scores: [...scores], energy: [...energy] };
  const finished = row.round === state.maxRounds;
  return { ...state, round: row.round, scores, energy, history: [...state.history.map(previous => ({ ...previous, actions: [...previous.actions], points: [...previous.points], scores: [...previous.scores], energy: [...previous.energy] })), row], status: finished ? 'finished' : 'playing', winner: finished ? scores[0] === scores[1] ? 'draw' : scores[0] > scores[1] ? 0 : 1 : null };
}
