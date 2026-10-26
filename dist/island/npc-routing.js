import { LAYOUT, BRIDGES, CAST_RADIUS, PLAYER_RADIUS, WALK_HEIGHT, isTerrainWalkable, isDistrictWalkable } from './navigation.js';

export const ROUTE_GAP = .025;
const PLANNING_RADIUS = CAST_RADIUS + ROUTE_GAP + .01;
const STEP = .2, MIN_X = -15, MIN_Z = -14, WIDTH = 158, HEIGHT = 148;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const ROUTE_BRIDGES = BRIDGES.map((bridge, index) => {
  const half = bridge.length / 2 + .75, dx = Math.sin(bridge.rotation) * half, dz = Math.cos(bridge.rotation) * half;
  return { ...bridge, index, a: { x: bridge.x - dx, z: bridge.z - dz }, b: { x: bridge.x + dx, z: bridge.z + dz } };
});
function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export function bridgeAt(point) { return ROUTE_BRIDGES.find(bridge => segmentDistance(point, bridge.a, bridge.b) < .7)?.index ?? -1; }
export function landAt(point) { return LAYOUT.find(district => isDistrictWalkable(point, district.id, 0))?.id ?? null; }
export function routeWalkable(point, radius = CAST_RADIUS + ROUTE_GAP) { return isTerrainWalkable(point, radius); }
export function npcGroundHeight(point) {
  const court = LAYOUT.find(row => row.id === 'court'), dx = point.x - court.x, dz = point.z - court.z + .3, a = -.06;
  const edge = Math.min(2.6 - Math.abs(dx * Math.cos(a) - dz * Math.sin(a)), 1.9 - Math.abs(dx * Math.sin(a) + dz * Math.cos(a)));
  return WALK_HEIGHT + .16 * Math.max(0, Math.min(1, edge / .25));
}
export function restingGround(point, districtId, radius = CAST_RADIUS + ROUTE_GAP) {
  return isDistrictWalkable(point, districtId, radius) && routeWalkable(point, radius) && bridgeAt(point) === -1;
}
export function sweptRoute(a, b, accepts = routeWalkable) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / .015));
  for (let i = 1; i <= steps; i++) if (!accepts({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps })) return false;
  return true;
}
let graph;
function routeGraph() {
  if (graph) return graph;
  const nodes = new Map();
  for (let z = 0; z < HEIGHT; z++) for (let x = 0; x < WIDTH; x++) {
    const point = { x: MIN_X + x * STEP, z: MIN_Z + z * STEP };
    if (routeWalkable(point, PLANNING_RADIUS)) nodes.set(z * WIDTH + x, { ...point, key: z * WIDTH + x, bridge: bridgeAt(point), edges: [] });
  }
  for (const [key, node] of nodes) for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const next = nodes.get(key + dz * WIDTH + dx);
    if (next && Math.abs(next.x - node.x) < STEP * 1.01 && sweptRoute(node, next, point => routeWalkable(point, PLANNING_RADIUS))) { node.edges.push(next.key); next.edges.push(key); }
  }
  graph = nodes; return nodes;
}
function nearbyNodes(point, nodes) {
  const x = Math.round((point.x - MIN_X) / STEP), z = Math.round((point.z - MIN_Z) / STEP), result = [];
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    const node = nodes.get((z + dz) * WIDTH + x + dx);
    if (node && distance(node, point) < .65) result.push(node);
  }
  return result.sort((a, b) => distance(a, point) - distance(b, point)).slice(0, 12).filter(node => sweptRoute(point, node));
}
class Heap {
  constructor() { this.rows = []; }
  push(row) { const a = this.rows; a.push(row); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p].score <= row.score) break; a[i] = a[p]; i = p; } a[i] = row; }
  pop() { const a = this.rows, first = a[0], last = a.pop(); if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let child = i * 2 + 1; if (child + 1 < a.length && a[child + 1].score < a[child].score) child++; if (a[child].score >= last.score) break; a[i] = a[child]; i = child; } a[i] = last; } return first; }
}
/** Static graph is built once; dynamic bodies are sampled only for a new route.
 * Search is bounded, and no graph work happens for an unobstructed walking step. */
