import { getCharacterFloor } from './floors.js';

// Public authored office routines, not model execution or player-game actions.
// Both people in a pair share an appointment clock, destination and visit kind.
export const OFFICE_ROUTINE_PAIRS = Object.freeze([
  ['jack', 'cindy'], ['wing', 'hope'], ['spencer', 'janet'], ['erich', 'jenjen'],
  ['sonny', 'captain'], ['rick', 'helen'], ['kind', 'meimei'], ['sophie', 'sam'],
  ['jonathan', 'simon'], ['owen', 'professor'], ['annie_yu', 'mia'], ['princess', 'joyce'],
  ['zoe', 'action'], ['hester', 'johnny'], ['james', 'alice'], ['wine', 'tony'], ['peter', 'henry'],
].map(pair => Object.freeze(pair)));

export const OFFICE_ROUTINE_CYCLE_MS = 226_000;
export const OFFICE_ELEVATOR = Object.freeze({ x: -.75, z: 7.45, doorX: -.75, doorZ: 6.25, laneSpacing: .68, lanes: 3 });
export const OFFICE_ROUTINE_PHASES = Object.freeze([
  ['home-work', 85_000], ['to-elevator', 18_000], ['outbound-lift', 12_000],
  ['to-visit', 18_000], ['visit', 45_000], ['return-to-elevator', 18_000],
  ['return-lift', 12_000], ['return-to-work', 18_000],
].map(([phase, duration], index, rows) => Object.freeze({
  phase, duration, start: rows.slice(0, index).reduce((sum, row) => sum + row[1], 0),
})));

const byCharacter = Object.freeze(Object.fromEntries(OFFICE_ROUTINE_PAIRS.flatMap((pair, pairIndex) => pair.map((id, side) => [id, Object.freeze({ pair, pairIndex, side })]))));
const zones = new Set(['studio', 'meeting', 'focus', 'lounge']);
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export function getCharacterRoutine(id, nowMs = Date.now(), { homeZone = 'studio' } = {}) {
  if (!Object.hasOwn(byCharacter, id)) return null;
  const { pair, pairIndex, side } = byCharacter[id];
  const sampledAt = Number.isFinite(nowMs) ? nowMs : 0;
  const offset = pairIndex * 13_000, shifted = sampledAt + offset;
  const cycle = Math.floor(shifted / OFFICE_ROUTINE_CYCLE_MS), elapsed = modulo(shifted, OFFICE_ROUTINE_CYCLE_MS);
  const visitKind = modulo(pairIndex + cycle, 2) === 0 ? 'meeting' : 'chat';
  const preferred = visitKind === 'meeting' ? [7, 5, 3, 4, 2, 6, 1] : [1, 2, 4, 5, 3, 7, 6];
  const homeFloor = getCharacterFloor(id), partnerId = pair[1 - side];
  const available = preferred.filter(floor => !pair.some(person => getCharacterFloor(person) === floor));
  const destinationFloor = available[modulo(pairIndex + cycle, available.length)];
  const segment = OFFICE_ROUTINE_PHASES.find(row => elapsed >= row.start && elapsed < row.start + row.duration);
  const phase = segment.phase === 'visit' ? visitKind : segment.phase;
  const progress = (elapsed - segment.start) / segment.duration;
  const inElevator = phase === 'outbound-lift' || phase === 'return-lift';
  let fromFloor = homeFloor, toFloor = homeFloor;
  if (phase === 'outbound-lift') toFloor = destinationFloor;
  else if (phase === 'return-lift') { fromFloor = destinationFloor; toFloor = homeFloor; }
  else if (['to-visit', 'meeting', 'chat', 'return-to-elevator'].includes(phase)) fromFloor = toFloor = destinationFloor;
  // Boarding and leaving the cabin use the first/last part of the same phase.
  const travelProgress = Math.max(0, Math.min(1, (progress - .15) / .7));
  const elevation = inElevator ? fromFloor + (toFloor - fromFloor) * travelProgress : fromFloor;
  const phaseStartedAt = cycle * OFFICE_ROUTINE_CYCLE_MS - offset + segment.start;
  const safeHomeZone = zones.has(homeZone) ? homeZone : 'studio';
  const visitZone = visitKind === 'meeting' ? 'meeting' : 'lounge';
  return {
    phase, sampledAt, phaseStartedAt, phaseEndsAt: phaseStartedAt + segment.duration, progress,
    cycle, pairIndex, side, meetingId: `office-${pairIndex}-${cycle}`, partnerId, visitKind,
    homeFloor, destinationFloor, fromFloor, toFloor, elevation,
    floor: Math.max(1, Math.min(7, Math.round(elevation))),
    homeZone: safeHomeZone, visitZone,
    zone: phase === 'home-work' || phase === 'return-to-work' ? safeHomeZone : ['to-visit', 'meeting', 'chat'].includes(phase) ? visitZone : 'studio',
    inElevator, travelProgress, liftLane: (pairIndex * 2 + side) % OFFICE_ELEVATOR.lanes,
  };
}
