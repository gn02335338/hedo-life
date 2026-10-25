import { ISLAND_CAST } from './cast.js';
import { LAYOUT, BRIDGES, CAST_POSITIONS, CAST_RADIUS, PLAYER_RADIUS, WALK_HEIGHT, isDistrictWalkable } from './navigation.js';
import { RESIDENT_POSITIONS, RESIDENT_RADIUS } from './residents.js';

export const NPC_STOP_DISTANCE = 2.1;
export const NPC_RESUME_DISTANCE = 2.7;
const GAP = .025, MAX_STEP = .035;
const districts = new Map(LAYOUT.map(row => [row.id, row]));
const activities = { lobby: '看看公告', lab: '整理靈感', meeting: '等下一場會議', hr: '照看小花圃', finance: '伸個懶腰', cafe: '等一杯咖啡', plaza: '看看廣場', court: '場邊休息', harbor: '吹吹海風' };
const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const seedOf = text => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619); return value >>> 0; };
const bridgeApproaches = BRIDGES.map(bridge => {
  const half = (bridge.length + .8) / 2, dx = Math.sin(bridge.rotation) * half, dz = Math.cos(bridge.rotation) * half;
  return { ...bridge, a: { x: bridge.x - dx, z: bridge.z - dz }, b: { x: bridge.x + dx, z: bridge.z + dz } };
});
function distanceToSegment(point, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
}

function patrolArea(point, agent) {
  if (!isDistrictWalkable(point, agent.districtId, agent.radius + GAP)) return false;
  const center = districts.get(agent.districtId), dx = point.x - center.x, dz = point.z - center.z;
  // Keep the outer bridge approaches clear as well as the bridges themselves.
  for (const bridge of bridgeApproaches) if ((bridge.fromId === agent.districtId || bridge.toId === agent.districtId)
    && distanceToSegment(point, bridge.a, bridge.b) < agent.radius + PLAYER_RADIUS + GAP) return false;
  if (agent.districtId === 'court') {
    const angle = -.06, x = dx * Math.cos(angle) - (dz + .3) * Math.sin(angle), z = dx * Math.sin(angle) + (dz + .3) * Math.cos(angle);
    if (agent.deck) return Math.abs(x) <= 4.9 / 2 - .25 && Math.abs(z) <= 3.5 / 2 - .25;
    // Ground-level actors use the path around the raised basketball deck.
    if (Math.abs(x) < 5.2 / 2 + agent.radius && Math.abs(z) < 3.8 / 2 + agent.radius) return false;
  }
  return true;
}
function clearSegment(a, b, agent) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / .06));
  for (let i = 1; i <= steps; i++) if (!patrolArea({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps }, agent)) return false;
  return true;
}
function makeAgent(kind, id, districtId, home, slot = null) {
  const key = `${kind}:${id}`, seed = seedOf(key), radius = kind === 'person' ? CAST_RADIUS : RESIDENT_RADIUS;
  const agent = { key, kind, id, districtId, slot, home: { ...home }, position: { ...home, y: home.y ?? WALK_HEIGHT }, radius, seed,
    deck: districtId === 'court' && home.y > WALK_HEIGHT + .1, heading: (seed % 628) / 100, state: 'resting', activity: activities[districtId],
    greeting: false, target: null, wait: .35 + (seed % 3000) / 1000, blocked: 0, visits: 0, speed: .34 + (seed % 220) / 1000, points: [] };
  // A couple of the original stationary guides stood beside bridge mouths.
  // Start their living version on the nearest safe interior patch, before the
  // first frame; no established actor is relocated during simulation updates.
  if (!patrolArea(home, agent)) {
    let anchor = null;
    for (const radius of [.15, .3, .45, .6, .9]) {
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12, candidate = { x: home.x + Math.sin(angle) * radius, z: home.z + Math.cos(angle) * radius };
        if (patrolArea(candidate, agent)) { anchor = candidate; break; }
      }
      if (anchor) break;
    }
    if (anchor) { home = { ...anchor, y: agent.position.y }; agent.home = { ...home }; agent.position = { ...home }; }
  }
  agent.points.push({ x: home.x, z: home.z });
  // Short, auditable routes remain near each authored home. Every leg is swept
  // against buildings/shore before use, including when choosing a new detour.
  for (const radius of [.45, .8, 1.15]) for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, point = { x: home.x + Math.sin(angle) * radius, z: home.z + Math.cos(angle) * radius };
    if (patrolArea(point, agent) && clearSegment(home, point, agent)) agent.points.push(point);
  }
  return agent;
}

