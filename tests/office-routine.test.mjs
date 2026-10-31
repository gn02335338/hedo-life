import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAS } from '../dist/persona.js';
import { getCharacterFloor, isOfficeFloor } from '../dist/office/floors.js';
import { OFFICE_ROUTINE_PAIRS, OFFICE_ROUTINE_PHASES, OFFICE_ROUTINE_CYCLE_MS, OFFICE_ELEVATOR, getCharacterRoutine } from '../dist/office/routine.js';

const ids = Object.keys(PERSONAS);
const phaseNames = ['home-work', 'to-elevator', 'outbound-lift', 'to-visit', 'meeting', 'chat', 'return-to-elevator', 'return-lift', 'return-to-work'];
const segmentOf = routine => OFFICE_ROUTINE_PHASES.find(row => row.phase === routine.phase || row.phase === 'visit' && ['meeting', 'chat'].includes(routine.phase));
function cycleStart(id) { const initial = getCharacterRoutine(id, 0); return initial.phaseStartedAt - segmentOf(initial).start; }
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} versus ${b}`);

test('17 immutable pairs cover exactly the 34 public colleagues and share a complete positive-duration cycle', () => {
  assert.equal(OFFICE_ROUTINE_PAIRS.length, 17);
  const paired = OFFICE_ROUTINE_PAIRS.flat();
  assert.equal(new Set(paired).size, 34);
  assert.deepEqual([...paired].sort(), [...ids].sort());
  assert.ok(Object.isFrozen(OFFICE_ROUTINE_PAIRS));
  for (const pair of OFFICE_ROUTINE_PAIRS) { assert.equal(pair.length, 2); assert.notEqual(pair[0], pair[1]); assert.ok(Object.isFrozen(pair)); }
  let elapsed = 0;
  for (const segment of OFFICE_ROUTINE_PHASES) {
    assert.equal(segment.start, elapsed); assert.ok(segment.duration > 0); elapsed += segment.duration;
    assert.ok(Object.isFrozen(segment));
  }
  assert.equal(elapsed, OFFICE_ROUTINE_CYCLE_MS);
  assert.equal(OFFICE_ROUTINE_CYCLE_MS, 226_000);
  assert.ok(Object.isFrozen(OFFICE_ELEVATOR));
  assert.ok(OFFICE_ELEVATOR.lanes >= 2 && OFFICE_ELEVATOR.laneSpacing > 0);
  assert.ok(Number.isFinite(OFFICE_ELEVATOR.x) && Number.isFinite(OFFICE_ELEVATOR.z));
});

test('every colleague leaves their own department, meets a synchronized partner elsewhere, and explicitly comes home', () => {
  for (const [pairIndex, [first, second]] of OFFICE_ROUTINE_PAIRS.entries()) {
    const start = cycleStart(first); assert.equal(cycleStart(second), start);
    const covered = new Set();
    for (let cycle = 0; cycle < 2; cycle++) for (const segment of OFFICE_ROUTINE_PHASES) {
      const now = start + cycle * OFFICE_ROUTINE_CYCLE_MS + segment.start + segment.duration / 2;
      const a = getCharacterRoutine(first, now, { homeZone: 'focus' }), b = getCharacterRoutine(second, now, { homeZone: 'studio' });
      for (const key of ['phase', 'phaseStartedAt', 'phaseEndsAt', 'progress', 'cycle', 'pairIndex', 'meetingId', 'visitKind', 'destinationFloor']) assert.equal(a[key], b[key], `${first}/${second}: ${key}`);
      assert.equal(a.partnerId, second); assert.equal(b.partnerId, first); assert.equal(a.pairIndex, pairIndex);
      assert.notEqual(a.liftLane, b.liftLane);
      assert.ok(![getCharacterFloor(first), getCharacterFloor(second)].includes(a.destinationFloor));
      for (const [id, routine] of [[first, a], [second, b]]) {
        assert.equal(routine.homeFloor, getCharacterFloor(id));
        assert.equal(routine.sampledAt, now);
        assert.ok(isOfficeFloor(routine.floor));
        assert.ok(routine.progress >= 0 && routine.progress < 1);
        assert.ok(routine.phaseStartedAt <= now && now < routine.phaseEndsAt);
        assert.ok(routine.liftLane >= 0 && routine.liftLane < OFFICE_ELEVATOR.lanes);
        if (['home-work', 'to-elevator', 'return-to-work'].includes(routine.phase)) assert.equal(routine.floor, routine.homeFloor);
        if (['to-visit', 'meeting', 'chat', 'return-to-elevator'].includes(routine.phase)) assert.equal(routine.floor, routine.destinationFloor);
        if (routine.phase === 'outbound-lift') { assert.equal(routine.fromFloor, routine.homeFloor); assert.equal(routine.toFloor, routine.destinationFloor); }
        if (routine.phase === 'return-lift') { assert.equal(routine.fromFloor, routine.destinationFloor); assert.equal(routine.toFloor, routine.homeFloor); }
        if (['meeting', 'chat'].includes(routine.phase)) assert.equal(routine.zone, routine.phase === 'meeting' ? 'meeting' : 'lounge');
      }
      if (['home-work', 'return-to-work'].includes(a.phase)) { assert.equal(a.zone, 'focus'); assert.equal(b.zone, 'studio'); }
      covered.add(a.phase);
    }
    assert.deepEqual([...covered].sort(), [...phaseNames].sort(), first);
    for (const id of [first, second]) {
      const next = getCharacterRoutine(id, start + OFFICE_ROUTINE_CYCLE_MS);
      assert.equal(next.phase, 'home-work'); assert.equal(next.elevation, getCharacterFloor(id));
    }
  }
  assert.ok(new Set(ids.map(id => getCharacterRoutine(id, 0).phase)).size >= 4, 'The whole office must not enter an elevator at once');
});

test('lift boarding, smooth vertical travel and exit keep the right endpoints on outward and return journeys', () => {
  const directions = new Set();
  for (const id of ids) for (const name of ['outbound-lift', 'return-lift']) {
    const segment = OFFICE_ROUTINE_PHASES.find(row => row.phase === name), start = cycleStart(id) + segment.start;
    const samples = [0, .10, .15, .5, .85, .95].map(progress => getCharacterRoutine(id, start + segment.duration * progress));
    const origin = samples[0].fromFloor, destination = samples[0].toFloor;
    assert.notEqual(origin, destination);
    directions.add(destination > origin ? 'up' : 'down');
    for (const sample of samples) {
      assert.equal(sample.phase, name); assert.equal(sample.inElevator, true);
      assert.ok(sample.elevation >= Math.min(origin, destination) && sample.elevation <= Math.max(origin, destination));
      assert.equal(sample.floor, Math.round(sample.elevation));
    }
    for (const index of [0, 1, 2]) { close(samples[index].elevation, origin, `${id} boards on their origin floor`); close(samples[index].travelProgress, 0, 'boarding progress'); }
    close(samples[3].elevation, (origin + destination) / 2, `${id} halfway elevation`);
    close(samples[3].travelProgress, .5, 'midpoint progress');
    for (const index of [4, 5]) { close(samples[index].elevation, destination, `${id} exits on destination floor`); close(samples[index].travelProgress, 1, 'exit progress'); }
  }
  assert.deepEqual([...directions].sort(), ['down', 'up']);
});

test('phase boundaries remain continuous through negative and positive cycles and switch at the exact timestamp', () => {
  for (const id of ids) for (const cycle of [-2, -1, 0, 1]) {
    const start = cycleStart(id) + cycle * OFFICE_ROUTINE_CYCLE_MS;
    for (const segment of OFFICE_ROUTINE_PHASES) {
      const boundary = start + segment.start, before = getCharacterRoutine(id, boundary - 1), at = getCharacterRoutine(id, boundary);
      const expected = segment.phase === 'visit' ? at.visitKind : segment.phase;
      assert.equal(at.phase, expected); assert.equal(at.phaseStartedAt, boundary); assert.equal(at.progress, 0);
      assert.equal(before.phaseEndsAt, boundary);
      close(before.elevation, at.elevation, `${id} continuous height at ${expected}`);
      assert.equal(at.phaseEndsAt - at.phaseStartedAt, segment.duration);
    }
  }
});

test('invalid times normalize safely, unknown identities stay absent, and readings cannot mutate shared routines', () => {
  for (const id of ids) {
    for (const badTime of [NaN, Infinity, -Infinity, null, undefined, '123']) {
      if (badTime === undefined) continue; // Omitted time intentionally uses Date.now().
      assert.deepEqual(getCharacterRoutine(id, badTime), getCharacterRoutine(id, 0));
    }
    for (const now of [-1, -OFFICE_ROUTINE_CYCLE_MS - 1, -1_000_000]) {
      const routine = getCharacterRoutine(id, now);
      assert.ok(phaseNames.includes(routine.phase)); assert.ok(isOfficeFloor(routine.floor)); assert.ok(Number.isFinite(routine.elevation));
      assert.equal(routine.sampledAt, now); assert.ok(routine.progress >= 0 && routine.progress < 1);
    }
    assert.equal(getCharacterRoutine(id, cycleStart(id), { homeZone: 'invalid' }).zone, 'studio');
    const original = getCharacterRoutine(id, 0), mutated = getCharacterRoutine(id, 0);
    mutated.partnerId = 'unknown'; mutated.homeFloor = 1; assert.deepEqual(getCharacterRoutine(id, 0), original);
  }
  for (const id of ['unknown', '__proto__', 'constructor', 'toString', 'company-mystery', null, undefined, Symbol('unknown')]) assert.equal(getCharacterRoutine(id, 0), null);
  const source = readFileSync(new URL('../dist/office/routine.js', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/from ['"]([^'"]+)/g)].map(match => match[1]), ['./floors.js']);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|Math\.random)\b/);
});
