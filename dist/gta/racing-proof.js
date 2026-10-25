import { RACE_CATALOG, RACING_RULES } from './racing-catalog.js';
import { OWNED_CAR_CATALOG } from './ownership-catalog.js';
import { BUILDINGS, WORLD_LIMIT } from './world.js';
import { segmentClear } from './police.js';

// A bounded route proof, not a claim of tamper-proof or server-authoritative
// driving. The server derives time from fixed simulation ticks and checks the
// complete route against the fastest published tuning's movement envelope.
export const RACE_PROOF_LIMITS = Object.freeze({ version: 1, tickRate: 120, sampleTicks: 2,
  maxSamples: 6002, maxBytes: 256 * 1024, maxSpeed: 32 * 1.24, maxAcceleration: 24 * 1.24 });
const round = value => Math.round(value * 10000) / 10000;
const positionValid = point => Number.isFinite(point?.x) && Number.isFinite(point?.z);
const raceFor = id => RACE_CATALOG.find(race => race.id === id);
const carValid = id => OWNED_CAR_CATALOG.some(car => car.id === id);
const fail = reason => ({ ok: false, reason });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = sample => ({ x: sample[1], z: sample[2] });
function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length)) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}

export function createRaceProof(raceId, vehicleId) {
  return { version: 1, raceId, vehicleId, samples: [], invalid: !raceFor(raceId) || !carValid(vehicleId) };
}
// Mutates only the recorder's bounded array. Never clone all samples per tick.
export function appendRaceProof(recorder, elapsedSeconds, position, speed) {
  if (!recorder || recorder.invalid) return false;
  const tick = Math.round(elapsedSeconds * RACE_PROOF_LIMITS.tickRate);
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || !positionValid(position) || !Number.isFinite(speed)
    || recorder.samples.length >= RACE_PROOF_LIMITS.maxSamples) { recorder.invalid = true; return false; }
  const previous = recorder.samples.at(-1);
  if (previous && tick === previous[0]) return true;
  if (!previous && tick !== 0 || previous && (tick <= previous[0] || tick - previous[0] > 2)) {
    recorder.invalid = true; return false;
  }
  recorder.samples.push([tick, round(position.x), round(position.z), round(speed)]);
  return true;
}
export function finalizeRaceProof(recorder) {
  if (!recorder || recorder.invalid || recorder.samples.length < 2) return null;
  return { version: 1, raceId: recorder.raceId, vehicleId: recorder.vehicleId, samples: recorder.samples.map(sample => [...sample]) };
}

export function verifyRaceProof(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)
    || Object.keys(proof).sort().join(',') !== 'raceId,samples,vehicleId,version' || proof.version !== 1) return fail('format');
  const race = raceFor(proof.raceId);
  if (!race || !carValid(proof.vehicleId)) return fail('catalog');
  const samples = proof.samples;
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > RACE_PROOF_LIMITS.maxSamples) return fail('samples');
  const checkpoints = [], epsilon = .00025;
  let checkpointIndex = 0, offRouteTicks = 0, previous;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!Array.isArray(sample) || sample.length !== 4 || sample.some(value => !Number.isFinite(value))
      || !Number.isSafeInteger(sample[0]) || sample[0] < 0 || sample[0] > race.timeLimit * 120
      || Math.abs(sample[3]) > RACE_PROOF_LIMITS.maxSpeed + .0001 || sample[3] < -8.0001
      || Math.max(Math.abs(sample[1]), Math.abs(sample[2])) > WORLD_LIMIT - 1.5 + epsilon) return fail('sample');
    const to = point(sample);
    if (index === 0) {
      if (sample[0] !== 0 || Math.abs(sample[3]) > RACING_RULES.startMaxSpeed + .0001
        || distance(to, race.start) > race.start.radius + epsilon) return fail('start');
      previous = sample; continue;
    }
    const ticks = sample[0] - previous[0], dt = ticks / 120, from = point(previous);
    if (ticks !== 2 && !(index === samples.length - 1 && ticks === 1)) return fail('ticks');
    // The final checkpoint may lie halfway through a 60 Hz physics step. Its
    // captured end speed still comes from that complete step (two 120 Hz ticks).
    if (Math.abs(sample[3]) - Math.abs(previous[3]) > RACE_PROOF_LIMITS.maxAcceleration / 60 + .0002) return fail('acceleration');
    if (distance(from, to) > Math.min(RACE_PROOF_LIMITS.maxSpeed, Math.max(Math.abs(sample[3]), Math.abs(previous[3]) + RACE_PROOF_LIMITS.maxAcceleration / 60)) * dt + epsilon
      || !segmentClear(from, to, BUILDINGS, .399)) return fail('movement');
    let last = from;
    for (let slice = 1; slice <= ticks; slice += 1) {
      const fraction = slice / ticks, current = { x: from.x + (to.x - from.x) * fraction, z: from.z + (to.z - from.z) * fraction };
      const roadDistance = Math.min(...race.route.slice(1).map((target, i) => segmentDistance(current, race.route[i], target)));
      offRouteTicks = roadDistance > RACING_RULES.corridorWidth + epsilon ? offRouteTicks + 1 : 0;
      if (offRouteTicks >= RACING_RULES.offRouteSeconds * 120) return fail('off-route');
      const target = race.checkpoints[checkpointIndex], before = race.route[checkpointIndex];
      if (target && (current.x - last.x) * (target.x - before.x) + (current.z - last.z) * (target.z - before.z) > 1e-8
        && segmentDistance(target, last, current) <= target.radius + epsilon) {
        const tick = previous[0] + slice;
        checkpoints.push(Math.round(tick * 1000 / 120)); checkpointIndex += 1;
        if (checkpointIndex === race.checkpoints.length) {
          if (index !== samples.length - 1 || slice !== ticks) return fail('after-finish');
          return { ok: true, raceId: race.id, vehicleId: proof.vehicleId, elapsedMs: Math.round(tick * 1000 / 120), checkpointTimes: checkpoints };
        }
      }
      last = current;
    }
    previous = sample;
  }
  return fail('incomplete');
}
