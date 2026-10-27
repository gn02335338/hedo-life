import { ISLAND_CAST } from './cast.js';

// Shared world-space layout and deterministic, renderer-independent walking rules.
export const LAYOUT = [
  { id: 'lobby', x: 0, z: 0, color: '#df7756', label: [0, 1.7, 3.45] },
  { id: 'lab', x: -8.8, z: -7.8, color: '#739c9a', label: [0, 1.7, 3.5] },
  { id: 'meeting', x: .3, z: -9.1, color: '#b597b5', label: [0, 1.7, 3.45] },
  { id: 'hr', x: -10, z: 1, color: '#dcab69', label: [0, 1.7, 3.4] },
  { id: 'finance', x: 9.2, z: -7.5, color: '#6d8896', label: [0, 1.7, 3.45] },
  { id: 'cafe', x: -8.5, z: 9.5, color: '#ce7956', label: [0, 1.7, 3.5] },
  { id: 'plaza', x: 9.7, z: 1.3, color: '#c88b75', label: [0, 1.7, 3.5] },
  { id: 'court', x: 46, z: 5, color: '#729988', label: [0, 1.7, 3.4] },
  { id: 'harbor', x: 57, z: 5, color: '#d2af72', label: [0, 1.7, 3.5] },
  { id: 'exile', x: -50, z: -28, color: '#9a9db8', label: [0, 1.7, 3.4] },
  { id: 'hospital', x: 46, z: -4, color: '#d28483', label: [0, 1.7, 3.4] },
  { id: 'police', x: 57, z: -4, color: '#738fae', label: [0, 1.7, 3.4] },
  { id: 'oneira', x: 28, z: -48, color: '#8072b1', label: [0, 1.7, 3.4] },
];
export const LINKS = [
  ['lab', 'meeting'], ['meeting', 'finance'], ['lab', 'hr'],
  ['lab', 'lobby'], ['meeting', 'lobby'], ['finance', 'plaza'],
  ['hr', 'lobby'], ['hr', 'cafe'], ['lobby', 'plaza'],
  ['lobby', 'cafe'],
  ['court', 'harbor'], ['court', 'hospital'], ['hospital', 'police'], ['police', 'harbor'],
];
export const WALK_HEIGHT = 1.07;
export const PLAYER_SPAWN = Object.freeze({ x: 0, z: 3.1 });
export const PLAYER_RADIUS = .22;
const EPSILON = 1e-8;
const byId = new Map(LAYOUT.map(district => [district.id, district]));
const world = (id, x, z) => ({ x: byId.get(id).x + x, z: byId.get(id).z + z });

export const DISTRICT_ENTRANCES = Object.fromEntries(LAYOUT.map(district => [district.id, world(district.id, 0, 2.85)]));
// Separate physical entrances around each campus, kept outside the main walls.
// Their identifiers are independent of the nine established district/save IDs.
const placeEntrances = {
  'general-manager-office':['lobby',.1,1.25], 'chairman-office':['lobby',-2.5,-.5],
  'research-center':['lab',-1.15,1.1], 'product-development':['lab',.75,1.1],
  'mis-service':['lab',-2.45,-.5], 'product-design':['lab',1.95,-.45], 'project-management':['lab',0,-2.15],
  'business-development':['plaza',-1.6,2], 'ecommerce-sales':['plaza',0,2], 'advertising-sales':['plaza',1.6,2],
  marketing:['meeting',-1.75,1.1], training:['meeting',1.75,1.1],
  'finance-department':['finance',-.95,1.15], accounting:['finance',.85,1.15],
  'human-resources':['hr',-1.2,1.1], administration:['hr',.65,1.1], legal:['hr',-2.3,-.6],
  'meeting-rooms':['cafe',-2.35,-.65], pantry:['cafe',-.8,.85], 'welfare-committee':['cafe',.7,.85],
  'basketball-court':['court',0,2.5], izakaya:['harbor',1.6,1.2], 'aliang-mystery-trip':['harbor',2,2.65],
  'exile-gate':['exile',1.8,1.35], 'cold-palace':['exile',-.65,.7],
  'hospital-er':['hospital',0,1.35], 'police-desk':['police',0,1.25],
  'oneira-hub':['oneira',-.55,1.05], 'oneira-library':['oneira',2.35,1.05],
};
export const PLACE_ENTRANCES = Object.freeze(Object.fromEntries(Object.entries(placeEntrances)
  .map(([id,[districtId,x,z]])=>[id,Object.freeze(world(districtId,x,z))])));

