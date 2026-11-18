import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUESTIONS } from '../dist/data-science-war/questions.js';
import { CLOSING, OPENING, TOPICS } from '../dist/data-science-war/cases.js';
import { ARRIVAL, MEETING_SCENES } from '../dist/data-science-war/meeting-scenes.js';
import { ITEMS, ITEM_BY_ID, meetingItemEffect } from '../dist/data-science-war/items.js';
import { SAVE_KEY, advanceMeeting, buildAgenda, buildItemDraw, createMeeting, endingFor, restoreMeeting, saveMeeting } from '../dist/data-science-war/game.js';

const advance = (state) => advanceMeeting(state, { type: 'advance' });
const pack = (state, item) => advanceMeeting(state, { type: 'pack', item });
const reply = (state, choice, evidence) => advanceMeeting(state, { type: 'reply', reply: choice, evidence });
const answer = (state) => reply(state, 'challenge', state.agenda[state.index].rebuttal);
const seeded = (item, condition = () => true) => {
  for (let seed = 0; seed < 512; seed++) {
    const state = createMeeting(seed);
    if (state.itemDraw.some(entry => entry.id === item)) {
      const next = pack(state, item);
      if (condition(next)) return next;
    }
  }
  throw new Error('No seed for ' + item);
};

const startQuiz = (item, condition) => advance(reply(seeded(item, condition), 'challenge'));

test('arrival asks why you entered and accepts direct dialogue before the three questions', () => {
  const entered = seeded('cola');
  assert.equal(entered.agenda[0], ARRIVAL);
  assert.equal(entered.rage, 0);
  assert.equal(entered.index, 0);
  assert.equal(advanceMeeting(entered, { type: 'item' }), entered);
  for (const choice of ARRIVAL.replies) {
    const replied = reply(entered, choice.id);
    assert.equal(replied.phase, 'report');
    assert.equal(replied.correct, 0);
    assert.equal(replied.resolved, 0);
    assert.equal(replied.report.proof, null);
    const quiz = advance(replied);
    assert.equal(quiz.index, 1);
    assert.ok(QUESTIONS.includes(quiz.agenda[quiz.index]));
  }
});

test('both draws are deterministic, distinct and varied, with the original sequence fixed', () => {
  const agendas = new Set();
  const draws = new Set();
  for (let seed = 0; seed < 128; seed++) {
    const agenda = buildAgenda(seed);
    assert.equal(agenda.length, 7);
    assert.equal(agenda[0], ARRIVAL);
    assert.deepEqual(agenda.slice(4), MEETING_SCENES);
    const modern = agenda.slice(1, 4);
    assert.equal(new Set(modern).size, 3);
    assert.ok(modern.every((scene) => QUESTIONS.includes(scene) && scene.speaker === 'sam'));
    agendas.add(modern.map(({ id }) => id).join(','));
    const draw = buildItemDraw(seed);
    assert.equal(draw.length, 3);
    assert.equal(new Set(draw).size, 3);
    assert.ok(draw.every(item => ITEMS.includes(item)));
    draws.add(draw.map(item => item.id).join(','));
  }
  assert.ok(agendas.size > 10 && draws.size > 10);
  for (const scene of [...OPENING, ...TOPICS, CLOSING, ...QUESTIONS]) {
    assert.equal(new Set(scene.evidence.map(({ id }) => id)).size, 3);
    assert.ok(scene.evidence.some(({ id }) => id === scene.rebuttal));
    assert.deepEqual(scene.replies.map(({ id }) => id), ['challenge', 'mediate', 'apology', 'scold', 'observe']);
  }
  const sceneIds = new Set([...OPENING, ...TOPICS, CLOSING].map(scene => scene.id));
  assert.ok(ITEMS.flatMap(item => item.fit ?? []).every(id => sceneIds.has(id)));
});

test('packing is a single irrevocable choice and weapon checks can expel, call police or admit', () => {
  const start = createMeeting(29);
  assert.equal(start.phase, 'items');
  assert.equal(pack(start, 'bogus'), start);
  const safe = seeded('cola');
  assert.equal(safe.phase, 'debate');
  assert.equal(pack(safe, 'cola'), safe);
  const expelled = seeded('bat', state => state.phase === 'ending');
  assert.equal(expelled.ending, 'kicked');
  assert.equal(expelled.index, 0);
  assert.equal(advance(expelled), expelled);
  const police = seeded('ceo-toy', state => state.phase === 'ending');
  assert.equal(police.ending, 'policeEntry');
  const admitted = seeded('ceo-toy', state => state.phase === 'debate');
  assert.ok(ITEM_BY_ID[admitted.itemId].loadout.startingEnergy > 25);
  assert.equal(advanceMeeting(admitted, { type: 'item' }), admitted);
});

