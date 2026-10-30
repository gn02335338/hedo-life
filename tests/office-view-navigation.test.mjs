import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentOfficeFloor } from '../dist/office/view-navigation.js';

test('a floor tour starts from each overview edge and stops at the building boundaries without wrapping', () => {
  let floor = adjacentOfficeFloor(null, 'up', true);
  const upwards = [floor];
  for (let step = 0; step < 7; step++) upwards.push(floor = adjacentOfficeFloor(floor, 'up'));
  assert.deepEqual(upwards, [1, 2, 3, 4, 5, 6, 7, 7]);
  floor = adjacentOfficeFloor(null, 'down', true);
  const downwards = [floor];
  for (let step = 0; step < 7; step++) downwards.push(floor = adjacentOfficeFloor(floor, 'down'));
  assert.deepEqual(downwards, [7, 6, 5, 4, 3, 2, 1, 1]);
});

test('overview navigation ignores the last selected floor while a selected floor moves one level', () => {
  assert.equal(adjacentOfficeFloor(6, 'up', true), 1);
  assert.equal(adjacentOfficeFloor(2, 'down', true), 7);
  assert.equal(adjacentOfficeFloor(4, 'up'), 5);
  assert.equal(adjacentOfficeFloor(4, 'down'), 3);
});

test('floor navigation rejects invalid selected floors and ambiguous controls instead of coercing them', () => {
  for (const floor of [0, 8, -1, 1.5, '2', null, undefined, true, {}, NaN, Infinity]) {
    assert.throws(() => adjacentOfficeFloor(floor, 'up'), TypeError);
    assert.throws(() => adjacentOfficeFloor(floor, 'down'), TypeError);
  }
  for (const direction of ['UP', 'next', '', 1, null, undefined]) {
    assert.throws(() => adjacentOfficeFloor(4, direction), TypeError);
    assert.throws(() => adjacentOfficeFloor(4, direction, true), TypeError);
  }
  for (const overview of ['all', 1, null]) assert.throws(() => adjacentOfficeFloor(4, 'up', overview), TypeError);
});
