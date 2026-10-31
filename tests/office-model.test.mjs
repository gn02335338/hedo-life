import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PERSONAS, displayPersona } from '../dist/persona.js';
import { OFFICE_ZONES, OFFICE_CAST, getCastMoment, getOfficeRoster } from '../dist/office/model.js';
import { getCharacterFloor, isOfficeFloor } from '../dist/office/floors.js';
import { getCharacterRoutine, OFFICE_ROUTINE_PHASES, OFFICE_ROUTINE_CYCLE_MS } from '../dist/office/routine.js';

test('office includes the entire public cast with current display aliases and existing portraits', () => {
  assert.equal(OFFICE_CAST.length, 34);
  assert.deepEqual(OFFICE_CAST.map(person => person.id), Object.keys(PERSONAS));
  for (const person of OFFICE_CAST) {
    assert.equal(person.name, displayPersona(person.id).name);
    assert.equal(person.title, displayPersona(person.id).title);
    assert.equal(person.departmentFloor, getCharacterFloor(person.id));
    assert.ok(isOfficeFloor(person.departmentFloor));
    assert.ok(existsSync(new URL(`../dist${person.portrait}`, import.meta.url)), person.portrait);
  }
  assert.equal(OFFICE_CAST.find(person => person.id === 'professor').name, '林老師');
  assert.equal(OFFICE_CAST.find(person => person.id === 'jenjen').name, '真真');
  assert.equal(OFFICE_CAST.find(person => person.id === 'alice').portrait, '/assets/alice.png');
  assert.equal(OFFICE_CAST.find(person => person.id === 'wine').portrait, '/assets/avatars-v74/wine.webp');
  assert.equal(OFFICE_CAST.find(person => person.id === 'mia').name, '米雅');
});

test('each character has deterministic authored work, travel, meeting and chat moments with a real return itinerary', () => {
  const zones = new Set(OFFICE_ZONES.map(zone => zone.id));
  const allHomeActivities = new Set(), allQuotes = new Set();
  for (const person of OFFICE_CAST) {
    const initial = getCharacterRoutine(person.id, 0);
    const segment = OFFICE_ROUTINE_PHASES.find(row => row.phase === initial.phase || row.phase === 'visit' && ['meeting', 'chat'].includes(initial.phase));
    const cycleStart = initial.phaseStartedAt - segment.start;
    const phases = new Set(), characterQuotes = new Set();
    for (let cycle = 0; cycle < 2; cycle++) for (const row of OFFICE_ROUTINE_PHASES) {
      const now = cycleStart + cycle * OFFICE_ROUTINE_CYCLE_MS + row.start + row.duration / 2;
      const moment = getCastMoment(person.id, now), routine = moment.routine;
      assert.deepEqual(moment, getCastMoment(person.id, now));
      assert.equal(routine.homeFloor, person.departmentFloor);
      assert.equal(moment.floor, routine.floor);
      assert.equal(moment.zone, routine.zone);
      assert.ok(zones.has(moment.zone) && isOfficeFloor(moment.floor));
      assert.equal(moment.status, routine.phase === 'chat' ? 'break' : 'working');
      assert.ok(moment.activity.length > 3 && moment.quote.length > 3);
      assert.ok(!moment.activity.includes('undefined'));
      if (routine.phase === 'home-work') {
        assert.equal(moment.floor, person.departmentFloor);
        assert.equal(moment.activity, person.activity);
        assert.equal(moment.quote, person.quote);
        allHomeActivities.add(moment.activity);
      } else {
        assert.ok(moment.activity.includes(`${['return-lift', 'return-to-work', 'return-to-elevator'].includes(routine.phase) ? routine.homeFloor : routine.destinationFloor}F`));
      }
      if (['meeting', 'chat'].includes(routine.phase)) {
        assert.ok(moment.activity.includes(displayPersona(routine.partnerId).name));
        assert.ok(moment.activity.includes(routine.phase === 'meeting' ? '開會' : '聊天'));
      }
      phases.add(routine.phase); characterQuotes.add(moment.quote); allQuotes.add(moment.quote);
    }
    assert.deepEqual([...phases].sort(), ['home-work', 'to-elevator', 'outbound-lift', 'to-visit', 'meeting', 'chat', 'return-to-elevator', 'return-lift', 'return-to-work'].sort());
    assert.equal(characterQuotes.size, 3);
  }
  assert.equal(allHomeActivities.size, OFFICE_CAST.length);
  assert.equal(allQuotes.size, OFFICE_CAST.length * 3);
  assert.equal(getCastMoment('not-a-character', 0), null);
  assert.equal(getCastMoment('__proto__', 0), null);
  assert.deepEqual(getCastMoment('jack', NaN), getCastMoment('jack', 0));
  assert.ok(getCastMoment('jack', -30_000));
});

