import { WORLD, SPAWN, SKILLS, ENEMY_TYPES, ENCOUNTERS, ITEM_BASES, RARITIES, BOSS_PROFILES } from './content.js';

export const FIXED_STEP = 1 / 60;
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
      settled: false, active: false,
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
    accumulator: 0, pendingInput: { attack: false, burst: false, dash: false, potion: false }, difficulty: saved.wins + 1, wins: saved.wins,
    room: 0, time: 0, message: '', messages: [], messageId: 0,
    roomCleared: { 1: false, 2: false, 3: false }, unlockedRoom: 1,
    defeatedBosses: { sonny: false, meimei: false, wing: false },
    gates: [
      { id: 'to-room-2', fromRoom: 1, toRoom: 2, x: 0, z: -8, width: 6, locked: true, noticeAt: -10 },
      { id: 'to-room-3', fromRoom: 2, toRoom: 3, x: 0, z: -23, width: 6, locked: true, noticeAt: -10 },
    ],
    player: { ...SPAWN, angle: 0, radius: 0.44, level: saved.level, xp: saved.xp, gold: saved.gold,
      hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attack: 14, armor: 0,
      potions: SKILLS.potion.charges, invulnerable: 0, attackTimer: 0, dashTimer: 0, dashX: 0, dashZ: -1 },
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
      const line = gate.z + body.radius;
      if (gate.locked && body.z >= line - 1e-7 && nextZ < line) {
        nextZ = line;
        if (body === state.player && state.time - gate.noticeAt > 2) {
          gate.noticeAt = state.time;
          say(state, `先清完${WORLD.rooms[gate.fromRoom].name}的領主與雜兵，下一區才會開啟。`);
        }
      }
    }
    if (isWalkable(body.x, nextZ, body.radius)) body.z = nextZ;
  }
}

