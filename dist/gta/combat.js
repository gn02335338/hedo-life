import { BUILDINGS, WORLD_LIMIT } from './world.js';
import { segmentClear } from './police.js';

export const WEAPONS = Object.freeze({
  unarmed: Object.freeze({ id: 'unarmed', name: '徒手', magSize: 0, damage: 0, range: 65, cadence: 0, reloadSeconds: 0 }),
  pistol: Object.freeze({ id: 'pistol', name: '手槍', magSize: 12, damage: 34, range: 65, cadence: 0.24, reloadSeconds: 1.2 }),
  smg: Object.freeze({ id: 'smg', name: '衝鋒槍', magSize: 30, damage: 18, range: 55, cadence: 0.09, reloadSeconds: 1.65 }),
});
export const COMBAT_RULES = Object.freeze({
  maxHealth: 100, officerHealth: 75, officerWarningSeconds: 1.4,
  officerRange: 38, officerCadence: 0.9, officerDamage: 7,
  gunfireCrimeSeconds: 2.5, hostilityClearSeconds: 3,
  maxTracers: 32, maxEvents: 32, aimAssistRadians: 0.055,
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const point = value => ({ x: finite(value?.x), z: finite(value?.z) });
const heightPoint = value => ({ x: value.x, y: 1.45, z: value.z });

export function createCombatState() {
  return {
    health: COMBAT_RULES.maxHealth, dead: false, weaponId: 'unarmed',
    weapons: { pistol: { mag: 12, reserve: 72 }, smg: { mag: 30, reserve: 150 } },
    reload: null, cooldown: 0, time: 0, tracers: [], events: [],
    hitMarker: 0, damageFlash: 0, muzzleFlash: 0, hostile: false,
    officers: {}, shotSerial: 0, crimeCooldown: 0, lastShotTime: -Infinity, aimPoint: null,
  };
}
function copyState(state) {
  return { ...state, weapons: Object.fromEntries(Object.entries(state.weapons).map(([id, ammo]) => [id, { ...ammo }])),
    reload: state.reload ? { ...state.reload } : null,
    officers: Object.fromEntries(Object.entries(state.officers).map(([id, officer]) => [id, { ...officer, position: officer.position ? { ...officer.position } : undefined }])),
    tracers: state.tracers.map(tracer => ({ ...tracer, from: { ...tracer.from }, to: { ...tracer.to } })),
    events: state.events.map(event => ({ ...event })), aimPoint: state.aimPoint ? { ...state.aimPoint } : null };
}
export function selectWeapon(state, id) {
  const next = copyState(state);
  if (!next.dead && Object.hasOwn(WEAPONS, id) && id !== next.weaponId) {
    next.weaponId = id; next.reload = null; next.cooldown = Math.max(next.cooldown, 0.15);
  }
  return next;
}
export function startReload(state) {
  const next = copyState(state), weapon = WEAPONS[next.weaponId], ammo = next.weapons[next.weaponId];
  if (!next.dead && ammo && !next.reload && ammo.mag < weapon.magSize && ammo.reserve > 0) {
    next.reload = { weaponId: weapon.id, remaining: weapon.reloadSeconds, total: weapon.reloadSeconds };
  }
  return next;
}
function emit(state, event) {
  if (state.events.length < COMBAT_RULES.maxEvents) state.events.push(event);
}
function damage(state, amount, source = 'impact', unitId) {
  if (state.dead || !Number.isFinite(amount) || amount <= 0) return;
  const loss = Math.min(state.health, amount);
  state.health = Math.max(0, state.health - loss); state.damageFlash = 0.32;
  emit(state, { type: 'damage', amount: loss, source, unitId });
  if (state.health === 0) {
    state.dead = true; state.reload = null; state.hostile = false;
    emit(state, { type: 'death' });
  }
}
export function applyDamage(state, amount) {
  const next = copyState(state); damage(next, amount); return next;
}
function officerState(state, unitId) {
  return state.officers[unitId] || { health: COMBAT_RULES.officerHealth, warning: 0, cooldown: 0, down: false, shotIndex: 0, muzzle: 0, hitReported: false };
}
function insideVehicle(position, car, padding = 0) {
  const dx = position.x - car.x, dz = position.z - car.z;
  const sine = Math.sin(finite(car.heading)), cosine = Math.cos(finite(car.heading));
  return Math.abs(dx * cosine + dz * sine) < 1.025 + padding
    && Math.abs(dx * sine - dz * cosine) < 2.075 + padding;
}
function officerPosition(unit, units, obstacles) {
  const sine = Math.sin(unit.heading), cosine = Math.cos(unit.heading);
  for (const [side, back] of [[-2.8, 0], [2.8, 0], [-2.8, 3], [2.8, 3], [0, 3.4], [-2.8, -3], [2.8, -3]]) {
    const candidate = { x: unit.x + cosine * side - sine * back, z: unit.z + sine * side + cosine * back };
    if (Math.max(Math.abs(candidate.x), Math.abs(candidate.z)) > WORLD_LIMIT - 0.5) continue;
    if (!segmentClear(candidate, candidate, obstacles, 0.4) || units.some(car => insideVehicle(candidate, car, 0.4))) continue;
    return candidate;
  }
  return null;
}
export function getPoliceCombatants(police, combat, obstacles = BUILDINGS, traffic = []) {
  const units = police?.units || [], result = [];
  for (const unit of units) {
    const record = officerState(combat, unit.id), down = record.down || unit.disabled === true;
    if (!down && Math.abs(unit.speed) >= 3.5) continue;
    const location = down && record.position ? record.position : officerPosition(unit, [...units, ...traffic], obstacles);
    if (!location) continue;
    result.push({ id: `officer-${unit.id}`, unitId: unit.id, ...location, y: 0, heading: finite(record.aimYaw, unit.heading),
      health: down ? 0 : record.health, down,
      armed: !down && (police.level >= 2 || combat.hostile),
      warning: record.warning, firing: !down && record.muzzle > 0 });
  }
  return result;
}

function rayBox(origin, direction, box, limit) {
  let near = 0, far = limit;
  for (const [axis, size] of [['x', 'w'], ['z', 'd']]) {
    const minimum = box[axis] - box[size] / 2, maximum = box[axis] + box[size] / 2;
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < minimum || origin[axis] > maximum) return null;
    } else {
      const a = (minimum - origin[axis]) / direction[axis], b = (maximum - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near <= limit && far >= 0 ? near : null;
}
function rayVehicle(origin, direction, car, limit) {
  const sine = Math.sin(finite(car.heading)), cosine = Math.cos(finite(car.heading));
  const dx = origin.x - car.x, dz = origin.z - car.z;
  return rayBox({ x: dx * cosine + dz * sine, z: dx * sine - dz * cosine },
    { x: direction.x * cosine + direction.z * sine, z: direction.x * sine - direction.z * cosine },
    { x: 0, z: 0, w: 2.05, d: 4.15 }, limit);
}
function rayCircle(origin, direction, target, limit) {
  const dx = target.x - origin.x, dz = target.z - origin.z;
  const along = dx * direction.x + dz * direction.z;
  const perpendicular = dx * dx + dz * dz - along * along;
  const radius = 0.62;
  if (perpendicular > radius * radius) return null;
  const entry = along - Math.sqrt(Math.max(0, radius * radius - perpendicular));
  const exit = along + Math.sqrt(Math.max(0, radius * radius - perpendicular));
  return exit >= 0 && entry <= limit ? Math.max(0, entry) : null;
}
function contextFor(input) {
  return { player: { ...point(input.player), speed: finite(input.player?.speed), heading: finite(input.player?.heading) },
    police: input.police || { level: 0, phase: 'clear', units: [] },
    obstacles: Array.isArray(input.obstacles) ? input.obstacles : BUILDINGS,
    traffic: Array.isArray(input.traffic) ? input.traffic : [], walking: input.walking === true,
    aiming: input.aiming === true, aimYaw: finite(input.aimYaw, finite(input.player?.heading)) };
}
function castRay(origin, yaw, range, context, combatants = [], ignoredCarId = null, ignoreOccupiedPlayerCar = false) {
  const direction = { x: Math.sin(yaw), z: -Math.cos(yaw) };
  let nearest = range, kind = null, targetId = null, unitId = null;
  for (const building of context.obstacles) {
    if (!(building.w > 0 && building.d > 0)) continue;
    const hit = rayBox(origin, direction, building, nearest);
    if (hit !== null && hit < nearest) { nearest = hit; kind = 'building'; targetId = null; unitId = null; }
  }
  const vehicles = new Map([...context.traffic, ...(context.police.units || [])].map(car => [car.id, car]));
  for (const car of vehicles.values()) {
    if (car.id === ignoredCarId || ignoreOccupiedPlayerCar && distance(car, context.player) < 1.75) continue;
    const hit = rayVehicle(origin, direction, car, nearest);
    if (hit !== null && hit < nearest) { nearest = hit; kind = 'vehicle'; targetId = car.id; unitId = car.kind === 'police' ? car.id : null; }
  }
  for (const officer of combatants) {
    if (officer.down) continue;
    const hit = rayCircle(origin, direction, officer, nearest);
    if (hit !== null && hit < nearest) { nearest = hit; kind = 'officer'; targetId = officer.id; unitId = officer.unitId; }
  }
  return { x: origin.x + direction.x * nearest, y: 1.45, z: origin.z + direction.z * nearest,
    distance: nearest, kind, targetId, unitId };
}
export function getAimTarget(state, input = {}) {
  const context = contextFor(input), weapon = WEAPONS[state.weaponId] || WEAPONS.unarmed;
  const combatants = getPoliceCombatants(context.police, state, context.obstacles, context.traffic);
  let yaw = context.aimYaw;
  const direct = castRay(context.player, yaw, weapon.range, context, combatants);
  if (context.aiming && state.weaponId !== 'unarmed' && direct.kind !== 'officer') {
    let smallest = COMBAT_RULES.aimAssistRadians;
    for (const officer of combatants) {
      if (officer.down || distance(officer, context.player) > weapon.range) continue;
      const heading = Math.atan2(officer.x - context.player.x, context.player.z - officer.z);
      const angle = Math.abs(angleDifference(heading, context.aimYaw));
      if (angle >= smallest) continue;
      const candidate = castRay(context.player, heading, weapon.range, context, combatants);
      if (candidate.unitId === officer.unitId && candidate.kind === 'officer') { yaw = heading; smallest = angle; }
    }
  }
  return yaw === context.aimYaw ? direct : castRay(context.player, yaw, weapon.range, context, combatants);
}
function tracer(state, from, to, source, hit, unitId) {
  state.shotSerial += 1;
  const ttl = source === 'player' ? 0.1 : 0.13;
  state.tracers.push({ id: state.shotSerial, from: heightPoint(from), to: heightPoint(to), ttl, maxTtl: ttl, source, hit, unitId });
  if (state.tracers.length > COMBAT_RULES.maxTracers) state.tracers.splice(0, state.tracers.length - COMBAT_RULES.maxTracers);
}
function playerShot(state, context, input) {
  const weapon = WEAPONS[state.weaponId], ammo = state.weapons[state.weaponId];
  if (!ammo || state.reload || state.cooldown > 1e-8) return;
  if (ammo.mag <= 0) { state.cooldown = 0.25; emit(state, { type: 'dryFire', weaponId: weapon.id }); return; }
  ammo.mag -= 1; state.cooldown = weapon.cadence; state.muzzleFlash = 0.06;
  state.hostile = true; state.lastShotTime = state.time;
  const hit = getAimTarget(state, input); state.aimPoint = hit;
  tracer(state, context.player, hit, 'player', hit.kind);
  emit(state, { type: 'shot', shooter: 'player', weaponId: weapon.id, position: point(context.player) });
  if (state.crimeCooldown <= 1e-8) {
    emit(state, { type: 'crime', crime: 'gunfire', position: point(context.player) });
    state.crimeCooldown = COMBAT_RULES.gunfireCrimeSeconds;
  }
  if (hit.unitId) {
    const record = { ...officerState(state, hit.unitId) };
    if (!record.hitReported) {
      emit(state, { type: 'crime', crime: 'police-hit', position: point(context.player) }); record.hitReported = true;
    }
    if (hit.kind === 'officer' && !record.down) {
      const location = getPoliceCombatants(context.police, state, context.obstacles, context.traffic).find(officer => officer.unitId === hit.unitId);
      const loss = Math.min(record.health, weapon.damage);
      record.health -= loss; record.position = location ? point(location) : record.position;
      state.hitMarker = 0.16;
      emit(state, { type: 'hit', unitId: hit.unitId, damage: loss });
      if (record.health <= 0) { record.down = true; record.warning = 0; record.muzzle = 0; emit(state, { type: 'unitDown', unitId: hit.unitId }); }
    }
    state.officers[hit.unitId] = record;
  }
}
function returnFire(state, context, dt) {
  const combatants = getPoliceCombatants(context.police, state, context.obstacles, context.traffic);
  const deployed = new Set(combatants.map(officer => officer.unitId));
  for (const [id, record] of Object.entries(state.officers)) if (!deployed.has(id)) record.warning = 0;
  for (const officer of combatants) {
    const record = { ...officerState(state, officer.unitId) };
    state.officers[officer.unitId] = record;
    record.position = point(officer);
    if (officer.down || !officer.armed || context.police.phase === 'clear' || context.police.phase === 'busted') { record.warning = 0; continue; }
    const range = distance(officer, context.player);
    const yaw = Math.atan2(context.player.x - officer.x, officer.z - context.player.z);
    const clearRay = castRay(officer, yaw, range, context, [], officer.unitId, !context.walking);
    if (range > COMBAT_RULES.officerRange || clearRay.distance < range - 0.1) { record.warning = 0; continue; }
    record.aimYaw = yaw;
    record.warning = Math.min(COMBAT_RULES.officerWarningSeconds, record.warning + dt);
    if (record.warning + 1e-8 < COMBAT_RULES.officerWarningSeconds || record.cooldown > 1e-8 || state.dead) continue;
    record.cooldown = COMBAT_RULES.officerCadence;
    record.muzzle = 0.09;
    record.shotIndex += 1;
    const accurate = Math.abs(context.player.speed) > 4 ? record.shotIndex % 3 === 0 : record.shotIndex % 4 !== 0;
    const missYaw = yaw + (record.shotIndex % 2 ? 1 : -1) * Math.atan2(2.3, Math.max(range, 1));
    const end = accurate ? heightPoint(context.player) : castRay(officer, missYaw, range + 2, context, [], officer.unitId, !context.walking);
    tracer(state, officer, end, 'police', accurate ? 'player' : end.kind, officer.unitId);
    emit(state, { type: 'shot', shooter: 'police', weaponId: 'pistol', unitId: officer.unitId, position: point(officer) });
    if (accurate) damage(state, COMBAT_RULES.officerDamage, 'police', officer.unitId);
  }
}
export function stepCombat(state, input = {}, dt = 0) {
  const next = copyState(state); next.events = [];
  const elapsed = clamp(finite(dt), 0, 0.1), context = contextFor(input);
  if (!elapsed || input.enabled === false || next.dead || context.police.phase === 'busted') return next;
  const unitIds = new Set((context.police.units || []).map(unit => unit.id));
  next.officers = Object.fromEntries(Object.entries(next.officers).filter(([id]) => unitIds.has(id)));
  const steps = Math.ceil(elapsed * 120), slice = elapsed / steps;
  for (let frame = 0; frame < steps; frame += 1) {
    next.time += slice;
    for (const key of ['cooldown', 'hitMarker', 'damageFlash', 'muzzleFlash', 'crimeCooldown']) next[key] = Math.max(0, next[key] - slice);
    next.tracers = next.tracers.map(shot => ({ ...shot, ttl: shot.ttl - slice })).filter(shot => shot.ttl > 0);
    for (const record of Object.values(next.officers)) {
      record.cooldown = Math.max(0, record.cooldown - slice); record.muzzle = Math.max(0, record.muzzle - slice);
    }
    if (next.reload) {
      next.reload.remaining = Math.max(0, next.reload.remaining - slice);
      if (next.reload.remaining <= 1e-8) {
        const id = next.reload.weaponId, ammo = next.weapons[id];
        const count = Math.min(WEAPONS[id].magSize - ammo.mag, ammo.reserve);
        ammo.mag += count; ammo.reserve -= count; next.reload = null;
        emit(next, { type: 'reloadComplete', weaponId: id });
      }
    }
    if (input.fire === true && context.walking) playerShot(next, context, input);
    if (!context.police.level && next.time - next.lastShotTime >= COMBAT_RULES.hostilityClearSeconds) next.hostile = false;
    returnFire(next, context, slice);
    if (next.dead) break;
  }
  next.aimPoint = getAimTarget(next, input);
  return next;
}
