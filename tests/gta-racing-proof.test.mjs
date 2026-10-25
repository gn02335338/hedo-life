import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceProof, appendRaceProof, finalizeRaceProof, verifyRaceProof, RACE_PROOF_LIMITS } from '../dist/gta/racing-proof.js';
import { driveRaceProof } from './helpers/gta-racing-proof.mjs';

const copy = value => structuredClone(value);
test('route proofs derive exact time and sequential gates from real stock, boosted and upgraded fixed-step driving', () => {
  for (const options of [{}, { boost: true }, { engine: 2, boost: true }, { waitFrames: 120 }, { collision: true, boost: true }]) {
    const { proof, state, impacts } = driveRaceProof(options), verified = verifyRaceProof(proof);
    assert.equal(state.phase, 'finished'); assert.equal(verified.ok, true, JSON.stringify({ options, verified }));
    assert.equal(verified.elapsedMs, Math.round(state.elapsed * 1000));
    assert.deepEqual(verified.checkpointTimes, state.checkpointTimes);
    assert.ok(Buffer.byteLength(JSON.stringify(proof)) < RACE_PROOF_LIMITS.maxBytes);
    if (options.collision) assert.ok(impacts > 0);
  }
});
test('recording is bounded and O(1), pause repeats do not advance time, and final proof is detached', () => {
  const recorder = createRaceProof('first-sprint', 'owned-hatch');
  assert.equal(appendRaceProof(recorder, 0, { x: -30, z: 60 }, 0), true);
  const samples = recorder.samples;
  for (let i = 0; i < 50; i += 1) appendRaceProof(recorder, 0, { x: -30, z: 60 }, 0);
  assert.equal(samples.length, 1); assert.equal(recorder.samples, samples);
  appendRaceProof(recorder, 1 / 60, { x: -29.999, z: 60 }, .2);
  const proof = finalizeRaceProof(recorder); assert.equal(proof.samples.length, 2);
  recorder.samples[0][1] = 500; assert.equal(proof.samples[0][1], -30);
  assert.equal(appendRaceProof(recorder, .2, { x: -30, z: 60 }, 0), false); assert.equal(finalizeRaceProof(recorder), null);
  const full = createRaceProof('city-loop', 'owned-hatch');
  for (let i = 0; i <= RACE_PROOF_LIMITS.maxSamples; i += 1) appendRaceProof(full, i / 60, { x: -30, z: 60 }, 0);
  assert.equal(full.samples.length, RACE_PROOF_LIMITS.maxSamples); assert.equal(full.invalid, true);
});
test('uncompleted, retimed, missing, nonfinite, accelerated, teleported and identity-forged proofs are rejected', () => {
  const good = driveRaceProof().proof;
  const mutate = fn => { const value = copy(good); fn(value); assert.equal(verifyRaceProof(value).ok, false); };
  mutate(p => p.samples.pop()); mutate(p => p.samples.splice(10, 1));
  mutate(p => p.samples[5][0] = p.samples[4][0]); mutate(p => p.samples[0][0] = 2);
  mutate(p => p.samples[5][1] = Infinity); mutate(p => p.samples[5][1] += 20);
  mutate(p => p.samples[5][3] = 39); mutate(p => p.samples[0][3] = 2);
  mutate(p => p.samples[0][1] = 60); mutate(p => p.vehicleId = 'police-1');
  mutate(p => p.raceId = 'unknown'); mutate(p => p.elapsedMs = 1);
  mutate(p => p.samples.push([p.samples.at(-1)[0] + 2, 120, 60, 0]));
  mutate(p => p.samples[4].push('extra'));
});

test('all catalog routes, including a near-limit long race, verify within the body and sample caps', async () => {
  const { RACE_CATALOG } = await import('../dist/gta/racing-catalog.js');
  const { startRace, stepRace } = await import('../dist/gta/racing.js');
  const { sanitizeProgress } = await import('../dist/gta/progress.js');
  const { createOwnedVehicle } = await import('../dist/gta/ownership.js');
  const progress = sanitizeProgress({ version: 4, completed: [], ledger: [{ id: 'buy', kind: 'purchase', vehicleId: 'owned-hatch', missionCount: 0 }] });
  for (const race of RACE_CATALOG) {
    let car = createOwnedVehicle(progress, 'owned-hatch', { x: -30, z: 60, heading: Math.PI / 2 }), routeIndex = 1;
    const context = () => ({ player: car, vehicle: car, controlledId: car.id, walking: false, wantedLevel: 0, traffic: [], pedestrians: [] });
    let state = startRace(progress, race.id, 'route-proof', context()).state;
    const recorder = createRaceProof(race.id, car.id), slowLong = race.id === 'city-loop';
    for (let frame = 0; frame < 6200 && ['countdown', 'racing'].includes(state.phase); frame += 1) {
      if (state.phase === 'racing' && (!slowLong || state.elapsed >= 10)) {
        car.speed = Math.min(slowLong ? 8 : 20, car.speed + 17 / 60);
        let budget = car.speed / 60;
        while (budget > 1e-8 && routeIndex < race.route.length) {
          const target = race.route[routeIndex], gap = Math.hypot(target.x - car.x, target.z - car.z), amount = Math.min(gap, budget);
          if (gap > 1e-8) { car.x += (target.x - car.x) / gap * amount; car.z += (target.z - car.z) / gap * amount; }
          budget -= amount; if (amount >= gap - 1e-8) routeIndex += 1;
        }
      }
      state = stepRace(state, context(), 1 / 60);
      if (state.phase === 'racing' || ['finished', 'lost'].includes(state.result?.reason)) appendRaceProof(recorder, state.elapsed, state.lastPlayer, car.speed);
    }
    const proof = finalizeRaceProof(recorder), verified = verifyRaceProof(proof);
    assert.equal(verified.ok, true, `${race.id} ${JSON.stringify(verified)}`);
    assert.equal(verified.elapsedMs, Math.round(state.elapsed * 1000)); assert.deepEqual(verified.checkpointTimes, state.checkpointTimes);
    assert.ok(Buffer.byteLength(JSON.stringify({ runId: '00000000-0000-4000-8000-000000000000', proof })) < RACE_PROOF_LIMITS.maxBytes);
    if (slowLong) { assert.ok(verified.elapsedMs > 99000); assert.ok(proof.samples.length > 5900); }
  }
});
