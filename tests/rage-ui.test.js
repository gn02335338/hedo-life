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
import * as career from '../dist/career.js';
import * as persona from '../dist/persona.js';
import {polishDreamText} from '../dist/copy-v15.js';

const appSource = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');

// Execute the actual app and click handler; only browser surfaces and network are
// replaced. This catches placement and double-resolution regressions together.
function appHarness() {
  const nodes = new Map(), listeners = new Map(), calls = { rage: 0, choice: 0, advance: 0 };
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
    ...roles, ...sources, ...endings, ...legacy, ...engine, ...achievements, ...career, ...persona, polishDreamText,
    requestRage(run) { calls.rage++; return engine.requestRage(run); },
    applyChoice(run, index) { calls.choice++; return engine.applyChoice(run, index); },
    advance(run) { calls.advance++; return engine.advance(run); },
    createFeedbackUI: () => ({ open() {} }),
    cloud: {
      state: { status: 'offline', achievements: [] }, subscribe() {},
      init: async () => null, achievementProgress: async () => null,
      complete: async () => null,
    },
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      querySelector: node,
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(callback);
      },
    },
    window: { scrollTo() {}, matchMedia: () => ({ matches: false }) },
    crypto: webcrypto, structuredClone,
    setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(appSource, context, { filename: 'dist/app.js' });
  return {
    context, nodes, calls,
    render(run) { context.testRun = run; vm.runInContext('run=testRun;game(false)', context); return node('#main').innerHTML; },
    state: () => vm.runInContext('run', context),
    html: () => node('#main').innerHTML,
    async rage() {
      const event = { target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'rage' } } : null } };
      for (const listener of listeners.get('click') || []) await listener(event);
    },
  };
}

// A tiny tag inventory is enough to check the rendered button's parent and order
// without introducing a second DOM implementation or a browser dependency.
function renderedButtons(html) {
  const stack = [], buttons = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const [, closing, tagName, attributes] = match, tag = tagName.toLowerCase();
    if (closing) {
      const index = stack.findLastIndex(entry => entry.tag === tag);
      if (index !== -1) stack.splice(index);
      continue;
    }
    const entry = { tag, attributes, index: match.index };
    if (tag === 'button') buttons.push({ ...entry, ancestors: [...stack] });
    if (!voidTags.has(tag) && !attributes.endsWith('/')) stack.push(entry);
  }
  return buttons;
}
const hasClass = (entry, name) => (entry.attributes.match(/\bclass="([^"]*)"/)?.[1] || '').split(/\s+/).includes(name);
const rageButtons = html => renderedButtons(html).filter(button => /\bdata-action="rage"/.test(button.attributes));

test('rage is the final event choice, rather than a detached chapter control', () => {
  const app = appHarness(), run = engine.createRun('ai', 'e14-ui-choices');
  const html = app.render(run), buttons = renderedButtons(html), [rage] = rageButtons(html);
  assert.equal(rageButtons(html).length, 1);
  assert.ok(rage.ancestors.some(entry => hasClass(entry, 'choices')));
  const choices = buttons.filter(button => /\bdata-choice=/.test(button.attributes));
  assert.ok(choices.length > 0);
  assert.ok(choices.every(button => button.index < rage.index));
  assert.ok(html.indexOf('class="chapter-meta"') < rage.index);
  assert.ok(!rage.ancestors.some(entry => hasClass(entry, 'game-sidebar')));
});

test('rage on an already revealed result follows the result and continue control', () => {
  const app = appHarness();
  const initial = engine.createRun('ai', 'e14-ui-result');
  const index = engine.getEvent(initial).choices.findIndex(choice => choice.available !== false && !choice.effect);
  const pending = engine.applyChoice(initial, index), html = app.render(pending), [rage] = rageButtons(html);
  assert.equal(rageButtons(html).length, 1);
  assert.ok(rage.ancestors.some(entry => hasClass(entry, 'rage-result-action')));
  assert.ok(!rage.ancestors.some(entry => hasClass(entry, 'choices')));
  assert.ok(html.indexOf('class="consequence"') < rage.index);
  assert.ok(html.indexOf('data-action="next"') < rage.index);
  assert.ok(html.includes(persona.displayText(pending.history.at(-1).result)));
  assert.equal(renderedButtons(html).filter(button => /\bdata-choice=/.test(button.attributes)).length, 0);
});

