import { WORLD, SPAWN, SKILLS, ENEMY_TYPES, ENCOUNTERS, ITEM_BASES, RARITIES, BOSS_PROFILES } from './content.js';
import { bossDecision, recoveryGoal, steerEnemy, observePlayer, predictedPlayer, navigableSegment } from './boss-ai.js';

export const FIXED_STEP = 1 / 60;
const COMBAT_EVENT_LIMIT = 96;
const INPUT_BUFFER_SECONDS = 0.15;
const COMBO = [
  { damage: 0.8, hitAt: 0.09 },
  { damage: 1, hitAt: 0.1 },
  { damage: 1.2, hitAt: 0.12 },
];
const MAX_ITEMS = 60;
const SLOTS = ['weapon', 'armor', 'charm'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const record = (v) => !!v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const owns = (v, keys) => keys.every((key) => Object.hasOwn(v, key));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const xpNext = (level) => 40 + clamp(Math.floor(level), 1, 50) * 24;

function normalizedItem(value) {
  if (!record(value) || !owns(value, ['id', 'baseId', 'rarity', 'slot', 'attack', 'armor', 'maxHp', 'energyRegen']) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.id)) return null;
  const base = ITEM_BASES.find((b) => b.id === value.baseId);
  if (!base || !Object.hasOwn(RARITIES, value.rarity) || value.slot !== base.slot) return null;
  const limits = { attack: 100, armor: 60, maxHp: 200, energyRegen: 10 };
  for (const [key, limit] of Object.entries(limits)) {
    if (!finite(value[key]) || value[key] < 0 || value[key] > limit) return null;
  }
  return {
    id: value.id, baseId: base.id, name: `${RARITIES[value.rarity].name}・${base.name}`,
    slot: base.slot, rarity: value.rarity, attack: Math.round(value.attack),
    armor: Math.round(value.armor), maxHp: Math.round(value.maxHp),
    energyRegen: Math.round(value.energyRegen * 10) / 10, description: base.description,
  };
}

// Storage is an untrusted boundary. Combat stats are always rebuilt from bounded data.
export function normalizeProgress(value) {
  if (!record(value) || !owns(value, ['version', 'level', 'xp', 'gold', 'wins', 'inventory', 'equipped']) || value.version !== 1) return null;
  for (const [key, min, max] of [['level', 1, 50], ['xp', 0, 1239], ['gold', 0, 999999], ['wins', 0, 99]]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) return null;
  }
  if (value.xp >= xpNext(value.level) || !Array.isArray(value.inventory) || value.inventory.length > MAX_ITEMS || !record(value.equipped) || !owns(value.equipped, SLOTS)) return null;
  const inventory = Array.from(value.inventory, normalizedItem);
  if (inventory.some((item) => !item) || new Set(inventory.map((item) => item.id)).size !== inventory.length) return null;
  const equipped = {};
  for (const slot of SLOTS) {
    const id = value.equipped[slot];
    if (id !== null && (typeof id !== 'string' || !inventory.some((item) => item.id === id && item.slot === slot))) return null;
    equipped[slot] = id;
  }
  return { version: 1, level: value.level, xp: value.xp, gold: value.gold, wins: value.wins, inventory, equipped };
}

function starterItem(baseId, id) {
  const base = ITEM_BASES.find((item) => item.id === baseId);
  return normalizedItem({ ...base, id, baseId, rarity: 'common' });
}

function freshProgress() {
  const inventory = [starterItem('keyboard', 'starter-keyboard'), starterItem('hoodie', 'starter-hoodie')];
  return { version: 1, level: 1, xp: 0, gold: 0, wins: 0, inventory, equipped: { weapon: inventory[0].id, armor: inventory[1].id, charm: null } };
}

function random(state) {
  let x = state.rng >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 4294967296;
}

function nextId(state, prefix) { return `${prefix}-${state.runId}-${++state.nextId}`; }
function say(state, text) {
  state.message = text;
  state.messages.push({ id: ++state.messageId, text });
  state.messages = state.messages.slice(-10);
}
function combatEvent(state, type, details = {}) {
  const event = { ...details, serial: ++state.combatSerial, time: state.time, type };
  state.combatEvents.push(event);
  if (state.combatEvents.length > COMBAT_EVENT_LIMIT) state.combatEvents.splice(0, state.combatEvents.length - COMBAT_EVENT_LIMIT);
  return event;
}
function effect(state, type, x, z, radius = 1, life = 0.35, color = '#eacb7c', angle = 0) {
  state.effects.push({ id: nextId(state, 'fx'), type, x, z, radius, angle, life, maxLife: life, color });
}

function deriveStats(state, preserveHp = true) {
  const p = state.player;
  const oldHp = p.hp ?? 100;
  p.attack = 14 + (p.level - 1) * 3;
  p.armor = 0;
  p.maxHp = 100 + (p.level - 1) * 12;
  p.maxEnergy = 100;
  p.energyRegen = 10;
  for (const item of Object.values(state.equipped)) if (item) {
    p.attack += item.attack; p.armor += item.armor;
    p.maxHp += item.maxHp; p.energyRegen += item.energyRegen;
  }
  // Equipping changes capacity without providing repeatable free healing.
  p.hp = preserveHp ? clamp(oldHp, 0, p.maxHp) : p.maxHp;
  p.xpNext = xpNext(p.level);
}

