import { BUILDINGS, WORLD_LIMIT } from './world.js';
import { RACE_CATALOG, RACING_RULES, validRaceReceipt } from './racing-catalog.js';
import { GARAGE_RULES, replayGarageProgress } from './garage.js';
import { segmentClear } from './police.js';

export { RACE_CATALOG, RACING_RULES } from './racing-catalog.js';
export const RACE_MESSAGES = Object.freeze({
  race: '找不到這場賽事。', vehicle: '請開已購買的愛車前來參賽。', moving: '停穩後再報名，車頭朝東較容易起跑。',
  wanted: '先解除通緝，再回到起點報名。', distance: '請開到街頭賽車起點。', busy: '請先完成上下車。',
  dead: '車手失去行動能力，比賽中止。', busted: '遭到逮捕，比賽中止。', 'vehicle-destroyed': '車輛已無法行駛，比賽中止。',
  'vehicle-changed': '比賽中更換車輛，這次成績不計。', 'left-vehicle': '離開參賽車輛，這次成績不計。',
  blocked: '起跑位置被車輛或路人占用，請挪車或稍等再報名。', 'false-start': '倒數時離開起跑區，比賽已取消。',
  'off-route': '離開賽道太久，這次成績不計。', teleport: '車輛位置不連續，這次成績不計。',
  'time-limit': '超過完賽時間，下次再挑戰。', lost: '已完賽，但名次未達獎勵條件。', cancelled: '已取消比賽，沒有發放獎金。',
  finished: '挑戰完成！獎金已備妥。', duplicate: '這場比賽已結算，不會重複發獎。',
  'ledger-full': '本機交易紀錄已滿，暫時無法報名領獎賽事。', 'invalid-result': '這場比賽沒有可領取的有效成績。',
});
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = p => ({ x: p.x, z: p.z });
const validPosition = p => Number.isFinite(p?.x) && Number.isFinite(p?.z);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);
const approach = (n, target, amount) => n < target ? Math.min(target, n + amount) : Math.max(target, n - amount);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const reject = reason => ({ ok: false, reason, message: RACE_MESSAGES[reason] || RACE_MESSAGES.cancelled });
const raceById = id => RACE_CATALOG.find(race => race.id === id);
function projection(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
  const t = length ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / length, 0, 1) : 0;
  return { t, distance: Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) };
}
function bounds(car, padding = 0) {
  const sine = Math.abs(Math.sin(finite(car.heading))), cosine = Math.abs(Math.cos(finite(car.heading)));
  return { x: car.x, z: car.z, w: car.w ?? cosine * 2.05 + sine * 4.15 + padding * 2,
    d: car.d ?? sine * 2.05 + cosine * 4.15 + padding * 2 };
}
const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
function clearCar(car, context, others) {
  if (!validPosition(car) || Math.max(Math.abs(car.x), Math.abs(car.z)) > WORLD_LIMIT - 2.7) return false;
  const footprint = bounds(car, .25);
  return !context.obstacles.some(block => block.w > 0 && block.d > 0 && overlap(footprint, block))
    && !others.some(other => other.id !== car.id && overlap(footprint, bounds(other, .2)))
    && !context.pedestrians.some(person => overlap(footprint, { x: person.x, z: person.z, w: 1.2, d: 1.2 }));
}
function contextFor(input = {}) {
  return { ...input, player: input.player, vehicle: input.vehicle,
    obstacles: Array.isArray(input.obstacles) ? input.obstacles : BUILDINGS,
    traffic: Array.isArray(input.traffic) ? input.traffic : [],
    pedestrians: Array.isArray(input.pedestrians) ? input.pedestrians : [],
    policeUnits: Array.isArray(input.policeUnits) ? input.policeUnits : [] };
}

