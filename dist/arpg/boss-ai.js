import { WORLD } from './content.js';

const CELL = 0.75;
const MAX_VISITS = 1400;
const grids = new Map();
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (x, z) => { const length = Math.hypot(x, z) || 1; return { x: x / length, z: z / length }; };
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function memory(enemy) {
  return enemy.ai ||= { mode: 'hold', side: Number(enemy.id?.split('-').at(-1)) % 2 ? -1 : 1,
    closeSince: null, followUp: null, followUpUntil: 0,
    nav: { path: [], nextPlanAt: 0, replans: 0 } };
}

export function observePlayer(state, dt) {
  const p = state.player;
  const motion = state.playerMotion ||= { x: p.x, z: p.z, vx: 0, vz: 0, speed: 0 };
  let vx = (p.x - motion.x) / dt, vz = (p.z - motion.z) / dt;
  const speed = Math.hypot(vx, vz);
  // A dash is observed after it happens; it is never used to read a future landing.
  if (speed > 7) { vx *= 7 / speed; vz *= 7 / speed; }
  const blend = 1 - Math.exp(-dt * 9);
  motion.vx += (vx - motion.vx) * blend; motion.vz += (vz - motion.vz) * blend;
  motion.speed = Math.hypot(motion.vx, motion.vz);
  motion.x = p.x; motion.z = p.z;
}

export function navigableSegment(state, a, b, radius, api) {
  if (!api.line(a, b, state)) return false;
  const steps = Math.max(1, Math.ceil(dist(a, b) / 0.25));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    if (!api.walkable(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, radius)) return false;
  }
  if (state) for (const gate of state.gates) {
    if (!gate.locked) continue;
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    if (minZ < gate.z + radius && maxZ > gate.z - radius) {
      const t = Math.abs(b.z - a.z) > 1e-9 ? Math.max(0, Math.min(1, (gate.z - a.z) / (b.z - a.z))) : 0.5;
      if (Math.abs(a.x + (b.x - a.x) * t - gate.x) < gate.width / 2 + radius) return false;
    }
  }
  return true;
}

function grid(radius, api) {
  const key = radius.toFixed(3);
  if (grids.has(key)) return grids.get(key);
  const nodes = [], byCell = new Map();
  for (let iz = 0; iz <= Math.ceil((WORLD.bounds.maxZ - WORLD.bounds.minZ) / CELL); iz++) {
    for (let ix = 0; ix <= Math.ceil((WORLD.bounds.maxX - WORLD.bounds.minX) / CELL); ix++) {
      const x = WORLD.bounds.minX + ix * CELL, z = WORLD.bounds.minZ + iz * CELL;
      if (!api.walkable(x, z, radius)) continue;
      byCell.set(`${ix},${iz}`, nodes.length); nodes.push({ x, z, ix, iz, neighbors: null });
    }
  }
  const value = { nodes, byCell }; grids.set(key, value); return value;
}

function avoidsPlayer(a, b, enemy, state) {
  const p = state.player, radius = enemy.radius + p.radius + 0.1;
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  const t = length2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2)) : 0;
  const nearest = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
  const before = dist(a, p);
  return before < radius ? dist(b, p) > before + 1e-6 && nearest >= before - 1e-6 : nearest >= radius - 1e-6;
}

function nearestNode(nodes, point, radius, state, api, enemy) {
  let best = -1, cost = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = dist(nodes[i], point);
    if (d < cost && d < 2.5 && navigableSegment(state, point, nodes[i], radius, api) && avoidsPlayer(point, nodes[i], enemy, state)) { best = i; cost = d; }
  }
  return best;
}

function push(heap, item) {
  let i = heap.length; heap.push(item);
  while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].score <= item.score) break; heap[i] = heap[parent]; i = parent; }
  heap[i] = item;
}
function pop(heap) {
  const result = heap[0], last = heap.pop();
  if (heap.length) {
    let i = 0;
    while (i * 2 + 1 < heap.length) {
      let child = i * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
      if (heap[child].score >= last.score) break;
      heap[i] = heap[child]; i = child;
    }
    heap[i] = last;
  }
  return result;
}