function buildEnemies(state) {
  const scale = 1 + (state.difficulty - 1) * 0.22;
  return ENCOUNTERS.map((spawn, index) => {
    const profile = BOSS_PROFILES[spawn.bossId];
    const base = profile ? { ...ENEMY_TYPES.boss, ...profile, name: profile.displayName } : ENEMY_TYPES[spawn.type];
    return {
      ...spawn, ...base, id: `enemy-${state.runId}-${index}`, type: spawn.type,
      hp: Math.round(base.maxHp * scale), maxHp: Math.round(base.maxHp * scale),
      attack: Math.round(base.attack * (1 + (state.difficulty - 1) * 0.12)),
      angle: 0, phase: 'idle', attackKind: null, attackLabel: '', telegraph: null, telegraphs: [],
      title: profile?.title || base.name, taunt: profile?.phaseTaunts.normal || '',
      timer: 0.35 + index * 0.08, turn: 0, elite: spawn.type === 'boss', enraged: false,
      settled: false, active: false, hitTimer: 0, hitAngle: 0, charge: null, comboStep: 0, comboTotal: 1,
    };
  });
}

export function createGame({ seed = 1, progress = null } = {}) {
  const saved = normalizeProgress(progress) || freshProgress();
  const state = {
    status: 'ready', seed: (Number(seed) >>> 0) || 1, rng: (Number(seed) >>> 0) || 1,
    runId: 1, nextId: Math.max(0, ...saved.inventory.map((item) => {
      const serial = Number(item.id.split('-').at(-1));
      return Number.isSafeInteger(serial) && serial >= 0 && serial < 1e9 ? serial : 0;
    })),
    accumulator: 0, pendingInput: { attack: false, burst: false, dash: false, potion: false },
    skillBuffer: { attack: null, burst: null, dash: null, potion: null }, combatSerial: 0, combatEvents: [],
    difficulty: saved.wins + 1, wins: saved.wins,
    room: 0, time: 0, message: '', messages: [], messageId: 0,
    playerMotion: { ...SPAWN, vx: 0, vz: 0, speed: 0 },
    roomCleared: { 1: false, 2: false, 3: false }, unlockedRoom: 1,
    defeatedBosses: { sonny: false, meimei: false, wing: false },
    gates: [
      { id: 'to-room-2', fromRoom: 1, toRoom: 2, x: 0, z: -8, width: 6, locked: true, noticeAt: -10 },
      { id: 'to-room-3', fromRoom: 2, toRoom: 3, x: 0, z: -23, width: 6, locked: true, noticeAt: -10 },
    ],
    player: { ...SPAWN, angle: 0, radius: 0.44, level: saved.level, xp: saved.xp, gold: saved.gold,
      hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attack: 14, armor: 0,
      potions: SKILLS.potion.charges, invulnerable: 0, attackTimer: 0, dashTimer: 0, dashX: 0, dashZ: -1,
      action: null, combo: 0, comboExpiresAt: 0, assistTargetId: null, hitTimer: 0, hitAngle: 0 },
    inventory: saved.inventory, equipped: Object.fromEntries(SLOTS.map((slot) => [slot, saved.inventory.find((item) => item.id === saved.equipped[slot]) || null])),
    enemies: [], drops: [], projectiles: [], effects: [],
    cooldowns: { attack: 0, burst: 0, dash: 0, potion: 0 },
    stats: { kills: 0, goldEarned: 0, damageDealt: 0, damageTaken: 0, itemsFound: 0, bossKills: 0, elapsed: 0 },
  };
  deriveStats(state, false);
  state.enemies = buildEnemies(state);
  say(state, '準備好了，就往需求大廳出發。');
  return state;
}

export function getProgress(state) {
  return normalizeProgress({
    version: 1, level: state.player.level, xp: state.player.xp, gold: state.player.gold, wins: state.wins,
    inventory: state.inventory.map((item) => ({ ...item })),
    equipped: Object.fromEntries(SLOTS.map((slot) => [slot, state.equipped[slot]?.id ?? null])),
  });
}

export function startGame(state) {
  if (state.status === 'ready') { state.status = 'playing'; say(state, '依序擊破阿福、水蛇與翅膀，清完三區，準時下班。'); }
  return state;
}

export function clearPendingInput(state) {
  state.pendingInput = { attack: false, burst: false, dash: false, potion: false };
  state.skillBuffer = { attack: null, burst: null, dash: null, potion: null };
  state.accumulator = 0;
}

export function restartGame(state) {
  const progress = getProgress(state);
  const next = createGame({ seed: (state.rng + 0x9e3779b9) >>> 0, progress });
  next.runId = state.runId + 1;
  next.enemies = buildEnemies(next);
  say(next, state.status === 'won' ? `第 ${next.difficulty} 輪：新的需求已經出現。` : '喝口咖啡，這次換個走位再試。');
  Object.assign(state, next);
  return state;
}

export function equipItem(state, id) {
  const item = state.inventory.find((entry) => entry.id === id);
  if (!item || !SLOTS.includes(item.slot)) return false;
  state.equipped[item.slot] = item;
  deriveStats(state);
  say(state, `已裝備 ${item.name}`);
  return true;
}

export function discardItem(state, id) {
  if (Object.values(state.equipped).some((item) => item?.id === id)) return false;
  const index = state.inventory.findIndex((item) => item.id === id);
  if (index < 0) return false;
  state.inventory.splice(index, 1);
  return true;
}

