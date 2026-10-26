// Shared by the room authority and its tests. Only bounded controls enter this
// simulation: no client position, stamina, time, damage or winner is accepted.
export const PVP_ARENA = Object.freeze({ width: 960, height: 540, margin: 24, duration: 75 });
const OBSTACLES = Object.freeze([
  Object.freeze({ id: 'north-planter', type: 'planter', x: 480, y: 124, radius: 31 }),
  Object.freeze({ id: 'middle-boxes', type: 'boxes', x: 480, y: 270, radius: 34 }),
  Object.freeze({ id: 'south-planter', type: 'planter', x: 480, y: 416, radius: 31 }),
]);
const MAX_HP = 160, MAX_ENERGY = 100, RADIUS = 18, STEP = 1 / 120;
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const copy = value => JSON.parse(JSON.stringify(value));
const normal = (x, y) => { const length = Math.hypot(x, y); return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }; };
const neutral = () => ({ x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });

export function normalizePvpInput(value) {
  try {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const x = finite(source.x) ? clamp(source.x, -1, 1) : 0, y = finite(source.y) ? clamp(source.y, -1, 1) : 0;
    const length = Math.hypot(x, y), scale = length > 1 ? 1 / length : 1;
    return { x: x * scale, y: y * scale, attack: source.attack === true, dodge: source.dodge === true,
      special: source.special === true, throw: source.throw === true };
  } catch { return neutral(); }
}
function makeFighter(seat) {
  return { id: 'player', seat, x: seat === 0 ? 250 : 710, y: 270, radius: RADIUS,
    hp: MAX_HP, maxHp: MAX_HP, energy: 25, maxEnergy: MAX_ENERGY, facing: seat === 0 ? 0 : Math.PI,
    action: 'idle', actionRemaining: 0, invulnerability: 0,
    cooldowns: { attack: 0, dodge: 0, special: 0, throw: 0 },
    paper: false, chain: 0, chainRemaining: 0, combo: 0, comboRemaining: 0,
    dashRemaining: 0, dashX: 0, dashY: 0 };
}
const makeStats = () => ({ damageDealt: 0, damageTaken: 0, maxCombo: 0, specialsUsed: 0, throwsUsed: 0, dodgesUsed: 0 });

