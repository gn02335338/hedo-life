// Shared world-space layout and deterministic, renderer-independent walking rules.
export const LAYOUT = [
  { id: 'lobby', x: 0, z: 0, color: '#df7756', label: [0, 1.7, 3.45] },
  { id: 'lab', x: -8.8, z: -7.8, color: '#739c9a', label: [0, 1.7, 3.5] },
  { id: 'meeting', x: .3, z: -9.1, color: '#b597b5', label: [0, 1.7, 3.45] },
  { id: 'hr', x: -10, z: 1, color: '#dcab69', label: [0, 1.7, 3.4] },
  { id: 'finance', x: 9.2, z: -7.5, color: '#6d8896', label: [0, 1.7, 3.45] },
  { id: 'cafe', x: -8.5, z: 9.5, color: '#ce7956', label: [0, 1.7, 3.5] },
  { id: 'plaza', x: 9.7, z: 1.3, color: '#c88b75', label: [0, 1.7, 3.5] },
  { id: 'court', x: .7, z: 10, color: '#729988', label: [0, 1.7, 3.4] },
  { id: 'harbor', x: 10.8, z: 10.5, color: '#d2af72', label: [0, 1.7, 3.5] },
];
export const LINKS = [
  ['lab', 'meeting'], ['meeting', 'finance'], ['lab', 'hr'],
  ['lab', 'lobby'], ['meeting', 'lobby'], ['finance', 'plaza'],
  ['hr', 'lobby'], ['hr', 'cafe'], ['lobby', 'plaza'],
  ['lobby', 'court'], ['cafe', 'court'], ['court', 'harbor'], ['plaza', 'harbor'],
];
export const WALK_HEIGHT = 1.07;
export const PLAYER_SPAWN = Object.freeze({ x: 0, z: 3.1 });
export const PLAYER_RADIUS = .22;
const EPSILON = 1e-8;
const byId = new Map(LAYOUT.map(district => [district.id, district]));
const world = (id, x, z) => ({ x: byId.get(id).x + x, z: byId.get(id).z + z });

export const DISTRICT_ENTRANCES = Object.fromEntries(LAYOUT.map(district => [district.id, world(district.id, 0, 2.85)]));
export const NPC_POSITIONS = Object.fromEntries(Object.entries({
  lobby: [2.6, 1.9], lab: [2.3, 2.7], meeting: [2, 2.6],
  hr: [1.55, 1.65], finance: [1.25, 2.45], cafe: [2.65, 1.45],
  plaza: [2.4, 1.6], court: [2.3, 2.55], harbor: [1.35, 2.35],
}).map(([id, [x, z]]) => [id, world(id, x, z)]));

function rectangle(x, z, width, depth, rotation = 0) {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({
    x: x + sx * width / 2 * cos + sz * depth / 2 * sin,
    z: z - sx * width / 2 * sin + sz * depth / 2 * cos,
  }));
}

// CylinderGeometry's six vertices start on +Z and rotate by pi/6: tips on X,
// flat shores at Z = +/-4.36*cos(pi/6). Match the grass, not the wider lower cliff.
const surfaces = LAYOUT.map(({ x, z }) => Array.from({ length: 6 }, (_, index) => {
  const angle = Math.PI / 6 - index * Math.PI / 3;
  return { x: x + 4.36 * Math.sin(angle), z: z + 4.36 * Math.cos(angle) };
}));
export const BRIDGES = LINKS.map(([fromId, toId]) => {
  const from = byId.get(fromId), to = byId.get(toId);
  const dx = to.x - from.x, dz = to.z - from.z;
  return {
    fromId, toId, x: (from.x + to.x) / 2, z: (from.z + to.z) / 2,
    length: Math.max(.6, Math.hypot(dx, dz) - 7.5), rotation: Math.atan2(dx, dz),
    // Planks extend to .54; the inner edges of the railing posts are at .4425.
    halfWidth: .4425,
  };
});
for (const bridge of BRIDGES) surfaces.push(rectangle(bridge.x, bridge.z, bridge.halfWidth * 2, bridge.length, bridge.rotation));