export function findNpcRoute(start, goal, { obstacles = [], blockedBridges = new Set(), alternativeGoals = [] } = {}) {
  const blockedCells = new Set();
  for (const body of obstacles) {
    const reach = CAST_RADIUS + body.radius + ROUTE_GAP - 1e-8, cells = Math.ceil(reach / STEP), cx = Math.round((body.x - MIN_X) / STEP), cz = Math.round((body.z - MIN_Z) / STEP);
    for (let z = cz - cells; z <= cz + cells; z++) for (let x = cx - cells; x <= cx + cells; x++) {
      if ((MIN_X + x * STEP - body.x) ** 2 + (MIN_Z + z * STEP - body.z) ** 2 < reach * reach) blockedCells.add(z * WIDTH + x);
    }
  }
  const available = point => !blockedBridges.has(point.bridge ?? bridgeAt(point))
    && (point.key !== undefined ? !blockedCells.has(point.key) : obstacles.every(body => (point.x - body.x) ** 2 + (point.z - body.z) ** 2 >= (CAST_RADIUS + body.radius + ROUTE_GAP - 1e-8) ** 2));
  const accepts = point => routeWalkable(point, PLANNING_RADIUS) && available(point);
  const startAccepts = point => routeWalkable(point) && available(point);
  const targets = [goal, ...alternativeGoals].filter(accepts);
  if (!targets.length) return null;
  for (const target of targets.slice(0, 4)) if (sweptRoute(start, target, accepts)) return [{ ...target }];
  const nodes = routeGraph(), starts = nearbyNodes(start, nodes).filter(node => accepts(node) && sweptRoute(start, node, startAccepts));
  const goals = new Map();
  for (const target of targets) for (const node of nearbyNodes(target, nodes)) if (!goals.has(node.key) && accepts(node) && sweptRoute(node, target, accepts)) goals.set(node.key, target);
  if (!starts.length || !goals.size) return null;
  const open = new Heap(), costs = new Map(), parents = new Map(), valid = new Map();
  for (const node of starts.slice(0, 6)) { const g = distance(start, node); costs.set(node.key, g); open.push({ key: node.key, score: g + distance(node, goal), g }); }
  let end = null, visited = 0;
  while (open.rows.length && visited++ < nodes.size * 2) {
    const row = open.pop(); if (row.g !== costs.get(row.key)) continue;
    if (goals.has(row.key)) { end = row.key; break; }
    const node = nodes.get(row.key);
    for (const key of node.edges) {
      const next = nodes.get(key);
      if (!valid.has(key)) valid.set(key, available(next));
      if (!valid.get(key)) continue;
      const g = row.g + distance(node, next);
      if (g >= (costs.get(key) ?? Infinity)) continue;
      // Edges are terrain-safe already. Dynamic circles still need a sweep,
      // otherwise diagonal grid shortcuts could clip a stationary colleague.
      if (obstacles.some(body => segmentDistance(body, node, next) < CAST_RADIUS + body.radius + ROUTE_GAP - 1e-8)) continue;
      costs.set(key, g); parents.set(key, row.key); open.push({ key, g, score: g + distance(next, goal) });
    }
  }
  if (end === null) return null;
  const path = [{ ...goals.get(end) }]; for (let key = end; key !== undefined; key = parents.get(key)) path.push({ x: nodes.get(key).x, z: nodes.get(key).z });
  path.reverse();
  // Keep the short entry to the buffered grid. A walking actor can start near
  // the edge of its safe patrol patch; subsequent legs retain extra clearance.
  const compact = [path[0]]; let anchor = path[0];
  for (let i = 1; i < path.length;) {
    let far = i; while (far + 1 < path.length && sweptRoute(anchor, path[far + 1], accepts)) far++;
    compact.push(path[far]); anchor = path[far]; i = far + 1;
  }
  return compact;
}
const groundCache = new Map();
export function districtGround(districtId) {
  if (groundCache.has(districtId)) return groundCache.get(districtId);
  const center = LAYOUT.find(row => row.id === districtId), result = [];
  for (let z = -3.5; z <= 3.5; z += .3) for (let x = -3.8; x <= 3.8; x += .3) {
    const point = { x: center.x + x, z: center.z + z };
    if (restingGround(point, districtId)) result.push(point);
  }
  groundCache.set(districtId, result); return result;
}