test('meeting items are contextual, can backfire, and are spent once', () => {
  const useItem = (state) => advanceMeeting(state, { type: 'item' });
  const active = startQuiz('textbook', state => ['friday-club', 'training-leak'].includes(state.agenda[1].itemTopic));
  const used = useItem(active);
  assert.equal(used.resolved, 1);
  assert.equal(used.itemUsed, true);
  const nextRound = advance(used);
  assert.equal(useItem(nextRound), nextRound);
  assert.equal(meetingItemEffect(ITEM_BY_ID['search-print'], OPENING[0]).solved, false);
  const impatient = advance(reply(startQuiz('cola'), 'scold'));
  assert.ok(useItem(impatient).rage < impatient.rage);
  assert.ok(useItem(startQuiz('empty-cookie-tin')).rage > active.rage);
});

test('wrong answers and scolding can be withdrawn once before moving on', () => {
  const start = startQuiz('cola');
  assert.equal(reply(start, 'challenge'), start);
  assert.equal(start.rage, 0);
  const wrongId = start.agenda[start.index].evidence.find(entry => entry.id !== start.agenda[start.index].rebuttal).id;
  const wrong = reply(start, 'challenge', wrongId);
  assert.equal(wrong.report.title, '答錯了');
  assert.equal(wrong.report.repairable, true);
  assert.equal(wrong.correct, 0);
  const repaired = advanceMeeting(wrong, { type: 'repair' });
  assert.ok(repaired.rage < wrong.rage);
  assert.equal(repaired.report.repairable, false);
  assert.equal(advanceMeeting(repaired, { type: 'repair' }), repaired);
  assert.equal(answer(start).resolved, 1);
  const firstScold = reply(start, 'scold');
  const nextScold = reply(advance(firstScold), 'scold');
  const rescued = reply(advance(nextScold), 'scold');
  assert.equal(rescued.rage, 49);
  assert.equal(rescued.report.snackFrom, 84);
  assert.equal(rescued.report.intervention, true);
  assert.equal(rescued.wineIntervened, true);
  assert.equal(rescued.jackConcerned, true);
  const afterSnack = advance(rescued);
  assert.equal(afterSnack.index, 4);
  assert.equal(afterSnack.agenda[4].speaker, 'joe');
  const fourth = reply(afterSnack, 'scold');
  assert.equal(fourth.report.intervention, false);
  const transformed = reply(advance(fourth), 'scold');
  assert.equal(transformed.rage, 100);
  assert.equal(advance(transformed).rage, 78);
});

test('all meeting, interruption and duel endings can be reached, and duel resolution is terminal', () => {
  const play = (choose, first = seeded('cola')) => {
    let state = first;
    while (state.phase !== 'ending') {
      assert.ok(state.actions.length < 24);
      state = state.phase === 'debate' ? choose(state) : advance(state);
    }
    return state;
  };
  assert.equal(play(state => reply(state, 'scold')).ending, 'angry');
  assert.equal(play(state => reply(state, 'mediate')).ending, 'calm');
  assert.equal(play(state => reply(state, 'observe')).ending, 'postponed');
  const happy = play(state => state.index % 2 === 0 ? answer(state) : reply(state, 'apology'));
  assert.equal(happy.ending, 'friends');
  assert.equal(endingFor(happy).perfect, true);
  const wing = play(state => state.index === 6 ? advanceMeeting(state, { type: 'wing' }) : reply(state, 'mediate'));
  assert.equal(wing.ending, 'soup');

  const start = seeded('cola');
  assert.equal(advanceMeeting(start, { type: 'wing' }), start);
  const fight = advanceMeeting(start, { type: 'fight' });
  assert.equal(fight.phase, 'battle');
  assert.equal(advance(fight), fight);
  assert.equal(advanceMeeting(fight, { type: 'battle', result: 'toString' }), fight);
  for (const [result, ending] of Object.entries({ win: 'duelWin', lose: 'duelLose', draw: 'duelDraw', quit: 'duelQuit' })) {
    const end = advanceMeeting(fight, { type: 'battle', result });
    assert.equal(end.phase, 'ending');
    assert.equal(end.ending, ending);
    assert.equal(advance(end), end);
  }
});