const walkRects = [...WORLD.rooms, ...WORLD.corridors];
const inRect = (x, z, rect) => Math.abs(x - rect.x) <= rect.width / 2 + 1e-7 && Math.abs(z - rect.z) <= rect.depth / 2 + 1e-7;
export function isWalkable(x, z, radius = 0.44) {
  if (![x, z, radius].every(finite) || radius < 0) return false;
  for (let i = -1; i < 16; i++) {
    const px = x + (i < 0 ? 0 : Math.cos(i * Math.PI / 8) * radius);
    const pz = z + (i < 0 ? 0 : Math.sin(i * Math.PI / 8) * radius);
    if (!walkRects.some((rect) => inRect(px, pz, rect))) return false;
  }
  for (const rect of WORLD.obstacles) {
    const dx = Math.max(Math.abs(x - rect.x) - rect.width / 2, 0);
    const dz = Math.max(Math.abs(z - rect.z) - rect.depth / 2, 0);
    if (dx * dx + dz * dz < radius * radius + 1e-8) return false;
  }
  return true;
}

function move(body, dx, dz, state = null) {
  // Sweeping short segments also prevents a fast dash from crossing a thin obstacle.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < steps; i++) {
    if (isWalkable(body.x + dx / steps, body.z, body.radius)) body.x += dx / steps;
    let nextZ = body.z + dz / steps;
    if (state) for (const gate of state.gates) {
      const front = gate.z + body.radius, back = gate.z - body.radius;
      if (!gate.locked || Math.abs(body.x - gate.x) > gate.width / 2 + body.radius) continue;
      if ((body.z >= front - 1e-7 && nextZ < front) || (body.z <= back + 1e-7 && nextZ > back)) {
        nextZ = body.z >= front - 1e-7 ? front : back;
        if (body === state.player && state.time - gate.noticeAt > 2) {
          gate.noticeAt = state.time;
          say(state, `先清完${WORLD.rooms[gate.fromRoom].name}的領主與雜兵，下一區才會開啟。`);
        }
      }
    }
    if (isWalkable(body.x, nextZ, body.radius)) body.z = nextZ;
  }
}

function clearLine(a, b, state = null) {
  if (state) for (const gate of state.gates) {
    if (!gate.locked || (a.z - gate.z) * (b.z - gate.z) >= 0) continue;
    const t = (gate.z - a.z) / (b.z - a.z);
    if (Math.abs(a.x + (b.x - a.x) * t - gate.x) <= gate.width / 2 + 0.05) return false;
  }
  const count = Math.max(1, Math.ceil(distance(a, b) / 0.25));
  for (let i = 1; i <= count; i++) {
    const k = i / count;
    if (!isWalkable(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, 0.01)) return false;
  }
  return true;
}

function direction(dx, dz) {
  const length = Math.hypot(dx, dz);
  return length > 1e-8 ? { x: dx / length, z: dz / length } : { x: 0, z: -1 };
}
function facing(angle) { return { x: Math.sin(angle), z: -Math.cos(angle) }; }
const navigation = { walkable: isWalkable, line: clearLine, move };

function gainXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  while (p.level < 50 && p.xp >= p.xpNext) {
    p.xp -= p.xpNext; p.level++;
    const oldMax = p.maxHp;
    deriveStats(state);
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax) + p.maxHp * 0.22);
    p.energy = p.maxEnergy;
    effect(state, 'levelup', p.x, p.z, 2.6, 0.8, '#e7d68b');
    say(state, `升到等級 ${p.level}，體力與能量恢復了。`);
  }
  p.xp = Math.min(p.xp, p.xpNext - 1);
}

function rollItem(state, boss) {
  const base = ITEM_BASES[Math.floor(random(state) * ITEM_BASES.length)];
  const roll = random(state);
  const rarity = boss ? (roll < 0.35 ? 'epic' : 'rare') : roll < 0.1 ? 'epic' : roll < 0.42 ? 'rare' : 'common';
  const multiplier = RARITIES[rarity].multiplier * (1 + Math.min(state.difficulty - 1, 20) * 0.12);
  const varied = 0.9 + random(state) * 0.3;
  return normalizedItem({
    id: nextId(state, 'item'), baseId: base.id, slot: base.slot, rarity,
    attack: Math.min(100, Math.round(base.attack * multiplier * varied)),
    armor: Math.min(60, Math.round(base.armor * multiplier * varied)),
    maxHp: Math.min(200, Math.round(base.maxHp * multiplier)),
    energyRegen: Math.min(10, Math.round(base.energyRegen * multiplier * 10) / 10),
  });
}

function killEnemy(state, enemy) {
  if (enemy.settled) return;
  enemy.settled = true; enemy.hp = 0; enemy.phase = 'dead'; enemy.telegraph = null; enemy.telegraphs = [];
  combatEvent(state, 'death', { targetId: enemy.id, bossId: enemy.bossId || null, enemyType: enemy.type, x: enemy.x, z: enemy.z, angle: enemy.hitAngle || 0 });
  state.stats.kills++;
  effect(state, 'death', enemy.x, enemy.z, enemy.radius * 1.8, 0.45, enemy.color);
  const gold = Math.round(enemy.gold * (1 + (state.difficulty - 1) * 0.15));
  state.drops.push({ id: nextId(state, 'drop'), type: 'gold', x: enemy.x + 0.3, z: enemy.z, amount: gold });
  state.drops.push({ id: nextId(state, 'drop'), type: 'xp', x: enemy.x - 0.3, z: enemy.z, amount: enemy.xp });
  if (enemy.type === 'boss' || state.stats.kills === 1 || random(state) < 0.48) {
    state.drops.push({ id: nextId(state, 'drop'), type: 'item', x: enemy.x, z: enemy.z - 0.4, amount: 1, item: rollItem(state, enemy.type === 'boss') });
  }
  if (enemy.type === 'boss') {
    state.stats.bossKills++;
    state.defeatedBosses[enemy.bossId] = true;
    state.drops.push({ id: nextId(state, 'drop'), type: 'coffee', x: enemy.x + 0.7, z: enemy.z - 0.5, amount: 1 });
    state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 35);
    const profile = BOSS_PROFILES[enemy.bossId];
    say(state, `${profile.displayName}已擊破！${profile.phaseTaunts.defeated}`);
  }
}

