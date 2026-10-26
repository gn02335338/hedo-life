import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS, TOUR } from '../dist/island/content.js';
import { PERSONAS } from '../dist/persona.js';
import { PLACES, PLACE_BY_ID } from '../dist/island/places.js';
import { ISLAND_CAST } from '../dist/island/cast.js';

const expectedIds = ['lobby', 'lab', 'meeting', 'hr', 'finance', 'cafe', 'plaza', 'court', 'harbor'];
const expectedNames = ['經營總部', '創研園區', '品牌學苑', '人事行政館', '財會中心', '共享生活館', '商務聚落', '下班球場', '夜色碼頭'];
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const hasText = value => typeof value === 'string' && value.trim().length > 0;

test('island offers nine distinct, fully described districts with public residents', () => {
  assert.deepEqual(DISTRICTS.map(place => place.id), expectedIds);
  assert.deepEqual(DISTRICTS.map(place => place.name), expectedNames);
  assert.equal(new Set(DISTRICTS.map(place => place.id)).size, 9);
  for (const [index, place] of DISTRICTS.entries()) {
    assert.equal(place.number, String(index + 1).padStart(2, '0'));
    for (const key of ['name', 'kicker', 'summary']) assert.ok(hasText(place[key]), `${place.id}.${key}`);
    assert.match(place.color, /^#[\da-f]{6}$/i);
    assert.match(place.time, timePattern);
    assert.ok(place.people.length >= 1 && place.people.length <= 3);
    assert.equal(new Set(place.people).size, place.people.length);
    for (const id of place.people) assert.ok(Object.hasOwn(PERSONAS, id), `${place.id}: nonpublic resident ${id}`);
    assert.ok(place.tags.length >= 2 && place.tags.length <= 5);
    assert.ok(place.tags.every(hasText));
    assert.ok(['department', 'shared', 'afterwork'].includes(place.category));
    for (const id of place.people) assert.equal(ISLAND_CAST.find(person => person.id === id).districtId, place.id, 'featured colleague is physically present');
  }
});

test('23 distinct places cover the requested17 departments,3 shared spaces and3 after-work stops', () => {
  const expected = {
    lobby: ['總經理室', '董事長室'], lab: ['研發中心', '產品開發', 'MIS資訊服務', '產品設計', '專案管理'],
    plaza: ['商務開發', '電商業務', '廣告業務'], meeting: ['行銷', '教育訓練'], finance: ['財務部', '會計部'],
    hr: ['人資部', '行政部', '法務部'], cafe: ['會議室', '茶水間', '福委會'], court: ['球場'], harbor: ['居酒屋', '阿良的神秘行程'],
  };
  assert.equal(PLACES.length, 23); assert.equal(PLACE_BY_ID.size, 23); assert.equal(new Set(PLACES.map(place => place.id)).size, 23);
  assert.deepEqual(PLACES.reduce((counts, place) => { counts[place.category]++; return counts; }, { department: 0, shared: 0, afterwork: 0 }), { department: 17, shared: 3, afterwork: 3 });
  for (const district of DISTRICTS) {
    const places = PLACES.filter(place => place.districtId === district.id);
    assert.deepEqual(places.map(place => place.name), expected[district.id]);
    for (const place of places) {
      assert.equal(place.category, district.category); assert.equal(PLACE_BY_ID.get(place.id), place);
      assert.ok(place.tags.includes(place.name), `${place.id}: full requested term stays searchable`);
      assert.ok(district.tags.includes(place.name), `${place.id}: district search also finds its unit`);
      assert.ok(hasText(place.shortName) && hasText(place.summary)); assert.match(place.id, /^[a-z]+(?:-[a-z]+)*$/);
      assert.deepEqual(Object.keys(place).sort(), ['category', 'districtId', 'id', 'name', 'shortName', 'story', 'summary', 'tags']);
      assert.ok(Object.isFrozen(place) && Object.isFrozen(place.story) && Object.isFrozen(place.story.choices));
    }
  }
});

test('all69 new place responses remain separate from public openings and choice labels', () => {
  const titles = new Set(), responses = new Set();
  for (const { id, story } of PLACES) {
    assert.ok(hasText(story.title) && hasText(story.opening)); assert.ok(!titles.has(story.title)); titles.add(story.title);
    assert.equal(story.choices.length, 3); assert.equal(new Set(story.choices.map(choice => choice.label)).size, 3);
    const visible = [story.title, story.opening, ...story.choices.map(choice => choice.label)].join('\n');
    for (const choice of story.choices) {
      assert.deepEqual(Object.keys(choice).sort(), ['label', 'response']);
      assert.ok(hasText(choice.label) && hasText(choice.response)); assert.ok(!visible.includes(choice.response), `${id}: response is not revealed before choice`);
      assert.ok(!responses.has(choice.response)); responses.add(choice.response); assert.ok(Object.isFrozen(choice));
    }
  }
  assert.equal(responses.size, 69);
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
