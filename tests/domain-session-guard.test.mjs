import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ACTIVE_REVISION_KEY } from '../dist/domain-migration.js';

const source = await readFile(new URL('../dist/domain-session-guard.js', import.meta.url), 'utf8');
function tab(origin = 'https://hodo.bvivify.com') {
  const storage = {}, session = {}, listeners = new Map();
  let reloads = 0;
  const context = vm.createContext({
    localStorage: storage, location: { origin, reload() { reloads++; } },
    window: { addEventListener(name, listener) { listeners.set(name, listener); } },
  });
  vm.runInContext(source, context);
  return {
    get reloads() { return reloads; },
    emit(key, { oldValue = 'previous', newValue = 'next', storageArea = storage } = {}) {
      listeners.get('storage')?.({ key, oldValue, newValue, storageArea });
    }, session,
  };
}

test('other target tabs reload once after committed migration or identity replacement', () => {
  for (const key of [ACTIVE_REVISION_KEY, 'hedo-anonymous-v1', null]) {
    const game = tab();
    game.emit(key);
    game.emit(ACTIVE_REVISION_KEY);
    assert.equal(game.reloads, 1);
  }
});

test('ordinary saves and session storage do not interrupt another game tab', () => {
  const game = tab();
  for (const key of ['hedo-life-v3', 'hedo-sync-queue-v3', 'hedo-island-v1']) game.emit(key);
  game.emit(ACTIVE_REVISION_KEY, { storageArea: game.session });
  game.emit(ACTIVE_REVISION_KEY, { oldValue: 'same', newValue: 'same' });
  assert.equal(game.reloads, 0);
  const old = tab('https://hedo-life.bvstudio.workers.dev');
  old.emit('hedo-anonymous-v1');
  assert.equal(old.reloads, 0);
});

test('every game loads the session guard before its application', async () => {
  for (const path of ['index.html', 'island/index.html', 'arpg/index.html', 'gta/index.html', 'cards/index.html']) {
    const html = await readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
    const guard = html.indexOf('src="/domain-session-guard.js"');
    assert.ok(guard >= 0, path);
    const application = html.search(/<script[^>]*type="module"[^>]*src="(?:\.\/|\/cards\/)app\.js"/);
    assert.ok(application >= 0 && guard < application, path);
  }
});
