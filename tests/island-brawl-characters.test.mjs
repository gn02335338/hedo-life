import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBrawlCharacter } from '../dist/island/brawl-characters.js';
import { createIslandBrawl } from '../dist/island/brawl.js';
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
        calls.push({ method: key, args });
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
const originalActor = createIslandBrawl({ opponentId: 'jack' }).getState().opponent;
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
  assert.equal(getIslandCharacterLook('jack').clothing, 'vest');
  assert.equal(getIslandCharacterLook('jack').glasses, 'none');
  assert.ok(getIslandCharacterLook('jack').accessories.includes('book'));
  assert.ok(getIslandCharacterLook('tony').accessories.includes('cigarette'));
  assert.ok(getIslandCharacterLook('owen').accessories.includes('sunglasses'));
});

test('all colleagues and the visitor preserve finite, balanced canvas state through combat poses and directions', () => {
  for (const id of ['player', ...ISLAND_CAST.map(person => person.id)]) {
    for (const reducedMotion of [false, true]) for (const action of ['idle', 'walk', 'attack', 'hit', 'defeated', 'windup', 'recover', 'dodge']) {
      for (const facing of [0, Math.PI, -Math.PI / 2, Math.PI / 2]) {
        const drawing = canvas();
        const body = { ...actor(id), action, facing, paper: true, invulnerable: action === 'hit', telegraphRemaining: action === 'windup' ? .4 : 0 };
        assert.doesNotThrow(() => drawBrawlCharacter(drawing.ctx, body, drawingOptions(id, { elapsed: 3.75, reducedMotion })));
        drawing.check();
        assert.ok(drawing.calls.length > 0, `${id}/${action}: the character is drawn`);
      }
    }
  }
});
