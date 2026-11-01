import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOfficeAvatar, validateOfficeAvatar, OFFICE_AVATAR_PRESETS } from '../dist/office/avatar-config.js';
const box = () => ({ x: 0, y: 1, z: 0, w: .3, h: .3, d: .3, color: '#aabbcc' });

test('avatar defaults are independent data and all presets canonically round bounded proportions and colors', () => {
  assert.equal(defaultOfficeAvatar('agent').preset, 'robot'); assert.equal(defaultOfficeAvatar('human').preset, 'human');
  const original = defaultOfficeAvatar(); original.voxels.push(box()); assert.equal(defaultOfficeAvatar().voxels.length, 0);
  for (const preset of OFFICE_AVATAR_PRESETS) {
    const value = { ...defaultOfficeAvatar(), preset, bodyColor: '#AABBCC', height: 1.234567, voxels: [box()] }, before = structuredClone(value);
    const normalized = validateOfficeAvatar(value); assert.equal(normalized.bodyColor, '#aabbcc'); assert.equal(normalized.height, 1.235); assert.equal(normalized.preset, preset); assert.deepEqual(value, before);
    normalized.voxels[0].color = '#123456'; assert.equal(value.voxels[0].color, '#aabbcc');
  }
});

test('avatar data rejects active content, extra properties, non-finite values, extreme geometry and more than 96 bounded boxes', () => {
  const valid = { ...defaultOfficeAvatar(), preset: 'voxel', voxels: Array.from({ length: 96 }, box) }; assert.equal(validateOfficeAvatar(valid).voxels.length, 96);
  for (const change of [
    { version: 2 }, { preset: 'url' }, { bodyColor: 'red' }, { skinColor: '#abc' }, { hairColor: 'url(https://example.test)' }, { accentColor: '#12345678' },
    { height: .69 }, { width: 1.41 }, { headSize: NaN }, { height: Infinity }, { width: '1' }, { headSize: null },
    { hairStyle: 'script' }, { accessory: 'url' }, { image: 'https://example.test' }, { voxels: Array.from({ length: 97 }, box) }, { voxels: null },
  ]) assert.throws(() => validateOfficeAvatar({ ...valid, ...change }), TypeError);
  for (const change of [{ x: NaN }, { y: Infinity }, { z: '0' }, { x: .95 }, { y: .01 }, { y: 2.49 }, { w: 0 }, { h: 1.51 }, { d: -1 }, { color: '<svg>' }, { script: 'run()' }]) {
    assert.throws(() => validateOfficeAvatar({ ...valid, voxels: [{ ...box(), ...change }] }), TypeError);
  }
});