// Rounded corner samples stay inside the intersection's road clearance. Their
// count is bounded by the fixed catalog, independent of how long a race runs.
function rivalPath(race, start, side) {
  const route = race.route, center = [route[0]];
  for (let index = 1; index < route.length - 1; index += 1) {
    const before = route[index - 1], corner = route[index], after = route[index + 1];
    const first = distance(before, corner), second = distance(corner, after);
    const inX = (corner.x - before.x) / first, inZ = (corner.z - before.z) / first;
    const outX = (after.x - corner.x) / second, outZ = (after.z - corner.z) / second;
    if (inX * outX + inZ * outZ > .99) { center.push(corner); continue; }
    const radius = Math.min(5.5, first / 3, second / 3);
    const entry = { x: corner.x - inX * radius, z: corner.z - inZ * radius };
    const exit = { x: corner.x + outX * radius, z: corner.z + outZ * radius };
    center.push(entry);
    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8, s = 1 - t;
      center.push({ x: s * s * entry.x + 2 * s * t * corner.x + t * t * exit.x,
        z: s * s * entry.z + 2 * s * t * corner.z + t * t * exit.z });
    }
  }
  const end = route.at(-1), beforeEnd = route.at(-2), lastLength = distance(end, beforeEnd);
  center.push(end, { x: end.x + (end.x - beforeEnd.x) / lastLength * 12, z: end.z + (end.z - beforeEnd.z) / lastLength * 12 });
  return [point(start), ...center.map(p => ({ x: p.x + side, z: p.z + side }))];
}
function createRivals(race, runId, context) {
  const rivals = [], others = [...context.traffic, ...context.policeUnits, context.vehicle].filter(Boolean);
  for (let index = 0; index < race.rivalSpeeds.length; index += 1) {
    const side = index ? 2.4 : -2.4;
    const rival = { id: `race-${runId}-${index + 1}`, ...race.rivalDrivers[index], kind: 'racer', raceRival: true, owned: false,
      x: race.start.x - 6 - index * 6, z: race.start.z + side, heading: Math.PI / 2, speed: 0,
      occupied: true,
      vehicleHealth: 100, damageStage: 'intact', burnRemaining: 0, wreckAge: 0,
      cruiseSpeed: race.rivalSpeeds[index], pathIndex: 1, checkpointIndex: 0, progress: 0, finished: false, finishTime: null };
    if (!clearCar(rival, context, [...others, ...rivals])) return null;
    rival.path = rivalPath(race, rival, side);
    rivals.push(rival);
  }
  return rivals;
}