function hurtEnemy(state, enemy, amount, impact) {
  if (enemy.hp <= 0 || enemy.settled) return;
  const damage = Math.min(enemy.hp, Math.max(0, amount));
  if (damage <= 0) return;
  enemy.hp -= damage; state.stats.damageDealt += damage;
  // Hit reactions are visual. They never reset a boss's attack or recovery timer.
  enemy.hitTimer = enemy.type === 'boss' ? 0.07 : 0.13;
  enemy.hitAngle = impact.angle;
  combatEvent(state, 'hit', { targetId: enemy.id, x: enemy.x, z: enemy.z, damage,
    angle: impact.angle, combo: impact.combo, heavy: impact.heavy, source: impact.source, actionSerial: impact.actionSerial,
    weapon: impact.weapon || null, bossId: enemy.bossId || null, enemyType: enemy.type });
  effect(state, 'hit', enemy.x, enemy.z, enemy.radius, 0.18, '#f1d89a');
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

function hurtPlayer(state, amount, source = null) {
  const p = state.player;
  if (state.status !== 'playing' || p.hp <= 0 || p.invulnerable > 0) return;
  const damage = Math.min(p.hp, Math.max(1, Math.round(amount * 100 / (100 + p.armor * 5))));
  p.hp = Math.max(0, p.hp - damage); p.invulnerable = 0.2;
  state.stats.damageTaken += damage;
  const angle = source && finite(source.x) && finite(source.z) ? Math.atan2(p.x - source.x, -(p.z - source.z)) : 0;
  p.hitTimer = 0.13; p.hitAngle = angle;
  combatEvent(state, 'player-hit', { targetId: 'player', actorId: source?.owner || source?.id || null,
    x: p.x, z: p.z, damage, angle, source: source?.attackKind || source?.kind || 'enemy' });
  effect(state, 'hit', p.x, p.z, 0.8, 0.2, '#f19b85');
  if (p.hp <= 0) {
    state.status = 'dead'; p.dashTimer = 0; p.attackTimer = 0; p.action = null; p.combo = 0;
    clearPendingInput(state);
    combatEvent(state, 'death', { targetId: 'player', bossId: null, enemyType: 'player', x: p.x, z: p.z, angle });
    say(state, '今天先到這裡。已撿到的裝備與經驗會保留。');
  }
}

function chooseAim(state, input, moving) {
  const p = state.player;
  if (record(input.aim) && finite(input.aim.x) && finite(input.aim.z) && distance(p, input.aim) > 0.05) return direction(input.aim.x - p.x, input.aim.z - p.z);
  if (input.attack || input.burst) {
    const candidates = state.enemies.filter((e) => e.hp > 0 && !e.settled && e.room <= state.unlockedRoom && distance(p, e) < 8 && clearLine(p, e, state))
      .sort((a, b) => distance(p, a) - distance(p, b) || a.id.localeCompare(b.id));
    const current = candidates.find((enemy) => enemy.id === p.assistTargetId);
    const nearest = candidates[0];
    // Keep a valid nearby target through small distance changes, but do not stay
    // attached to a distant foe when a substantially nearer one reaches us.
    const target = current && (!nearest || distance(p, current) <= distance(p, nearest) * 1.3 + 0.35) ? current : nearest;
    p.assistTargetId = target?.id || null;
    if (target) return direction(target.x - p.x, target.z - p.z);
  }
  return moving || facing(p.angle);
}

function actionRequest(state, input, skill, wait) {
  const buffered = state.skillBuffer[skill];
  if (buffered && buffered.expiresAt + 1e-9 < state.time) state.skillBuffer[skill] = null;
  if (input[skill] && wait > 1e-9 && wait <= INPUT_BUFFER_SECONDS + 1e-9 && !state.skillBuffer[skill]) {
    state.skillBuffer[skill] = { expiresAt: state.time + INPUT_BUFFER_SECONDS };
  }
  if ((input[skill] || state.skillBuffer[skill]) && wait <= 1e-9) {
    state.skillBuffer[skill] = null;
    return true;
  }
  return false;
}

function beginMelee(state, aim) {
  const p = state.player;
  p.combo = state.time <= p.comboExpiresAt + 1e-9 ? p.combo % 3 + 1 : 1;
  p.comboExpiresAt = state.time + SKILLS.attack.cooldown + 0.45;
  const spec = COMBO[p.combo - 1];
  const angle = Math.atan2(aim.x, -aim.z), weapon = state.equipped.weapon?.baseId || 'keyboard';
  const event = combatEvent(state, 'swing', { x: p.x, z: p.z, angle, weapon, combo: p.combo,
    heavy: p.combo === 3, duration: SKILLS.attack.cooldown, hitAt: spec.hitAt });
  p.action = { kind: 'attack', elapsed: 0, duration: SKILLS.attack.cooldown, hitAt: spec.hitAt,
    serial: event.serial, combo: p.combo, angle, heavy: p.combo === 3, weapon,
    damage: Math.round(p.attack * spec.damage), resolved: false };
  p.angle = angle;
  p.attackTimer = p.action.duration;
  state.cooldowns.attack = SKILLS.attack.cooldown;
}

function resolveMelee(state) {
  const p = state.player, action = p.action;
  if (action?.kind !== 'attack' || action.resolved || action.elapsed + 1e-9 < action.hitAt) return;
  action.resolved = true;
  const aim = facing(action.angle);
  combatEvent(state, 'strike', { x: p.x, z: p.z, angle: action.angle, weapon: action.weapon,
    combo: action.combo, heavy: action.heavy, actionSerial: action.serial, source: 'melee', range: SKILLS.attack.range });
  effect(state, 'melee', p.x, p.z, SKILLS.attack.range, 0.18, action.heavy ? '#f7b96a' : '#f2d58c', action.angle);
  for (const enemy of state.enemies) {
    if (enemy.room > state.unlockedRoom) continue;
    const dist = distance(p, enemy), dir = direction(enemy.x - p.x, enemy.z - p.z);
    if (dist <= SKILLS.attack.range + enemy.radius && (dist < 1.1 || dir.x * aim.x + dir.z * aim.z >= 0.35) && clearLine(p, enemy, state)) {
      hurtEnemy(state, enemy, action.damage, { angle: action.angle, combo: action.combo,
        heavy: action.heavy, source: 'melee', actionSerial: action.serial, weapon: action.weapon });
    }
  }
}

function castSkills(state, input, aim, moving) {
  const p = state.player;
  const cd = state.cooldowns;
  if (actionRequest(state, input, 'potion', cd.potion) && p.potions > 0 && p.hp < p.maxHp) {
    const previousHp = p.hp;
    p.potions--; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SKILLS.potion.heal);
    cd.potion = SKILLS.potion.cooldown;
    combatEvent(state, 'cast', { skill: 'potion', x: p.x, z: p.z, angle: p.angle, heal: p.hp - previousHp });
    effect(state, 'heal', p.x, p.z, 1.3, 0.5, '#93d5ab');
  }
  let dashed = false;
  if (actionRequest(state, input, 'dash', cd.dash) && p.energy >= SKILLS.dash.energy) {
    const dir = moving || aim;
    p.energy -= SKILLS.dash.energy; cd.dash = SKILLS.dash.cooldown;
    p.dashTimer = SKILLS.dash.duration; p.dashX = dir.x; p.dashZ = dir.z;
    p.invulnerable = Math.max(p.invulnerable, SKILLS.dash.duration + 0.1);
    p.angle = Math.atan2(dir.x, -dir.z);
    const event = combatEvent(state, 'dash', { x: p.x, z: p.z, angle: p.angle, duration: SKILLS.dash.duration });
    p.action = { kind: 'dash', elapsed: 0, duration: SKILLS.dash.duration, hitAt: 0, serial: event.serial, combo: 0, angle: p.angle, heavy: false };
    p.attackTimer = 0; p.combo = 0; p.comboExpiresAt = 0; state.skillBuffer.attack = null;
    dashed = true;
    effect(state, 'dash', p.x, p.z, 1.1, 0.3, '#97d8ce', p.angle);
  }
  if (actionRequest(state, input, 'burst', cd.burst) && p.energy >= SKILLS.burst.energy) {
    cd.burst = SKILLS.burst.cooldown; p.energy -= SKILLS.burst.energy;
    const angle = Math.atan2(aim.x, -aim.z);
    const event = combatEvent(state, 'cast', { skill: 'burst', x: p.x, z: p.z, angle });
    if (!p.action) p.action = { kind: 'burst', elapsed: 0, duration: 0.28, hitAt: 0, serial: event.serial, combo: 0, angle, heavy: true };
    effect(state, 'burst', p.x, p.z, SKILLS.burst.radius, 0.55, '#a2d5e5');
    for (const enemy of state.enemies) if (enemy.room <= state.unlockedRoom && distance(p, enemy) <= SKILLS.burst.radius + enemy.radius && clearLine(p, enemy, state)) {
      hurtEnemy(state, enemy, Math.round(p.attack * SKILLS.burst.damage), { angle: Math.atan2(enemy.x - p.x, -(enemy.z - p.z)),
        combo: 1, heavy: true, source: 'burst', actionSerial: event.serial });
    }
  }
  const wait = Math.max(cd.attack, p.dashTimer, p.action ? p.action.duration - p.action.elapsed : 0);
  if (!dashed && actionRequest(state, input, 'attack', wait)) {
    beginMelee(state, aim);
  }
}