function pathTo(state, enemy, goal, api) {
  const { nodes, byCell } = grid(enemy.radius, api);
  const start = nearestNode(nodes, enemy, enemy.radius, state, api, enemy), end = nearestNode(nodes, goal, enemy.radius, state, api, enemy);
  if (start < 0 || end < 0) return [];
  const previous = new Int32Array(nodes.length).fill(-1), costs = new Float64Array(nodes.length).fill(Infinity);
  const closed = new Uint8Array(nodes.length), heap = [];
  costs[start] = 0; previous[start] = start; push(heap, { id: start, score: dist(nodes[start], nodes[end]) });
  let best = start, visits = 0;
  while (heap.length && visits++ < MAX_VISITS) {
    const { id } = pop(heap);
    if (closed[id]) continue;
    closed[id] = 1;
    if (dist(nodes[id], nodes[end]) < dist(nodes[best], nodes[end])) best = id;
    if (id === end) { best = id; break; }
    const node = nodes[id];
    if (!node.neighbors) {
      node.neighbors = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const next = byCell.get(`${node.ix + dx},${node.iz + dz}`);
        if (next !== undefined && navigableSegment(null, node, nodes[next], enemy.radius, api)) node.neighbors.push(next);
      }
    }
    for (const next of node.neighbors) {
      if (closed[next] || !navigableSegment(state, node, nodes[next], enemy.radius, api) || !avoidsPlayer(node, nodes[next], enemy, state)) continue;
      const candidate = costs[id] + dist(node, nodes[next]);
      if (candidate >= costs[next]) continue;
      costs[next] = candidate; previous[next] = id;
      push(heap, { id: next, score: candidate + dist(nodes[next], nodes[end]) });
    }
  }
  const result = [];
  for (let id = best; id !== start && id >= 0; id = previous[id]) result.push({ x: nodes[id].x, z: nodes[id].z });
  return result.reverse().slice(0, 64);
}

function ringGoal(state, enemy, radius, offset, api, requireShot = false) {
  const p = state.player, preferred = Math.atan2(enemy.z - p.z, enemy.x - p.x) + offset;
  let result = null, best = Infinity;
  for (let i = 0; i < 24; i++) {
    const angle = preferred + Math.floor((i + 1) / 2) * Math.PI / 12 * (i % 2 ? 1 : -1);
    const point = { x: p.x + Math.cos(angle) * radius, z: p.z + Math.sin(angle) * radius };
    if (!api.walkable(point.x, point.z, enemy.radius)) continue;
    if (requireShot && !navigableSegment(state, point, p, 0.28, api)) continue;
    const score = dist(enemy, point) + turn(angle, preferred) * 1.8;
    if (score < best) { best = score; result = point; }
  }
  return result || { x: enemy.x, z: enemy.z };
}

function retreatGoal(state, enemy, api) {
  const ai = memory(enemy), p = state.player;
  // Commit to a reachable side of the player instead of flipping the far-side
  // ring destination as our own bearing changes while rounding their body.
  if (!ai.retreatGoal || !ai.retreatAnchor || dist(p, ai.retreatAnchor) > 1.5 || dist(enemy, ai.retreatGoal) < 0.45) {
    ai.retreatGoal = ringGoal(state, enemy, 6.2, ai.side * 0.28, api, true);
    ai.retreatAnchor = { x: p.x, z: p.z };
  }
  return ai.retreatGoal;
}

export function predictedPlayer(state, seconds, api) {
  const p = state.player, motion = state.playerMotion || { vx: 0, vz: 0 };
  const lead = Math.min(0.25, Math.max(0, seconds));
  for (const factor of [1, 0.65, 0.3, 0]) {
    const point = { x: p.x + motion.vx * lead * factor, z: p.z + motion.vz * lead * factor };
    if (navigableSegment(state, p, point, 0.12, api)) return point;
  }
  return { x: p.x, z: p.z };
}

