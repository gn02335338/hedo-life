import { createVehicle, stepVehicle } from '../../dist/gta/driving.js';
import { startRace, stepRace } from '../../dist/gta/racing.js';
import { sanitizeProgress } from '../../dist/gta/progress.js';
import { createOwnedVehicle } from '../../dist/gta/ownership.js';
import { BUILDINGS } from '../../dist/gta/world.js';
import { createRaceProof, appendRaceProof, finalizeRaceProof } from '../../dist/gta/racing-proof.js';

// Uses the actual fixed-step driving and race models, including braking during
// countdown and the half-step position of a finishing checkpoint.
export function driveRaceProof({ boost = false, engine = 0, waitFrames = 0, collision = false } = {}) {
  const progress = sanitizeProgress({ version: 4, completed: [], ledger: [{ id: 'buy', kind: 'purchase', vehicleId: 'owned-hatch', missionCount: 0 }] });
  const car = createOwnedVehicle(progress, 'owned-hatch', { x: -30, z: 60, heading: Math.PI / 2 });
  const context = actor => ({ player: actor, vehicle: { ...car, ...actor }, controlledId: car.id, walking: false, wantedLevel: 0, traffic: [], pedestrians: [] });
  let actor = createVehicle(car), state = startRace(progress, 'first-sprint', 'proof-test', context(actor)).state;
  const recorder = createRaceProof('first-sprint', car.id);
  let impacts = 0;
  for (let frame = 0; frame < 1800 && ['countdown', 'racing'].includes(state.phase); frame += 1) {
    const waiting = state.phase === 'racing' && state.elapsed * 60 < waitFrames;
    const obstacle = collision && state.elapsed > 1 && state.elapsed < 2.5 ? [{ x: -5, z: 60, w: 2, d: 2 }] : [];
    actor = stepVehicle(actor, { throttle: state.phase === 'racing' && !waiting ? 1 : 0, brake: state.phase === 'countdown' || waiting, boost, tuning: { engine } }, 1 / 60, [...BUILDINGS, ...obstacle]);
    if (actor.impact) impacts += 1;
    state = stepRace(state, context(actor), 1 / 60);
    if (state.phase === 'racing' || state.phase === 'finished') appendRaceProof(recorder, state.elapsed, state.lastPlayer, actor.speed);
  }
  return { proof: finalizeRaceProof(recorder), state, impacts };
}
