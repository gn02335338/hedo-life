import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, TOUR } from '../dist/island/content.js';
import { PERSONAS } from '../dist/persona.js';

const expectedIds = ['lobby', 'lab', 'meeting', 'hr', 'finance', 'cafe', 'plaza', 'court', 'harbor'];
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const hasText = value => typeof value === 'string' && value.trim().length > 0;

test('island offers nine distinct, fully described districts with public residents', () => {
  assert.deepEqual(DISTRICTS.map(place => place.id), expectedIds);
  assert.equal(new Set(DISTRICTS.map(place => place.id)).size, 9);
  for (const [index, place] of DISTRICTS.entries()) {
    assert.equal(place.number, String(index + 1).padStart(2, '0'));
    for (const key of ['name', 'kicker', 'summary']) assert.ok(hasText(place[key]), `${place.id}.${key}`);
    assert.match(place.color, /^#[\da-f]{6}$/i);
    assert.match(place.time, timePattern);
    assert.ok(place.people.length >= 1 && place.people.length <= 3);
    assert.equal(new Set(place.people).size, place.people.length);
    for (const id of place.people) assert.ok(Object.hasOwn(PERSONAS, id), `${place.id}: nonpublic resident ${id}`);
    assert.ok(place.tags.length >= 2 && place.tags.length <= 3);
    assert.ok(place.tags.every(hasText));
  }
});

test('every island story supplies three distinct choices and separately revealable responses', () => {
  for (const { id, story } of DISTRICTS) {
    assert.ok(hasText(story?.title), `${id}: title`);
    assert.ok(hasText(story?.opening), `${id}: opening`);
    assert.equal(story.choices.length, 3, `${id}: choices`);
    assert.equal(new Set(story.choices.map(choice => choice.label)).size, 3);
    for (const { label, response } of story.choices) {
      assert.ok(hasText(label), `${id}: label`);
      assert.ok(hasText(response), `${id}: response`);
      assert.notEqual(label, response);
      assert.ok(!story.opening.includes(response), `${id}: response is not in the opening`);
    }
  }
});

test('district links and chronological day tour point to existing island locations', () => {
  const ids = new Set(DISTRICTS.map(place => place.id));
  for (const place of DISTRICTS) {
    assert.equal(place.related.length, 2);
    assert.equal(new Set(place.related).size, 2);
    for (const id of place.related) {
      assert.ok(ids.has(id), `${place.id}: unknown related district ${id}`);
      assert.notEqual(id, place.id);
    }
  }
  assert.equal(TOUR.length, 6);
  assert.equal(new Set(TOUR.map(stop => stop.districtId)).size, 6);
  for (const [index, stop] of TOUR.entries()) {
    assert.ok(ids.has(stop.districtId), `unknown tour district ${stop.districtId}`);
    assert.match(stop.hour, timePattern);
    assert.ok(hasText(stop.label));
    assert.ok(hasText(stop.note));
    if (index) assert.ok(stop.hour > TOUR[index - 1].hour, 'tour stops move forward through the day');
  }
});