function beginAttack(state, e, chosen = null) {
  const p = state.player;
  e.turn++;
  const boss = e.type === 'boss';
  const target = boss ? predictedPlayer(state, chosen === 'charge' ? 0.18 : 0.22, navigation) : p;
  const dir = direction(target.x - e.x, target.z - e.z);
  e.angle = Math.atan2(dir.x, -dir.z);
  const ranged = e.type === 'wraith';
  let line = e.type === 'slime';
  let duration = e.type === 'golem' ? 1.05 : ranged ? 0.85 : 0.8;
  e.attackKind = ranged ? 'bolt' : line ? 'charge' : 'slam';
  let skill = null;
  if (boss) {
    const profile = BOSS_PROFILES[e.bossId];
    e.attackKind = chosen || bossDecision(state, e, navigation).attack || (e.bossId === 'sonny' ? 'slam' : e.bossId === 'meimei' ? 'volley' : 'bombard');
    const second = ['charge', 'promise'].includes(e.attackKind) || (e.bossId === 'wing' && e.attackKind === 'slam');
    skill = profile.skills[second ? 1 : 0];
    line = e.attackKind === 'charge' || e.attackKind === 'volley';
    e.attackLabel = skill.label;
    e.taunt = profile.phaseTaunts[e.enraged ? 'enraged' : 'normal'];
    duration = e.attackKind === 'charge' ? 1.05 : e.attackKind === 'bombard' ? 1.1 : e.attackKind === 'volley' ? 1 : 0.95;
    e.comboTotal = e.bossId === 'wing' && e.enraged ? 2 : 1;
    e.comboStep = e.comboTotal === 2 ? e.ai.followUp === e.attackKind ? 2 : 1 : 0;
    if (e.comboStep === 2) e.ai.followUp = null;
  }
  e.attackPlan = { recovery: boss ? e.bossId === 'sonny' ? 1.15 : e.bossId === 'meimei' ? 1.15 : 1.3 : e.type === 'golem' ? 1.35 : 1 };
  if (e.comboStep === 1) { e.attackPlan.recovery = 0.65; e.attackPlan.followUp = e.attackKind === 'bombard' ? 'slam' : 'bombard'; }
  e.phase = 'windup'; e.timer = duration;
  e.telegraph = {
    kind: ranged || line ? 'line' : 'circle', x: e.x, z: e.z,
    radius: e.bossId === 'wing' ? 4.2 : boss ? 3.1 : 2.8, angle: e.angle,
    length: e.attackKind === 'volley' ? 12 : boss ? 7 : ranged ? 13 : 5,
    width: e.attackKind === 'volley' ? 3.6 : boss ? 2.3 : ranged ? 0.65 : 1.45,
    skillId: skill?.id || e.attackKind, label: skill?.label || '',
    duration, remaining: duration, progress: 0,
  };
  if (e.attackKind === 'promise') Object.assign(e.telegraph, { x: target.x, z: target.z, radius: 2.6 });
  if (e.attackKind === 'bombard') {
    const motion = state.playerMotion, heading = motion.speed > 0.5 ? direction(motion.vx, motion.vz) : dir;
    // Cover the observed route ahead, leaving the uncommitted side/behind open.
    const positions = [{ ...target },
      { x: target.x + heading.x * 2.6 - heading.z * 1.6, z: target.z + heading.z * 2.6 + heading.x * 1.6 },
      { x: target.x + heading.x * 4 + heading.z * 1.6, z: target.z + heading.z * 4 - heading.x * 1.6 }];
    e.telegraphs = positions.filter((pos) => isWalkable(pos.x, pos.z, 0.1)).map((pos) => ({ ...e.telegraph, ...pos, radius: 1.8 }));
    if (!e.telegraphs.length) e.telegraphs = [{ ...e.telegraph, x: p.x, z: p.z, radius: 1.8 }];
    e.telegraph = e.telegraphs[0];
  } else if (e.attackKind === 'volley' || e.attackKind === 'bolt') {
    const count = e.attackKind === 'volley' ? 5 : 1, radius = count > 1 ? 0.28 : 0.22;
    const speed = count > 1 ? 6.2 : 7, life = 2.6;
    e.attackPlan.shots = Array.from({ length: count }, (_, index) => {
      const angle = e.angle + (index - (count - 1) / 2) * 0.18, shot = facing(angle);
      return { x: e.x, z: e.z, angle, vx: shot.x * speed, vz: shot.z * speed, radius, life };
    });
    e.telegraphs = e.attackPlan.shots.map(shot => ({ ...e.telegraph, kind: 'line',
      x: shot.x - Math.sin(shot.angle) * radius, z: shot.z + Math.cos(shot.angle) * radius,
      angle: shot.angle, width: radius * 2, length: speed * life + radius * 2 }));
    e.telegraph = e.telegraphs[Math.floor(count / 2)];
  } else {
    if (e.attackKind === 'charge') {
      const travelDistance = boss ? clamp(distance(e, target) + 1.2, 3.8, 7) : 5;
      Object.assign(e.telegraph, { x: e.x - dir.x * e.radius, z: e.z - dir.z * e.radius,
        length: travelDistance + 2 * e.radius, width: 2 * e.radius + 0.12 });
      e.attackPlan.travelDistance = travelDistance;
    }
    e.telegraphs = [e.telegraph];
  }
}

