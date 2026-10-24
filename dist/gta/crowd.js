import { BUILDINGS, WORLD_LIMIT } from './world.js';

export const CROWD_RULES = Object.freeze({
  count: 12, radius: .45, startleSeconds: .32, panicSeconds: 5.8,
  recoverySeconds: 2.8, maxStep: .1, maxThreats: 8, rememberedThreats: 16,
});
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const wrap = (value, length) => ((value % length) + length) % length;
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Closed sidewalk routes are built once, not searched every frame. The narrow
// corner arcs stay outside the padded building footprint. Both long sides have
// an outward detour around the existing lamps (z -14) and planters (z +14).
function sidewalkLoop(building) {
  const hx = building.w / 2 + .8, hz = building.d / 2 + .8, radius = .4;
  const segments = [];
  let length = 0;
  function line(x1, z1, x2, z2) {
    const span = Math.hypot(x2 - x1, z2 - z1);
    segments.push({ start: length, length: span, x: x1, z: z1, tx: (x2 - x1) / span, tz: (z2 - z1) / span }); length += span;
  }
  function arc(x, z, angle) {
    const span = Math.PI * radius / 2;
    segments.push({ start: length, length: span, x, z, angle, radius }); length += span;
  }
  function side(sign, forward) {
    const points = [[sign * hx, -hz + radius], [sign * hx, -17.5], [sign * (hx + 1.2), -16],
      [sign * (hx + 1.2), -12], [sign * hx, -10.5], [sign * hx, 10.5],
      [sign * (hx + 1.2), 12], [sign * (hx + 1.2), 16], [sign * hx, 17.5], [sign * hx, hz - radius]];
    if (!forward) points.reverse();
    for (let i = 1; i < points.length; i++) line(...points[i - 1], ...points[i]);
  }
  line(-hx + radius, -hz, hx - radius, -hz);
  arc(hx - radius, -hz + radius, -Math.PI / 2);
  side(1, true);
  arc(hx - radius, hz - radius, 0);
  line(hx - radius, hz, -hx + radius, hz);
  arc(-hx + radius, hz - radius, Math.PI / 2);
  const leftStart = length;
  side(-1, false);
  arc(-hx + radius, -hz + radius, Math.PI);
  return { x: building.x, z: building.z, segments, length, leftStart };
}
const LOOPS = BUILDINGS.map(sidewalkLoop);
function onLoop(loop, pathDistance) {
  const s = wrap(pathDistance, loop.length);
  let segment = loop.segments[loop.segments.length - 1];
  for (const candidate of loop.segments) if (s < candidate.start + candidate.length) { segment = candidate; break; }
  const offset = s - segment.start;
  if (segment.radius) {
    const angle = segment.angle + offset / segment.radius;
    return { x: loop.x + segment.x + Math.cos(angle) * segment.radius, z: loop.z + segment.z + Math.sin(angle) * segment.radius,
      tx: -Math.sin(angle), tz: Math.cos(angle) };
  }
  return { x: loop.x + segment.x + segment.tx * offset, z: loop.z + segment.z + segment.tz * offset, tx: segment.tx, tz: segment.tz };
}

export function createCrowd() {
  const blocks = [10, 9, 6, 5, 11, 14, 8, 2, 1, 7, 13, 4];
  return blocks.map((blockIndex, index) => {
    const loop = LOOPS[blockIndex];
    const pathDistance = index === 0 ? loop.leftStart + 16 : loop.length * ((index * .217 + .11) % 1);
    const point = onLoop(loop, pathDistance), direction = index % 2 ? -1 : 1;
    return { id: `pedestrian-${index + 1}`, x: point.x, z: point.z, heading: Math.atan2(point.tx * direction, -point.tz * direction),
      speed: 1.15 + index % 4 * .14, mode: 'walk', phase: index * .9, blockIndex, pathDistance, direction,
      walkSpeed: 1.15 + index % 4 * .14, fleeSpeed: 4.7 + index % 3 * .25,
      startleRemaining: 0, panicRemaining: 0, recoveryRemaining: 0, avoidCooldown: 0, yieldRemaining: 0,
      threatX: point.x, threatZ: point.z, seenThreatIds: [], distance: 0 };
  });
}