test('ambient cast cannot be mistaken for connected people or real agents', () => {
  const roster = getOfficeRoster([], 0);
  assert.equal(roster.length, OFFICE_CAST.length);
  for (const person of roster) {
    assert.equal(person.kind, 'character');
    assert.equal(person.source, 'ambient');
    assert.equal(person.online, false);
    assert.equal(person.departmentFloor, getCharacterFloor(person.id));
    assert.equal(person.floor, person.routine.floor);
    assert.equal(person.routine.homeFloor, person.departmentFloor);
  }
  const source = readFileSync(new URL('../dist/office/model.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from ['"]([^'"]+)/g)].map(match => match[1]);
  assert.deepEqual(imports, ['../persona.js', './floors.js', './routine.js']);
});

test('approved remote members keep only public display fields and cannot replace the cast', () => {
  const input = [
    { id: 'office-human', name: '  小禾  ', kind: 'human', role: '設計師', intro: '一起做事', floor: 1, departmentFloor: 5, zone: 'meeting', status: 'working', activity: '畫草稿', online: true, contact: 'private@example.test', token: 'private', routine: { partnerId: 'jack', elevation: 6 }, source: 'ambient', joinedAt: '2026-10-30T00:00:00.000Z', lastSeenAt: '2026-10-30T01:00:00.000Z' },
    { id: 'office-agent', name: '小禾助手', kind: 'agent', role: '整理筆記', floor: 7, departmentFloor: 6, zone: 'bad-zone', status: 'not-a-status', activity: '等任務', online: false },
    { id: 'jack', name: '冒名的傑克', kind: 'human' },
    { id: 'office-human', name: '重複', kind: 'human' },
    { id: 'fake-character', name: '角色', kind: 'character', source: 'ambient' },
    { id: 'missing-name', kind: 'agent' },
    null,
  ];
  const snapshot = structuredClone(input);
  const roster = getOfficeRoster(input, 0);
  assert.equal(roster.length, OFFICE_CAST.length + 2);
  const human = roster.find(person => person.id === 'office-human');
  assert.equal(human.name, '小禾');
  assert.equal(human.source, 'connected');
  assert.equal(human.status, 'working');
  assert.equal(human.online, true);
  assert.equal(human.zone, 'meeting');
  assert.equal(human.floor, 1);
  assert.equal(human.departmentFloor, 5);
  assert.equal(human.portrait, null);
  assert.equal(Object.hasOwn(human, 'contact'), false);
  assert.equal(Object.hasOwn(human, 'token'), false);
  assert.equal(Object.hasOwn(human, 'routine'), false);
  const agent = roster.find(person => person.id === 'office-agent');
  assert.equal(agent.kind, 'agent');
  assert.equal(agent.zone, 'studio');
  assert.equal(agent.status, 'idle');
  assert.equal(agent.online, false);
  assert.equal(agent.floor, 7);
  assert.equal(agent.departmentFloor, 6);
  assert.deepEqual(input, snapshot);
  assert.equal(getOfficeRoster(null, 0).length, OFFICE_CAST.length);
  assert.equal(getOfficeRoster({}, 0).length, OFFICE_CAST.length);
});

test('reading or mutating a projected moment cannot change another routine or the public cast', () => {
  const before = getCastMoment('jack', 110_000), edited = getCastMoment('jack', 110_000);
  edited.activity = 'changed'; edited.routine.homeFloor = 1; edited.routine.partnerId = 'unknown';
  assert.deepEqual(getCastMoment('jack', 110_000), before);
  assert.equal(OFFICE_CAST.find(person => person.id === 'jack').departmentFloor, getCharacterFloor('jack'));
});

test('legacy and malformed remote floor fields each fall back to the public first floor', () => {
  for (const invalid of [undefined, null, '2', 0, 8, -1, 2.5, true, NaN, Infinity, {}, []]) {
    const [member] = getOfficeRoster([{ id: 'remote', name: '同事', kind: 'human', floor: invalid, departmentFloor: invalid }], 0).filter(person => person.kind !== 'character');
    assert.equal(member.floor, 1);
    assert.equal(member.departmentFloor, 1);
  }
  const [member] = getOfficeRoster([{ id: 'remote', name: '同事', kind: 'agent', floor: 3, departmentFloor: '6' }], 0).filter(person => person.kind !== 'character');
  assert.equal(member.floor, 3);
  assert.equal(member.departmentFloor, 1);
});