export function createIslandPvpCombat({ seed } = {}) {
  // This version has no random combat outcomes. The seed is accepted for the
  // room protocol; every result is determined by the same two input streams.
  void seed;
  const fighters = [makeFighter(0), makeFighter(1)], stats = [makeStats(), makeStats()];
  const pickups = [
    { id: 'paper-left', type: 'paper', x: 210, y: 150, radius: 16, available: true, respawnIn: 0 },
    { id: 'paper-right', type: 'paper', x: 750, y: 390, radius: 16, available: true, respawnIn: 0 },
  ];
  let phase = 'ready', winner = null, reason = null, elapsed = 0, effects = [], projectiles = [];
  let previous = [neutral(), neutral()], nextEffect = 0, nextProjectile = 0;
  const publicFighter = body => ({ id: body.id, seat: body.seat, x: body.x, y: body.y, radius: body.radius,
    hp: body.hp, maxHp: body.maxHp, energy: body.energy, maxEnergy: body.maxEnergy, facing: body.facing,
    action: body.action, actionRemaining: body.actionRemaining, invulnerable: body.invulnerability > 0,
    cooldowns: { ...body.cooldowns }, paper: body.paper, combo: body.combo,
    telegraphRemaining: 0, telegraphDuration: 0, telegraphRadius: 82, telegraphHalfAngle: Math.acos(.2),
    attackRadius: 82, attackHalfAngle: Math.acos(.2), telegraphKind: 'cone', telegraphRange: 82,
    telegraphWidth: 0, telegraphTarget: null, activeSkillId: null, skillName: null, castKind: null, pose: null,
    shield: 0, shieldRemaining: 0, slowRemaining: 0 });
  function state() {
    return { phase, fighters: fighters.map(publicFighter), winner, reason,
      elapsed, duration: PVP_ARENA.duration, remaining: Math.max(0, PVP_ARENA.duration - elapsed),
      obstacles: copy(OBSTACLES), pickups: copy(pickups), projectiles: copy(projectiles), effects: copy(effects), stats: copy(stats),
      summary: phase === 'finished' ? { winner, reason, duration: elapsed, stats: copy(stats) } : null };
  }
  function effect(type, body, extra = {}) {
    effects.push({ id: ++nextEffect, owner: body.seat, type, x: body.x, y: body.y, angle: body.facing || 0,
      radius: 30, life: .25, maxLife: .25, ...extra });
    if (effects.length > 64) effects.splice(0, effects.length - 64);
  }
  function finish(result, why, forfeiting = null) {
    if (phase === 'finished') return;
    phase = 'finished'; winner = result; reason = why; previous = [neutral(), neutral()]; projectiles = [];
    for (const body of fighters) {
      body.dashRemaining = 0;
      body.action = body.hp <= 0 || body.seat === forfeiting ? 'defeated' : 'idle';
      body.actionRemaining = 0;
    }
  }
  function terrain(point) {
    const edge = PVP_ARENA.margin + RADIUS;
    return point.x >= edge && point.x <= PVP_ARENA.width - edge && point.y >= edge && point.y <= PVP_ARENA.height - edge
      && OBSTACLES.every(obstacle => distance(point, obstacle) >= RADIUS + obstacle.radius - 1e-10);
  }
  function proposal(body, dx, dy) {
    const next = { x: body.x + dx, y: body.y + dy };
    if (terrain(next)) return next;
    const point = { x: body.x, y: body.y };
    if (terrain({ x: next.x, y: point.y })) point.x = next.x;
    if (terrain({ x: point.x, y: next.y })) point.y = next.y;
    return point;
  }
  function movePair(motions) {
    const candidates = fighters.map((body, seat) => proposal(body, motions[seat].x, motions[seat].y));
    // Compute both proposals before mutating either body. An equal approach to
    // the same space must not grant the first seat ownership of that space.
    if (distance(candidates[0], candidates[1]) < 2 * RADIUS - 1e-10) return;
    for (let seat = 0; seat < 2; seat++) {
      const body = fighters[seat], moved = distance(body, candidates[seat]);
      body.x = candidates[seat].x; body.y = candidates[seat].y;
      if (moved > 0 && body.actionRemaining === 0) body.action = body.dashRemaining > 0 ? 'dodge' : 'walk';
    }
  }
  function knock(body, from, amount) {
    const vector = normal(body.x - from.x, body.y - from.y), other = fighters[1 - body.seat];
    for (let remaining = amount; remaining > 1e-8;) {
      const step = Math.min(3, remaining), point = proposal(body, vector.x * step, vector.y * step);
      if (distance(point, other) >= 2 * RADIUS - 1e-10) { body.x = point.x; body.y = point.y; }
      remaining -= step;
    }
  }
  function advance(body, dt) {
    for (const key of Object.keys(body.cooldowns)) body.cooldowns[key] = Math.max(0, body.cooldowns[key] - dt);
    body.invulnerability = Math.max(0, body.invulnerability - dt);
    body.actionRemaining = Math.max(0, body.actionRemaining - dt);
    body.chainRemaining = Math.max(0, body.chainRemaining - dt);
    body.comboRemaining = Math.max(0, body.comboRemaining - dt);
    if (body.comboRemaining === 0) body.combo = 0;
    if (body.actionRemaining === 0) body.action = 'idle';
  }
  function inArc(from, target, range) {
    const dx = target.x - from.x, dy = target.y - from.y, length = Math.hypot(dx, dy);
    return length <= range && (length < .001 || (Math.cos(from.facing) * dx + Math.sin(from.facing) * dy) / length >= .2);
  }
  function dodge(body, input) {
    if (body.cooldowns.dodge > 0 || body.dashRemaining > 0) return;
    const vector = Math.hypot(input.x, input.y) > .01 ? normal(input.x, input.y) : { x: Math.cos(body.facing), y: Math.sin(body.facing) };
    body.dashX = vector.x; body.dashY = vector.y; body.dashRemaining = .19;
    body.invulnerability = .34; body.cooldowns.dodge = 1.7; body.action = 'dodge'; body.actionRemaining = .25;
    stats[body.seat].dodgesUsed++; effect('dash', body, { radius: 27, life: .3, maxLife: .3 });
  }
  function special(body, target, intents) {
    if (body.energy < MAX_ENERGY || body.cooldowns.special > 0 || body.dashRemaining > 0) return false;
    body.energy = 0; body.cooldowns.special = .65; body.cooldowns.attack = Math.max(.35, body.cooldowns.attack);
    body.action = 'attack'; body.actionRemaining = .35; stats[body.seat].specialsUsed++;
    effect('special', body, { radius: 142, life: .45, maxLife: .45, text: '下班無雙' });
    if (distance(body, target) <= 142) intents.push({ seat: body.seat, damage: 27, push: 40, point: { x: body.x, y: body.y } });
    return true;
  }
  function attack(body, target, intents) {
    if (body.cooldowns.attack > 0 || body.dashRemaining > 0) return;
    body.chain = body.chainRemaining > 0 ? body.chain % 3 + 1 : 1; body.chainRemaining = .65;
    body.cooldowns.attack = .36; body.action = 'attack'; body.actionRemaining = .15;
    effect('slash', body, { radius: 82, life: .16, maxLife: .16, text: `${body.chain}` });
    if (inArc(body, target, 82)) intents.push({ seat: body.seat, damage: [5, 7, 10][body.chain - 1], push: body.chain === 3 ? 14 : 5, point: { x: body.x, y: body.y } });
  }
  function throwPaper(body) {
    if (!body.paper || body.cooldowns.throw > 0 || body.dashRemaining > 0) return;
    body.paper = false; body.cooldowns.throw = .35; stats[body.seat].throwsUsed++;
    projectiles.push({ id: ++nextProjectile, owner: body.seat, x: body.x + Math.cos(body.facing) * 25,
      y: body.y + Math.sin(body.facing) * 25, vx: Math.cos(body.facing) * 470, vy: Math.sin(body.facing) * 470, radius: 6, ttl: 1.5 });
  }
  function resolve(intents) {
    // A hit's eligibility is captured before applying either fighter's damage.
    // Both legal strikes can therefore land, including a simultaneous KO.
    const hits = fighters.map((target, seat) => target.invulnerability > 0 ? null
      : intents.filter(hit => hit.seat !== seat).sort((a, b) => b.damage - a.damage)[0] || null);
    for (let seat = 0; seat < 2; seat++) {
      const hit = hits[seat]; if (!hit) continue;
      const body = fighters[seat], source = fighters[1 - seat], actual = Math.min(body.hp, hit.damage);
      body.hp -= actual; body.invulnerability = .16; body.action = 'hit'; body.actionRemaining = .16;
      body.energy = Math.min(MAX_ENERGY, body.energy + actual * .55); source.energy = Math.min(MAX_ENERGY, source.energy + 12);
      source.combo = source.comboRemaining > 0 ? source.combo + 1 : 1; source.comboRemaining = 1.7;
      stats[source.seat].maxCombo = Math.max(stats[source.seat].maxCombo, source.combo);
      stats[source.seat].damageDealt += actual; stats[seat].damageTaken += actual;
      effect('impact', body, { owner: source.seat, radius: 34, text: `−${actual}` });
    }
    for (let seat = 0; seat < 2; seat++) if (hits[seat]) knock(fighters[seat], hits[seat].point, hits[seat].push);
    if (fighters.some(body => body.hp <= 0)) finish(fighters[0].hp === fighters[1].hp ? null : fighters[0].hp > 0 ? 0 : 1, 'knockout');
  }
  function tick(dt, inputs, pulses) {
    elapsed = Math.min(PVP_ARENA.duration, elapsed + dt);
    effects = effects.map(item => ({ ...item, life: item.life - dt })).filter(item => item.life > 0);
    for (const body of fighters) advance(body, dt);
    for (let seat = 0; seat < 2; seat++) {
      const body = fighters[seat], target = fighters[1 - seat], input = inputs[seat];
      if (Math.hypot(input.x, input.y) > .01) body.facing = Math.atan2(input.y, input.x);
      else if (body.dashRemaining === 0) body.facing = Math.atan2(target.y - body.y, target.x - body.x);
      if (pulses[seat].dodge) dodge(body, input);
    }
    const intents = [];
    for (let seat = 0; seat < 2; seat++) {
      const body = fighters[seat], target = fighters[1 - seat], input = inputs[seat];
      const burst = pulses[seat].special && special(body, target, intents);
      if (!burst && pulses[seat].throw) throwPaper(body);
      if (!burst && input.attack) attack(body, target, intents);
    }
    const motions = fighters.map((body, seat) => body.dashRemaining > 0
      ? { x: body.dashX * 620 * Math.min(dt, body.dashRemaining), y: body.dashY * 620 * Math.min(dt, body.dashRemaining) }
      : { x: inputs[seat].x * 210 * dt, y: inputs[seat].y * 210 * dt });
    movePair(motions);
    for (const body of fighters) body.dashRemaining = Math.max(0, body.dashRemaining - dt);
    for (const pickup of pickups) {
      if (!pickup.available) { pickup.respawnIn = Math.max(0, pickup.respawnIn - dt); if (pickup.respawnIn === 0) pickup.available = true; }
      if (!pickup.available) continue;
      const candidates = fighters.filter(body => !body.paper && distance(body, pickup) < RADIUS + pickup.radius);
      if (!candidates.length) continue;
      candidates.sort((a, b) => distance(a, pickup) - distance(b, pickup));
      // An exactly shared pickup is left on the floor until someone moves;
      // iteration order never decides which player receives it.
      if (candidates.length === 2 && Math.abs(distance(candidates[0], pickup) - distance(candidates[1], pickup)) < 1e-9) continue;
      const body = candidates[0]; body.paper = true; pickup.available = false; pickup.respawnIn = 9;
      effect('pickup', body, { text: '紙團 +1', radius: 25, life: .5, maxLife: .5 });
    }
    for (const projectile of projectiles) {
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.ttl -= dt;
      if (OBSTACLES.some(item => distance(projectile, item) < item.radius + projectile.radius)
        || projectile.x < 24 || projectile.x > 936 || projectile.y < 24 || projectile.y > 516) projectile.ttl = 0;
      const target = fighters[1 - projectile.owner];
      if (projectile.ttl > 0 && distance(projectile, target) < RADIUS + projectile.radius) {
        projectile.ttl = 0; intents.push({ seat: projectile.owner, damage: 12, push: 15, point: { x: projectile.x - projectile.vx * dt, y: projectile.y - projectile.vy * dt } });
        effect('projectile-hit', { ...projectile, seat: projectile.owner }, { radius: 25 });
      }
    }
    projectiles = projectiles.filter(item => item.ttl > 0); resolve(intents);
    if (phase === 'playing' && elapsed >= PVP_ARENA.duration) {
      const difference = fighters[0].hp / fighters[0].maxHp - fighters[1].hp / fighters[1].maxHp;
      finish(Math.abs(difference) < 1e-9 ? null : difference > 0 ? 0 : 1, 'timeout');
    }
  }
  function step(dt, values = []) {
    if (phase !== 'playing' || !finite(dt) || dt <= 0) return state();
    const source = Array.isArray(values) ? values : [], inputs = [normalizePvpInput(source[0]), normalizePvpInput(source[1])];
    const pulses = inputs.map((input, seat) => ({ dodge: input.dodge && !previous[seat].dodge,
      special: input.special && !previous[seat].special, throw: input.throw && !previous[seat].throw }));
    previous = inputs;
    let remaining = Math.min(.05, dt), first = true;
    while (remaining > 1e-8 && phase === 'playing') {
      const slice = Math.min(STEP, remaining, PVP_ARENA.duration - elapsed);
      if (slice <= 1e-10) { elapsed = PVP_ARENA.duration; finish(fighters[0].hp === fighters[1].hp ? null : fighters[0].hp > fighters[1].hp ? 0 : 1, 'timeout'); break; }
      tick(slice, inputs, first ? pulses : [{}, {}]); remaining -= slice; first = false;
    }
    return state();
  }
  return Object.freeze({ getState: state, step,
    start() { if (phase === 'ready') { phase = 'playing'; previous = [neutral(), neutral()]; } return state(); },
    forfeit(seat) { if ((seat === 0 || seat === 1) && phase !== 'finished') finish(1 - seat, 'forfeit', seat); return state(); },
  });
}