function finishAttack(state, e) {
  e.telegraph = null; e.telegraphs = []; e.phase = 'recovery';
  e.timer = e.attackPlan?.recovery || (e.type === 'boss' ? 1.2 : 1);
  e.recoveryDuration = e.timer;
  if (e.attackPlan?.followUp) { e.ai.followUp = e.attackPlan.followUp; e.ai.followUpUntil = state.time + 5; }
  if (e.bossId === 'sonny') e.taunt = '剛剛那下不算，我在等披薩。';
}

function chargeTick(state, e, dt) {
  const charge = e.charge, p = state.player, dir = facing(charge.angle);
  const duration = Math.min(dt, Math.max(0, charge.duration - charge.elapsed));
  const travel = charge.travelDistance / charge.duration * duration;
  const steps = Math.max(1, Math.ceil(travel / 0.08));
  for (let i = 0; i < steps && !charge.stopped; i++) {
    const next = { x: e.x + dir.x * travel / steps, z: e.z + dir.z * travel / steps };
    if (!navigableSegment(state, e, next, e.radius, navigation)) { charge.stopped = true; charge.stopReason = 'wall'; break; }
    if (!charge.hit && distance(next, p) <= e.radius + p.radius) {
      charge.hit = true; charge.stopped = true; charge.stopReason = 'player';
      hurtPlayer(state, e.attack, e); break;
    }
    charge.travelled += distance(e, next); e.x = next.x; e.z = next.z;
  }
  charge.elapsed = Math.min(charge.duration, charge.elapsed + duration); e.timer = Math.max(0, charge.duration - charge.elapsed);
  if (charge.stopped || charge.elapsed + 1e-9 >= charge.duration) {
    effect(state, 'charge', charge.startX, charge.startZ, charge.travelled, 0.3, e.color, charge.angle);
    finishAttack(state, e);
  }
}