// Authored campus homes for the complete public cast. Department affiliations
// choose the island; courtyards and back paths keep approved resident slots and
// bridge approaches free.
const castLocalPositions = {
  wing:[2.6,1.9], spencer:[-1.25,-2.75], rick:[.5,-2.65],
  jack:[2.3,2.7], sam:[-1.25,-2.85], professor:[-.8,-3.15], princess:[1.7,1.15],
  meimei:[2.4,1.6], helen:[.05,-3.15], joyce:[-.9,-3.35], hester:[-2.95,-.9],
  hope:[1.55,1.65], jenjen:[-1.3,-2.85], zoe:[2,2.6],
  janet:[1.25,2.45], sophie:[-1.25,-2.65], erich:[.7,-2.65],
  jonathan:[2.65,1.45], annie_yu:[-1.2,-2.7], alice:[.1,-3.15],
  captain:[2.6,-2.1], simon:[-3,-1.5], action:[-.5,1.8],
  owen:[2.75,-1], sonny:[-1.25,-.8,1.23], kind:[2.75,1.15],
  cindy:[1.35,2.35], james:[-.8,-2.6], johnny:[.4,-2.15],
  wine:[3,-1.5], peter:[1.1,.4,1.23], tony:[-3,-1.5], henry:[-3,-.5], mia:[-3,0],
};
export const CAST_POSITIONS = Object.freeze(Object.fromEntries(ISLAND_CAST.map(({id,districtId})=>{
  const [x,z,y=WALK_HEIGHT]=castLocalPositions[id];
  return [id,Object.freeze({...world(districtId,x,z),y})];
})));
export const CAST_RADIUS = .21;
export const NPC_POSITIONS = Object.freeze(Object.fromEntries(Object.entries({lobby:'wing',lab:'jack',meeting:'zoe',hr:'hope',finance:'janet',cafe:'jonathan',plaza:'meimei',court:'sonny',harbor:'cindy'})
  .map(([districtId,id])=>[districtId,Object.freeze({x:CAST_POSITIONS[id].x,z:CAST_POSITIONS[id].z})])));

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
const terrainObstacles = [
  { id: 'lobby', x: -.45, z: -.65, width: 3.1, depth: 2.4 },
  { id: 'lab', x: -.25, z: -.5, width: 3.45, depth: 2.3 },
  { id: 'meeting', x: 0, z: -.55, radius: 2.08 },
  { id: 'hr', x: -.3, z: -.5, width: 3, depth: 2.15 },
  { id: 'finance', x: -.2, z: -.4, width: 3.1, depth: 2.2 },
  { id: 'cafe', x: -.55, z: -.7, width: 2.7, depth: 2.05 },
  { id: 'plaza', x: 0, z: -.8, radius: 2.25 },
  { id: 'harbor', x: -.95, z: -.8, radius: 1.12 },
  { id: 'harbor', x: 1.65, z: .05, width: 1.45, depth: 1.35, rotation: -.15 },
  { id: 'harbor', x: 2.6, z: 1.95, width: .8, depth: .8 },
  { id: 'exile', x: -.65, z: -.8, width: 2.15, depth: 1.9 },
  { id: 'exile', x: 1.8, z: .15, width: .95, depth: .9 },
  { id: 'hospital', x: -.3, z: -.5, width: 3.1, depth: 2.2 },
  { id: 'hospital', x: 2.45, z: 1.3, width: .85, depth: 1.35 },
  { id: 'police', x: -.25, z: -.5, width: 2.9, depth: 2.1 },
  { id: 'police', x: 2.35, z: 1.4, width: .85, depth: 1.3 },
  { id: 'oneira', x: -.55, z: -.65, width: 2.4, depth: 2.0 },
  { id: 'oneira', x: 2.35, z: -.25, width: 1.05, depth: 1.15 },
  ...[-2.15, 2.15].map(x => ({ id: 'court', x: x * Math.cos(-.06), z: -.3 - x * Math.sin(-.06), radius: .055 })),
].map(obstacle => ({ ...obstacle, ...world(obstacle.id, obstacle.x, obstacle.z) }));
const castObstacles = Object.values(CAST_POSITIONS).map(position => ({ ...position, radius: CAST_RADIUS }));

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

/** Geometry alone, excluding every character's authored or current position. */
export function isTerrainWalkable(point, radius = PLAYER_RADIUS) {
  if (!finitePoint(point) || !Number.isFinite(radius) || radius < 0) return false;
  if (!surfaces.some(polygon => within(point, polygon))) return false;
  if (boundary.some(([a, b]) => segmentDistanceSquared(point, a, b) < radius * radius - EPSILON)) return false;
  return !terrainObstacles.some(obstacle => blocked(point, radius, obstacle));
}

/** Erode a single home island, so autonomous characters never enter bridges. */
export function isDistrictWalkable(point, districtId, radius = PLAYER_RADIUS) {
  const index = LAYOUT.findIndex(district => district.id === districtId);
  if (index < 0 || !isTerrainWalkable(point, radius) || !within(point, surfaces[index])) return false;
  return edges[index].every(([a, b]) => segmentDistanceSquared(point, a, b) >= radius * radius - EPSILON);
}

