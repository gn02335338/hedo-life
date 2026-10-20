import {characterHistoryChanges,characterAffinity} from '../dist/character-stats.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import { polishDreamText } from '../dist/copy-v15.js';

const source = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
function appHarness() {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', title: '', open: false,
      classList: { add() {}, remove() {}, toggle() {} },
      focus() {}, scrollIntoView() {}, setAttribute() {}, addEventListener() {},
      showModal() { this.open = true; }, close() { this.open = false; },
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    ...roles, ...sources, ...endings, ...legacy, ...engine, ...achievements, ...career, ...currentCareer, ...persona, polishDreamText, characterHistoryChanges, characterAffinity,
    createFeedbackUI: () => ({ open() {} }),
    createCharacterBook: () => ({open() {},onSnapshot() {},onRunChanged() {}}),
    cloud: { state: { status: 'offline', achievements: [] }, subscribe() {}, init: async () => null, achievementProgress: async () => null, characterProgress: async () => null, complete: async () => null },
    localStorage: { getItem: () => null, setItem() {} },
    document: { querySelector: node, addEventListener() {} },
    window: { scrollTo() {}, matchMedia: () => ({ matches: false }) },
    crypto: webcrypto, structuredClone, setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(source, context, { filename: 'dist/app.js' });
  return {
    render(run) { context.testRun = run; vm.runInContext('run=testRun;game(false)', context); return node('#main').innerHTML; },
    journal: () => vm.runInContext('journalHTML()', context),
  };
}

function resolvedRage(mode, cohort = 'e14') {
  for (let index = 0; index < 100; index++) {
    const run = engine.requestRage(engine.createRun('ai', `${cohort}-dream-ui-${index}`));
    if (run.rageContext?.mode === mode) return run;
  }
  throw new Error(`Missing natural ${mode} route`);
}

test('dream UI never announces the result before rage is chosen', () => {
  const html = appHarness().render(engine.createRun('ai', 'e14-dream-not-yet'));
  assert.ok(html.includes('受不了了，扁他'));
  for (const hidden of ['reality-indicator', 'imagined-consequence', '現實沒有動手', '回到現實', '面對後續']) assert.ok(!html.includes(hidden), hidden);
});

for (const cohort of ['e14', 'e15']) test(`${cohort} imagined rage gets a dream frame and returns to the original conversation`, () => {
  const app = appHarness(), run = resolvedRage('imagined', cohort), before = JSON.stringify(run);
  const html = app.render(run);
  assert.match(html, /class="consequence imagined-consequence" role="status" aria-label="腦內夢境結果"/);
  assert.ok(html.includes('腦內夢境'));
  assert.ok(html.includes('現實沒有動手'));
  assert.ok(html.includes('回到現實'));
  assert.ok(html.includes('quote-avatar'));
  assert.ok(html.includes('./assets/wing.png'));
  assert.ok(!html.includes('漫畫'));
  assert.equal(JSON.stringify(run), before, 'display polish must not mutate the saved replay');
  assert.ok(app.journal().includes('reality-imagined'));
  assert.ok(!app.journal().includes('漫畫'));
  const returned = app.render(engine.advance(run));
  assert.ok(!returned.includes('reality-indicator'));
  assert.ok(!returned.includes('imagined-consequence'));
  assert.ok(app.journal().includes('現實沒有動手'), 'the past result remains identified in the journal');
});

test('a real rage result stays real even if an earlier dream flag is present', () => {
  const app = appHarness(), run = resolvedRage('real');
  run.flags.rage_imagined = 1;
  const html = app.render(run);
  assert.ok(html.includes('reality-real'));
  assert.ok(html.includes('現實失控'));
  assert.ok(html.includes('事情真的發生了'));
  assert.ok(html.includes('面對後續'));
  assert.ok(!html.includes('現實沒有動手'));
  assert.ok(!html.includes('imagined-consequence'));
  const aftermath = app.render(engine.advance(run));
  assert.ok(aftermath.includes('失控後的世界'));
  assert.ok(!aftermath.includes('reality-imagined'));
});

test('unrelated outcomes and older rage menus do not acquire dream labels', () => {
  const app = appHarness(), initial = engine.createRun('ai', 'e14-dream-unrelated');
  const choice = engine.getEvent(initial).choices.findIndex(item => item.available !== false && !item.effect);
  const ordinary = engine.applyChoice(initial, choice);
  ordinary.flags.rage_imagined = 1;
  assert.ok(!app.render(ordinary).includes('reality-indicator'));
  assert.ok(!app.render(engine.requestRage(engine.createRun('ai', 'e13-original-menu'))).includes('reality-indicator'));
});
