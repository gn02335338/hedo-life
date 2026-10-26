import { ISLAND_CAST } from './cast.js';

// Original island courtyard duel. This simulation has no DOM, persistence,
// network, career-game state, or preselected winner.
export const BRAWL_ARENA = Object.freeze({ width: 960, height: 540, margin: 24, duration: 75 });
const PEOPLE = new Set(ISLAND_CAST.map(person => person.id));
const MAX_HP = 160, MAX_ENERGY = 100, RADIUS = 18, STEP = 1 / 120;
const OBSTACLES = Object.freeze([
  Object.freeze({ id: 'north-planter', type: 'planter', x: 480, y: 124, radius: 31 }),
  Object.freeze({ id: 'middle-boxes', type: 'boxes', x: 480, y: 270, radius: 34 }),
  Object.freeze({ id: 'south-planter', type: 'planter', x: 480, y: 416, radius: 31 }),
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = value => JSON.parse(JSON.stringify(value));
function hash(value) { let n = 2166136261; for (const char of String(value)) n = Math.imul(n ^ char.codePointAt(0), 16777619); return n >>> 0; }
function normal(x, y) { const length = Math.hypot(x, y); return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }; }
function actor(id, x, y, facing) {
  return { id, x, y, radius: RADIUS, hp: MAX_HP, maxHp: MAX_HP, energy: 25, maxEnergy: MAX_ENERGY, facing,
    action: 'idle', actionRemaining: 0, invulnerability: 0, cooldowns: { attack: 0, dodge: 0, special: 0, throw: 0 },
    paper: false, telegraphRemaining: 0, telegraphDuration: 0, dashRemaining: 0, dashX: 0, dashY: 0,
    chain: 0, chainRemaining: 0, recovering: 0, heavy: false };
}

export function createIslandBrawl({ opponentId, seed } = {}) {
  if (!PEOPLE.has(opponentId)) throw new RangeError('Unknown island opponent');
  let randomState = hash(seed === undefined ? `island-brawl:${opponentId}` : seed) || 1;
  const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) / 4294967296; };
  const profile = hash(opponentId) % 3;
  const player = actor('player', 250, 270, 0), opponent = actor(opponentId, 710, 270, Math.PI);
  const stats = { damageDealt: 0, damageTaken: 0, maxCombo: 0, specialsUsed: 0, throwsUsed: 0, dodgesUsed: 0 };
  const pickups = [{ id: 'paper-left', type: 'paper', x: 210, y: 150, radius: 16, available: true, respawnIn: 0 },
    { id: 'paper-right', type: 'paper', x: 750, y: 390, radius: 16, available: true, respawnIn: 0 }];
  let phase = 'ready', outcome = null, elapsed = 0, combo = 0, comboRemaining = 0, summary = null;
  let effects = [], projectiles = [], nextEffect = 0, nextProjectile = 0, aiWait = .7;
  let previous = { dodge: false, special: false, throw: false };
  const publicActor = body => ({ id: body.id, x: body.x, y: body.y, radius: body.radius, hp: body.hp, maxHp: body.maxHp,
    energy: body.energy, maxEnergy: body.maxEnergy, facing: body.facing, action: body.action, actionRemaining: body.actionRemaining,
    invulnerable: body.invulnerability > 0, cooldowns: { ...body.cooldowns }, paper: body.paper,
    telegraphRemaining: body.telegraphRemaining, telegraphDuration: body.telegraphDuration,
    telegraphRadius: body.heavy ? 128 : 110, telegraphHalfAngle: Math.acos(.35), attackRadius: body === player ? 82 : body.heavy ? 128 : 110, attackHalfAngle: Math.acos(body === player ? .2 : .35) });
  function state() {
    return { phase, outcome, opponentId, aiStyle: ['steady', 'swift', 'bold'][profile],
      elapsed, duration: BRAWL_ARENA.duration, remaining: Math.max(0, BRAWL_ARENA.duration - elapsed),
      player: publicActor(player), opponent: publicActor(opponent), combo, maxCombo: stats.maxCombo,
      obstacles: copy(OBSTACLES), pickups: copy(pickups), projectiles: copy(projectiles), effects: copy(effects), summary: summary ? { ...summary } : null };
  }
  function effect(type, body, extra = {}) {
    effects.push({ id: ++nextEffect, type, x: body.x, y: body.y, radius: 30, angle: body.facing || 0,
      life: .25, maxLife: .25, halfAngle: Math.acos(body === player ? .2 : .35), owner: body === player ? 'player' : 'opponent', ...extra });
    if (effects.length > 80) effects.splice(0, effects.length - 80);
  }
  function clearInputs() { previous = { dodge: false, special: false, throw: false }; }
  function finish(result, reason) {
    if (phase === 'finished') return;
    phase = 'finished'; outcome = result; clearInputs();
    player.action = player.hp <= 0 ? 'defeated' : 'idle'; opponent.action = opponent.hp <= 0 ? 'defeated' : 'idle';
    summary = { duration: elapsed, ...stats, reason, outcome };
  }
  function allowed(point, body, other) {
    const edge = BRAWL_ARENA.margin + body.radius;
    return point.x >= edge && point.x <= BRAWL_ARENA.width - edge && point.y >= edge && point.y <= BRAWL_ARENA.height - edge
      && OBSTACLES.every(obstacle => distance(point, obstacle) >= body.radius + obstacle.radius)
      && distance(point, other) >= body.radius + other.radius;
  }
  function move(body, dx, dy, other) {
    const next = { x: body.x + dx, y: body.y + dy };
    if (allowed(next, body, other)) { body.x = next.x; body.y = next.y; return Math.hypot(dx, dy); }
    let moved = 0;
    if (allowed({ x: next.x, y: body.y }, body, other)) { body.x = next.x; moved += Math.abs(dx); }
    if (allowed({ x: body.x, y: next.y }, body, other)) { body.y = next.y; moved += Math.abs(dy); }
    return moved;
  }
  function knock(body, from, amount) {
    const away = normal(body.x - from.x, body.y - from.y), other = body === player ? opponent : player;
    for (let remaining = amount; remaining > 0;) {
      const step = Math.min(3, remaining); move(body, away.x * step, away.y * step, other); remaining -= step;
    }
  }
  function hit(from, target, damage, push = 12, breaksGuard = false) {
    if ((target.invulnerability > 0 && !breaksGuard) || target.hp <= 0) return false;
    const approach = Math.atan2(from.y - target.y, from.x - target.x);
    const guarded = !breaksGuard && target === opponent && target.telegraphRemaining > 0 && Math.cos(approach - target.facing) > .3;
    if (guarded) { damage = Math.max(1, Math.ceil(damage * .3)); push *= .2; }
    const actual = Math.min(target.hp, damage);
    target.hp = Math.max(0, target.hp - damage); target.invulnerability = .16;
    target.action = 'hit'; target.actionRemaining = .16;
    target.energy = Math.min(MAX_ENERGY, target.energy + actual * .55);
    from.energy = Math.min(MAX_ENERGY, from.energy + (guarded ? 3 : 12));
    if (from === player) {
      stats.damageDealt += actual; combo = comboRemaining > 0 ? combo + 1 : 1; comboRemaining = 1.7;
      stats.maxCombo = Math.max(stats.maxCombo, combo);
    } else { stats.damageTaken += actual; combo = 0; comboRemaining = 0; }
    effect('impact', target, { radius: 34, text: guarded ? `架住 −${actual}` : `−${actual}`, owner: from === player ? 'player' : 'opponent' });
    knock(target, from, push);
    if (target.hp <= 0) finish(target === opponent ? 'win' : 'lose', 'knockout');
    return true;
  }
  function inArc(from, target, range, cosine = .2) {
    const dx = target.x - from.x, dy = target.y - from.y, length = Math.hypot(dx, dy);
    return length <= range && (length < .001 || (Math.cos(from.facing) * dx + Math.sin(from.facing) * dy) / length >= cosine);
  }
  function attack() {
    if (player.cooldowns.attack > 0 || player.dashRemaining > 0) return;
    player.chain = player.chainRemaining > 0 ? player.chain % 3 + 1 : 1; player.chainRemaining = .65;
    player.cooldowns.attack = .36; player.action = 'attack'; player.actionRemaining = .15;
    effect('slash', player, { radius: 82, life: .16, maxLife: .16, text: `${player.chain}` });
    if (inArc(player, opponent, 82)) hit(player, opponent, [5, 7, 10][player.chain - 1], player.chain === 3 ? 14 : 5);
  }
  function dodge(input) {
    if (player.cooldowns.dodge > 0 || player.dashRemaining > 0) return;
    const vector = Math.hypot(input.x, input.y) > .01 ? normal(input.x, input.y) : { x: Math.cos(player.facing), y: Math.sin(player.facing) };
    player.dashX = vector.x; player.dashY = vector.y; player.dashRemaining = .19;
    player.invulnerability = .34; player.cooldowns.dodge = 1.7; player.action = 'dodge'; player.actionRemaining = .25;
    stats.dodgesUsed++;
    if (opponent.telegraphRemaining > 0 && distance(player, opponent) < 125) player.energy = Math.min(MAX_ENERGY, player.energy + 10);
    effect('dash', player, { radius: 27, life: .3, maxLife: .3 });
  }
  function special() {
    if (player.energy < MAX_ENERGY || player.cooldowns.special > 0 || player.dashRemaining > 0) return;
    player.energy = 0; player.cooldowns.special = .65; player.invulnerability = Math.max(player.invulnerability, .32);
    player.action = 'attack'; player.actionRemaining = .35; stats.specialsUsed++;
    effect('special', player, { radius: 142, life: .45, maxLife: .45, text: '下班無雙' });
    if (distance(player, opponent) <= 142) hit(player, opponent, 27, 40, true);
  }
  function throwPaper() {
    if (!player.paper || player.cooldowns.throw > 0 || player.dashRemaining > 0) return;
    player.paper = false; player.cooldowns.throw = .35; stats.throwsUsed++;
    projectiles.push({ id: ++nextProjectile, owner: 'player', x: player.x + Math.cos(player.facing) * 25,
      y: player.y + Math.sin(player.facing) * 25, vx: Math.cos(player.facing) * 470, vy: Math.sin(player.facing) * 470, radius: 6, ttl: 1.5 });
  }
  function advanceActor(body, dt) {
    for (const key of Object.keys(body.cooldowns)) body.cooldowns[key] = Math.max(0, body.cooldowns[key] - dt);
    body.invulnerability = Math.max(0, body.invulnerability - dt); body.chainRemaining = Math.max(0, body.chainRemaining - dt);
    body.actionRemaining = Math.max(0, body.actionRemaining - dt);
    if (body.actionRemaining === 0 && body.telegraphRemaining === 0) body.action = 'idle';
  }
  function ai(dt) {
    if (opponent.telegraphRemaining > 0) {
      opponent.telegraphRemaining = Math.max(0, opponent.telegraphRemaining - dt);
      if (opponent.telegraphRemaining === 0) {
        const heavy = opponent.heavy;
        opponent.action = 'attack'; opponent.actionRemaining = .2; opponent.recovering = heavy ? .95 : .65;
        effect(heavy ? 'special' : 'slash', opponent, { radius: heavy ? 128 : 110, life: .22, maxLife: .22 });
        if (inArc(opponent, player, heavy ? 128 : 110, .35)) hit(opponent, player, heavy ? 23 : 14, heavy ? 25 : 14);
        if (heavy) opponent.energy = 0;
        aiWait = .32 + random() * .25;
      }
      return;
    }
    if (opponent.recovering > 0) { opponent.recovering = Math.max(0, opponent.recovering - dt); if (opponent.actionRemaining === 0) opponent.action = 'recover'; return; }
    aiWait = Math.max(0, aiWait - dt);
    const gap = distance(opponent, player);
    if (gap < 83 && aiWait === 0) {
      opponent.facing = Math.atan2(player.y - opponent.y, player.x - opponent.x);
      opponent.heavy = opponent.energy >= MAX_ENERGY;
      opponent.telegraphDuration = opponent.heavy ? .95 : [.72, .61, .8][profile];
      opponent.telegraphRemaining = opponent.telegraphDuration; opponent.action = 'windup'; return;
    }
    const aim = Math.atan2(player.y - opponent.y, player.x - opponent.x), speed = [145, 160, 135][profile];
    opponent.facing = aim;
    if (gap < 68) return;
    // Pick a legal step around planters rather than walking into their centers.
    let best = null;
    for (const offset of [0, .45, -.45, .9, -.9, 1.35, -1.35, 1.75, -1.75]) {
      const angle = aim + offset, dx = Math.cos(angle) * speed * dt, dy = Math.sin(angle) * speed * dt;
      const next = { x: opponent.x + dx, y: opponent.y + dy };
      if (!allowed(next, opponent, player)) continue;
      const score = distance(next, player) + Math.abs(offset) * .025;
      if (!best || score < best.score) best = { dx, dy, score };
    }
    if (best && move(opponent, best.dx, best.dy, player) > 0) { opponent.action = 'walk'; opponent.actionRemaining = .04; }
  }
  function tick(dt, input, pulses) {
    elapsed = Math.min(BRAWL_ARENA.duration, elapsed + dt);
    effects = effects.map(item => ({ ...item, life: item.life - dt })).filter(item => item.life > 0);
    advanceActor(player, dt); advanceActor(opponent, dt);
    comboRemaining = Math.max(0, comboRemaining - dt); if (comboRemaining === 0) combo = 0;
    const vector = normal(input.x, input.y);
    if (Math.hypot(input.x, input.y) > .01) player.facing = Math.atan2(input.y, input.x);
    else if (player.dashRemaining === 0) player.facing = Math.atan2(opponent.y - player.y, opponent.x - player.x);
    if (pulses.dodge) dodge(input);
    if (pulses.special) special();
    if (pulses.throw) throwPaper();
    if (input.attack) attack();
    if (phase !== 'playing') return;
    if (player.dashRemaining > 0) {
      const moving = Math.min(dt, player.dashRemaining); move(player, player.dashX * 620 * moving, player.dashY * 620 * moving, opponent);
      player.dashRemaining = Math.max(0, player.dashRemaining - dt);
    } else if (Math.hypot(vector.x, vector.y) > 0 && move(player, vector.x * 210 * dt, vector.y * 210 * dt, opponent) > 0) {
      if (player.actionRemaining === 0) player.action = 'walk';
    }
    for (const pickup of pickups) {
      if (!pickup.available) { pickup.respawnIn = Math.max(0, pickup.respawnIn - dt); if (pickup.respawnIn === 0) pickup.available = true; }
      if (pickup.available && !player.paper && distance(player, pickup) < RADIUS + pickup.radius) {
        player.paper = true; pickup.available = false; pickup.respawnIn = 9;
        effect('pickup', player, { text: '紙團 +1', radius: 25, life: .5, maxLife: .5 });
      }
    }
    for (const projectile of projectiles) {
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.ttl -= dt;
      if (OBSTACLES.some(item => distance(projectile, item) < item.radius + projectile.radius)
        || projectile.x < 24 || projectile.x > 936 || projectile.y < 24 || projectile.y > 516) projectile.ttl = 0;
      if (projectile.ttl > 0 && distance(projectile, opponent) < RADIUS + projectile.radius) {
        projectile.ttl = 0; hit(player, opponent, 12, 15); effect('projectile-hit', projectile, { radius: 25, owner: 'player' });
      }
    }
    projectiles = projectiles.filter(item => item.ttl > 0);
    if (phase === 'playing') ai(dt);
    if (phase === 'playing' && elapsed >= BRAWL_ARENA.duration) {
      const gap = player.hp / player.maxHp - opponent.hp / opponent.maxHp;
      finish(Math.abs(gap) < 1e-8 ? 'draw' : gap > 0 ? 'win' : 'lose', 'timeout');
    }
  }
  function step(dt, value = {}) {
    if (phase !== 'playing' || !finite(dt) || dt <= 0) return state();
    const source = value && typeof value === 'object' ? value : {};
    const input = { x: finite(source.x) ? clamp(source.x, -1, 1) : 0, y: finite(source.y) ? clamp(source.y, -1, 1) : 0,
      attack: source.attack === true, dodge: source.dodge === true, special: source.special === true, throw: source.throw === true };
    const pulses = { dodge: input.dodge && !previous.dodge, special: input.special && !previous.special, throw: input.throw && !previous.throw };
    previous = { dodge: input.dodge, special: input.special, throw: input.throw };
    let remaining = Math.min(.05, dt), first = true;
    while (remaining > 1e-8 && phase === 'playing') {
      const slice = Math.min(STEP, remaining); tick(slice, input, first ? pulses : {}); remaining -= slice; first = false;
    }
    return state();
  }
  return Object.freeze({
    getState: state,
    start() { if (phase === 'ready') phase = 'playing'; return state(); },
    step,
    pause() { if (phase === 'playing') { phase = 'paused'; clearInputs(); } return state(); },
    resume() { if (phase === 'paused') { phase = 'playing'; clearInputs(); } return state(); },
    forfeit() { if (phase === 'playing' || phase === 'paused') finish('lose', 'forfeit'); return state(); },
  });
}