/** Pure, bounded island simulation. Public roster text never enters this model. */
export function createNpcLife({ residents = [] } = {}) {
  const agents = new Map(ISLAND_CAST.map(({ id, districtId }) => {
    const agent = makeAgent('person', id, districtId, CAST_POSITIONS[id]); return [agent.key, agent];
  }));
  let conversation = null, frame = 0, visitor = null, visitorVisible = false;
  const free = (point, agent, player = null) => {
    for (const other of agents.values()) if (other !== agent && distance(point, other.position) < agent.radius + other.radius + GAP - 1e-8) return false;
    return !finite(player) || distance(point, player) >= agent.radius + PLAYER_RADIUS + GAP - 1e-8;
  };
  const state = () => [...agents.values()].map(agent => ({ key: agent.key, kind: agent.kind, id: agent.id, districtId: agent.districtId,
    position: { ...agent.position }, heading: agent.heading, state: agent.state, activity: agent.activity }));
  function setResidents(rows = []) {
    const accepted = new Map(), slots = new Set();
    for (const row of Array.isArray(rows) ? rows.slice(0, 27) : []) {
      if (!row || typeof row.id !== 'string' || !row.id || !districts.has(row.districtId) || !Number.isInteger(row.slot) || row.slot < 0 || row.slot > 2) continue;
      const key = `resident:${row.id}`, slot = `${row.districtId}:${row.slot}`;
      if (accepted.has(key) || slots.has(slot)) continue;
      accepted.set(key, row); slots.add(slot);
    }
    for (const [key, agent] of agents) if (agent.kind === 'resident' && (!accepted.has(key) || accepted.get(key).districtId !== agent.districtId || accepted.get(key).slot !== agent.slot)) agents.delete(key);
    for (const [key, row] of [...accepted].sort(([a], [b]) => a.localeCompare(b))) {
      if (agents.has(key)) continue;
      const home = RESIDENT_POSITIONS[row.districtId][row.slot]; let agent = makeAgent('resident', row.id, row.districtId, home, row.slot);
      // New arrivals may find their usual spot occupied by a passing colleague.
      // Only the new actor chooses a free spawn; established walkers never jump.
      let spawn = agent.points.find(point => patrolArea(point, agent) && free(point, agent, visitorVisible ? visitor : null));
      if (!spawn) {
        // At most seven actors share a district. A bounded interior grid gives
        // a new arrival space even if all of its usual short patrol is busy.
        const center = districts.get(row.districtId), alternatives = [];
        for (let x = -3.5; x <= 3.5; x += .25) for (let z = -3.5; z <= 3.5; z += .25) {
          const point = { x: center.x + x, z: center.z + z };
          if (patrolArea(point, agent) && free(point, agent, visitorVisible ? visitor : null)) alternatives.push(point);
        }
        alternatives.sort((a, b) => distance(a, home) - distance(b, home));
        spawn = alternatives[0];
        if (!spawn) throw new Error('No safe island arrival position');
        agent = makeAgent('resident', row.id, row.districtId, spawn, row.slot);
      }
      agent.position = { ...spawn, y: WALK_HEIGHT }; agents.set(key, agent);
    }
    if (conversation && !agents.has(conversation)) conversation = null;
    return state();
  }
  function setConversationTarget(target) {
    const key = target && ['person', 'resident'].includes(target.kind) && typeof target.id === 'string' ? `${target.kind}:${target.id}` : null;
    conversation = key && agents.has(key) ? key : null;
  }
  function waypoint(agent, player) {
    for (let i = 0; i < agent.points.length; i++) {
      const index = (agent.seed + agent.visits * 7 + i) % agent.points.length, point = agent.points[index];
      if (distance(point, agent.position) > .3 && free(point, agent, player) && clearSegment(agent.position, point, agent)) {
        agent.visits++; return point;
      }
    }
    agent.visits++; return null;
  }
  function update(dt, { player = null, roaming = false, paused = false, reducedMotion = false, hidden = false } = {}) {
    visitor = finite(player) ? { x: player.x, z: player.z } : null; visitorVisible = Boolean(roaming && visitor);
    const frozen = paused || reducedMotion || hidden, elapsed = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .1) : 0;
    const rows = [...agents.values()];
    if (!frozen && elapsed) frame++;
    for (let i = 0; i < rows.length; i++) {
      const agent = rows[(i + frame) % rows.length], pinned = conversation === agent.key;
      if (pinned) {
        agent.state = 'talking'; agent.activity = '聊聊島上日常';
        if (!frozen && visitor && distance(agent.position, visitor) > .01) agent.heading = Math.atan2(visitor.x - agent.position.x, visitor.z - agent.position.z);
        continue;
      }
      if (frozen) { agent.state = 'resting'; agent.activity = '休息中'; continue; }
      const gap = visitorVisible ? distance(agent.position, visitor) : Infinity;
      agent.greeting = visitorVisible && gap <= (agent.greeting ? NPC_RESUME_DISTANCE : NPC_STOP_DISTANCE) + 1e-8;
      if (agent.greeting) {
        agent.state = 'greeting'; agent.activity = '停下來和你打招呼';
        if (gap > .01) agent.heading = Math.atan2(visitor.x - agent.position.x, visitor.z - agent.position.z);
        continue;
      }
      agent.state = 'resting'; agent.activity = activities[agent.districtId];
      if (!elapsed) continue;
      if (agent.wait > 0) { agent.wait = Math.max(0, agent.wait - elapsed); continue; }
      const playerObstacle = visitorVisible ? visitor : null;
      if (!agent.target) agent.target = waypoint(agent, playerObstacle);
      if (!agent.target) { agent.wait = .7; continue; }
      const remaining = distance(agent.position, agent.target), travel = Math.min(remaining, agent.speed * elapsed);
      if (remaining < .025) { agent.target = null; agent.wait = 1.4 + ((agent.seed + agent.visits * 331) % 3300) / 1000; continue; }
      const dx = (agent.target.x - agent.position.x) / remaining, dz = (agent.target.z - agent.position.z) / remaining;
      const steps = Math.max(1, Math.ceil(travel / MAX_STEP)), step = travel / steps;
      let moved = 0;
      for (let n = 0; n < steps; n++) {
        const next = { x: agent.position.x + dx * step, z: agent.position.z + dz * step };
        if (!patrolArea(next, agent) || !free(next, agent, playerObstacle)) break;
        agent.position.x = next.x; agent.position.z = next.z; moved += step;
      }
      if (moved > 0) { agent.state = 'walking'; agent.activity = '在附近散步'; agent.heading = Math.atan2(dx, dz); agent.blocked = 0; }
      else {
        agent.activity = '讓路，等一下'; agent.blocked += elapsed;
        if (agent.blocked >= 1.1) { agent.target = null; agent.wait = .25; agent.blocked = 0; }
      }
    }
    return state();
  }
  setResidents(residents);
  return { update, getState: state, setResidents, setConversationTarget,
    getObstacles: () => [...agents.values()].map(agent => ({ ...agent.position, radius: agent.radius, key: agent.key })) };
}