function clearLine(a, b) {
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

function hurtEnemy(state, enemy, amount) {
  if (enemy.hp <= 0 || enemy.settled) return;
  const damage = Math.min(enemy.hp, Math.max(0, amount));
  enemy.hp -= damage; state.stats.damageDealt += damage;
  effect(state, 'hit', enemy.x, enemy.z, enemy.radius, 0.18, '#f1d89a');
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

function hurtPlayer(state, amount) {
  const p = state.player;
  if (state.status !== 'playing' || p.hp <= 0 || p.invulnerable > 0) return;
  const damage = Math.min(p.hp, Math.max(1, Math.round(amount * 100 / (100 + p.armor * 5))));
  p.hp = Math.max(0, p.hp - damage); p.invulnerable = 0.2;
  state.stats.damageTaken += damage;
  effect(state, 'hit', p.x, p.z, 0.8, 0.2, '#f19b85');
  if (p.hp <= 0) {
    state.status = 'dead'; p.dashTimer = 0; state.accumulator = 0;
    say(state, '今天先到這裡。已撿到的裝備與經驗會保留。');
  }
}

function chooseAim(state, input, moving) {
  const p = state.player;
  if (record(input.aim) && finite(input.aim.x) && finite(input.aim.z) && distance(p, input.aim) > 0.05) return direction(input.aim.x - p.x, input.aim.z - p.z);
  if (input.attack || input.burst) {
    const target = state.enemies.filter((e) => e.hp > 0 && e.room <= state.unlockedRoom && distance(p, e) < 8 && clearLine(p, e)).sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (target) return direction(target.x - p.x, target.z - p.z);
  }
  return moving || facing(p.angle);
}

function castSkills(state, input, aim, moving) {
  const p = state.player;
  const cd = state.cooldowns;
  if (input.potion && cd.potion <= 0 && p.potions > 0 && p.hp < p.maxHp) {
    p.potions--; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SKILLS.potion.heal);
    cd.potion = SKILLS.potion.cooldown;
    effect(state, 'heal', p.x, p.z, 1.3, 0.5, '#93d5ab');
  }
  if (input.dash && cd.dash <= 0 && p.energy >= SKILLS.dash.energy) {
    const dir = moving || aim;
    p.energy -= SKILLS.dash.energy; cd.dash = SKILLS.dash.cooldown;
    p.dashTimer = SKILLS.dash.duration; p.dashX = dir.x; p.dashZ = dir.z;
    p.invulnerable = Math.max(p.invulnerable, SKILLS.dash.duration + 0.1);
    effect(state, 'dash', p.x, p.z, 1.1, 0.3, '#97d8ce', Math.atan2(dir.x, -dir.z));
  }
  if (input.attack && cd.attack <= 0) {
    cd.attack = SKILLS.attack.cooldown; p.attackTimer = 0.18;
    effect(state, 'melee', p.x, p.z, SKILLS.attack.range, 0.18, '#f2d58c', p.angle);
    for (const e of state.enemies) {
      if (e.room > state.unlockedRoom) continue;
      const dist = distance(p, e), dir = direction(e.x - p.x, e.z - p.z);
      if (dist <= SKILLS.attack.range + e.radius && (dist < 1.1 || dir.x * aim.x + dir.z * aim.z >= 0.35) && clearLine(p, e)) hurtEnemy(state, e, p.attack);
    }
  }
  if (input.burst && cd.burst <= 0 && p.energy >= SKILLS.burst.energy) {
    cd.burst = SKILLS.burst.cooldown; p.energy -= SKILLS.burst.energy;
    effect(state, 'burst', p.x, p.z, SKILLS.burst.radius, 0.55, '#a2d5e5');
    for (const enemy of state.enemies) if (enemy.room <= state.unlockedRoom && distance(p, enemy) <= SKILLS.burst.radius + enemy.radius && clearLine(p, enemy)) hurtEnemy(state, enemy, Math.round(p.attack * SKILLS.burst.damage));
  }
}

function beginAttack(state, e) {
  const p = state.player;
  e.turn++;
  const dir = direction(p.x - e.x, p.z - e.z);
  e.angle = Math.atan2(dir.x, -dir.z);
  const boss = e.type === 'boss';
  const ranged = e.type === 'wraith';
  const alternate = e.turn % 2 === 0;
  let line = e.type === 'slime';
  let duration = (boss ? 1.2 : e.type === 'golem' ? 1.05 : ranged ? 0.85 : 0.8) * (e.enraged ? 0.78 : 1);
  e.attackKind = ranged ? 'bolt' : line ? 'charge' : 'slam';
  let skill = null;
  if (boss) {
    const profile = BOSS_PROFILES[e.bossId];
    skill = profile.skills[alternate ? 1 : 0];
    e.attackKind = e.bossId === 'sonny' ? (alternate ? 'charge' : 'slam')
      : e.bossId === 'meimei' ? (alternate ? 'promise' : 'volley') : (alternate ? 'slam' : 'bombard');
    line = e.attackKind === 'charge' || e.attackKind === 'volley';
    e.attackLabel = skill.label;
    e.taunt = profile.phaseTaunts[e.enraged ? 'enraged' : 'normal'];
  }
  e.phase = 'windup'; e.timer = duration;
  e.telegraph = {
    kind: ranged || line ? 'line' : 'circle', x: e.x, z: e.z,
    radius: e.bossId === 'wing' ? 4.7 : boss ? 3.3 : 2.8, angle: e.angle,
    length: e.attackKind === 'volley' ? 12 : boss ? 7 : ranged ? 13 : 5,
    width: e.attackKind === 'volley' ? 3.6 : boss ? 2.3 : ranged ? 0.65 : 1.45,
    skillId: skill?.id || e.attackKind, label: skill?.label || '',
    duration, remaining: duration, progress: 0,
  };
  if (e.attackKind === 'promise') Object.assign(e.telegraph, { x: p.x, z: p.z, radius: 2.6 });
  if (e.attackKind === 'bombard') {
    // Locked impact positions leave time to step or dash away; no invisible tracking.
    const positions = [{ x: p.x, z: p.z }, { x: p.x - 2.8, z: p.z - 1.5 }, { x: p.x + 2.8, z: p.z + 1.5 }];
    e.telegraphs = positions.filter((pos) => isWalkable(pos.x, pos.z, 0.1)).map((pos) => ({ ...e.telegraph, ...pos, radius: 1.8 }));
    if (!e.telegraphs.length) e.telegraphs = [{ ...e.telegraph, x: p.x, z: p.z, radius: 1.8 }];
    e.telegraph = e.telegraphs[0];
  } else e.telegraphs = [e.telegraph];
}

function executeAttack(state, e) {
  const p = state.player, t = e.telegraph;
  if (!t) return;
  const dir = facing(t.angle);
  if (e.attackKind === 'bolt' || e.attackKind === 'volley') {
    const count = e.attackKind === 'volley' ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const shot = facing(t.angle + (i - (count - 1) / 2) * 0.18);
      state.projectiles.push({ id: nextId(state, 'bolt'), owner: e.id, x: e.x, z: e.z,
        vx: shot.x * (count > 1 ? 6.2 : 7), vz: shot.z * (count > 1 ? 6.2 : 7),
        kind: count > 1 ? 'speech' : 'bolt', radius: count > 1 ? 0.28 : 0.22, damage: e.attack, life: 2.6, color: e.color });
    }
  } else if (e.attackKind === 'charge') {
    const dx = p.x - t.x, dz = p.z - t.z;
    const forward = dx * dir.x + dz * dir.z;
    const side = Math.abs(dx * -dir.z + dz * dir.x);
    // The charge only hits along the distance actually travelled before a wall.
    const before = { x: e.x, z: e.z };
    move(e, dir.x * t.length, dir.z * t.length, state);
    const traveled = distance(before, e);
    if (forward >= -p.radius && forward <= traveled + e.radius + p.radius && side <= t.width / 2 + p.radius && clearLine(t, p)) hurtPlayer(state, e.attack);
    effect(state, 'charge', t.x, t.z, traveled, 0.3, e.color, t.angle);
  } else if (e.attackKind === 'bombard') {
    for (const area of e.telegraphs) {
      if (distance(p, area) <= area.radius + p.radius && clearLine(area, p)) hurtPlayer(state, e.attack);
      effect(state, 'bombard', area.x, area.z, area.radius, 0.6, '#e6b565');
    }
  } else {
    if (distance(p, t) <= t.radius + p.radius && clearLine(t, p)) hurtPlayer(state, e.attack * (e.enraged ? 1.15 : 1));
    effect(state, e.attackKind === 'promise' ? 'promise' : 'slam', t.x, t.z, t.radius, 0.4, e.color);
  }
  e.telegraph = null; e.telegraphs = []; e.phase = 'recovery';
  e.timer = (e.bossId === 'sonny' ? 1.5 : e.type === 'boss' ? 1.2 : e.type === 'golem' ? 1.35 : 1) * (e.enraged ? 0.8 : 1);
  if (e.bossId === 'sonny') e.taunt = '剛剛那下不算，我在等披薩。';
}

