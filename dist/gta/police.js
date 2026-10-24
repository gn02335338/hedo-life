import { BUILDINGS, ROAD_LINES, SPAWN, WORLD_LIMIT } from './world.js';

export const POLICE_RULES = Object.freeze({
  maxLevel: 5,
  dispatchSeconds: 2.2,
  reinforcementSeconds: 1.2,
  sightDistance: 48,
  lostSightSeconds: 1.5,
  searchSeconds: 12,
  starFadeSeconds: 6,
  captureSeconds: 3.2,
  captureWalkingDistance: 4.3,
  captureDrivingDistance: 5.8,
  capturePlayerMaxSpeed: 2.2,
  captureUnitMaxSpeed: 3.5,
  spawnMinDistance: 45,
  armedStandoffDistance: 16,
  disabledCleanupSeconds: 8,
  maxRetainedUnits: 8,
});

const RADIUS = 1.65;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const copyPoint = point => ({ x: point.x, z: point.z });
const position = (point, fallback = SPAWN) => ({
  x: clamp(finite(point?.x, fallback.x), -WORLD_LIMIT + RADIUS, WORLD_LIMIT - RADIUS),
  z: clamp(finite(point?.z, fallback.z), -WORLD_LIMIT + RADIUS, WORLD_LIMIT - RADIUS),
});
const validBlock = block => block && Number.isFinite(block.x) && Number.isFinite(block.z) && block.w > 0 && block.d > 0;

export function createPoliceState() {
  return {
    level: 0, phase: 'clear', units: [], lastKnown: { x: SPAWN.x, z: SPAWN.z },
    unseenTime: 0, searchTime: 0, escapeProgress: 0, arrestProgress: 0,
    dispatchRemaining: 0, searchRemaining: POLICE_RULES.searchSeconds,
    nextStarAt: POLICE_RULES.searchSeconds, phaseTime: 0, time: 0,
    seen: false, crimeCount: 0, lastCrimeType: null, nextUnitId: 1,
  };
}

function copyState(state) {
  return {
    ...state, lastKnown: copyPoint(state.lastKnown),
    units: state.units.map(unit => ({ ...unit,
      target: unit.target ? copyPoint(unit.target) : null,
      route: (unit.route || []).map(copyPoint),
    })),
  };
}

export function reportCrime(state, crime = {}) {
  const next = copyState(state);
  if (!['theft', 'collision', 'police-collision', 'gunfire', 'police-hit', 'explosion'].includes(crime.type) || next.phase === 'busted') return next;
  const increase = clamp(Math.floor(finite(crime.severity, ['police-collision', 'gunfire', 'explosion'].includes(crime.type) ? 2 : 1)), 1, 2);
  next.level = Math.min(POLICE_RULES.maxLevel, next.level + increase);
  next.lastKnown = position(crime.position, next.lastKnown);
  next.phase = next.units.length ? 'pursuit' : 'dispatch';
  next.phaseTime = next.unseenTime = next.searchTime = next.escapeProgress = next.arrestProgress = 0;
  next.nextStarAt = next.searchRemaining = POLICE_RULES.searchSeconds;
  next.dispatchRemaining = next.units.length ? POLICE_RULES.reinforcementSeconds : POLICE_RULES.dispatchSeconds;
  next.seen = false;
  next.crimeCount += 1;
  next.lastCrimeType = crime.type;
  next.units = next.units.map(unit => ({ ...unit, repathIn: 0, searchIndex: -1, target: copyPoint(next.lastKnown), siren: !unit.disabled }));
  return next;
}

