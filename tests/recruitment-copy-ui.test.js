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
import * as characters from '../dist/character-stats.js';
import { characterBookHTML } from '../dist/character-book.js';
import { polishDreamText } from '../dist/copy-v15.js';

const source = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const personnelRoutes = JSON.parse(await readFile(new URL('./fixtures/personnel-routes-v20.json', import.meta.url), 'utf8')).routes;
const tick = () => new Promise(resolve => setImmediate(resolve));
const esc = value => persona.displayText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const slogan = /<blockquote>要好命就不要來移動，<br>要計較就趁早離開這裡。<\/blockquote>/;

async function appHarness(mobile) {
  const nodes = new Map(), calls = { saves: 0, proofs: 0 };
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', title: '', open: false,
      classList: { add() {}, remove() {}, toggle() {} }, focus() {}, setAttribute() {}, addEventListener() {},
      scrollIntoView() {}, showModal() { this.open = true; }, close() { this.open = false; },
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    ...roles, ...sources, ...endings, ...legacy, ...engine, ...achievements, ...career, ...currentCareer, ...persona, ...characters, polishDreamText,
    createFeedbackUI: () => ({ open() {} }), createCharacterBook: () => ({ open() {}, onSnapshot() {}, onRunChanged() {} }),
    cloud: { state: { status: 'offline', achievements: [], characters: [] }, subscribe() {}, init: async () => null,
      achievementProgress: async () => { calls.proofs++; return null; }, characterProgress: async () => { calls.proofs++; return null; }, complete: async () => null },
    localStorage: { getItem: () => null, setItem() { calls.saves++; } },
    document: { querySelector: node, addEventListener() {} },
    window: { scrollTo() {}, matchMedia: () => ({ matches: mobile }) },
    crypto: webcrypto, structuredClone, setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(source, context, { filename: 'dist/app.js' });
  await tick(); calls.saves = 0; calls.proofs = 0;
  return {
    calls, state: () => vm.runInContext('run', context), html: () => node('#main').innerHTML,
    render(run) { context.fixtureRun = run; vm.runInContext('run=fixtureRun;game(true)', context); return node('#main').innerHTML; },
    roles() { vm.runInContext('roleScreen(false)', context); return node('#main').innerHTML; },
    journal() { return vm.runInContext('journalHTML()', context); },
  };
}

function onboardingRun(assignment) {
  // Exercise the three actual hiring draws rather than overriding an assignment.
  for (let index = 0; index < 100; index++) {
    const run = engine.createRun('system', `e22-recruit-ui-${index}`);
    if (run.assignment === assignment) return run;
  }
  throw new Error(`No natural onboarding draw for ${assignment}`);
}

function assertUnrevealedChoices(html, event) {
  for (const choice of event.choices.filter(row => row.available !== false)) {
    assert.ok(html.includes(esc(choice.text)), 'the player sees the actual branch-specific response');
    for (const outcome of [choice.result, choice.check?.success?.result, choice.check?.failure?.result,
      ...(choice.draw?.outcomes.map(row => row.result) || [])]) {
      if (outcome) assert.ok(!html.includes(esc(outcome)), 'the response does not reveal its result');
    }
    if (choice.detail) assert.ok(!html.includes(esc(choice.detail)), 'internal choice detail stays hidden');
  }
  assert.doesNotMatch(html, /class="result-text"|outcome-ledger|luck-result|delta-chip|aria-label="事件後數值變化"/);
}

