import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, freshProgress } from '../dist/attachment/model.js';
import { loadProgress, saveProgress, clearProgress } from '../dist/attachment/progress.js';

function memoryStorage() {
  const entries = new Map([['hedo-life-v3', 'career'], ['anonymous-player', 'identity']]);
  const touched = [];
  return {
    entries, touched,
    getItem(key) { touched.push(key); return entries.get(key) ?? null; },
    setItem(key, value) { touched.push(key); entries.set(key, value); },
    removeItem(key) { touched.push(key); entries.delete(key); },
  };
}

test('quiz progress resumes and resets only its own dedicated key', () => {
  const storage = memoryStorage();
  const record = { ...freshProgress(), phase: 'quiz', cursor: 2 };
  record.answers[0] = 4;
  record.answers[1] = 2;
  assert.equal(saveProgress(record, storage), true);
  assert.deepEqual(loadProgress(storage), { progress: record, available: true });
  assert.equal(clearProgress(storage), true);
  assert.deepEqual(loadProgress(storage).progress, freshProgress());
  assert.equal(storage.entries.get('hedo-life-v3'), 'career');
  assert.equal(storage.entries.get('anonymous-player'), 'identity');
  assert.ok(storage.touched.every(key => key === STORAGE_KEY));
});

test('malformed and oversized local records fall back to fresh state', () => {
  for (const raw of ['{bad', 'null', '[]', '0', 'x'.repeat(4097), '{"version":99}']) {
    assert.deepEqual(loadProgress({ getItem: () => raw }), { progress: freshProgress(), available: true });
  }
});

test('storage denial and quota failure leave the quiz usable in memory', () => {
  const fail = () => { throw new Error('storage denied'); };
  for (const storage of [null, {}, { getItem: fail, setItem: fail, removeItem: fail }, new Proxy({}, { get: fail })]) {
    assert.deepEqual(loadProgress(storage), { progress: freshProgress(), available: false });
    assert.equal(saveProgress(freshProgress(), storage), false);
    assert.equal(clearProgress(storage), false);
  }
  const quotaLimited = { getItem: () => null, setItem: fail, removeItem: () => {} };
  assert.equal(loadProgress(quotaLimited).available, true);
  assert.equal(saveProgress(freshProgress(), quotaLimited), false);
});

test('saved quiz records discard personal and career fields', () => {
  const storage = memoryStorage();
  saveProgress({ ...freshProgress(), email: 'discard', token: 'discard', career: { seed: 'discard' } }, storage);
  assert.deepEqual(JSON.parse(storage.entries.get(STORAGE_KEY)), freshProgress());
});
