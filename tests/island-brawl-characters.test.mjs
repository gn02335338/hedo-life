import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { drawBrawlCharacter } from '../dist/island/brawl-characters.js';
import { createIslandBrawl } from '../dist/island/brawl.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { displayPersona } from '../dist/persona.js';

function canvas() {
  const calls = [], transforms = [], images = [];
  let depth = 0;
  // Existing 2D support is enough; native roundRect must not be required.
  const ctx = new Proxy({ globalAlpha: 1, roundRect: undefined }, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => {
        calls.push({ method: key, args });
        if (key === 'save') depth++;
        if (key === 'restore') { depth--; assert.ok(depth >= 0, 'canvas state cannot be restored before being saved'); }
        if (['translate', 'rotate', 'scale', 'transform', 'setTransform'].includes(key)) {
          assert.ok(args.every(Number.isFinite), `${key} receives finite coordinates`);
          transforms.push({ method: key, args });
        }
        if (key === 'drawImage') images.push(args);
        if (key === 'measureText') return { width: String(args[0]).length * 10 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return { addColorStop() {} };
      };
    },
  });
  return { ctx, calls, transforms, images, check() { assert.equal(depth, 0, 'drawing returns the canvas state to its caller'); } };
}
const baseActor = () => createIslandBrawl({ opponentId: 'jack' }).getState().opponent;
const portrait = (width = 600, height = 600, extra = {}) => ({ complete: true, naturalWidth: width, naturalHeight: height, ...extra });
function checkWholePortrait(args, original) {
  assert.equal(args[0], original, 'the selected colleague image is the image on the field');
  let width, height;
  if (args.length === 9) {
    assert.deepEqual(args.slice(1, 5), [0, 0, original.naturalWidth, original.naturalHeight], 'the face, hair and clothing remain in the full original image');
    [width, height] = args.slice(7, 9);
  } else {
    assert.equal(args.length, 5, 'the original image is explicitly sized for the courtyard');
    [width, height] = args.slice(3, 5);
  }
  assert.ok(args.slice(1).every(Number.isFinite), 'all image coordinates and dimensions are finite');
  assert.ok(width > 0 && height > 0 && width <= 300 && height <= 300, 'a portrait of any shape stays within a compact fighter silhouette');
  assert.ok(Math.abs((width / height) / (original.naturalWidth / original.naturalHeight) - 1) < 1e-6, 'the original portrait is not stretched');
}

test('all 34 official island colleagues have distinct, available portrait art', async () => {
  assert.equal(ISLAND_CAST.length, 34);
  const paths = new Set(), hashes = new Set();
  for (const { id } of ISLAND_CAST) {
    const person = displayPersona(id);
    assert.ok(person?.name && person.image, id);
    assert.ok(!paths.has(person.image), `${id}: a different colleague must not share the same portrait path`);
    paths.add(person.image);
    const bytes = await readFile(new URL(`../dist/${person.image.replace(/^\.\//, '')}`, import.meta.url));
    assert.ok(bytes.length > 0, `${id}: portrait art exists`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(hash), `${id}: a different colleague must not reuse identical portrait pixels`);
    hashes.add(hash);
  }
});

test('the fighter on the field uses each selected colleague portrait without cropping or distortion', () => {
  for (const { id } of ISLAND_CAST) {
    const person = displayPersona(id), original = portrait(600, 600, { src: person.image }), drawing = canvas();
    drawBrawlCharacter(drawing.ctx, { ...baseActor(), id }, { isPlayer: false, name: person.name, portrait: original, elapsed: 1.25, reducedMotion: false });
    assert.ok(drawing.images.length > 0, `${id}: the real portrait is visible on the field`);
    for (const args of drawing.images) checkWholePortrait(args, original);
    drawing.check();
  }
});

test('wide and tall original artwork remains fully visible and bounded in the arena', () => {
  for (const [width, height] of [[1236, 1272], [1024, 1536], [560, 605], [8000, 50], [50, 8000]]) {
    const original = portrait(width, height), drawing = canvas();
    drawBrawlCharacter(drawing.ctx, baseActor(), { isPlayer: false, name: '對戰島民', portrait: original, elapsed: .8, reducedMotion: false });
    assert.ok(drawing.images.length > 0);
    for (const args of drawing.images) checkWholePortrait(args, original);
    drawing.check();
  }
});

test('missing, loading and failed portraits never pass invalid images to canvas or prevent drawing', () => {
  for (const original of [null, undefined, portrait(600, 600, { complete: false }), portrait(0, 0), portrait(0, 600), portrait(600, 0)]) {
    const drawing = canvas();
    assert.doesNotThrow(() => drawBrawlCharacter(drawing.ctx, baseActor(), { isPlayer: false, name: '傑克', portrait: original, elapsed: 1, reducedMotion: false }));
    assert.equal(drawing.images.length, 0, 'a fallback is used until usable portrait pixels are available');
    drawing.check();
  }
});

test('combat poses and facing preserve finite coordinates and canvas state with or without reduced motion', () => {
  for (const isPlayer of [false, true]) for (const reducedMotion of [false, true]) {
    for (const action of ['idle', 'walk', 'attack', 'hit', 'defeated', 'windup', 'recover', 'dodge']) {
      for (const facing of [0, Math.PI, -Math.PI / 2, Math.PI / 2]) {
        const original = isPlayer ? null : portrait(), drawing = canvas();
        const actor = { ...baseActor(), action, facing, paper: true, invulnerable: action === 'hit', telegraphRemaining: action === 'windup' ? .4 : 0 };
        assert.doesNotThrow(() => drawBrawlCharacter(drawing.ctx, actor, { isPlayer, name: isPlayer ? '我' : '傑克', portrait: original, elapsed: 3.75, reducedMotion }));
        for (const args of drawing.images) checkWholePortrait(args, original);
        drawing.check();
        assert.ok(drawing.calls.length > 0, `${action}: the character is drawn`);
      }
    }
  }
});