function executeAttack(state, e) {
  const p = state.player, t = e.telegraph;
  if (!t) return;
  combatEvent(state, 'enemy-attack', { actorId: e.id, targetId: 'player', bossId: e.bossId || null,
    x: e.x, z: e.z, angle: t.angle, source: e.attackKind, skill: e.attackLabel || e.attackKind });
  if (e.attackKind === 'bolt' || e.attackKind === 'volley') {
    for (const shot of e.attackPlan.shots) {
      state.projectiles.push({ ...shot, id: nextId(state, 'bolt'), owner: e.id,
        kind: e.attackKind === 'volley' ? 'speech' : 'bolt', damage: e.attack, color: e.color });
    }
  } else if (e.attackKind === 'charge') {
    e.phase = 'charge'; e.timer = 0.36;
    e.charge = { startX: e.x, startZ: e.z, angle: t.angle, duration: 0.36, elapsed: 0,
      travelDistance: e.attackPlan.travelDistance, travelled: 0, hit: false, stopped: false };
    for (const area of e.telegraphs) { area.remaining = 0; area.progress = 1; }
    return;
  } else if (e.attackKind === 'bombard') {
    for (const area of e.telegraphs) {
      if (distance(p, area) <= area.radius + p.radius && clearLine(area, p, state)) hurtPlayer(state, e.attack, e);
      effect(state, 'bombard', area.x, area.z, area.radius, 0.6, '#e6b565');
    }
  } else {
    if (distance(p, t) <= t.radius + p.radius && clearLine(t, p, state)) hurtPlayer(state, e.attack * (e.enraged ? 1.15 : 1), e);
    effect(state, e.attackKind === 'promise' ? 'promise' : 'slam', t.x, t.z, t.radius, 0.4, e.color);
  }
  finishAttack(state, e);
}

function enemyTick(state, e, dt) {
  if (e.hp <= 0 || e.settled || e.room > state.unlockedRoom) return;
  const p = state.player;
  const dist = distance(p, e);
  if (!e.active && state.room >= e.room && dist < (e.type === 'boss' ? 12 : 9) && (e.type === 'boss' || clearLine(e, p, state))) {
    e.active = true;
    if (e.bossId) say(state, `${e.name}・${e.title}：${BOSS_PROFILES[e.bossId].intro}`);
  }
  if (!e.active) return;
  if (e.bossId === 'wing' && e.hp <= e.maxHp / 2 && !e.enraged) {
    e.enraged = true; e.taunt = BOSS_PROFILES.wing.phaseTaunts.enraged;
    say(state, `翅膀暴怒：${e.taunt}`);
    effect(state, 'enrage', e.x, e.z, 3.6, 0.8, '#e48a75');
  }
  if (e.phase === 'charge') { chargeTick(state, e, dt); return; }
  e.timer = Math.max(0, e.timer - dt);
  if (e.phase === 'windup') {
    for (const area of e.telegraphs) {
      area.remaining = e.timer;
      area.progress = clamp(1 - e.timer / area.duration, 0, 1);
    }
    if (e.timer <= 0) executeAttack(state, e);
    return;
  }
  if (e.phase === 'recovery') {
    if (e.type === 'boss' && e.timer > 0.2) steerEnemy(state, e, recoveryGoal(state, e, navigation), dt, navigation);
    if (e.timer <= 0) e.phase = 'idle';
    return;
  }
  const dir = direction(p.x - e.x, p.z - e.z);
  e.angle = Math.atan2(dir.x, -dir.z);
  if (e.type === 'boss') {
    const decision = bossDecision(state, e, navigation);
    if (e.timer <= 0 && decision.attack) { beginAttack(state, e, decision.attack); return; }
    steerEnemy(state, e, decision.goal, dt, navigation);
    return;
  }
  const range = e.bossId === 'meimei' ? 10 : e.bossId === 'wing' ? 8 : e.type === 'wraith' ? 10 : e.type === 'slime' ? 4.8 : e.type === 'boss' ? 5 : 2.8;
  if (dist <= range && e.timer <= 0 && clearLine(e, p, state)) { beginAttack(state, e); return; }
  const ranged = e.type === 'wraith' || e.bossId === 'meimei';
  const retreat = ranged && dist < 3.5;
  if (dist > (ranged ? 6 : 1.7) || retreat) move(e, dir.x * e.speed * dt * (retreat ? -1 : 1), dir.z * e.speed * dt * (retreat ? -1 : 1), state);
}

function pickupDrops(state, all = false) {
  state.drops = state.drops.filter((drop) => {
    if (!all && distance(state.player, drop) > 1.7) return true;
    if (drop.type === 'item') {
      if (state.inventory.length >= MAX_ITEMS) {
        if (state.message !== '背包滿了，先丟棄不需要的裝備。') say(state, '背包滿了，先丟棄不需要的裝備。');
        return true;
      }
      state.inventory.push(drop.item); state.stats.itemsFound++;
      say(state, `撿到 ${drop.item.name}`);
    } else if (drop.type === 'gold') {
      state.player.gold = Math.min(999999, state.player.gold + drop.amount); state.stats.goldEarned += drop.amount;
    } else if (drop.type === 'xp') gainXp(state, drop.amount);
    else if (drop.type === 'coffee') {
      if (state.player.potions >= SKILLS.potion.charges) return true;
      state.player.potions = Math.min(SKILLS.potion.charges, state.player.potions + drop.amount);
      say(state, '撿到續命咖啡，補回一次補給。');
    }
    effect(state, 'pickup', drop.x, drop.z, 0.5, 0.28, drop.item ? RARITIES[drop.item.rarity].color : '#d9c479');
    return false;
  });
}

