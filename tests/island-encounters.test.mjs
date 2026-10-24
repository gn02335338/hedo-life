import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { ENCOUNTERS } from '../dist/island/encounters.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { DISTRICTS } from '../dist/island/content.js';
import { PERSONAS, displayPersona } from '../dist/persona.js';
import { CHARACTER_IDS } from '../dist/character-stats.js';

const originalResidents = {
  lobby: 'wing', lab: 'jack', meeting: 'meimei', hr: 'hope', finance: 'janet',
  cafe: 'jonathan', plaza: 'captain', court: 'owen', harbor: 'cindy',
};
const hasText = value => typeof value === 'string' && value.trim().length > 0;

test('the island cast exactly covers the public character book with valid names and portraits', async () => {
  assert.deepEqual(ISLAND_CAST.map(person => person.id), CHARACTER_IDS, 'same public cast and order as the character book');
  assert.deepEqual(ISLAND_CAST.map(person => person.id), Object.keys(PERSONAS), 'no hidden or community-only identities');
  assert.equal(new Set(ISLAND_CAST.map(person => person.id)).size, ISLAND_CAST.length);
  const districts = new Set(DISTRICTS.map(place => place.id));
  for (const person of ISLAND_CAST) {
    assert.deepEqual(Object.keys(person).sort(), ['districtId', 'id'], `${person.id}: display identity is not copied into location data`);
    assert.ok(districts.has(person.districtId), `${person.id}: existing map location`);
    const display = displayPersona(person.id);
    assert.ok(hasText(display?.name), `${person.id}: public display name`);
    assert.ok(hasText(display?.about), `${person.id}: public introduction`);
    assert.ok(hasText(display?.image), `${person.id}: public portrait path`);
    await access(new URL(`../dist/${display.image}`, import.meta.url));
  }
});

test('every public character has one encounter at their mapped home, preserving the original nine', () => {
  assert.equal(ENCOUNTERS.length, ISLAND_CAST.length);
  assert.equal(new Set(ENCOUNTERS.map(encounter => encounter.id)).size, ENCOUNTERS.length);
  assert.deepEqual(ENCOUNTERS.map(({ id }) => id).sort(), [...CHARACTER_IDS].sort());
  const homes = new Map(ISLAND_CAST.map(({ id, districtId }) => [id, districtId]));
  for (const encounter of ENCOUNTERS) {
    assert.equal(encounter.districtId, homes.get(encounter.id), `${encounter.id}: scene and conversation share a district`);
    assert.deepEqual(Object.keys(encounter).sort(), ['choices', 'districtId', 'greeting', 'id', 'opening', 'title'], `${encounter.id}: conversation data has no career effects or private profile fields`);
  }
  for (const [districtId, id] of Object.entries(originalResidents)) {
    assert.equal(homes.get(id), districtId, `${id}: original home stays in place`);
    assert.equal(ENCOUNTERS.find(encounter => encounter.id === id)?.districtId, districtId);
  }
});

test('encounters provide short proximity prompts and distinct scenes separate from district stories', () => {
  const titles = new Set();
  const openings = new Set();
  const districtStories = new Set(DISTRICTS.flatMap(place => [place.story.title, place.story.opening]));
  for (const encounter of ENCOUNTERS) {
    for (const field of ['greeting', 'title', 'opening']) {
      assert.ok(hasText(encounter[field]), `${encounter.id}.${field}: readable text`);
      assert.equal(encounter[field], encounter[field].trim(), `${encounter.id}.${field}: no invisible padding`);
    }
    assert.ok([...encounter.greeting].length <= 28, `${encounter.id}: proximity prompt fits a small control`);
    assert.ok(!titles.has(encounter.title), `${encounter.id}: distinct scene title`);
    assert.ok(!openings.has(encounter.opening), `${encounter.id}: distinct scene opening`);
    assert.ok(!districtStories.has(encounter.title) && !districtStories.has(encounter.opening), `${encounter.id}: a new walking encounter`);
    titles.add(encounter.title);
    openings.add(encounter.opening);
  }
});

test('each encounter has three distinct choices whose responses remain separately revealable', () => {
  const responses = new Set();
  for (const { id, greeting, title, opening, choices } of ENCOUNTERS) {
    assert.ok(Array.isArray(choices) && choices.length === 3, `${id}: three conversation choices`);
    assert.equal(new Set(choices.map(choice => choice.label)).size, choices.length, `${id}: distinguishable choices`);
    const beforeSelection = [greeting, title, opening, ...choices.map(choice => choice.label)].join('\n');
    for (const choice of choices) {
      assert.deepEqual(Object.keys(choice).sort(), ['label', 'response'], `${id}: no stats, gates, endings or career mutations`);
      assert.ok(hasText(choice.label), `${id}: choice label`);
      assert.ok(hasText(choice.response), `${id}: selected response`);
      assert.notEqual(choice.label, choice.response, `${id}: a choice is not its own outcome`);
      assert.ok(!beforeSelection.includes(choice.response), `${id}: response not exposed in pre-choice copy`);
      assert.ok(!responses.has(choice.response), `${id}: each choice has its own response`);
      responses.add(choice.response);
    }
  }
});