/** Per-scene extra obstacles are circles {x,z,radius}; static geometry is never mutated.
 * Dynamic scenes explicitly replace the legacy stationary cast footprints.
 */
export function isWalkable(point, radius = PLAYER_RADIUS, extraObstacles = [], { dynamicCharacters = false } = {}) {
  if (!isTerrainWalkable(point, radius)) return false;
  if(!Array.isArray(extraObstacles)) return false;
  return (dynamicCharacters || !castObstacles.some(obstacle => blocked(point, radius, obstacle)))
    && !extraObstacles.some(obstacle => !finitePoint(obstacle) || !Number.isFinite(obstacle.radius)
      || obstacle.radius < 0 || blocked(point, radius, obstacle));
}

/** Input is world-space x/z, capped to unit magnitude (analog input stays analog).
 * Time is in seconds, capped at 100 ms; 6 cm substeps prevent wall tunneling.
 * The returned point is fresh. A blocked diagonal slides along a free axis.
 */
export function movePlayer(position, input, dt, speed = 4.5, extraObstacles = [], options = {}) {
  const result = finitePoint(position) ? { x: position.x, z: position.z } : { ...PLAYER_SPAWN };
  if (!finitePoint(input) || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(speed) || speed <= 0) return result;
  const magnitude = Math.hypot(input.x, input.z);
  if (!Number.isFinite(magnitude) || magnitude < EPSILON) return result;
  const distance = Math.min(12, speed * Math.min(.1, dt)) * Math.min(1, magnitude);
  const steps = Math.max(1, Math.ceil(distance / .06));
  const dx = input.x / magnitude * distance / steps, dz = input.z / magnitude * distance / steps;
  for (let step = 0; step < steps; step++) {
    const next = { x: result.x + dx, z: result.z + dz };
    if (isWalkable(next, PLAYER_RADIUS, extraObstacles, options)) { result.x = next.x; result.z = next.z; continue; }
    if (isWalkable({ x: result.x + dx, z: result.z }, PLAYER_RADIUS, extraObstacles, options)) result.x += dx;
    if (isWalkable({ x: result.x, z: result.z + dz }, PLAYER_RADIUS, extraObstacles, options)) result.z += dz;
  }
  return result;
}

/** Targets: { key, position:{x,z}, radius?, exitRadius?, ...metadata }.
 * Keep the current key through small distance changes. A visitor deliberately
 * approaching a much closer target can switch before leaving the old radius,
 * which keeps conversations reachable in a busy courtyard. Defaults: 1.5 / 1.9.
 */
export function nearestInteraction(position, targets, currentId = null) {
  if (!finitePoint(position) || !Array.isArray(targets)) return null;
  const valid = targets.filter(target => target && finitePoint(target.position || target));
  const keyOf = target => target.key ?? target.id;
  const distanceTo = target => { const point = target.position || target; return Math.hypot(point.x - position.x, point.z - position.z); };
  const enterRadius = target => Number.isFinite(target.radius) && target.radius >= 0 ? target.radius : 1.5;
  const current = currentId == null ? null : valid.find(target => keyOf(target) === currentId);
  let nearest = null, nearestDistance = Infinity;
  for (const target of valid) {
    const distance = distanceTo(target);
    if (distance <= enterRadius(target) && distance < nearestDistance) { nearest = target; nearestDistance = distance; }
  }
  if (current) {
    const enter = enterRadius(current);
    const exit = Number.isFinite(current.exitRadius) ? Math.max(enter, current.exitRadius) : enter + .4;
    const currentDistance = distanceTo(current);
    // A tight gathering leaves less room to approach one person more closely.
    // Keep a small dead band there; use the wider one between distant targets.
    const targetGap = nearest ? Math.hypot((nearest.position || nearest).x - (current.position || current).x, (nearest.position || nearest).z - (current.position || current).z) : Infinity;
    const switchMargin = targetGap < 1.2 ? .05 : .3;
    const clearlyCloser = nearest && nearestDistance <= .85 && currentDistance - nearestDistance >= switchMargin;
    if (currentDistance <= exit && !clearlyCloser) return current;
  }
  return nearest;
}

/** Emergency transport uses a clear landing outside the selected facility.
 * Fail closed rather than putting the visitor inside another actor or wall. */
export function findPlaceLanding(placeId, extraObstacles = [], options = { dynamicCharacters: true }) {
  const entrance = PLACE_ENTRANCES[placeId];
  if (!entrance || !Array.isArray(extraObstacles)) return null;
  for (const radius of [0, .35, .55, .8, 1.1, 1.4, 1.7]) {
    for (let index = 0; index < (radius ? 24 : 1); index++) {
      const angle = index * Math.PI / 12;
      const point = { x: entrance.x + Math.sin(angle) * radius, z: entrance.z + Math.cos(angle) * radius };
      if (isWalkable(point, PLAYER_RADIUS, extraObstacles, options)) return point;
    }
  }
  return null;
}
