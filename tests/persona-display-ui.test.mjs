import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PERSONAS, displayPersona } from '../dist/persona.js';
import { displayIslandPersona } from '../dist/island/persona.js';

test('Jack displays his sports portrait on the island while career portraits and the art manifest stay intact', async () => {
  const original = PERSONAS.jack, shown = displayIslandPersona('jack');
  assert.equal(shown.image, './assets/jack-sport.webp');
  assert.equal(original.image, './assets/jack.png');
  assert.equal(displayPersona('jack').image, original.image);
  assert.equal(PERSONAS.jack, original);
  assert.ok(Object.isFrozen(original));
  const manifest = JSON.parse(await readFile(new URL('../dist/assets/art-v38.json', import.meta.url), 'utf8'));
  const record = manifest.portraits.find(portrait => portrait.id === 'jack');
  assert.equal(record.path, original.image);
  const bytes = await readFile(new URL(`../dist/${original.image.replace(/^\.\//, '')}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, 'the retained historical portrait pixels still match their published manifest');
  const sports = await readFile(new URL(`../dist/${shown.image.replace(/^\.\//, '')}`, import.meta.url));
  assert.equal(sports.toString('ascii', 0, 4), 'RIFF');
  assert.equal(sports.toString('ascii', 8, 12), 'WEBP');
  assert.ok(sports.length < 250000, 'the replacement portrait stays within the HUD asset budget');
});

test('other public characters retain their original displayed image paths', () => {
  for (const id of Object.keys(PERSONAS).filter(id => id !== 'jack')) {
    assert.equal(displayIslandPersona(id).image, displayPersona(id).image, id);
  }
});
