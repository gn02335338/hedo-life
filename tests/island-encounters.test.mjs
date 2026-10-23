import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../dist/island/encounters.js';
import { DISTRICTS } from '../dist/island/content.js';
import { PERSONAS, displayPersona } from '../dist/persona.js';

const expectedResidents = {
  lobby: 'wing', lab: 'jack', meeting: 'meimei', hr: 'hope', finance: 'janet',
  cafe: 'jonathan', plaza: 'captain', court: 'owen', harbor: 'cindy',
};
const hasText = value => typeof value === 'string' && value.trim().length > 0;

test('every walkable district has one distinct public resident with a usable display identity', () => {
  assert.equal(ENCOUNTERS.length, DISTRICTS.length);
  assert.equal(new Set(ENCOUNTERS.map(encounter => encounter.id)).size, ENCOUNTERS.length);
  assert.equal(new Set(ENCOUNTERS.map(encounter => encounter.districtId)).size, ENCOUNTERS.length);
  assert.deepEqual(Object.fromEntries(ENCOUNTERS.map(({ districtId, id }) => [districtId, id])), expectedResidents);
  for (const encounter of ENCOUNTERS) {
    const district = DISTRICTS.find(place => place.id === encounter.districtId);
    assert.ok(district, `${encounter.id}: existing map location`);
    assert.ok(district.people.includes(encounter.id), `${encounter.id}: resident belongs to the location`);
    assert.ok(Object.hasOwn(PERSONAS, encounter.id), `${encounter.id}: public persona`);
    const person = displayPersona(encounter.id);
    assert.ok(hasText(person?.name), `${encounter.id}: public display name`);
    assert.ok(hasText(person?.image), `${encounter.id}: public portrait`);
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

test('each encounter has two or three distinct choices whose responses remain separately revealable', () => {
  const responses = new Set();
  for (const { id, greeting, title, opening, choices } of ENCOUNTERS) {
    assert.ok(Array.isArray(choices) && choices.length >= 2 && choices.length <= 3, `${id}: bounded conversation choices`);
    assert.equal(new Set(choices.map(choice => choice.label)).size, choices.length, `${id}: distinguishable choices`);
    const beforeSelection = [greeting, title, opening, ...choices.map(choice => choice.label)].join('\n');
    for (const choice of choices) {
      assert.ok(hasText(choice.label), `${id}: choice label`);
      assert.ok(hasText(choice.response), `${id}: selected response`);
      assert.notEqual(choice.label, choice.response, `${id}: a choice is not its own outcome`);
      assert.ok(!beforeSelection.includes(choice.response), `${id}: response not exposed in pre-choice copy`);
      assert.ok(!responses.has(choice.response), `${id}: each choice has its own response`);
      responses.add(choice.response);
    }
  }
});
