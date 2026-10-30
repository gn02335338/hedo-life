import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAS } from '../dist/persona.js';
import { OFFICE_FLOORS, DEFAULT_OFFICE_FLOOR, isOfficeFloor, getOfficeFloor, CHARACTER_FLOORS, getCharacterFloor } from '../dist/office/floors.js';

test('the public office has exactly seven ordered, named department floors', () => {
  assert.equal(DEFAULT_OFFICE_FLOOR, 1);
  assert.deepEqual(OFFICE_FLOORS.map(floor => floor.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(OFFICE_FLOORS.map(floor => floor.name), ['接待與共享', '人資行政', '財會法務稽核', '業務商務開發', '產品與專案', '研發與資料', '經營與顧問']);
  for (const floor of OFFICE_FLOORS) {
    assert.equal(getOfficeFloor(floor.id), floor);
    assert.ok(floor.department.length > 2);
    assert.ok(floor.description.length > 10);
    assert.match(floor.color, /^#[0-9a-f]{6}$/i);
    assert.ok(Object.isFrozen(floor));
  }
  assert.ok(Object.isFrozen(OFFICE_FLOORS));
});

test('floor identifiers reject coercion, fractions and out-of-building values', () => {
  for (let floor = 1; floor <= 7; floor++) assert.equal(isOfficeFloor(floor), true);
  for (const invalid of [0, -1, 8, 1.5, NaN, Infinity, -Infinity, '1', '7', '', null, undefined, true, false, {}, [], [2], 1n, Symbol('floor')]) {
    assert.equal(isOfficeFloor(invalid), false);
    assert.equal(getOfficeFloor(invalid), null);
  }
});

test('every public character has a home department without exposing additional identities', () => {
  assert.equal(Object.keys(CHARACTER_FLOORS).length, 34);
  assert.deepEqual(Object.keys(CHARACTER_FLOORS).sort(), Object.keys(PERSONAS).sort());
  assert.ok(Object.isFrozen(CHARACTER_FLOORS));
  for (const id of Object.keys(PERSONAS)) {
    assert.ok(isOfficeFloor(getCharacterFloor(id)), id);
    assert.ok(getCharacterFloor(id) > 1, `${id} works in a department and visits reception for breaks`);
  }
  assert.equal(getCharacterFloor('hope'), 2);
  assert.equal(getCharacterFloor('mia'), 2);
  assert.equal(getCharacterFloor('alice'), 2);
  assert.equal(getCharacterFloor('janet'), 3);
  assert.equal(getCharacterFloor('erich'), 3);
  assert.equal(getCharacterFloor('sophie'), 3);
  assert.equal(getCharacterFloor('meimei'), 4);
  assert.equal(getCharacterFloor('action'), 4);
  assert.equal(getCharacterFloor('helen'), 5);
  assert.equal(getCharacterFloor('johnny'), 5);
  assert.equal(getCharacterFloor('jack'), 6);
  assert.equal(getCharacterFloor('henry'), 6);
  assert.equal(getCharacterFloor('wine'), 6);
  assert.equal(getCharacterFloor('wing'), 7);
  assert.equal(getCharacterFloor('professor'), 7);
  for (const invalid of ['unknown', '__proto__', 'constructor', null, undefined, 2, Symbol('character')]) assert.equal(getCharacterFloor(invalid), 1);
});

test('shared floor definitions import no browser, persona, engine or private modules', () => {
  const source = readFileSync(new URL('../dist/office/floors.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|document|window)\b/);
});