// Slab intersection uses the same building footprints as the movement model.
// Padding turns the visibility test into a swept car-clearance test for routes.
export function segmentClear(from, to, obstacles = BUILDINGS, padding = 0) {
  if (!from || !to || ![from.x, from.z, to.x, to.z].every(Number.isFinite)) return false;
  for (const block of obstacles) {
    if (!validBlock(block)) continue;
    let enter = 0, exit = 1;
    let intersects = true;
    for (const axis of ['x', 'z']) {
      const half = (axis === 'x' ? block.w : block.d) / 2 + padding;
      const low = block[axis] - half, high = block[axis] + half;
      const delta = to[axis] - from[axis];
      if (Math.abs(delta) < 1e-10) {
        if (from[axis] <= low + 1e-8 || from[axis] >= high - 1e-8) { intersects = false; break; }
      } else {
        const a = (low - from[axis]) / delta, b = (high - from[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (enter >= exit - 1e-9) { intersects = false; break; }
      }
    }
    if (intersects && exit > 0 && enter < 1) return false;
  }
  return true;
}

export function canSeePlayer(unit, player, obstacles = BUILDINGS) {
  return !unit.disabled && distance(unit, player) <= POLICE_RULES.sightDistance && segmentClear(unit, player, obstacles);
}

function clearPosition(point, obstacles) {
  return Math.max(Math.abs(point.x), Math.abs(point.z)) <= WORLD_LIMIT - RADIUS
    && segmentClear(point, point, obstacles, RADIUS);
}

const intersections = ROAD_LINES.flatMap(z => ROAD_LINES.map(x => ({ x, z })));
const spawnPositions = [...new Map(ROAD_LINES.flatMap(road =>
  Array.from({ length: 9 }, (_, index) => -120 + index * 30).flatMap(axis => [
    { x: road, z: axis }, { x: axis, z: road },
  ])).map(point => [`${point.x},${point.z}`, point])).values()];

function navigableTarget(target, obstacles) {
  if (clearPosition(target, obstacles)) return copyPoint(target);
  // A pedestrian or narrower player car may stand closer to a wall than a
  // patrol can. Approach the nearest clear edge, rather than abandoning the
  // suspect at a road centre several metres away.
  const edges = obstacles.filter(validBlock).flatMap(block => [
    { x: block.x - block.w / 2 - RADIUS - 0.05, z: target.z },
    { x: block.x + block.w / 2 + RADIUS + 0.05, z: target.z },
    { x: target.x, z: block.z - block.d / 2 - RADIUS - 0.05 },
    { x: target.x, z: block.z + block.d / 2 + RADIUS + 0.05 },
  ]);
  const candidates = [...edges, ...ROAD_LINES.flatMap(line => [{ x: line, z: target.z }, { x: target.x, z: line }])];
  return [...candidates, ...intersections].filter(point => clearPosition(point, obstacles))
    .sort((a, b) => distance(a, target) - distance(b, target))[0] || null;
}

function roundedPath(path, obstacles) {
  if (path.length < 3) return path.slice(1);
  const rounded = [path[0]];
  for (let index = 1; index < path.length - 1; index += 1) {
    const before = path[index - 1], corner = path[index], after = path[index + 1];
    const inLength = distance(before, corner), outLength = distance(corner, after);
    const inset = Math.min(7, inLength * 0.25, outLength * 0.25);
    if (inset < 0.1) { rounded.push(corner); continue; }
    const entry = { x: corner.x + (before.x - corner.x) * inset / inLength, z: corner.z + (before.z - corner.z) * inset / inLength };
    const exit = { x: corner.x + (after.x - corner.x) * inset / outLength, z: corner.z + (after.z - corner.z) * inset / outLength };
    const curve = [entry, ...Array.from({ length: 6 }, (_, step) => {
      const t = (step + 1) / 6, s = 1 - t;
      return { x: s * s * entry.x + 2 * s * t * corner.x + t * t * exit.x,
        z: s * s * entry.z + 2 * s * t * corner.z + t * t * exit.z };
    })];
    const points = [rounded.at(-1), ...curve];
    if (points.every((point, i) => !i || segmentClear(points[i - 1], point, obstacles, RADIUS))) rounded.push(...curve);
    else rounded.push(corner);
  }
  rounded.push(path.at(-1));
  return rounded.slice(1);
}

// Every connection is checked against expanded footprints. The road junctions
// let a pursuit route go around a block instead of steering through its wall.
function planRoute(from, requestedTarget, obstacles, extraPoints = []) {
  const target = navigableTarget(requestedTarget, obstacles);
  if (!target || !clearPosition(from, obstacles)) return [];
  if (segmentClear(from, target, obstacles, RADIUS)) return [target];
  const nodes = [copyPoint(from), target, ...[...intersections, ...extraPoints].filter(point => clearPosition(point, obstacles))];
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set();
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) if (!visited.has(index) && (current < 0 || costs[index] < costs[current])) current = index;
    if (current < 0 || !Number.isFinite(costs[current])) return [];
    if (current === 1) break;
    visited.add(current);
    for (let next = 0; next < nodes.length; next += 1) {
      if (visited.has(next) || next === current || !segmentClear(nodes[current], nodes[next], obstacles, RADIUS)) continue;
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  if (previous[1] < 0) return [];
  const path = [];
  for (let cursor = 1; cursor >= 0; cursor = previous[cursor]) path.unshift(nodes[cursor]);
  return roundedPath(path, obstacles);
}

function spawnUnit(state, player, obstacles, traffic) {
  const ordinal = state.units.filter(unit => !unit.disabled).length;
  const serial = Math.max(state.nextUnitId || 1, ...state.units.map(unit => Number(unit.id.split('-').at(-1)) + 1 || 1));
  const angle = Math.PI + ordinal * Math.PI / 2;
  const preferred = { x: state.lastKnown.x + Math.sin(angle) * 70, z: state.lastKnown.z - Math.cos(angle) * 70 };
  const candidates = spawnPositions.filter(point => clearPosition(point, obstacles)
    && distance(point, player) >= POLICE_RULES.spawnMinDistance
    && distance(point, state.lastKnown) >= 45
    && [...state.units, ...traffic].every(other => distance(point, other) >= 8));
  candidates.sort((a, b) => distance(a, preferred) - distance(b, preferred));
  const origin = candidates.find(point => planRoute(point, state.lastKnown, obstacles).length);
  if (!origin) return null;
  const route = planRoute(origin, state.lastKnown, obstacles);
  const target = route[0] || state.lastKnown;
  return {
    id: `police-${serial}`, name: '巡邏警車', kind: 'police', color: 0xe4e9ef,
    x: origin.x, z: origin.z, heading: Math.atan2(target.x - origin.x, origin.z - target.z),
    speed: 0, occupied: true, stolen: false, siren: true, visible: false,
    ordinal, route, target: copyPoint(state.lastKnown), repathIn: 0.45, searchIndex: -1,
    blockedTime: 0, avoidanceUntil: 0,
  };
}

function searchTarget(unit, lastKnown, obstacles) {
  if (unit.searchIndex < 0) return copyPoint(lastKnown);
  const candidates = intersections.filter(point => distance(point, lastKnown) <= 105 && clearPosition(point, obstacles))
    .sort((a, b) => distance(a, lastKnown) - distance(b, lastKnown));
  return copyPoint(candidates[(unit.searchIndex + unit.ordinal * 2) % candidates.length] || lastKnown);
}

function trafficClearance(unit, direction, traffic) {
  let free = Infinity;
  for (const other of traffic) {
    if (other.id === unit.id) continue;
    const dx = other.x - unit.x, dz = other.z - unit.z;
    const along = dx * direction.x + dz * direction.z;
    const across = Math.abs(dx * direction.z - dz * direction.x);
    if (along > 0 && across < 2.7) free = Math.min(free, Math.max(0, along - 4.8));
  }
  return free;
}

function trafficDetour(unit, context, neighbours) {
  const blocks = [...context.traffic, ...neighbours].filter(other => other.id !== unit.id
    && distance(unit, other) < 25
    && !(unit.visible && distance(other, context.player) < 2)).map(other => {
    const cosine = Math.abs(Math.cos(other.heading || 0)), sine = Math.abs(Math.sin(other.heading || 0));
    return { x: other.x, z: other.z, w: 2.7 * cosine + 4.9 * sine, d: 4.9 * cosine + 2.7 * sine };
  }).filter(block => segmentClear(unit, unit, [block], RADIUS));
  const points = blocks.flatMap(block => [-1, 1].flatMap(sx => [-1, 1].map(sz => ({
    x: block.x + sx * (block.w / 2 + RADIUS + 0.3),
    z: block.z + sz * (block.d / 2 + RADIUS + 0.3),
  }))));
  return { obstacles: [...context.obstacles, ...blocks], points };
}

function moveUnit(previous, state, context, dt, neighbours) {
  if (previous.disabled) return { ...previous, speed: 0, siren: false, visible: false, route: [] };
  if (previous.damageStage === 'burning' || previous.damageStage === 'wreck') return { ...previous, speed: 0, siren: false, route: [] };
  const unit = { ...previous, route: previous.route.slice(), repathIn: previous.repathIn - dt,
    visible: canSeePlayer(previous, context.player, context.obstacles),
    siren: state.phase === 'pursuit' || state.phase === 'dispatch' };
  if (state.phase !== 'search') unit.searchIndex = -1;
  let target = state.phase === 'search' ? searchTarget(unit, state.lastKnown, context.obstacles) : copyPoint(state.lastKnown);
  if (state.phase === 'search' && distance(unit, target) < 4) {
    unit.searchIndex += 1;
    target = searchTarget(unit, state.lastKnown, context.obstacles);
  }
  const targetChanged = !unit.target || distance(unit.target, target) > 1.5;
  if (unit.repathIn <= 0 && (targetChanged || !unit.route.length)) {
    unit.target = copyPoint(target);
    const detour = unit.avoidanceUntil > state.time ? trafficDetour(unit, context, neighbours) : null;
    unit.route = planRoute(unit, target, detour?.obstacles || context.obstacles, detour?.points);
    unit.repathIn = 0.45;
  }
  let desiredSpeed = state.phase === 'search' ? 10 : 12.5 + state.level * 1.45;
  let free = Infinity;
  const first = unit.route[0];
  if (!first) desiredSpeed = 0;
  else {
    const length = distance(unit, first);
    if (length > 1e-8) free = trafficClearance(unit, { x: (first.x - unit.x) / length, z: (first.z - unit.z) / length }, [...context.traffic, ...neighbours]);
    unit.blockedTime = free < 1.6 && unit.speed < 2.5 && distance(unit, target) > 6 ? (unit.blockedTime || 0) + dt : 0;
    if (unit.blockedTime > 0.45 && unit.repathIn <= 0) {
      const detour = trafficDetour(unit, context, neighbours);
      const route = planRoute(unit, target, detour.obstacles, detour.points);
      if (route.length) {
        unit.route = route;
        unit.avoidanceUntil = state.time + 3;
        unit.repathIn = 0.45;
        unit.blockedTime = 0;
      }
    }
    if (unit.visible) free = Math.min(free, Math.max(0, distance(unit, context.player)
      - (context.armedHostile ? POLICE_RULES.armedStandoffDistance : context.walking ? 3 : 4)));
    desiredSpeed = Math.min(desiredSpeed, Math.sqrt(2 * 9 * free));
    if (unit.route.length > 1 && length < 7) desiredSpeed = Math.min(desiredSpeed, 8);
  }
  unit.speed = approach(unit.speed, desiredSpeed, (unit.speed > desiredSpeed ? 16 : 9) * dt);
  let travel = Math.min(unit.speed * dt, free);
  if (free <= 0.02) unit.speed = 0;
  for (let hops = 0; travel > 1e-8 && unit.route.length && hops < 40; hops += 1) {
    const next = unit.route[0], length = distance(unit, next);
    if (length < 1e-8) { unit.route.shift(); continue; }
    const movement = Math.min(travel, length);
    const candidate = { x: unit.x + (next.x - unit.x) * movement / length, z: unit.z + (next.z - unit.z) * movement / length };
    if (!segmentClear(unit, candidate, context.obstacles, RADIUS)) { unit.speed = 0; unit.route = []; unit.repathIn = 0; break; }
    const heading = Math.atan2(next.x - unit.x, unit.z - next.z);
    unit.heading = wrapAngle(unit.heading + wrapAngle(heading - unit.heading) * (1 - Math.exp(-15 * dt)));
    unit.x = candidate.x; unit.z = candidate.z;
    travel -= movement;
    if (movement >= length - 1e-8) unit.route.shift();
  }
  return unit;
}

function changePhase(state, phase) {
  if (state.phase !== phase) { state.phase = phase; state.phaseTime = 0; }
}

export function stepPolice(state, input = {}, dt = 0) {
  let next = copyState(state);
  const elapsed = clamp(finite(dt, 0), 0, 0.1);
  if (!elapsed || next.level === 0 || next.phase === 'busted') return next;
  const context = {
    player: { ...position(input.player, next.lastKnown), speed: finite(input.player?.speed, 0) },
    walking: input.walking === true,
    armedHostile: input.armedHostile === true,
    obstacles: Array.isArray(input.obstacles) ? input.obstacles : BUILDINGS,
    traffic: Array.isArray(input.traffic) ? input.traffic : [],
  };
  const steps = Math.ceil(elapsed * 120), slice = elapsed / steps;
  const disabledIds = new Set(Array.isArray(input.disabledUnitIds) ? input.disabledUnitIds : []);
  next.units = next.units.map(unit => disabledIds.has(unit.id) && !unit.disabled
    ? { ...unit, disabled: true, disabledAt: next.time, speed: 0, siren: false, visible: false, route: [] } : unit);
  for (let frame = 0; frame < steps; frame += 1) {
    next.time += slice;
    next.units = next.units.filter(unit => !unit.disabled || next.time - unit.disabledAt < POLICE_RULES.disabledCleanupSeconds);
    next.phaseTime += slice;
    next.dispatchRemaining = Math.max(0, next.dispatchRemaining - slice);
    const desiredUnits = [0, 1, 2, 2, 3, 4][next.level];
    if (next.dispatchRemaining <= 1e-8 && next.units.filter(unit => !unit.disabled).length < desiredUnits) {
      const unit = spawnUnit(next, context.player, context.obstacles, context.traffic);
      if (unit) {
        if (next.units.length >= POLICE_RULES.maxRetainedUnits) {
          const expired = next.units.findIndex(item => item.disabled);
          if (expired >= 0) next.units.splice(expired, 1);
        }
        next.units.push(unit);
        next.nextUnitId = Number(unit.id.split('-').at(-1)) + 1;
      }
      next.dispatchRemaining = POLICE_RULES.reinforcementSeconds;
    }
    if (next.phase === 'dispatch' && next.units.length) changePhase(next, 'pursuit');
    if (next.phase === 'dispatch') continue;
    next.seen = next.units.some(unit => canSeePlayer(unit, context.player, context.obstacles));
    if (next.seen) {
      changePhase(next, 'pursuit');
      next.lastKnown = position(context.player);
      next.unseenTime = next.searchTime = next.escapeProgress = 0;
      next.nextStarAt = next.searchRemaining = POLICE_RULES.searchSeconds;
    } else {
      next.unseenTime += slice;
      if (next.unseenTime >= POLICE_RULES.lostSightSeconds) changePhase(next, 'search');
      if (next.phase === 'search') {
        next.searchTime += slice;
        if (next.searchTime + 1e-8 >= next.nextStarAt) {
          next.level -= 1;
          next.nextStarAt += POLICE_RULES.starFadeSeconds;
          if (next.level === 0) { next = { ...createPoliceState(), time: next.time, nextUnitId: next.nextUnitId }; break; }
        }
        const duration = next.nextStarAt === POLICE_RULES.searchSeconds ? POLICE_RULES.searchSeconds : POLICE_RULES.starFadeSeconds;
        next.searchRemaining = Math.max(0, next.nextStarAt - next.searchTime);
        next.escapeProgress = clamp(1 - next.searchRemaining / duration, 0, 1);
      }
    }
    const before = next.units;
    next.units = before.map(unit => moveUnit(unit, next, context, slice, before));
    const closeEnough = !context.armedHostile && Math.abs(context.player.speed) < POLICE_RULES.capturePlayerMaxSpeed
      && next.units.some(unit => !unit.disabled && unit.speed < POLICE_RULES.captureUnitMaxSpeed
        && distance(unit, context.player) < (context.walking ? POLICE_RULES.captureWalkingDistance : POLICE_RULES.captureDrivingDistance)
        && canSeePlayer(unit, context.player, context.obstacles));
    next.arrestProgress = closeEnough ? Math.min(1, next.arrestProgress + slice / POLICE_RULES.captureSeconds) : 0;
    if (next.arrestProgress >= 1 - 1e-8) {
      next.arrestProgress = 1;
      changePhase(next, 'busted');
      next.units = next.units.map(unit => ({ ...unit, speed: 0, siren: false }));
      break;
    }
  }
  return next;
}