test('local replay keeps the draw, one-shot item and battle, and upgrades older saves forward', () => {
  const records = new Map([['hedo-island-v1', 'island progress']]);
  const storage = {
    getItem: (key) => records.get(key),
    setItem: (key, value) => records.set(key, value),
  };
  const opening = createMeeting(84);
  saveMeeting(opening, storage);
  assert.deepEqual(restoreMeeting(storage), opening);
  const used = advanceMeeting(startQuiz('cola'), { type: 'item' });
  const battle = advanceMeeting(advance(used), { type: 'fight' });
  saveMeeting(battle, storage);
  assert.deepEqual(restoreMeeting(storage), battle);
  assert.equal(records.get('hedo-island-v1'), 'island progress');

  const past = [{ type: 'fight' }, { type: 'battle', result: 'win' }, { type: 'advance' }];
  records.set(SAVE_KEY, JSON.stringify({ version: 1, seed: 84, actions: past }));
  const migrated = restoreMeeting(storage);
  assert.equal(migrated.rulesVersion, 2);
  assert.equal(migrated.index, 1);
  assert.equal(migrated.phase, 'debate');
  assert.equal(migrated.wins, 1);
  const newDuel = advanceMeeting(migrated, { type: 'fight' });
  const terminal = advanceMeeting(newDuel, { type: 'battle', result: 'lose' });
  assert.equal(terminal.ending, 'duelLose');
  saveMeeting(terminal, storage);
  assert.deepEqual(restoreMeeting(storage), terminal);
  records.set(SAVE_KEY, '{"version":1,"seed":84,"actions":[{"type":"battle","result":"win"}]}');
  assert.equal(restoreMeeting(storage), null);
  assert.doesNotThrow(() => saveMeeting(battle, { setItem() { throw new Error('denied'); } }));
});


test('one-time snack rescue and Jack concern replay exactly, including after an apology', () => {
  const records = new Map();
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  let state = startQuiz('cola');
  for (let index = 0; index < 3; index++) {
    state = reply(state, 'scold');
    if (index < 2) state = advance(state);
  }
  assert.equal(state.report.intervention, true);
  saveMeeting(state, storage);
  assert.deepEqual(restoreMeeting(storage), state);
  const repaired = advanceMeeting(restoreMeeting(storage), { type: 'repair' });
  assert.equal(repaired.rage, 31);
  assert.equal(repaired.jackConcerned, true);
  assert.equal(repaired.wineIntervened, true);
  assert.equal(repaired.report.intervention, false);
  saveMeeting(repaired, storage);
  assert.deepEqual(restoreMeeting(storage), repaired);
});

test('schema-two saves keep their original agenda, initial rage and future rules on upgrade', () => {
  const state = createMeeting(84, null, 2);
  assert.equal(state.rage, 34);
  assert.deepEqual(state.agenda, buildAgenda(84, 2));
  const chosen = state.itemDraw.find(item => !item.loadout);
  const packed = pack(state, chosen.id);
  const pending = reply(packed, 'scold');
  let raw = JSON.stringify({ version: 2, seed: 84, actions: pending.actions, legacyCount: null });
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const restored = restoreMeeting(storage);
  assert.deepEqual(restored, pending);
  const continued = reply(advance(restored), 'scold');
  assert.equal(continued.rage, 90);
  assert.equal(continued.wineIntervened, false);
  saveMeeting(continued, storage);
  assert.equal(JSON.parse(raw).rulesVersion, 2);
  assert.deepEqual(restoreMeeting(storage), continued);
});


test('rules-three saves retain their quiz-first sequence when saved again', () => {
  let old = createMeeting(5, null, 3);
  old = pack(old, 'cola');
  old = reply(old, 'scold');
  const storage = {
    value: JSON.stringify({ version: 3, seed: old.seed, legacyCount: null, rulesVersion: 3, actions: old.actions }),
    getItem() { return this.value; },
    setItem(_, value) { this.value = value; },
  };
  assert.equal(old.agenda.length, 6);
  assert.equal(old.index, 0);
  const restored = restoreMeeting(storage);
  assert.deepEqual(restored, old);
  const next = advance(restored);
  assert.equal(next.agenda[0].id.startsWith('q-'), true);
  saveMeeting(next, storage);
  assert.deepEqual(restoreMeeting(storage), next);
});