export function bossDecision(state, enemy, api) {
  const p = state.player, ai = memory(enemy), distance = dist(enemy, p);
  const line = api.line(enemy, p, state);
  let mode = 'approach', goal, attack = null;
  if (enemy.bossId === 'sonny') {
    goal = ringGoal(state, enemy, 2.5, ai.side * 0.12, api, true);
    if (line && distance <= 3.1) { mode = 'press'; attack = 'slam'; }
    else if (line && distance >= 4.2 && distance <= 11) { mode = 'press'; attack = 'charge'; }
    else mode = 'approach';
  } else if (enemy.bossId === 'meimei') {
    const shot = navigableSegment(state, enemy, p, 0.28, api);
    const motion = state.playerMotion || { vx: 0, vz: 0, speed: 0 }, toward = unit(p.x - enemy.x, p.z - enemy.z);
    const lateral = Math.abs(motion.vx * -toward.z + motion.vz * toward.x);
    if (distance < 4.5) {
      ai.closeSince ??= state.time;
      mode = 'retreat'; goal = retreatGoal(state, enemy, api);
      if (line && state.time - ai.closeSince >= 0.55) attack = 'promise';
    } else {
      ai.closeSince = null;
      ai.retreatGoal = null;
      mode = !shot ? 'strafe' : distance > 7.2 ? 'approach' : 'strafe';
      goal = ringGoal(state, enemy, 6, ai.side * (shot ? 0.38 : 0.65), api, true);
      if (shot && distance <= 11) attack = lateral > 1.1 || (motion.speed > 2 && enemy.attackKind === 'volley') ? 'promise' : 'volley';
    }
  } else {
    mode = 'approach'; goal = ringGoal(state, enemy, 3.1, ai.side * 0.2, api, true);
    if (ai.followUp && state.time > ai.followUpUntil) ai.followUp = null;
    if (ai.followUp === 'slam') {
      if (line && distance <= 3.8) attack = 'slam';
    } else if (ai.followUp === 'bombard') {
      if (line && distance <= 12) attack = 'bombard';
    } else if (line) attack = distance <= 3.8 ? 'slam' : distance <= 12 ? 'bombard' : null;
  }
  ai.mode = mode;
  return { mode, goal, attack };
}

export function recoveryGoal(state, enemy, api) {
  const ai = memory(enemy);
  if (enemy.bossId === 'meimei') {
    ai.mode = dist(enemy, state.player) < 5.2 ? 'retreat' : 'strafe';
    return ai.mode === 'retreat' ? retreatGoal(state, enemy, api) : ringGoal(state, enemy, 6.2, ai.side * 0.6, api, true);
  }
  ai.mode = 'reposition';
  return ringGoal(state, enemy, enemy.bossId === 'sonny' ? 4.05 : 5, ai.side * 0.5, api, true);
}

export function steerEnemy(state, enemy, goal, dt, api) {
  if (!goal || enemy.speed <= 0 || dist(enemy, goal) < 0.15) return;
  const ai = memory(enemy), nav = ai.nav;
  let target = goal;
  if (!navigableSegment(state, enemy, goal, enemy.radius, api) || !avoidsPlayer(enemy, goal, enemy, state)) {
    if (state.time + 1e-9 >= nav.nextPlanAt) {
      nav.path = pathTo(state, enemy, goal, api); nav.nextPlanAt = state.time + 0.5; nav.replans++;
    }
    while (nav.path.length && dist(enemy, nav.path[0]) < 0.3) nav.path.shift();
    if (!nav.path.length) return;
    target = nav.path[0];
  }
  const angle = Math.atan2(target.z - enemy.z, target.x - enemy.x);
  const step = Math.min(enemy.speed * dt, dist(enemy, target));
  let best = null, bestScore = -Infinity;
  for (const offset of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.55, -1.55]) {
    const next = { x: enemy.x + Math.cos(angle + offset) * step, z: enemy.z + Math.sin(angle + offset) * step };
    if (!navigableSegment(state, enemy, next, enemy.radius, api)) continue;
    if (!avoidsPlayer(enemy, next, enemy, state)) continue;
    let crowded = false;
    for (const other of state.enemies) {
      if (other === enemy || other.hp <= 0) continue;
      const separation = (enemy.radius + other.radius) * 0.82;
      if (dist(next, other) < separation && dist(next, other) < dist(enemy, other) - 1e-6) { crowded = true; break; }
    }
    if (crowded) continue;
    const score = dist(enemy, target) - dist(next, target) - Math.abs(offset) * 0.003;
    if (score > bestScore) { bestScore = score; best = next; }
  }
  if (best) api.move(enemy, best.x - enemy.x, best.z - enemy.z, state);
}