export function createRaceState() {
  return { phase: 'idle', runId: null, raceId: null, vehicleId: null, countdownRemaining: 0, elapsed: 0,
    checkpointIndex: 0, checkpoint: null, checkpointTimes: [], route: [], rank: 1, rivals: [], result: null,
    events: [], lastPlayer: null, offRouteTime: 0, progress: 0 };
}
export function raceEligibility(progress, raceId, input = {}) {
  const race = raceById(raceId), context = contextFor(input), current = replayGarageProgress(progress);
  if (!race) return reject('race');
  if (context.dead) return reject('dead');
  if (context.busted) return reject('busted');
  if (context.transition) return reject('busy');
  const vehicle = context.vehicle;
  if (context.walking !== false || !vehicle?.owned || vehicle.id !== context.controlledId
    || !current.ownedVehicleIds.includes(vehicle.id)) return reject('vehicle');
  if (vehicle.vehicleHealth <= 0 || ['burning', 'wreck'].includes(vehicle.damageStage)) return reject('vehicle-destroyed');
  if (context.wantedLevel !== 0) return reject('wanted');
  if (!Number.isFinite(context.player?.speed) || !Number.isFinite(vehicle.speed)
    || Math.max(Math.abs(context.player.speed), Math.abs(vehicle.speed)) > RACING_RULES.startMaxSpeed) return reject('moving');
  if (!validPosition(context.player) || !validPosition(vehicle) || distance(context.player, race.start) > race.start.radius
    || distance(vehicle, race.start) > race.start.radius) return reject('distance');
  if (current.ledger.length >= GARAGE_RULES.maxLedger) return reject('ledger-full');
  if (!createRivals(race, 'preview', context)) return reject('blocked');
  return { ok: true, reason: null, message: '停妥了。倒數後向東出發，依序穿過標記。' };
}
export function startRace(progress, raceId, runId, input = {}) {
  if (!validId(runId)) return reject('invalid-result');
  const current = replayGarageProgress(progress);
  if (current.ledger.some(entry => entry.id === runId)) return reject('duplicate');
  const eligible = raceEligibility(current, raceId, input);
  if (!eligible.ok) return eligible;
  const race = raceById(raceId), context = contextFor(input);
  return { ok: true, reason: null, message: '三秒倒數，準備起跑。', state: { ...createRaceState(), phase: 'countdown',
    runId, raceId, vehicleId: context.vehicle.id, countdownRemaining: RACING_RULES.countdownSeconds,
    checkpoint: race.checkpoints[0], route: race.route, rivals: createRivals(race, runId, context), lastPlayer: point(context.player) } };
}
function finish(state, phase, reason, success = false) {
  state.phase = phase;
  const race = raceById(state.raceId);
  const receipt = success ? { raceId: state.raceId, vehicleId: state.vehicleId, elapsedMs: Math.round(state.elapsed * 1000),
    rank: state.rank, checkpointTimes: [...state.checkpointTimes] } : null;
  state.result = { success, reason, message: RACE_MESSAGES[reason] || RACE_MESSAGES.cancelled,
    elapsed: state.elapsed, rank: state.rank, reward: success ? race.reward : 0, receipt };
  state.events.push({ type: success ? 'raceFinished' : 'raceEnded', reason, message: state.result.message });
  state.rivals = state.rivals.map(rival => ({ ...rival, speed: 0 }));
  return state;
}
export function cancelRace(state, reason = 'cancelled') {
  if (!['countdown', 'racing'].includes(state.phase)) return state;
  return finish({ ...state, events: [], rivals: state.rivals.map(car => ({ ...car })) }, 'cancelled', reason);
}
function passedCheckpoint(from, to, race, index) {
  const target = race.checkpoints[index];
  if (!target) return false;
  const direction = { x: target.x - race.route[index].x, z: target.z - race.route[index].z };
  return (to.x - from.x) * direction.x + (to.z - from.z) * direction.z > 1e-8
    && projection(target, from, to).distance <= target.radius;
}
function routeProgress(position, race, index) {
  if (index >= race.checkpoints.length) return 1;
  let travelled = 0;
  for (let i = 0; i < index; i += 1) travelled += distance(race.route[i], race.route[i + 1]);
  const length = distance(race.route[index], race.route[index + 1]);
  travelled += length * projection(position, race.route[index], race.route[index + 1]).t;
  return clamp(travelled / race.distance, 0, 1);
}
function moveRival(previous, race, context, dt, neighbours, elapsed) {
  const rival = { ...previous };
  if (rival.vehicleHealth <= 0 || ['burning', 'wreck'].includes(rival.damageStage)) { rival.speed = 0; return rival; }
  if (rival.pathIndex >= rival.path.length) { rival.speed = 0; return rival; }
  const target = rival.path[rival.pathIndex], remaining = distance(rival, target);
  const dx = (target.x - rival.x) / Math.max(remaining, .001), dz = (target.z - rival.z) / Math.max(remaining, .001);
  let desired = rival.finished ? 9 : rival.cruiseSpeed;
  const nextPoint = rival.path[rival.pathIndex + 1];
  if (nextPoint && remaining < 12) {
    const nextYaw = Math.atan2(nextPoint.x - target.x, target.z - nextPoint.z);
    if (Math.abs(angleDelta(nextYaw, Math.atan2(dx, -dz))) > .08) desired = Math.min(desired, 10);
  }
  const others = [...new Map([...context.traffic, ...context.policeUnits, context.vehicle, ...neighbours]
    .filter(Boolean).map(car => [car.id, car])).values()].filter(car => car.id !== rival.id);
  for (const other of [...others, ...context.pedestrians]) {
    const ox = other.x - rival.x, oz = other.z - rival.z, along = ox * dx + oz * dz;
    const across = Math.abs(ox * dz - oz * dx);
    if (along > 0 && along < 28 && across < (other.id ? 2.8 : 2)) {
      desired = Math.min(desired, Math.sqrt(24 * Math.max(0, along - (other.id ? 5.2 : 3.8))));
    }
  }
  rival.speed = approach(rival.speed, desired, (desired < rival.speed ? 24 : 9) * dt);
  let budget = rival.speed * dt, candidate = point(rival), index = rival.pathIndex, heading = rival.heading;
  while (budget > 1e-9 && index < rival.path.length) {
    const goal = rival.path[index], gap = distance(candidate, goal), amount = Math.min(gap, budget);
    if (gap < 1e-7) { index += 1; continue; }
    heading = Math.atan2(goal.x - candidate.x, candidate.z - goal.z);
    candidate = { x: candidate.x + (goal.x - candidate.x) * amount / gap, z: candidate.z + (goal.z - candidate.z) * amount / gap };
    budget -= amount;
    if (amount >= gap - 1e-8) index += 1;
  }
  const newHeading = rival.heading + angleDelta(heading, rival.heading) * (1 - Math.exp(-12 * dt));
  if (!clearCar({ ...rival, ...candidate, heading: newHeading }, context, others)) { rival.speed = 0; return rival; }
  rival.x = candidate.x; rival.z = candidate.z; rival.heading = newHeading; rival.pathIndex = index;
  if (!rival.finished && passedCheckpoint(previous, rival, race, rival.checkpointIndex)) {
    rival.checkpointIndex += 1;
    if (rival.checkpointIndex === race.checkpoints.length) { rival.finished = true; rival.finishTime = elapsed; }
  }
  rival.progress = routeProgress(rival, race, rival.checkpointIndex);
  return rival;
}