function cross(a, b) { return a.x * b.z - a.z * b.x; }
function delta(a, b) { return { x: b.x - a.x, z: b.z - a.z }; }
function within(point, polygon) {
  return polygon.every((a, index) => cross(delta(a, polygon[(index + 1) % polygon.length]), delta(a, point)) >= -EPSILON);
}
const edges = surfaces.map(polygon => polygon.map((a, index) => [a, polygon[(index + 1) % polygon.length]]));

// Keep only exposed portions of the union boundary. Eroding each island and
// bridge separately would leave impassable gaps where their decks overlap.
const boundary = [];
for (let polygonIndex = 0; polygonIndex < surfaces.length; polygonIndex++) {
  for (const [a, b] of edges[polygonIndex]) {
    const direction = delta(a, b), length = Math.hypot(direction.x, direction.z);
    const cuts = [0, 1];
    for (let otherIndex = 0; otherIndex < surfaces.length; otherIndex++) {
      if (otherIndex === polygonIndex) continue;
      for (const [c, d] of edges[otherIndex]) {
        const otherDirection = delta(c, d), denominator = cross(direction, otherDirection);
        if (Math.abs(denominator) < EPSILON) continue;
        const offset = delta(a, c);
        const t = cross(offset, otherDirection) / denominator;
        const u = cross(offset, direction) / denominator;
        if (t > 0 && t < 1 && u >= -EPSILON && u <= 1 + EPSILON) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let index = 1; index < cuts.length; index++) {
      const start = cuts[index - 1], end = cuts[index];
      if (end - start < EPSILON) continue;
      const middle = (start + end) / 2;
      // An outward probe also handles edges lying along another polygon edge.
      const outside = { x: a.x + direction.x * middle + direction.z / length * 1e-6,
        z: a.z + direction.z * middle - direction.x / length * 1e-6 };
      if (surfaces.some((polygon, index) => index !== polygonIndex && within(outside, polygon))) continue;
      boundary.push([
        { x: a.x + direction.x * start, z: a.z + direction.z * start },
        { x: a.x + direction.x * end, z: a.z + direction.z * end },
      ]);
    }
  }
}

// Ground-level main building footprints, matching scene.js. Low decorative
// planting and street furniture are omitted so narrow public paths stay usable.
const obstacles = [
  { id: 'lobby', x: -.45, z: -.65, width: 3.1, depth: 2.4 },
  { id: 'lab', x: -.25, z: -.5, width: 3.45, depth: 2.3 },
  { id: 'meeting', x: 0, z: -.55, radius: 2.08 },
  { id: 'hr', x: -.3, z: -.5, width: 3, depth: 2.15 },
  { id: 'finance', x: -.2, z: -.4, width: 3.1, depth: 2.2 },
  { id: 'cafe', x: -.55, z: -.7, width: 2.7, depth: 2.05 },
  { id: 'plaza', x: 0, z: -.8, radius: 2.25 },
  { id: 'harbor', x: -.95, z: -.8, radius: 1.12 },
  { id: 'harbor', x: 1.65, z: .05, width: 1.45, depth: 1.35, rotation: -.15 },
  ...[-2.15, 2.15].map(x => ({ id: 'court', x: x * Math.cos(-.06), z: -.3 - x * Math.sin(-.06), radius: .055 })),
].map(obstacle => ({ ...obstacle, ...world(obstacle.id, obstacle.x, obstacle.z) }));
for (const position of Object.values(NPC_POSITIONS)) obstacles.push({ ...position, radius: .21 });

function segmentDistanceSquared(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
  return (point.x - a.x - t * dx) ** 2 + (point.z - a.z - t * dz) ** 2;
}
function blocked(point, radius, obstacle) {
  const dx = point.x - obstacle.x, dz = point.z - obstacle.z;
  if (obstacle.radius !== undefined) return dx * dx + dz * dz < (obstacle.radius + radius) ** 2 - EPSILON;
  const rotation = obstacle.rotation || 0, cos = Math.cos(rotation), sin = Math.sin(rotation);
  const localX = Math.abs(dx * cos - dz * sin), localZ = Math.abs(dx * sin + dz * cos);
  if (localX <= obstacle.width / 2 && localZ <= obstacle.depth / 2) return true;
  return Math.max(0, localX - obstacle.width / 2) ** 2 + Math.max(0, localZ - obstacle.depth / 2) ** 2 < radius ** 2 - EPSILON;
}
function finitePoint(point) { return point && Number.isFinite(point.x) && Number.isFinite(point.z); }

/** Per-scene extra obstacles are circles {x,z,radius}; static geometry is never mutated. */
export function isWalkable(point, radius = PLAYER_RADIUS, extraObstacles = []) {
  if (!finitePoint(point) || !Number.isFinite(radius) || radius < 0) return false;
  if (!surfaces.some(polygon => within(point, polygon))) return false;
  if (boundary.some(([a, b]) => segmentDistanceSquared(point, a, b) < radius * radius - EPSILON)) return false;
  if(!Array.isArray(extraObstacles)) return false;
  return !obstacles.some(obstacle => blocked(point, radius, obstacle))
    && !extraObstacles.some(obstacle => !finitePoint(obstacle) || !Number.isFinite(obstacle.radius)
      || obstacle.radius < 0 || blocked(point, radius, obstacle));
}

/** Input is world-space x/z, capped to unit magnitude (analog input stays analog).
 * Time is in seconds, capped at 100 ms; 6 cm substeps prevent wall tunneling.
 * The returned point is fresh. A blocked diagonal slides along a free axis.
 */
export function movePlayer(position, input, dt, speed = 4.5, extraObstacles = []) {
  const result = finitePoint(position) ? { x: position.x, z: position.z } : { ...PLAYER_SPAWN };
  if (!finitePoint(input) || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(speed) || speed <= 0) return result;
  const magnitude = Math.hypot(input.x, input.z);
  if (!Number.isFinite(magnitude) || magnitude < EPSILON) return result;
  const distance = Math.min(12, speed * Math.min(.1, dt)) * Math.min(1, magnitude);
  const steps = Math.max(1, Math.ceil(distance / .06));
  const dx = input.x / magnitude * distance / steps, dz = input.z / magnitude * distance / steps;
  for (let step = 0; step < steps; step++) {
    const next = { x: result.x + dx, z: result.z + dz };
    if (isWalkable(next, PLAYER_RADIUS, extraObstacles)) { result.x = next.x; result.z = next.z; continue; }
    if (isWalkable({ x: result.x + dx, z: result.z }, PLAYER_RADIUS, extraObstacles)) result.x += dx;
    if (isWalkable({ x: result.x, z: result.z + dz }, PLAYER_RADIUS, extraObstacles)) result.z += dz;
  }
  return result;
}

/** Targets: { key, position:{x,z}, radius?, exitRadius?, ...metadata }.
 * Keep the current key until its exit radius is exceeded; otherwise choose the
 * nearest target within its enter radius. Defaults are 1.5 / 1.9 world units.
 */
export function nearestInteraction(position, targets, currentId = null) {
  if (!finitePoint(position) || !Array.isArray(targets)) return null;
  const valid = targets.filter(target => target && finitePoint(target.position || target));
  const keyOf = target => target.key ?? target.id;
  const distanceTo = target => { const point = target.position || target; return Math.hypot(point.x - position.x, point.z - position.z); };
  const enterRadius = target => Number.isFinite(target.radius) && target.radius >= 0 ? target.radius : 1.5;
  const current = currentId == null ? null : valid.find(target => keyOf(target) === currentId);
  if (current) {
    const enter = enterRadius(current);
    const exit = Number.isFinite(current.exitRadius) ? Math.max(enter, current.exitRadius) : enter + .4;
    if (distanceTo(current) <= exit) return current;
  }
  let nearest = null, nearestDistance = Infinity;
  for (const target of valid) {
    const distance = distanceTo(target);
    if (distance <= enterRadius(target) && distance < nearestDistance) { nearest = target; nearestDistance = distance; }
  }
  return nearest;
}
