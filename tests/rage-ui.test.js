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
import {polishDreamText} from '../dist/copy-v15.js';

const appSource = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');

// Execute the actual app and click handler; only browser surfaces and network are
// replaced. This catches placement and double-resolution regressions together.
function appHarness() {
  const nodes = new Map(), listeners = new Map(), calls = { rage: 0, raise: 0, choice: 0, advance: 0, save: 0 };
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
    requestRage(run, target) { calls.rage++; return engine.requestRage(run, target); },
    requestRaise(run) { calls.raise++; return engine.requestRaise(run); },
    applyChoice(run, index) { calls.choice++; return engine.applyChoice(run, index); },
    advance(run) { calls.advance++; return engine.advance(run); },
    createFeedbackUI: () => ({ open() {} }),
    createCharacterBook: () => ({open() {},onSnapshot() {},onRunChanged() {}}),
    cloud: {
      state: { status: 'offline', achievements: [] }, subscribe() {},
      init: async () => null, achievementProgress: async () => null, characterProgress: async () => null,
      complete: async () => null,
    },
    localStorage: { getItem: () => null, setItem() { calls.save++; } },
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
    async action(action) {
      const event = { target: { closest: selector => selector === '[data-action]' ? { dataset: { action } } : null } };
      for (const listener of listeners.get('click') || []) await listener(event);
    },
    async rage() { return this.action('rage'); },
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

test('new browser lives use the e39 calendar and the guide explains solo and group targets', () => {
  const app = appHarness();
  const seed = vm.runInContext('randomSeed()', app.context);
  assert.match(seed, /^e39-cal46-[a-f0-9]{22}$/);
  assert.ok(seed.length <= 32);
  vm.runInContext('statGuide()', app.context);
  const guide = app.nodes.get('#dialog-content').innerHTML;
  assert.ok(guide.includes('眼前跟你說話的人'));
  assert.ok(guide.includes('多人同場會先讓你選一位，取消不算出手'));
  assert.ok(guide.includes('存款達 75、完成 6 次工作後'));
  assert.ok(guide.includes('存款達 90、完成 10 次工作後'));
  assert.ok(guide.includes('選定方向後才揭曉後續'));
  assert.doesNotMatch(guide,/venture_independent|venture_restart|retired_free|retired_flexible/);
});

test('e17 lives use the current rage label without an upgrade notice, while e13 keeps its original notice', () => {
  const app = appHarness(), initial = engine.createRun('ai', 'e17-ui-current-cohort');
  assert.ok(!app.render(initial).includes('class="upgrade-inline"'));
  assert.ok(!app.html().includes('class="rules-notice"'));
  let real;
  for (let index = 0; index < 100; index++) {
    const result = engine.requestRage(engine.createRun('ai', `e17-ui-rage-tag-${index}`));
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

function initialAssistant(cohort) {
  for (let index = 0; index < 100; index++) {
    const run = engine.createRun('system', `${cohort}-ui-assistant-${index}`);
    if (run.assignment === 'assistant') return run;
  }
  throw new Error('Missing natural assistant assignment');
}

test('new work cards show all eight real titles and select the assistant stage', () => {
  const app = appHarness(), html = app.render(initialAssistant('e17'));
  const track = html.match(/<div class="career-track full-career">[\s\S]*?<\/ol>/)?.[0];
  assert.ok(track);assert.match(track, /aria-label="八階職涯"/);
  assert.equal([...track.matchAll(/<li /g)].length, 8);
  assert.equal([...track.matchAll(/aria-current="step"/g)].length, 1);
  assert.match(track, /<li class="current"[^>]*aria-current="step"[^>]*>[\s\S]*?LV\.0<\/small>助理工程師/);
  for (const title of currentCareer.CAREER_LADDERS_V17.system) assert.ok(track.includes(title), title);
  vm.runInContext('careerGuide()', app.context);
  const guide = app.nodes.get('#dialog-content').innerHTML;
  assert.equal([...guide.matchAll(/<li /g)].length, 8);
  assert.match(guide, /資深、主任仍以專業交付為主/);
});

test('published five-stage assistant work cards remain unranked', () => {
  const app = appHarness(), html = app.render(initialAssistant('e16'));
  const track = html.match(/<div class="career-track">[\s\S]*?<\/ol>/)?.[0];
  assert.ok(track);assert.match(track, /aria-label="五階職涯"/);assert.match(track, /待轉正/);
  assert.equal([...track.matchAll(/<li /g)].length, 5);
  assert.doesNotMatch(track, /aria-current="step"|LV\.7|主任工程師/);
});

test('career preparation respects each cohort maximum instead of stopping new lives at deputy rank', () => {
  const app = appHarness();
  function control(seed, rank) {
    app.context.testRun = { ...engine.createRun('system', seed), assignment: 'honest', actualRoleId: 'system', turn: 20, rank };
    return vm.runInContext('run=testRun;careerControl()', app.context);
  }
  for (const rank of [4, 5, 6]) {
    const html = control('e17-ui-senior', rank);
    assert.match(html, /準備升遷/);assert.doesNotMatch(html, /本局的升遷評核已結束/);
  }
  assert.equal(control('e17-ui-chief', 7), '');
  assert.equal(control('e16-ui-chief', 4), '');
});

test('career statistics do not infer eight-stage ranks from legacy ending-only aggregates', () => {
  const assistant = endings.ENDINGS.find(ending => ending.family === 'career_assistant');
  const staff = endings.ENDINGS.find(ending => ending.family === 'career_staff');
  assert.ok(assistant);assert.ok(staff);
  const app = appHarness();
  app.context.testData = { endings: [{ id: assistant.id, count: 1 }, { id: staff.id, count: 2 }] };
  const html = vm.runInContext('careerStatsHTML(testData)', app.context);
  assert.match(html, /等待新版分類資料/);
  assert.match(html, /不由結局路線猜職級/);
  assert.doesNotMatch(html, /class="bar-row"|助理：1局|專業員工：2局/);
  assert.ok(!html.includes(assistant.title));assert.ok(!html.includes(staff.title));
});


// Reach the real talk-pay entry point through normal play; no salary or cooldown
// fields are injected to make the work-card button appear available.
function readyRaiseRun() {
  for (let seed = 0; seed < 30; seed++) {
    let run = engine.createRun('system', `e19-ui-raise-${seed}`);
    for (let step = 0; step < 80 && !run.completed; step++) {
      if (engine.canRequestRaise(run)) return run;
      if (run.pending) { run = engine.advance(run); continue; }
      const event = engine.getEvent(run), candidates = event.choices
        .map((choice, index) => choice.available === false ? null : engine.applyChoice(run, index))
        .filter(Boolean);
      const score = candidate => (candidate.completed || candidate.pendingFamily ? -10000 : 0)
        + candidate.stats.boss * 2 + candidate.stats.mood + candidate.stats.energy
        + candidate.stats.cash * .3 + candidate.stats.trust * .2;
      candidates.sort((left, right) => score(right) - score(left));
      run = candidates[0];
    }
  }
  throw new Error('A natural talk-pay entry is required for UI coverage');
}

test('the raise control is separate from promotion and explains unavailable entry without spoilers', () => {
  const app = appHarness(), initial = engine.createRun('system', 'e19-ui-raise-entry');
  const html = app.render(initial), buttons = renderedButtons(html);
  const button = buttons.find(entry => /\bdata-action="raise"/.test(entry.attributes));
  assert.ok(button);assert.match(button.attributes, /\bdisabled\b/);
  assert.ok(button.ancestors.some(entry => hasClass(entry, 'sidebar-controls')));
  assert.ok(!button.ancestors.some(entry => hasClass(entry, 'choices')));
  assert.ok(button.attributes.includes(engine.raiseAvailability(initial).reason));
  assert.ok(html.indexOf('data-action="career"') < button.index);
  assert.match(html, /我要談加薪 ↗/);
  assert.doesNotMatch(button.attributes, /機率|百分|成功率|氣炸|加薪\s*\+/);
  for (const cohort of ['e16', 'e17', 'e18']) {
    assert.doesNotMatch(app.render(engine.createRun('system', `${cohort}-ui-no-raise`)), /data-action="raise"/);
  }
});

test('one available raise click opens its scene, persists once, and cannot enter again from that scene', async () => {
  const app = appHarness(), initial = readyRaiseRun(), html = app.render(initial), savedBefore = app.calls.save;
  const button = renderedButtons(html).find(entry => /\bdata-action="raise"/.test(entry.attributes));
  assert.ok(button);assert.doesNotMatch(button.attributes, /\bdisabled\b/);
  app.nodes.get('#dialog').open = true;
  await app.action('raise');
  assert.equal(app.calls.raise, 0);assert.equal(app.state(), initial);assert.equal(app.calls.save, savedBefore);
  app.nodes.get('#dialog').open = false;
  await app.action('raise');
  const opened = app.state();
  assert.equal(opened.eventId, 'raise-request');assert.equal(opened.pending, false);
  assert.equal(opened.turn, initial.turn);assert.equal(opened.history.length, initial.history.length);
  assert.equal(opened.actions.length, initial.actions.length + 1);
  assert.equal(opened.actions.at(-1).type, 'raise');assert.equal(app.calls.save, savedBefore + 1);
  assert.equal(app.calls.choice, 0);assert.equal(app.calls.advance, 0);
  assert.match(app.html(), /class="tag">職涯選擇<\/span>/);
  const blocked = renderedButtons(app.html()).find(entry => /\bdata-action="raise"/.test(entry.attributes));
  assert.match(blocked.attributes, /\bdisabled\b/);
  const exit = renderedButtons(app.html()).find(entry => /\bdata-action="exit"/.test(entry.attributes));
  assert.match(exit.attributes, /\bdisabled\b/);
  const after = JSON.stringify(opened);
  await app.action('raise');
  assert.equal(JSON.stringify(app.state()), after);assert.equal(app.calls.save, savedBefore + 1);
});

test('the guide explains independent talk-pay limits only for new lives', () => {
  const app = appHarness();
  app.render(engine.createRun('system', 'e19-ui-raise-guide'));
  vm.runInContext('statGuide()', app.context);
  const guide = app.nodes.get('#dialog-content').innerHTML;
  assert.match(guide, /完成三個工作回合/);assert.match(guide, /五個工作回合/);
  assert.match(guide, /每局最多三次/);assert.match(guide, /正式開口前取消不算/);
  assert.match(guide, /不占升遷評核/);assert.doesNotMatch(guide, /成功率|翅膀.*氣炸/);
  app.render(engine.createRun('system', 'e18-ui-existing-guide'));
  vm.runInContext('statGuide()', app.context);
  assert.doesNotMatch(app.nodes.get('#dialog-content').innerHTML, /\$ \/ 談薪|每局最多三次/);
});

// These deliberately isolated UI states exercise presentation and entry controls.
// Natural save/replay witnesses cover how the engine reaches them separately.
function watchDutyState(eventId = 'watch-empty-corridor') {
  const initial = engine.createRun('system', 'e20-ui-watch-card');
  return {
    ...initial, actualRoleId: 'system', assignment: 'honest', rank: 1, turn: 9,
    eventId, pipCount: 1, pip: { active: false, remaining: 0 },
    stats: { ...initial.stats, energy: 75, mood: 65, cash: 70, boss: 40 },
    flags: { ...initial.flags, pip_passed: 1, post_pip_tolerance: 1, floor_watch: 1, floor_watch_days: 1 },
  };
}
const actionButton = (html, action) => renderedButtons(html).find(button =>
  button.attributes.includes(`data-action="${action}"`));

test('watch duty shows the real floor arrangement without replacing the player career title', () => {
  const app = appHarness(), run = watchDutyState(), html = app.render(run);
  const card = html.match(/<div class="player-card">[\s\S]*?<\/div><div class="boss-panel/)?.[0];
  assert.ok(card);
  assert.match(card, /<h2>工程師<\/h2>/);
  assert.equal(engine.jobTitle(run), '工程師');
  assert.match(card, /aria-label="目前人事狀態"/);
  assert.match(card, /<b>三樓看門中<\/b>/);
  assert.match(card, /辦公室在五樓・原職稱保留/);
  assert.match(card, /PIP 已通過・仍在觀察/);
  assert.doesNotMatch(card, /<h2>[^<]*(?:看門|三樓)|機率|百分|成功率/);
});

test('watch duty carries the floor reminder into the mobile workbar and keeps ordinary self-care available', () => {
  const app = appHarness(), html = app.render(watchDutyState());
  const mobile = html.match(/<div class="mobile-workbar">[\s\S]*?<\/div>/)?.[0];
  assert.ok(mobile);assert.match(mobile, /三樓看門中/);
  assert.match(mobile, /心情 65 · 體力 75 · 存款 70/);
  assert.match(actionButton(html, 'career').attributes, /\bdisabled\b/);
  assert.match(actionButton(html, 'raise').attributes, /\bdisabled\b/);
  assert.doesNotMatch(actionButton(html, 'break').attributes, /\bdisabled\b/);
  assert.doesNotMatch(actionButton(html, 'exit').attributes, /\bdisabled\b/);
  assert.match(html, /class="tag">三樓待命<\/span>/);
});

test('passed PIP observation remains visible after work returns, without claiming watch duty continues', () => {
  const run = watchDutyState('meimei-product-loop');run.flags.floor_watch = 0;
  const app = appHarness(), html = app.render(run);
  assert.match(html, /class="personnel-status post-pip-status"/);
  assert.match(html, /PIP 已通過・仍在觀察/);
  assert.doesNotMatch(html, /三樓看門中|辦公室在五樓・原職稱保留/);
  assert.match(html, /<h2>工程師<\/h2>/);
});

test('new personnel notices keep sidebar exits from bypassing the choices on screen', () => {
  const app = appHarness();
  for (const eventId of ['dismissal-final', 'labor-claim', 'labor-mediation', 'floor-notice', 'watch-review', 'watch-future']) {
    const html = app.render(watchDutyState(eventId));
    assert.match(html, /class="tag">人事通知<\/span>/, eventId);
    for (const action of ['career', 'raise', 'break', 'exit']) {
      const button = actionButton(html, action);assert.ok(button, `${eventId}: ${action}`);
      assert.match(button.attributes, /\bdisabled\b/, `${eventId}: ${action}`);
    }
  }
});

test('Water Snake has her own illustrated speaker and existing characters keep their own portrait', () => {
  const app = appHarness(), run = watchDutyState('watch-invisible-invite'), html = app.render(run);
  const quote = html.match(/<div class="character-quote">[\s\S]*?<\/div><\/div>/)?.[0];
  assert.ok(quote);assert.match(quote, /src="\.\/assets\/meimei\.png"/);
  assert.match(quote, /水蛇/);assert.match(quote, /業務經理/);
  assert.doesNotMatch(quote, /美美|Meimei|Wing|src="\.\/assets\/wing\.png"/);
  assert.match(html, /src="\.\/assets\/wing\.png"/);
  const legacy = app.render(engine.createRun('system', 'e19-ui-no-new-status'));
  assert.doesNotMatch(legacy, /class="personnel-status|三樓看門中|PIP 已通過・仍在觀察/);
});