export function stepRace(state, input = {}, dt = 0) {
  const elapsed = clamp(finite(dt), 0, RACING_RULES.maxStep);
  if (!elapsed) return state;
  if (!['countdown', 'racing'].includes(state.phase)) return state.events.length ? { ...state, events: [] } : state;
  const next = { ...state, checkpointTimes: [...state.checkpointTimes], rivals: state.rivals.map(car => ({ ...car })), events: [] };
  const race = raceById(state.raceId), context = contextFor(input);
  if (context.dead) return finish(next, 'failed', 'dead');
  if (context.busted) return finish(next, 'failed', 'busted');
  if (context.walking !== false || context.transition) return finish(next, 'failed', 'left-vehicle');
  if (context.controlledId !== state.vehicleId || context.vehicle?.id !== state.vehicleId) return finish(next, 'failed', 'vehicle-changed');
  if (context.vehicle.vehicleHealth <= 0 || ['burning', 'wreck'].includes(context.vehicle.damageStage)) return finish(next, 'failed', 'vehicle-destroyed');
  if (!validPosition(context.player) || !validPosition(state.lastPlayer)
    || distance(context.player, state.lastPlayer) > RACING_RULES.maximumPlayerSpeed * elapsed + RACING_RULES.teleportSlack
    || !segmentClear(state.lastPlayer, context.player, context.obstacles, .4)) return finish(next, 'failed', 'teleport');
  const from = state.lastPlayer, to = context.player, steps = Math.ceil(elapsed * 120), slice = elapsed / steps;
  let previous = point(from);
  for (let frame = 0; frame < steps; frame += 1) {
    const t = (frame + 1) / steps, player = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    if (next.phase === 'countdown') {
      if (distance(player, race.start) > race.start.radius) return finish(next, 'failed', 'false-start');
      next.countdownRemaining = Math.max(0, next.countdownRemaining - slice);
      if (next.countdownRemaining <= 1e-8) { next.countdownRemaining = 0; next.phase = 'racing'; next.events.push({ type: 'raceStarted' }); }
      previous = player; continue;
    }
    next.elapsed += slice;
    const roadDistance = Math.min(...race.route.slice(1).map((p, i) => projection(player, race.route[i], p).distance));
    next.offRouteTime = roadDistance > RACING_RULES.corridorWidth || Math.max(Math.abs(player.x), Math.abs(player.z)) > WORLD_LIMIT - 1.5
      ? next.offRouteTime + slice : 0;
    if (next.offRouteTime >= RACING_RULES.offRouteSeconds - 1e-8) return finish(next, 'failed', 'off-route');
    const before = next.rivals;
    next.rivals = before.map(rival => moveRival(rival, race, context, slice, before, next.elapsed));
    if (passedCheckpoint(previous, player, race, next.checkpointIndex)) {
      next.checkpointTimes.push(Math.round(next.elapsed * 1000)); next.checkpointIndex += 1;
      next.checkpoint = race.checkpoints[next.checkpointIndex] || null;
      next.events.push({ type: 'checkpoint', index: next.checkpointIndex });
    }
    next.progress = routeProgress(player, race, next.checkpointIndex);
    next.rank = 1 + next.rivals.filter(rival => rival.finished || rival.progress > next.progress + 1e-7).length;
    if (next.checkpointIndex === race.checkpoints.length) {
      next.lastPlayer = point(player);
      const success = next.elapsed <= race.timeLimit + 1e-8 && next.rank <= race.maxRank;
      return finish(next, success ? 'finished' : 'failed', success ? 'finished' : next.elapsed > race.timeLimit ? 'time-limit' : 'lost', success);
    }
    if (next.elapsed >= race.timeLimit - 1e-8) return finish(next, 'failed', 'time-limit');
    previous = player;
  }
  next.lastPlayer = point(to);
  return next;
}

export function settleRace(progress, state) {
  const current = replayGarageProgress(progress), fail = reason => ({ ...reject(reason), progress: current, reward: 0 });
  if (state?.phase !== 'finished' || !state.result?.success || !validId(state.runId) || !Array.isArray(state.checkpointTimes)) return fail('invalid-result');
  if (current.ledger.some(entry => entry.id === state.runId)) return fail('duplicate');
  if (current.ledger.length >= GARAGE_RULES.maxLedger) return fail('ledger-full');
  const receipt = { raceId: state.raceId, vehicleId: state.vehicleId, elapsedMs: Math.round(state.elapsed * 1000),
    rank: state.rank, checkpointTimes: [...state.checkpointTimes] };
  if (!current.ownedVehicleIds.includes(state.vehicleId) || !validRaceReceipt(receipt)) return fail('invalid-result');
  const record = { id: state.runId, kind: 'race', ...receipt, missionCount: current.completed.length };
  const next = replayGarageProgress({ ...current, ledger: [...current.ledger, record] });
  if (next.ledger.length !== current.ledger.length + 1) return fail('invalid-result');
  const reward = raceById(state.raceId).reward;
  return { ok: true, reason: null, message: `完賽獎金 $${reward} 已加入城市基金。`, progress: next, reward };
}
