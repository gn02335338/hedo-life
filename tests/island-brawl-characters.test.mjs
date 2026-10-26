import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBrawlCharacter } from '../dist/island/brawl-characters.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { ISLAND_CHARACTER_LOOKS, ISLAND_VISITOR_LOOK, getIslandCharacterLook } from '../dist/island/character-looks.js';

function canvas() {
  const calls = [], paint = [], transforms = [];
  let depth = 0;
  // Existing 2D support is enough; native roundRect and bitmap drawing are not required.
  const ctx = new Proxy({ globalAlpha: 1, roundRect: undefined, drawImage() { assert.fail('arena characters must use the shared chibi drawing style, not a portrait bitmap'); } }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push({ method: key, args, strokeStyle: target.strokeStyle, lineWidth: target.lineWidth });
        if (key === 'save') depth++;
        if (key === 'restore') { depth--; assert.ok(depth >= 0, 'canvas state cannot be restored before being saved'); }
        for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${key} receives finite drawing coordinates`);
        if (['translate', 'rotate', 'scale', 'transform', 'setTransform'].includes(key)) transforms.push({ method: key, args });
        if (key === 'measureText') return { width: String(args[0]).length * 10 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return { addColorStop() {} };
      };
    },
    set(target, key, value) {
      target[key] = value;
      if (key === 'fillStyle' || key === 'strokeStyle') paint.push({ key, value });
      return true;
    },
  });
  return {
    ctx, calls, paint, transforms,
    check() { assert.equal(depth, 0, 'drawing returns the canvas state to its caller'); },
    visualSignature() { return JSON.stringify({ paint, calls: calls.filter(call => !['fillText', 'strokeText'].includes(call.method)) }); },
  };
}
const originalActor = { x: 710, y: 270, radius: 18, action: 'idle', facing: Math.PI, invulnerable: false, telegraphRemaining: 0, paper: false };
const actor = id => ({ ...originalActor, id });
const drawingOptions = (id, extra = {}) => ({ isPlayer: id === 'player', name: id === 'player' ? '我' : '島民', elapsed: 1.25, reducedMotion: false, ...extra });

function visualProfile(profile) {
  return Object.fromEntries(Object.entries(profile).filter(([key]) => !['id', 'name', 'title', 'image', 'portrait'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
}

test('all 34 colleagues have their own complete chibi appearance, with the visitor as the safe fallback', () => {
  assert.equal(ISLAND_CAST.length, 34);
  const signatures = new Set();
  for (const { id } of ISLAND_CAST) {
    const look = getIslandCharacterLook(id);
    assert.equal(look, ISLAND_CHARACTER_LOOKS[id], `${id}: the authored appearance is selected by identity`);
    for (const key of ['skin', 'hair', 'shirt', 'trousers']) assert.match(look[key], /^#[0-9a-f]{3,8}$/i, `${id}: ${key} has a usable colour`);
    assert.ok(look.hairStyle && look.clothing, `${id}: hair and clothing are specified`);
    assert.ok(Array.isArray(look.accessories), `${id}: signature props are explicit`);
    const signature = JSON.stringify(visualProfile(look));
    assert.ok(!signatures.has(signature), `${id}: each colleague must be identifiable beyond the name label`);
    signatures.add(signature);
  }
  assert.equal(getIslandCharacterLook('unknown-colleague'), ISLAND_VISITOR_LOOK);
});

test('the common renderer gives every colleague their authored colours and a distinct body without raster portraits', () => {
  const rendered = new Set();
  for (const { id } of ISLAND_CAST) {
    const drawing = canvas(), look = getIslandCharacterLook(id);
    drawBrawlCharacter(drawing.ctx, actor(id), drawingOptions(id));
    const colours = new Set(drawing.paint.map(item => item.value));
    assert.ok(colours.has(look.skin), `${id}: the character has the selected skin tone`);
    assert.ok(colours.has(look.shirt), `${id}: the character wears the selected clothing`);
    if (look.hairStyle !== 'bald') assert.ok(colours.has(look.hair), `${id}: the selected hair is drawn`);
    const signature = drawing.visualSignature();
    assert.ok(!rendered.has(signature), `${id}: distinct data must produce a distinct visible body, not just a different label`);
    rendered.add(signature);
    drawing.check();
  }
  const visitor = canvas();
  drawBrawlCharacter(visitor.ctx, actor('player'), drawingOptions('player'));
  assert.ok(visitor.calls.length > 0, 'the visitor uses the same code-native drawing path');
  visitor.check();
});

test('the arena never reads or pastes the previous portrait even if one is passed accidentally', () => {
  const unavailablePortrait = new Proxy({}, { get() { assert.fail('the chibi renderer must not depend on image loading or image dimensions'); } });
  for (const id of ['player', ...ISLAND_CAST.map(person => person.id)]) {
    const drawing = canvas();
    assert.doesNotThrow(() => drawBrawlCharacter(drawing.ctx, actor(id), drawingOptions(id, { portrait: unavailablePortrait })));
    drawing.check();
  }
});

test('recognisable illustration details remain in the authored chibi appearances', () => {
  const jack = getIslandCharacterLook('jack'), wing = getIslandCharacterLook('wing');
  assert.equal(jack.clothing, 'tee');
  assert.equal(jack.shirt, '#303640');
  assert.equal(jack.glasses, 'none');
  assert.ok(!jack.accessories.includes('book'), 'Jack wears the supplied sport outfit rather than the old office vest and book');
  assert.equal(jack.sportShoes, true);
  assert.equal(wing.leftLegRatio, .5, 'Wing’s own left leg is visibly shorter');
  assert.ok(wing.accessories.includes('cane'));
  assert.ok(getIslandCharacterLook('tony').accessories.includes('cigarette'));
  assert.ok(getIslandCharacterLook('owen').accessories.includes('sunglasses'));
});

test('Wing’s shorter left leg mirrors with facing, keeps both soles grounded and does not change combat coordinates', () => {
  for (const facing of [0, Math.PI]) {
    const drawing = canvas(), body = { ...actor('wing'), facing }, before = structuredClone(body);
    drawBrawlCharacter(drawing.ctx, body, drawingOptions('wing', { reducedMotion: true }));
    let point, segments = [], legs;
    for (const call of drawing.calls) {
      if (call.method === 'beginPath') { point = null; segments = []; }
      if (call.method === 'moveTo') point = call.args;
      if (call.method === 'lineTo') { if (point) segments.push({ from: point, to: call.args }); point = call.args; }
      if (call.method === 'stroke' && call.strokeStyle === getIslandCharacterLook('wing').trousers && call.lineWidth === 12 && segments.length === 2) legs ||= segments;
    }
    assert.ok(legs, 'the actual two leg strokes are drawn');
    const length = leg => Math.hypot(leg.to[0] - leg.from[0], leg.to[1] - leg.from[1]);
    const ownLeft = legs.find(leg => Math.sign(leg.from[0]) === (Math.cos(facing) < 0 ? -1 : 1));
    const ownRight = legs.find(leg => leg !== ownLeft);
    assert.ok(Math.abs(length(ownLeft) / length(ownRight) - .5) < .03, 'the visible left leg is about half the right leg');
    assert.equal(ownLeft.to[1], ownRight.to[1], 'both soles rest at the same ground level');
    assert.deepEqual(body, before, 'visual leg differences do not move the collision body or alter stamina');
    drawing.check();
  }
});

test('all colleagues and the visitor preserve finite, balanced canvas state through combat poses and directions', () => {
  for (const id of ['player', ...ISLAND_CAST.map(person => person.id)]) {
    for (const reducedMotion of [false, true]) for (const action of ['idle', 'walk', 'attack', 'hit', 'defeated', 'windup', 'recover', 'dodge', 'skill', 'heal', 'guard', 'down', 'kick']) {
      for (const facing of [0, Math.PI, -Math.PI / 2, Math.PI / 2]) {
        const drawing = canvas();
        const body = { ...actor(id), action, pose: ['skill', 'heal', 'guard', 'down', 'kick'].includes(action) ? action : null, facing, paper: true, invulnerable: action === 'hit', telegraphRemaining: action === 'windup' ? .4 : 0 };
        assert.doesNotThrow(() => drawBrawlCharacter(drawing.ctx, body, drawingOptions(id, { elapsed: 3.75, reducedMotion })));
        drawing.check();
        assert.ok(drawing.calls.length > 0, `${id}/${action}: the character is drawn`);
      }
    }
  }
});
