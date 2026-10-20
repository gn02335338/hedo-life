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
const { routes } = JSON.parse(await readFile(new URL('./fixtures/chronicle-routes-v22.json', import.meta.url), 'utf8'));
const rageRoutes = routes.filter(route => ['helen-imagined', 'helen-real'].includes(route.id));
const tick = () => new Promise(resolve => setImmediate(resolve));
const esc = value => persona.displayText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rowFor = run => characters.deriveCharacterStats(run).find(row => row.id === 'helen');
const beforeRage = fixture => {
  const run = engine.replayRun(fixture.roleId, fixture.seed, fixture.actions.slice(0, -1));
  run.runId = webcrypto.randomUUID();
  return run;
};

async function appHarness(mobile) {
  const nodes = new Map(), calls = { saves: 0, proofs: [] };
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
      achievementProgress: async () => null, characterProgress: async run => { calls.proofs.push(structuredClone(run)); return null; }, complete: async () => null },
    localStorage: { getItem: () => null, setItem() { calls.saves++; } },
    document: { querySelector: node, addEventListener() {} },
    window: { scrollTo() {}, matchMedia: () => ({ matches: mobile }) },
    crypto: webcrypto, structuredClone, setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(source, context, { filename: 'dist/app.js' });
  await tick(); calls.saves = 0; calls.proofs.length = 0;
  return {
    calls, state: () => vm.runInContext('run', context), html: () => node('#main').innerHTML,
    render(run) { context.fixtureRun = run; vm.runInContext('run=fixtureRun;game(true)', context); return node('#main').innerHTML; },
    async choose(index) { context.fixtureIndex = index; vm.runInContext('choose(fixtureIndex)', context); await tick(); },
    async rage() { vm.runInContext('beginRage()', context); await tick(); },
  };
}

