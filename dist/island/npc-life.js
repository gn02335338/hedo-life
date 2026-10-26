import { ISLAND_CAST } from './cast.js';
import { LAYOUT, PLACE_ENTRANCES, CAST_RADIUS, PLAYER_RADIUS, WALK_HEIGHT } from './navigation.js';
import { RESIDENT_POSITIONS, RESIDENT_RADIUS } from './residents.js';
import { getPersonRoutine } from './routines.js';
import { PLACE_BY_ID } from './places.js';
import { ROUTE_GAP, bridgeAt, landAt, routeWalkable, restingGround, sweptRoute, findNpcRoute, districtGround, npcGroundHeight } from './npc-routing.js';

export const NPC_STOP_DISTANCE = 2.1;
export const NPC_RESUME_DISTANCE = 2.7;
export const NPC_COMMUTE_SPEED = 1.35;
const MAX_STEP = .035;
const districts = new Map(LAYOUT.map(row => [row.id, row]));
const activities = { lobby: '看看總部公告', lab: '找開發靈感', meeting: '等一場分享', hr: '看看服務公告', finance: '在中庭歇腳', cafe: '到茶水間歇腳', plaza: '逛逛商務聚落', court: '場邊休息', harbor: '看看夜色碼頭' };
const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const seedOf = text => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619); return value >>> 0; };
const publicEntrances = Object.values(PLACE_ENTRANCES);
const patrolGround = (point, districtId) => restingGround(point, districtId) && publicEntrances.every(entrance => distance(point, entrance) > .72);
function patrolPoints(home, districtId) {
  const result = [{ x: home.x, z: home.z }], allowed = point => patrolGround(point, districtId);
  for (const radius of [.3, .55, .85]) for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, point = { x: home.x + Math.sin(angle) * radius, z: home.z + Math.cos(angle) * radius };
    if (allowed(point) && sweptRoute(home, point, allowed)) result.push(point);
  }
  return result;
}
function makeAgent(kind, id, districtId, home, slot = null) {
  const key = `${kind}:${id}`, seed = seedOf(key);
  return { key, kind, id, districtId, slot, home: { ...home }, position: { ...home, y: npcGroundHeight(home) }, radius: kind === 'person' ? CAST_RADIUS : RESIDENT_RADIUS, seed,
    heading: (seed % 628) / 100, state: 'resting', activity: activities[districtId], greeting: false, target: null,
    wait: .35 + (seed % 3000) / 1000, blocked: 0, visits: 0, speed: .34 + (seed % 220) / 1000,
    points: patrolPoints(home, districtId), routine: null, destination: { ...home }, traveling: false, commuting: false, path: [], routeDelay: 0, yieldTarget: null };
}
const residentHomes = Object.entries(RESIDENT_POSITIONS).flatMap(([districtId, points]) => points.map(point => ({ ...point, districtId })));
/** Assign separate resting spots before a trip; reserve public entrances and
 * community arrival slots so a large department never forms a solid doorway. */
function assignDestinations(hour, fixed = new Map()) {
  const assignments = new Map(), reserved = [...fixed.values()];
  for (const person of ISLAND_CAST) {
    const routine = getPersonRoutine(person.id, hour), target = PLACE_ENTRANCES[routine.placeId];
    if (fixed.has(person.id)) { assignments.set(person.id, { routine, position: fixed.get(person.id) }); continue; }
    const points = districtGround(routine.districtId).filter(point => residentHomes.every(home => distance(point, home) > .95)
      && Object.values(PLACE_ENTRANCES).every(entrance => distance(point, entrance) > .9));
    const candidates = [...points].sort((a, b) => distance(a, target) - distance(b, target));
    let point;
    for (const separation of [1.3, 1.15, 1, .9, .75, .6, .48]) {
      point = candidates.find(candidate => reserved.every(other => distance(candidate, other) >= separation)); if (point) break;
    }
    if (!point) throw new Error(`No safe routine destination for ${person.id}`);
    reserved.push(point); assignments.set(person.id, { routine, position: { ...point } });
  }
  return assignments;
}