for (const mobile of [false, true]) {
  const device = mobile ? 'mobile' : 'desktop';

  test(`${device}: the recruitment slogan precedes the vacancies and does not reroll or save a life`, async () => {
    const app = await appHarness(mobile), run = onboardingRun('honest');
    app.render(run);
    const before = JSON.stringify(app.state()), html = app.roles();
    assert.match(html, /class="recruitment-slogan" aria-label="翅膀欽點的徵才標語"/);
    assert.match(html, /翅膀欽點・徵才標語/);
    assert.match(html, slogan);
    assert.ok(html.indexOf('class="recruitment-slogan"') < html.indexOf('class="role-grid"'));
    assert.equal([...html.matchAll(/class="recruitment-slogan"/g)].length, 1);
    assert.equal([...html.matchAll(/data-role="/g)].length, roles.ROLES.length);
    assert.match(html, /data-role="random"/);
    assert.doesNotMatch(html, /data-role="executive"|data-choice=|outcome-ledger|delta-chip|\d+%/);
    assert.equal(JSON.stringify(app.state()), before, 'opening vacancies preserves the full RNG and replay state');
    assert.equal(app.calls.saves, 0);
    assert.equal(app.calls.proofs, 0);
  });

  test(`${device}: the onboarding slogan preserves distinct honest, reassigned and assistant conversations without spoilers`, async () => {
    const app = await appHarness(mobile), choices = new Set(), bodies = new Set();
    for (const assignment of ['honest', 'swapped', 'assistant']) {
      const run = onboardingRun(assignment), event = persona.displayChronicleEvent(engine.getEvent(run));
      assert.equal(event.id, 'onboarding');
      const before = JSON.stringify(run), html = app.render(run);
      assert.match(html, /class="recruitment-slogan onboarding-slogan"/);
      assert.match(html, /class="recruitment-slogan-label">報到須知<\/span>/);
      assert.match(html, slogan);
      assert.match(html, /你又看到徵才頁那句話。現在它貼在報到桌前。/);
      assert.equal([...html.matchAll(/class="recruitment-slogan onboarding-slogan"/g)].length, 1);
      assert.ok(html.includes(esc(event.body)));
      assert.ok(html.includes(esc(engine.jobTitle(run))), 'the actual role is visible at reporting');
      assertUnrevealedChoices(html, event);
      const responses = html.slice(html.indexOf('<div class="choices '));
      assert.ok(responses.indexOf('data-action="rage"') > responses.lastIndexOf('data-choice='));
      choices.add(event.choices.map(choice => choice.text).join('|'));
      bodies.add(event.body);
      assert.equal(JSON.stringify(run), before, `${assignment} presentation preserves RNG, actions and history`);
      assert.equal(engine.validRun(run), true);
    }
    assert.equal(choices.size, 3, 'each hiring outcome keeps its own responses');
    assert.equal(bodies.size, 3);
    assert.equal(app.calls.saves, 0);
    assert.equal(app.calls.proofs, 0);
  });

  test(`${device}: an old Moon Dog personnel record displays 真真 while retaining the stable character and replay identity`, async () => {
    const route = personnelRoutes.find(row => row.id === 'direct-without-pip');
    assert.ok(route);
    const run = engine.applyChoice(engine.replayRun(route.roleId, route.seed, route.actions), 1);
    const last = run.history.at(-1);
    assert.equal(last.speaker, 'exit-team');
    assert.match(last.body, /Moon Dog/);
    const app = await appHarness(mobile), before = JSON.stringify(run), counts = characters.deriveCharacterStats(run);
    const html = app.render(run), journal = app.journal();
    assert.match(html, /aria-label="法師、真真、阿福三件套動畫角色"/);
    assert.match(html, /法師 · 真真 · 阿福/);
    assert.ok(html.includes(esc(last.body)));
    assert.match(html, /src="\.\/assets\/jenjen\.png"/);
    assert.match(html, /data-character-id="jenjen" class="character-change/);
    assert.match(html, /<span>真真<\/span>/);
    assert.doesNotMatch(html + journal, /Moon Dog|JenJen/);
    assert.equal(JSON.stringify(run), before, 'old canonical history is not rewritten by rendering');
    assert.deepEqual(characters.deriveCharacterStats(run), counts);
    assert.equal(app.calls.saves, 0);
    assert.equal(app.calls.proofs, 0);

    const book = characterBookHTML({ filter: 'jenjen', currentRun: run });
    assert.match(book, /id="character-card-jenjen"/);
    assert.match(book, /<h3 id="character-title-jenjen">真真<\/h3>/);
    assert.match(book, /src="\.\/assets\/jenjen\.png" alt="真真原創動畫角色"/);
    assert.match(book, /aria-label="真真本局好感"/);
    assert.doesNotMatch(book, /Moon Dog|JenJen/);
    assert.equal(persona.PERSONAS.jenjen.name, '真真');
  });
}