for (const mobile of [false, true]) {
  const device = mobile ? 'mobile' : 'desktop';
  test(`${device}: a natural Helen work scene shows her portrait, hides outcomes, and records only the resolved interaction`, async () => {
    assert.equal(rageRoutes.length, 2);
    const app = await appHarness(mobile), run = beforeRage(rageRoutes[0]);
    assert.equal(engine.getEvent(run).speaker, 'helen');
    assert.equal(engine.canRequestRage(run), true);
    const saved = JSON.stringify(run), counts = characters.deriveCharacterStats(run), event = persona.displayChronicleEvent(engine.getEvent(run));
    const html = app.render(run);
    assert.match(html, /src="\.\/assets\/helen\.png"/);
    assert.ok(html.includes('前女友'));
    assert.ok(html.includes('產品開發總監'));
    assert.ok(html.includes(esc(event.body)));
    for (const choice of event.choices.filter(choice => choice.available !== false)) {
      assert.ok(html.includes(esc(choice.text)));
      for (const outcome of [choice.result, choice.check?.success?.result, choice.check?.failure?.result,
        ...(choice.draw?.outcomes.map(row => row.result) || [])]) {
        if (outcome) assert.ok(!html.includes(esc(outcome)), 'unresolved outcomes remain private');
      }
    }
    assert.doesNotMatch(html, /class="result-text"|outcome-ledger|luck-result|aria-label="事件後數值變化"/);
    const choices = html.slice(html.indexOf('<div class="choices '));
    assert.ok(choices.indexOf('data-action="rage"') > choices.lastIndexOf('data-choice='));
    assert.equal(JSON.stringify(run), saved);
    assert.deepEqual(characters.deriveCharacterStats(run), counts);
    assert.equal(app.calls.saves, 0);
    assert.equal(app.calls.proofs.length, 0);

    const index = engine.getEvent(run).choices.findIndex(choice => choice.available !== false);
    await app.choose(index);
    const pending = app.state(), last = pending.history.at(-1), after = app.html();
    assert.equal(pending.pending, true);
    assert.equal(last.speaker, 'helen');
    assert.equal(last.choiceIndex, index);
    assert.ok(after.includes(esc(last.result)));
    assert.match(after, /aria-label="事件後數值變化"/);
    assert.match(after, /data-character-id="helen" class="character-change/);
    assert.equal(rowFor(pending).encounters, rowFor(run).encounters + 1);
    assert.equal(app.calls.proofs.length, 1);
    assert.deepEqual(app.calls.proofs[0].actions, pending.actions);
    assert.equal(engine.validRun(pending), true);
  });

  test(`${device}: Helen's actual resolved rage controls dream and reality UI without mixing character counters`, async () => {
    assert.equal(rageRoutes.length, 2);
    for (const fixture of rageRoutes) {
      const app = await appHarness(mobile), run = beforeRage(fixture);
      const before = rowFor(run);
      app.render(run); await app.rage();
      const pending = app.state(), last = pending.history.at(-1), html = app.html();
      assert.equal(pending.pending, true);
      assert.equal(last.eventId, 'rage-release');
      assert.equal(last.speaker, 'helen');
      assert.deepEqual(pending.actions, fixture.actions);
      assert.equal(pending.rageContext.mode, fixture.mode);
      assert.match(html, /src="\.\/assets\/helen\.png"/);
      assert.match(html, /data-character-id="helen" class="character-change/);
      assert.match(html, /aria-label="事件後數值變化"/);
      const after = rowFor(pending);
      assert.equal(after.encounters, before.encounters + 1);
      assert.equal(after.imaginedHits - before.imaginedHits, Number(fixture.mode === 'imagined'));
      assert.equal(after.realHits - before.realHits, Number(fixture.mode === 'real'));
      if (fixture.mode === 'imagined') {
        assert.match(html, /imagined-consequence/);
        assert.match(html, /腦內夢境結果/);
        assert.match(html, /現實沒有動手/);
        assert.match(html, /回到現實/);
        assert.match(html, /幻想扁人 \+1/);
        assert.doesNotMatch(html, /真的動手 \+1|real-consequence|現實失控結果/);
      } else {
        assert.match(html, /real-consequence/);
        assert.match(html, /現實失控結果/);
        assert.match(html, /事情真的發生了/);
        assert.match(html, /面對後續/);
        assert.match(html, /真的動手 \+1/);
        assert.doesNotMatch(html, /幻想扁人 \+1|imagined-consequence|腦內夢境結果/);
      }
      assert.equal(app.calls.proofs.length, 1);
      assert.equal(engine.validRun(pending), true);
      const saved = JSON.stringify(pending);
      app.render(pending);
      assert.equal(JSON.stringify(pending), saved, 'displaying a revealed mode cannot reroll it');
      assert.equal(app.calls.proofs.length, 1, 'rendering does not send another proof');
    }
  });
}

test('the expanded archive preserves the eleven published IDs and presents Helen and Sonny context without ending spoilers', () => {
  const oldIds = ['wing', 'spencer', 'erich', 'sonny', 'jenjen', 'rick', 'kind', 'hope', 'jack', 'meimei'];
  assert.deepEqual(characters.CHARACTER_IDS.slice(0, 11), [...oldIds, 'helen']);
  const html = characterBookHTML();
  assert.equal([...html.matchAll(/class="character-card"/g)].length, 16);
  assert.match(html, /16<small>位遊戲角色/);
  for (const id of characters.CHARACTER_IDS) {
    assert.ok(html.includes(`id="character-card-${id}"`));
    assert.ok(html.includes(`src="${persona.PERSONAS[id].image}"`));
  }
  assert.equal(persona.PERSONAS.helen.name, '前女友');
  assert.equal(persona.PERSONAS.helen.title, '產品開發總監');
  assert.match(persona.PERSONAS.helen.about, /海倫/);
  assert.match(persona.PERSONAS.helen.about, /不代表實際交往紀錄/);
  assert.match(persona.PERSONAS.sonny.about, /桑尼/);
  assert.ok(html.includes(`<p class="character-bio">${persona.PERSONAS.helen.about}</p>`));
  assert.ok(html.includes(`<p class="character-bio">${persona.PERSONAS.sonny.about}</p>`));
  assert.doesNotMatch(html, /成功率|納斯達克幻想|自願離職陷阱|勉強通關/);
  const protectedText = 'https://example.com/Helen/Sonny ./assets/helen.png rage_sonny';
  assert.equal(persona.displayText(protectedText), protectedText);
});

test('optional archive biographies are escaped as text', async () => {
  const source = (await readFile(new URL('../dist/character-book.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replaceAll('export function ', 'function ');
  const untrusted = '<img src=x onerror="alert(1)"><script>bad()</script>&';
  const context = vm.createContext({
    PERSONAS: { ...persona.PERSONAS, helen: { ...persona.PERSONAS.helen, about: untrusted } },
    ...characters,
  });
  vm.runInContext(source, context);
  const html = vm.runInContext('characterBookHTML({filter:"helen"})', context);
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;&amp;'));
  assert.ok(!html.includes(untrusted));
  assert.doesNotMatch(html, /<script>|<img src=x/);
});