/** Pure, bounded island simulation. Time changes retarget walks, never poses. */
export function createNpcLife({ residents = [], hour = 12 } = {}) {
  let currentHour = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12;
  const destinations = assignDestinations(currentHour), agents = new Map();
  for (const { id } of ISLAND_CAST) {
    const { routine, position } = destinations.get(id), agent = makeAgent('person', id, routine.districtId, position);
    agent.routine = routine; agents.set(agent.key, agent);
  }
  let conversation = null, frame = 0, visitor = null, visitorVisible = false;
  const bridgeLocks = new Map();
  const free = (point, agent, player = null) => {
    for (const other of agents.values()) if (other !== agent && distance(point, other.position) < agent.radius + other.radius + ROUTE_GAP - 1e-8) return false;
    return !finite(player) || distance(point, player) >= agent.radius + PLAYER_RADIUS + ROUTE_GAP - 1e-8;
  };
  const state = () => [...agents.values()].map(agent => ({ key: agent.key, kind: agent.kind, id: agent.id, districtId: agent.districtId,
    position: { ...agent.position }, heading: agent.heading, state: agent.state, activity: agent.activity,
    routine: agent.routine ? { ...agent.routine } : null,
    destinationDistrictId: agent.routine?.districtId ?? agent.districtId,
    destinationPlaceId: agent.routine?.placeId ?? null, traveling: agent.traveling }));
  function setHour(value) {
    if (!Number.isFinite(Number(value))) return state();
    currentHour = ((Number(value) % 24) + 24) % 24;
    const people = [...agents.values()].filter(agent => agent.kind === 'person');
    if (people.every(agent => getPersonRoutine(agent.id, currentHour).placeId === agent.routine.placeId)) {
      for (const agent of people) agent.routine = getPersonRoutine(agent.id, currentHour);
      return state();
    }
    const fixed = new Map([...agents.values()].filter(agent => agent.kind === 'person' && getPersonRoutine(agent.id, currentHour).placeId === agent.routine.placeId).map(agent => [agent.id, agent.destination]));
    const next = assignDestinations(currentHour, fixed);
    for (const agent of agents.values()) if (agent.kind === 'person') {
      const { routine, position } = next.get(agent.id), changed = routine.placeId !== agent.routine.placeId;
      agent.routine = routine;
      if (!changed) continue;
      agent.destination = position; agent.traveling = true; agent.path = []; agent.target = null; agent.wait = 0;
      agent.routeDelay = (agent.seed % 12) * .07; agent.blocked = 0;
    }
    return state();
  }
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
      const home = RESIDENT_POSITIONS[row.districtId][row.slot], agent = makeAgent('resident', row.id, row.districtId, home, row.slot);
      const options = [home, ...agent.points, ...[...districtGround(row.districtId)].sort((a, b) => distance(a, home) - distance(b, home))];
      const spawn = options.find(point => patrolGround(point, row.districtId) && free(point, agent, visitorVisible ? visitor : null));
      if (!spawn) throw new Error('No safe island arrival position');
      agent.home = { ...spawn }; agent.position = { ...spawn, y: npcGroundHeight(spawn) }; agent.points = patrolPoints(spawn, row.districtId); agents.set(key, agent);
    }
    if (conversation && !agents.has(conversation)) conversation = null;
    return state();
  }
  function setConversationTarget(target) {
    const key = target && ['person', 'resident'].includes(target.kind) && typeof target.id === 'string' ? `${target.kind}:${target.id}` : null;
    conversation = key && agents.has(key) ? key : null;
  }
  function waypoint(agent, player) {
    const allowed = point => patrolGround(point, agent.districtId);
    for (let i = 0; i < agent.points.length; i++) {
      const index = (agent.seed + agent.visits * 7 + i) % agent.points.length, point = agent.points[index];
      if (distance(point, agent.position) > .25 && free(point, agent, player) && sweptRoute(agent.position, point, allowed)) { agent.visits++; return point; }
    }
    agent.visits++; return null;
  }
  function plan(agent, player) {
    const bodies = [...agents.values()].filter(other => other !== agent).map(other => ({ ...other.position, radius: other.radius }));
    if (player) bodies.push({ ...player, radius: PLAYER_RADIUS });
    const blockedBridges = new Set([...bridgeLocks].filter(([, key]) => key !== agent.key).map(([bridge]) => bridge));
    const radius = agent.routine.districtId === 'court' ? 3 : 1.1;
    const alternatives = [agent.destination, ...districtGround(agent.routine.districtId).filter(point => distance(point, agent.destination) < radius)
      .sort((a, b) => distance(a, agent.destination) - distance(b, agent.destination))];
    const goals = [];
    for (const point of alternatives) if (free(point, agent, player) && Object.values(PLACE_ENTRANCES).every(entrance => distance(point, entrance) > .72)
      && goals.every(goal => distance(point, goal) > .35)) { goals.push(point); if (goals.length >= 12) break; }
    agent.path = goals.length ? findNpcRoute(agent.position, goals[0], { obstacles: bodies, blockedBridges, alternativeGoals: goals.slice(1) }) || [] : [];
    // A busy landing must not strand someone on the opposite side of the map.
    // Walk toward the queue on the static route; every actual step still checks
    // current bodies, bridge ownership and player space before advancing.
    if (!agent.path.length && goals.length) agent.path = findNpcRoute(agent.position, goals[0], { alternativeGoals: goals.slice(1) }) || [];
    agent.routeDelay = agent.path.length ? 0 : 1.5 + (agent.seed % 5) * .1;
  }
  function yieldWay(agent, player) {
    if (!agent.target) return;
    const direction = { x: agent.target.x - agent.position.x, z: agent.target.z - agent.position.z };
    const length = Math.hypot(direction.x, direction.z);
    if (!length) return;
    const blockers = [...agents.values()].filter(other => other !== agent && other.key !== conversation && !other.greeting && !other.yieldTarget
      && bridgeAt(other.position) < 0 && distance(other.position, agent.position) < .85
      && ((other.position.x - agent.position.x) * direction.x + (other.position.z - agent.position.z) * direction.z) > 0);
    for (const other of blockers) {
      if (other.commuting && bridgeAt(agent.position) < 0 && other.key < agent.key) continue;
      const options = [];
      for (const radius of [.5, .8, 1.1]) for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8, point = { x: other.position.x + Math.sin(angle) * radius, z: other.position.z + Math.cos(angle) * radius };
        const side = Math.abs((point.x - agent.position.x) * direction.z - (point.z - agent.position.z) * direction.x) / length;
        if (side < .6 || !patrolGround(point, other.districtId) || !free(point, other, player)) continue;
        if (sweptRoute(other.position, point, p => routeWalkable(p) && free(p, other, player))) options.push(point);
      }
      options.sort((a, b) => distance(a, other.position) - distance(b, other.position));
      if (options.length) { other.yieldTarget = options[0]; other.target = null; other.wait = 0; other.path = []; other.routeDelay = 0; }
    }
  }
  function arrive(agent) {
    agent.traveling = false; agent.commuting = false; agent.districtId = agent.routine.districtId;
    agent.home = { ...agent.position }; agent.points = patrolPoints(agent.home, agent.districtId);
    agent.target = null; agent.path = []; agent.wait = 1.4 + (agent.seed % 2000) / 1000;
  }
  function update(dt, { player = null, roaming = false, paused = false, reducedMotion = false, hidden = false } = {}) {
    visitor = finite(player) ? { x: player.x, z: player.z } : null; visitorVisible = Boolean(roaming && visitor);
    const frozen = paused || reducedMotion || hidden, elapsed = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .1) : 0;
    const rows = [...agents.values()]; let plansLeft = 2;
    if (!frozen && elapsed) {
      frame++;
      // Narrow bridges admit a small wave of departures. Colleagues waiting
      // their turn keep strolling locally, rather than crowding every shore.
      let capacity = 6 - rows.filter(agent => agent.traveling && agent.commuting).length;
      for (const agent of rows) if (capacity > 0 && agent.traveling && !agent.commuting) {
        agent.commuting = true; agent.target = null; agent.path = []; agent.wait = 0; capacity--;
      }
    }
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
      agent.state = 'resting'; agent.activity = agent.routine?.activity || activities[agent.districtId];
      if (!elapsed) continue;
      if (agent.wait > 0) { agent.wait = Math.max(0, agent.wait - elapsed); continue; }
      const playerObstacle = visitorVisible ? visitor : null;
      if (agent.yieldTarget) agent.target = agent.yieldTarget;
      else if (agent.commuting) {
        const arrivalRadius = agent.routine.districtId === 'court' ? 3.2 : 1.15;
        if (agent.districtId === agent.routine.districtId && distance(agent.position, agent.destination) < arrivalRadius
          && restingGround(agent.position, agent.routine.districtId) && Object.values(PLACE_ENTRANCES).every(point => distance(agent.position, point) > .72)) { arrive(agent); continue; }
        if (agent.routeDelay > 0) { agent.routeDelay = Math.max(0, agent.routeDelay - elapsed); agent.activity = '等前面的路空一點'; continue; }
        if (!agent.path.length && plansLeft > 0) { plan(agent, playerObstacle); plansLeft--; }
        agent.target = agent.path[0] ?? null;
      } else if (!agent.target) agent.target = waypoint(agent, playerObstacle);
      if (!agent.target) { if (!agent.traveling) agent.wait = .7; continue; }
      const remaining = distance(agent.position, agent.target), travel = Math.min(remaining, (agent.commuting ? NPC_COMMUTE_SPEED : agent.speed) * elapsed);
      if (remaining < .025) {
        if (agent.yieldTarget) { agent.yieldTarget = null; agent.path = []; }
        else if (agent.commuting) agent.path.shift(); else agent.wait = 1.4 + ((agent.seed + agent.visits * 331) % 3300) / 1000;
        agent.target = null; continue;
      }
      const dx = (agent.target.x - agent.position.x) / remaining, dz = (agent.target.z - agent.position.z) / remaining;
      const steps = Math.max(1, Math.ceil(travel / MAX_STEP)), step = travel / steps;
      let moved = 0;
      for (let n = 0; n < steps; n++) {
        const next = { x: agent.position.x + dx * step, z: agent.position.z + dz * step };
        if (!(agent.commuting ? routeWalkable(next) : patrolGround(next, agent.districtId)) || !free(next, agent, playerObstacle)) break;
        const nextBridge = bridgeAt(next), previousBridge = bridgeAt(agent.position);
        if (nextBridge >= 0 && bridgeLocks.has(nextBridge) && bridgeLocks.get(nextBridge) !== agent.key) break;
        if (nextBridge >= 0) bridgeLocks.set(nextBridge, agent.key);
        agent.position.x = next.x; agent.position.z = next.z; agent.position.y = npcGroundHeight(next); moved += step;
        if (previousBridge >= 0 && previousBridge !== nextBridge && bridgeLocks.get(previousBridge) === agent.key) bridgeLocks.delete(previousBridge);
        const land = landAt(next); if (land) agent.districtId = land;
      }
      if (moved > 0) {
        agent.state = 'walking'; agent.activity = agent.yieldTarget ? '往旁邊讓個路' : agent.commuting ? `前往${PLACE_BY_ID.get(agent.routine.placeId).name}` : agent.traveling ? '等夥伴走過，再出發' : agent.routine?.activity || '在附近散步';
        agent.heading = Math.atan2(dx, dz); agent.blocked = 0;
      } else {
        agent.activity = '讓路，等一下'; agent.blocked += elapsed;
        if (agent.blocked >= .8) { if (agent.commuting) yieldWay(agent, playerObstacle); agent.yieldTarget = null; agent.target = null; agent.path = []; agent.routeDelay = .1; agent.wait = agent.commuting ? 0 : .25; agent.blocked = 0; }
      }
    }
    return state();
  }
  setResidents(residents);
  return { update, getState: state, setResidents, setConversationTarget, setHour,
    getObstacles: () => [...agents.values()].map(agent => ({ ...agent.position, radius: agent.radius, key: agent.key })) };
}