test('one rage click reveals exactly one outcome and does not auto-advance it', async () => {
  const app = appHarness(), run = engine.createRun('ai', 'e14-ui-direct');
  app.render(run);
  await app.rage();
  const resolved = app.state();
  assert.equal(app.calls.rage, 1);
  assert.equal(app.calls.choice, 0);
  assert.equal(app.calls.advance, 0);
  assert.equal(resolved.pending, true);
  assert.equal(resolved.history.length, run.history.length + 1);
  assert.equal(resolved.actions.filter(action => action.type === 'rage').length, 1);
  assert.equal(resolved.actions.filter(action => action.type === 'choice').length, 0);
  assert.match(app.html(), /class="consequence(?:\s|")/);
  assert.ok(!app.html().includes('data-choice="0"'));
  const afterOneClick = JSON.stringify(resolved);
  await app.rage();
  assert.equal(JSON.stringify(app.state()), afterOneClick);
});

test('rage from a revealed result keeps that conversation and committed choice', async () => {
  const app = appHarness(), initial = engine.createRun('ai', 'e14-ui-result-click');
  const index = engine.getEvent(initial).choices.findIndex(choice => choice.available !== false && !choice.effect);
  const pending = engine.applyChoice(initial, index);
  app.render(pending);
  await app.rage();
  const resolved = app.state(), action = resolved.actions.at(-1);
  assert.equal(action.type, 'rage');
  assert.equal(action.phase, 'result');
  assert.equal(action.eventId, pending.eventId);
  assert.equal(resolved.rageContext.target, engine.getEvent(pending).speaker);
  assert.deepEqual(resolved.history.slice(0, -1), pending.history);
  assert.equal(resolved.pending, true);
  assert.equal(app.calls.advance, 0);
  assert.equal(app.calls.choice, 0);
});

test('new browser lives use e16 and the guide describes the current speaker', () => {
  const app = appHarness();
  const seed = vm.runInContext('randomSeed()', app.context);
  assert.match(seed, /^e16-[a-f0-9]+$/);
  assert.ok(seed.length <= 32);
  vm.runInContext('statGuide()', app.context);
  const guide = app.nodes.get('#dialog-content').innerHTML;
  assert.ok(guide.includes('眼前跟你說話的人'));
  assert.ok(!guide.includes('挑選對象'));
});

test('e16 lives use the current rage label without an upgrade notice, while e13 keeps its original notice', () => {
  const app = appHarness(), initial = engine.createRun('ai', 'e16-ui-current-cohort');
  assert.ok(!app.render(initial).includes('class="upgrade-inline"'));
  assert.ok(!app.html().includes('class="rules-notice"'));
  let real;
  for (let index = 0; index < 100; index++) {
    const result = engine.requestRage(engine.createRun('ai', `e16-ui-rage-tag-${index}`));
    if (result.rageContext?.mode === 'real') { real = result; break; }
  }
  assert.ok(real, 'a natural actual-rage result is available');
  const current = app.render(real);
  assert.match(current, /class="tag">當場暴走<\/span>/);
  assert.ok(!current.includes('class="upgrade-inline"'));
  assert.ok(!current.includes('卡通暴走'));
  const legacy = app.render(engine.requestRage(engine.createRun('ai', 'e13-ui-cohort-notice')));
  assert.ok(legacy.includes('class="upgrade-inline"'));
  assert.match(legacy, /class="tag">卡通暴走<\/span>/);
});