function enemyTick(state, e, dt) {
  if (e.hp <= 0 || e.settled || e.room > state.unlockedRoom) return;
  const p = state.player;
  const dist = distance(p, e);
  if (!e.active && state.room >= e.room && dist < (e.type === 'boss' ? 12 : 9) && clearLine(e, p)) {
    e.active = true;
    if (e.bossId) say(state, `${e.name}・${e.title}：${BOSS_PROFILES[e.bossId].intro}`);
  }
  if (!e.active) return;
  if (e.bossId === 'wing' && e.hp <= e.maxHp / 2 && !e.enraged) {
    e.enraged = true; e.taunt = BOSS_PROFILES.wing.phaseTaunts.enraged;
    say(state, `翅膀暴怒：${e.taunt}`);
    effect(state, 'enrage', e.x, e.z, 3.6, 0.8, '#e48a75');
  }
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
    if (e.timer <= 0) e.phase = 'idle';
    return;
  }
  const dir = direction(p.x - e.x, p.z - e.z);
  e.angle = Math.atan2(dir.x, -dir.z);
  const range = e.bossId === 'meimei' ? 10 : e.bossId === 'wing' ? 8 : e.type === 'wraith' ? 10 : e.type === 'slime' ? 4.8 : e.type === 'boss' ? 5 : 2.8;
  if (dist <= range && e.timer <= 0 && clearLine(e, p)) { beginAttack(state, e); return; }
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
  p.attackTimer = Math.max(0, p.attackTimer - dt);
  const ix = finite(input.x) ? clamp(input.x, -1, 1) : 0;
  const iz = finite(input.z) ? clamp(input.z, -1, 1) : 0;
  const magnitude = Math.hypot(ix, iz);
  const moving = magnitude > 0.01 ? direction(ix, iz) : null;
  const aim = chooseAim(state, input, moving);
  p.angle = Math.atan2(aim.x, -aim.z);
  castSkills(state, input, aim, moving);
  if (p.dashTimer > 0) {
    const duration = Math.min(dt, p.dashTimer);
    move(p, p.dashX * SKILLS.dash.distance / SKILLS.dash.duration * duration, p.dashZ * SKILLS.dash.distance / SKILLS.dash.duration * duration, state);
    p.dashTimer = Math.max(0, p.dashTimer - dt);
  } else if (moving) move(p, moving.x * 5 * dt * Math.min(magnitude, 1), moving.z * 5 * dt * Math.min(magnitude, 1), state);
  state.room = p.z > 4 ? 0 : p.z > -10 ? 1 : p.z > -23 ? 2 : 3;
  for (const enemy of state.enemies) {
    if (state.status !== 'playing') break;
    enemyTick(state, enemy, dt);
  }
  state.projectiles = state.projectiles.filter((projectile) => {
    projectile.life -= dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vz) * dt / 0.15));
    for (let i = 0; i < steps; i++) {
      projectile.x += projectile.vx * dt / steps; projectile.z += projectile.vz * dt / steps;
      if (!isWalkable(projectile.x, projectile.z, projectile.radius)) return false;
      if (distance(projectile, p) <= projectile.radius + p.radius) { hurtPlayer(state, projectile.damage); return false; }
    }
    return projectile.life > 0;
  });
  if (state.status === 'playing') pickupDrops(state);
  if (state.status === 'playing') updateRooms(state);
  if (state.status === 'playing' && state.defeatedBosses.wing && state.roomCleared[1] && state.roomCleared[2] && state.roomCleared[3] && !state.enemies.some((enemy) => enemy.hp > 0)) {
    pickupDrops(state, true);
    state.status = 'won'; state.wins = Math.min(99, state.wins + 1);
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
