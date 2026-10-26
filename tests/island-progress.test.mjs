import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS } from '../dist/island/content.js';
import { STORAGE_KEY, freshProgress, readProgress, writeProgress } from '../dist/island/progress.js';

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const reads = [], writes = [];
  return {
    entries, reads, writes,
    getItem(key) { reads.push(key); return entries.get(key) ?? null; },
    setItem(key, value) { writes.push(key); entries.set(key, value); },
  };
}

function readSaved(value) {
  return readProgress(memoryStorage({ [STORAGE_KEY]: JSON.stringify(value) }));
}

test('island progress round-trips only through its dedicated storage key', () => {
  const storage = memoryStorage({ 'hedo-life-v3': 'untouched game', 'hedo-anonymous-v1': 'untouched identity' });
  const state = { version: 1, visited: ['cafe', 'lobby'], choices: { cafe: 2, lobby: 0 } };
  assert.equal(STORAGE_KEY, 'hedo-island-v1');
  assert.equal(writeProgress(storage, state), true);
  assert.deepEqual(readProgress(storage), state);
  assert.deepEqual(storage.reads, [STORAGE_KEY]);
  assert.deepEqual(storage.writes, [STORAGE_KEY]);
  assert.equal(storage.entries.get('hedo-life-v3'), 'untouched game');
  assert.equal(storage.entries.get('hedo-anonymous-v1'), 'untouched identity');
  const first = freshProgress(), second = freshProgress();
  first.visited.push('lab'); first.choices.lab = 1;
  assert.deepEqual(second, { version: 1, visited: [], choices: {} });
});

test('missing, malformed and structurally invalid saved progress resets safely', () => {
  for (const raw of [null, undefined, '', '{bad json', 'undefined', 1, { version: 1 }]) {
    assert.deepEqual(readProgress({ getItem: () => raw }), freshProgress());
  }
  for (const value of [null, false, 1, 'progress', [], {},
    { version: 0, visited: [], choices: {} },
    { version: 2, visited: [], choices: {} },
    { version: '1', visited: [], choices: {} },
    { version: 1, visited: null, choices: {} },
    { version: 1, visited: 'lobby', choices: {} },
    { version: 1, visited: [], choices: null },
    { version: 1, visited: [], choices: [] }]) {
    assert.deepEqual(readSaved(value), freshProgress());
  }
});

test('unknown and duplicate visits stay bounded to the known districts, including special destinations', () => {
  const ids = DISTRICTS.map(district => district.id);
  const visited = [...Array(25000).fill('unknown'), null, 1, {}, 'constructor', '__proto__', ...ids, ...ids];
  const progress = readSaved({ version: 1, visited, choices: {} });
  assert.deepEqual(progress.visited, ids);
  assert.equal(progress.visited.length, DISTRICTS.length);
  assert.deepEqual(progress.choices, {});
});

test('only exact numeric choice indices for visited districts survive read and write', () => {
  const invalid = {
    version: 1,
    visited: ['lobby', 'lab', 'meeting', 'hr', 'finance', 'cafe', 'plaza', 'court'],
    choices: { lobby: 0, lab: 1, meeting: 2, hr: '1', finance: true, cafe: -1, plaza: 3, court: 0.5, harbor: 1, unknown: 2 },
  };
  const expected = { version: 1, visited: invalid.visited, choices: { lobby: 0, lab: 1, meeting: 2 } };
  assert.deepEqual(readSaved(invalid), expected);
  const storage = memoryStorage();
  assert.equal(writeProgress(storage, invalid), true);
  assert.deepEqual(JSON.parse(storage.entries.get(STORAGE_KEY)), expected);
  for (const choice of [NaN, Infinity, -Infinity, null, undefined, '0', false, {}, []]) {
    assert.equal(writeProgress(storage, { version: 1, visited: ['lobby'], choices: { lobby: choice } }), true);
    assert.deepEqual(readProgress(storage).choices, {});
  }
});

test('prototype properties and unexpected payload fields never become progress', () => {
  const raw = '{"version":1,"visited":["lobby","__proto__","constructor"],"choices":{"lobby":1,"__proto__":{"polluted":true},"constructor":2},"__proto__":{"polluted":true},"token":"discard"}';
  const expected = { version: 1, visited: ['lobby'], choices: { lobby: 1 } };
  assert.deepEqual(readProgress({ getItem: () => raw }), expected);
  assert.equal(Object.hasOwn(readProgress({ getItem: () => raw }), '__proto__'), false);
  assert.equal(Object.prototype.polluted, undefined);
  const inheritedState = Object.create({ version: 1, visited: ['lobby'], choices: { lobby: 2 } });
  const inheritedChoices = { version: 1, visited: ['lobby'], choices: Object.create({ lobby: 2 }) };
  const storage = memoryStorage();
  for (const state of [inheritedState, inheritedChoices]) {
    assert.equal(writeProgress(storage, state), true);
    assert.deepEqual(readProgress(storage), freshProgress());
  }
  const nullPrototypeChoices = Object.create(null);
  nullPrototypeChoices.lobby = 1;
  assert.equal(writeProgress(storage, { version: 1, visited: ['lobby'], choices: nullPrototypeChoices }), true);
  assert.deepEqual(readProgress(storage), expected);
});

test('unavailable storage and throwing accessors never escape the helpers', () => {
  const failure = () => { throw new Error('storage denied'); };
  for (const storage of [null, undefined, {}, { getItem: failure, setItem: failure },
    Object.defineProperties({}, { getItem: { get: failure }, setItem: { get: failure } }),
    new Proxy({}, { get: failure })]) {
    assert.deepEqual(readProgress(storage), freshProgress());
    assert.equal(writeProgress(storage, freshProgress()), false);
  }
  const storage = memoryStorage();
  const state = Object.defineProperty({ version: 1, choices: {} }, 'visited', { get: failure });
  assert.equal(writeProgress(storage, state), true);
  assert.deepEqual(readProgress(storage), freshProgress());
});