function escapeDirection(person, loop, threat) {
  let bestDirection = person.direction, bestScore = -Infinity;
  for (const direction of [person.direction, -person.direction]) {
    const near = onLoop(loop, person.pathDistance + direction * 5);
    const far = onLoop(loop, person.pathDistance + direction * 14);
    const score = distance(near, threat) + distance(far, threat) * .22;
    if (score > bestScore + .02) { bestScore = score; bestDirection = direction; }
  }
  return bestDirection;
}
function blockersFor(vehicles, player) {
  const blockers = [];
  for (const car of Array.isArray(vehicles) ? vehicles : []) {
    if (!validPoint(car)) continue;
    const heading = finite(car.heading), sx = Math.sin(heading), cx = Math.cos(heading);
    const travel = clamp(finite(car.speed), -35, 40) * .5;
    // The swept oriented box anticipates the next half second, including a car
    // passing between the two endpoint positions. No vehicle state is changed.
    blockers.push({ x: car.x + sx * travel / 2, z: car.z - cx * travel / 2, sx, cx,
      halfWidth: 1.05 + CROWD_RULES.radius, halfLength: 2.15 + CROWD_RULES.radius + Math.abs(travel) / 2 });
  }
  if (validPoint(player)) blockers.push({ x: player.x, z: player.z, radius: 1.05 });
  return blockers;
}
function clearance(point, blockers) {
  let nearest = Infinity;
  for (const blocker of blockers) {
    const dx = point.x - blocker.x, dz = point.z - blocker.z;
    if (blocker.radius) { nearest = Math.min(nearest, Math.hypot(dx, dz) - blocker.radius); continue; }
    const qx = Math.abs(dx * blocker.cx + dz * blocker.sx) - blocker.halfWidth;
    const qz = Math.abs(dx * blocker.sx - dz * blocker.cx) - blocker.halfLength;
    nearest = Math.min(nearest, Math.hypot(Math.max(0, qx), Math.max(0, qz)) + Math.min(0, Math.max(qx, qz)));
  }
  return nearest;
}
function hearThreats(person, loop, threats) {
  let chosen = null, urgency = Infinity;
  for (const threat of threats) {
    if (person.seenThreatIds.includes(threat.id)) continue;
    const range = distance(person, threat);
    if (range > threat.radius) continue;
    person.seenThreatIds.push(threat.id);
    const score = range / threat.radius;
    if (score < urgency) { urgency = score; chosen = threat; }
  }
  if (!chosen) return;
  person.seenThreatIds = person.seenThreatIds.slice(-CROWD_RULES.rememberedThreats);
  person.direction = escapeDirection(person, loop, chosen);
  person.threatX = chosen.x; person.threatZ = chosen.z;
  person.panicRemaining = CROWD_RULES.panicSeconds;
  person.recoveryRemaining = 0;
  if (person.mode === 'walk' || person.mode === 'recover') {
    person.mode = 'startled'; person.startleRemaining = CROWD_RULES.startleSeconds; person.speed = 0;
  }
  // Repeated fresh gunshots keep someone running, rather than repeatedly
  // restarting the stationary startle pose in front of the threat.
}
function advance(person, dt, threats, blockers) {
  const loop = LOOPS[person.blockIndex];
  hearThreats(person, loop, threats);
  person.avoidCooldown = Math.max(0, person.avoidCooldown - dt);
  person.yieldRemaining = Math.max(0, person.yieldRemaining - dt);
  person.panicRemaining = Math.max(0, person.panicRemaining - dt);
  if (person.mode === 'startled') {
    person.startleRemaining = Math.max(0, person.startleRemaining - dt);
    if (person.startleRemaining <= 1e-8) person.mode = 'flee';
  }
  if (person.mode === 'flee' && person.panicRemaining <= 1e-8) {
    person.mode = 'recover'; person.recoveryRemaining = CROWD_RULES.recoverySeconds;
  }
  if (person.mode === 'recover') {
    person.recoveryRemaining = Math.max(0, person.recoveryRemaining - dt);
    if (person.recoveryRemaining <= 1e-8) person.mode = 'walk';
  }
  let target = person.mode === 'startled' ? 0 : person.mode === 'flee' ? person.fleeSpeed
    : person.mode === 'recover' ? person.walkSpeed + (person.fleeSpeed - person.walkSpeed)
      * (person.recoveryRemaining / CROWD_RULES.recoverySeconds) ** 2 : person.walkSpeed;
  const current = onLoop(loop, person.pathDistance), currentClearance = clearance(current, blockers);
  if (blockers.length && person.mode !== 'startled') {
    const lookAhead = Math.max(1.8, Math.min(4, target * .65));
    const ahead = clearance(onLoop(loop, person.pathDistance + person.direction * lookAhead), blockers);
    if (ahead < .3 || currentClearance < .15) {
      const behind = clearance(onLoop(loop, person.pathDistance - person.direction * lookAhead), blockers);
      if (!person.avoidCooldown && behind > ahead + .25 && behind > currentClearance + .1) {
        person.direction *= -1; person.avoidCooldown = 1.1; person.yieldRemaining = .16; person.speed = 0;
      } else if (ahead <= currentClearance + .05) target = 0;
      else target = Math.min(target, Math.max(1.2, target * .75));
    }
  }
  if (person.yieldRemaining > 0) target = 0;
  const decay = Math.exp(-9 * dt), previousSpeed = person.speed;
  person.speed = target + (previousSpeed - target) * decay;
  let travel = target * dt + (previousSpeed - target) * (1 - decay) / 9;
  if (person.mode === 'startled' || person.yieldRemaining > 0) { person.speed = 0; travel = 0; }
  let next = onLoop(loop, person.pathDistance + travel * person.direction);
  const nextClearance = clearance(next, blockers);
  // A spawned/moving blocker can overlap an existing pedestrian. Let the
  // pedestrian leave along increasing clearance, but never step farther in.
  if (nextClearance < 0 && nextClearance < currentClearance - 1e-8) {
    person.speed = 0; travel = 0; next = current;
  }
  person.pathDistance = wrap(person.pathDistance + travel * person.direction, loop.length);
  person.x = clamp(next.x, -WORLD_LIMIT + CROWD_RULES.radius, WORLD_LIMIT - CROWD_RULES.radius);
  person.z = clamp(next.z, -WORLD_LIMIT + CROWD_RULES.radius, WORLD_LIMIT - CROWD_RULES.radius);
  const desiredHeading = Math.atan2(next.tx * person.direction, -next.tz * person.direction);
  person.heading += angleDelta(desiredHeading, person.heading) * (1 - Math.exp(-14 * dt));
  person.heading = Math.atan2(Math.sin(person.heading), Math.cos(person.heading));
  person.phase = wrap(person.phase + travel * 4.8, TAU); person.distance += travel;
}

export function stepCrowd(crowd, dt, { threats = [], vehicles = [], player = null } = {}) {
  const next = (Array.isArray(crowd) ? crowd : []).map(person => ({ ...person, seenThreatIds: [...(person.seenThreatIds || [])] }));
  const elapsed = clamp(finite(dt), 0, CROWD_RULES.maxStep);
  if (!elapsed) return next;
  const activeThreats = (Array.isArray(threats) ? threats : []).filter(threat => validPoint(threat)
    && (typeof threat.id === 'string' || Number.isFinite(threat.id))
    && ['gunshot', 'collision'].includes(threat.kind) && Number.isFinite(threat.radius) && threat.radius > 0
    && Number.isFinite(threat.remaining) && threat.remaining > 0).slice(-CROWD_RULES.maxThreats);
  const blockers = blockersFor(vehicles, player);
  const steps = Math.max(1, Math.ceil(elapsed * 120 - 1e-8)), slice = elapsed / steps;
  for (const person of next) for (let index = 0; index < steps; index++) advance(person, slice, activeThreats, blockers);
  return next;
}
