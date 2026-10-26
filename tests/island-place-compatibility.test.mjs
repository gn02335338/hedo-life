import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS } from '../dist/island/content.js';
import { PLACES } from '../dist/island/places.js';
import { normalizeResidents, RESIDENT_POSITIONS } from '../dist/island/residents.js';
import { STORAGE_KEY, readProgress, writeProgress } from '../dist/island/progress.js';
import { reviewQueueHTML } from '../dist/island/review/review.js';
import { ISLAND_DISTRICTS, ISLAND_LIMITS, validateIslandApplication } from '../worker/island-applications.js';

// These are existing storage/API identifiers. New locations are children, not replacements.
const districts = {
  lobby: '經營總部', lab: '創研園區', meeting: '品牌學苑', hr: '人事行政館',
  finance: '財會中心', cafe: '共享生活館', plaza: '商務聚落', court: '下班球場', harbor: '夜色碼頭',
};
const profile = {
  nickname: '測試島民', outfit: 'teal', greeting: '今天一起在島上散步',
  introduction: '喜歡看看海,也喜歡和大家聊聊日常。',
};
const request = districtId => ({
  version: 1, submissionId: '122b91db-791b-4b4c-9180-93e5dcfdb211', districtId,
  ...profile, reason: '希望在工作空檔與大家分享島上的日常。', consent: true,
});

test('renamed districts preserve all existing application identifiers and do not turn places into resident districts', () => {
  assert.deepEqual(Object.fromEntries(DISTRICTS.filter(d => d.category !== 'special').map(({ id, name }) => [id, name])), districts);
  assert.deepEqual(ISLAND_DISTRICTS, Object.keys(districts));
  assert.equal(ISLAND_LIMITS.residentsPerDistrict, 3);
  for (const district of DISTRICTS.filter(d => d.category === 'special')) {
    assert.throws(() => validateIslandApplication(request(district.id)), error => error.code === 'invalid_island_application');
  }
  for (const districtId of Object.keys(districts)) assert.equal(validateIslandApplication(request(districtId)).districtId, districtId);
  for (const place of PLACES) {
    assert.ok(DISTRICTS.some(district => district.id === place.districtId), `${place.id} has a stable parent`);
    assert.throws(() => validateIslandApplication(request(place.id)), error => error.code === 'invalid_island_application');
    assert.throws(() => validateIslandApplication({ ...request(place.districtId), placeId: place.id }), error => error.code === 'invalid_island_application');
  }
});

test('all 27 previously approved resident slots survive district renaming without a new response schema', () => {
  const residents = Object.keys(districts).flatMap((districtId, districtIndex) => Array.from({ length: 3 }, (_, slot) => ({
    id: `00000000-0000-4000-8000-${String(districtIndex * 3 + slot + 1).padStart(12, '0')}`,
    ...profile, districtId, slot,
  })));
  assert.deepEqual(normalizeResidents({ version: 1, residents }), residents);
  for (const resident of residents) {
    const point = RESIDENT_POSITIONS[resident.districtId][resident.slot];
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z), `${resident.districtId}:${resident.slot} retains a scene position`);
  }
});

test('existing reviewer receipts display new public district names while retaining their original IDs', () => {
  for (const [districtId, name] of Object.entries(districts)) {
    const item = {
      ...request(districtId), id: '122b91db-791b-4b4c-9180-93e5dcfdb211', status: 'approved',
      reviewNote: '', createdAt: '2026-10-24T01:00:00.000Z', reviewedAt: '2026-10-24T02:00:00.000Z',
    };
    const html = reviewQueueHTML({ items: [item], notes: new Map() });
    assert.ok(html.includes(`${name} ·`), `existing ${districtId} receipt uses ${name}`);
    assert.ok(html.includes(`data-id="${item.id}"`));
    assert.match(html, /撤銷核准並移出小島/);
  }
});

test('new place memories cannot enter the legacy passport or overwrite career and anonymous identity data', () => {
  const legacy = { version: 1, visited: ['lobby', 'lab', 'cafe'], choices: { lobby: 2, lab: 0, cafe: 1 } };
  const data = new Map([
    [STORAGE_KEY, JSON.stringify(legacy)], ['hedo-anonymous-v1', 'a'.repeat(64)],
    ['hedo-life-v1', '{"test":"unchanged career bytes"}'],
  ]);
  const writes = [];
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes.push(key); data.set(key, value); } };
  const progress = readProgress(storage);
  // A future caller accidentally passes its session-only place collection to the writer.
  progress.visited.push(...PLACES.map(place => place.id));
  Object.assign(progress.choices, Object.fromEntries(PLACES.map(place => [place.id, 2])));
  progress.placeVisits = PLACES.map(place => place.id);
  assert.equal(writeProgress(storage, progress), true);
  assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)), legacy, 'legacy district response indexes retain their exact meaning and value');
  assert.deepEqual(writes, [STORAGE_KEY]);
  assert.equal(data.get('hedo-anonymous-v1'), 'a'.repeat(64));
  assert.equal(data.get('hedo-life-v1'), '{"test":"unchanged career bytes"}');
});