function updateRooms(state) {
  for (const room of [1, 2, 3]) {
    const bossId = ['sonny', 'meimei', 'wing'][room - 1];
    if (state.roomCleared[room] || !state.defeatedBosses[bossId] || state.enemies.some((enemy) => enemy.room === room && enemy.hp > 0)) continue;
    state.roomCleared[room] = true;
    if (room < 3) {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * 0.22);
      state.player.energy = state.player.maxEnergy;
    }
    say(state, `${WORLD.rooms[room].name}已清！${room < 3 ? '恢復體力，下一區封印已解除。' : '三位領主全數擊破。'}`);
    effect(state, 'roomclear', state.player.x, state.player.z, 3, 0.8, '#d5c48c');
  }
  state.unlockedRoom = state.roomCleared[1] ? state.roomCleared[2] ? 3 : 2 : 1;
  for (const gate of state.gates) gate.locked = !state.roomCleared[gate.fromRoom];
}

function tick(state, input, dt) {
  if (state.status !== 'playing') return;
  const p = state.player;
  state.time += dt; state.stats.elapsed += dt;
  for (const key of Object.keys(state.cooldowns)) state.cooldowns[key] = Math.max(0, state.cooldowns[key] - dt);
  p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.hitTimer = Math.max(0, p.hitTimer - dt);
  if (p.action) {
    p.action.elapsed = Math.min(p.action.duration, p.action.elapsed + dt);
    if (p.action.elapsed + 1e-9 >= p.action.duration) p.action = null;
  }
  p.attackTimer = p.action?.kind === 'attack' ? p.action.duration - p.action.elapsed : 0;
  const ix = finite(input.x) ? clamp(input.x, -1, 1) : 0;
  const iz = finite(input.z) ? clamp(input.z, -1, 1) : 0;
  const magnitude = Math.hypot(ix, iz);
  const moving = magnitude > 0.01 ? direction(ix, iz) : null;
  const aim = chooseAim(state, { ...input, attack: input.attack || state.skillBuffer.attack,
    burst: input.burst || state.skillBuffer.burst }, moving);
  p.angle = p.action?.kind === 'attack' || p.action?.kind === 'dash' ? p.action.angle : Math.atan2(aim.x, -aim.z);
  castSkills(state, input, aim, moving);
  if (p.dashTimer > 0) {
    const duration = Math.min(dt, p.dashTimer);
    move(p, p.dashX * SKILLS.dash.distance / SKILLS.dash.duration * duration, p.dashZ * SKILLS.dash.distance / SKILLS.dash.duration * duration, state);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
  } else if (moving) {
    const attackWeight = p.action?.kind === 'attack' && p.action.elapsed < p.action.hitAt + 0.06 ? 0.78 : 1;
    move(p, moving.x * 5 * dt * Math.min(magnitude, 1) * attackWeight, moving.z * 5 * dt * Math.min(magnitude, 1) * attackWeight, state);
  }
  resolveMelee(state);
  observePlayer(state, dt);
  state.room = p.z > 4 ? 0 : p.z > -10 ? 1 : p.z > -23 ? 2 : 3;
  for (const enemy of state.enemies) {
    if (state.status !== 'playing') break;
    enemy.hitTimer = Math.max(0, (enemy.hitTimer || 0) - dt);
    enemyTick(state, enemy, dt);
  }
  state.projectiles = state.projectiles.filter((projectile) => {
    const travelTime = Math.min(dt, Math.max(0, projectile.life));
    if (travelTime <= 1e-9) return false;
    projectile.life = Math.max(0, projectile.life - travelTime);
    const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vz) * travelTime / 0.15));
    for (let i = 0; i < steps; i++) {
      projectile.x += projectile.vx * travelTime / steps; projectile.z += projectile.vz * travelTime / steps;
      if (!isWalkable(projectile.x, projectile.z, projectile.radius)) return false;
      if (distance(projectile, p) <= projectile.radius + p.radius) { hurtPlayer(state, projectile.damage, projectile); return false; }
    }
    return projectile.life > 1e-9;
  });
  if (state.status === 'playing') pickupDrops(state);
  if (state.status === 'playing') updateRooms(state);
  if (state.status === 'playing' && state.defeatedBosses.wing && state.roomCleared[1] && state.roomCleared[2] && state.roomCleared[3] && !state.enemies.some((enemy) => enemy.hp > 0)) {
    pickupDrops(state, true);
    state.status = 'won'; state.wins = Math.min(99, state.wins + 1);
    p.action = null; p.attackTimer = 0; p.dashTimer = 0; clearPendingInput(state);
    say(state, '翅膀倒下了，三區全清。今天，準時下班！');
    state.projectiles = [];
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.settled);
  state.effects = state.effects.filter((entry) => { entry.life -= dt; return entry.life > 0; });
}

export function stepGame(state, input = {}, dt = FIXED_STEP) {
  if (state.status !== 'playing' || !finite(dt) || dt <= 0) return state;
  const controls = record(input) ? input : {};
  for (const key of ['attack', 'burst', 'dash', 'potion']) state.pendingInput[key] ||= !!controls[key];
  // A suspended tab never catches up seconds of invisible combat on resume.
  state.accumulator += Math.min(dt, 0.25);
  while (state.accumulator + 1e-9 >= FIXED_STEP && state.status === 'playing') {
    state.accumulator = Math.max(0, state.accumulator - FIXED_STEP);
    const tickInput = { ...controls, ...state.pendingInput, attack: !!controls.attack || state.pendingInput.attack };
    state.pendingInput = { attack: false, burst: false, dash: false, potion: false };
    tick(state, tickInput, FIXED_STEP);
  }
  return state;
}
