import test from 'node:test';
import assert from 'node:assert/strict';
import { directionFrame } from '../dist/arpg/art-layer.js';

// A camera southeast of the actor sees the actor's front when it faces SE.
// Walking toward the screen's right must select the right-facing atlas cell.
const bearing = Math.atan2(17, -22);
const rightHeading = Math.atan2(22, 17);

test('eight-direction art faces toward its actual screen-space movement', () => {
  assert.equal(directionFrame(bearing, bearing), 0);
  assert.equal(directionFrame(rightHeading, bearing), 2);
  assert.equal(directionFrame(bearing + Math.PI, bearing), 4);
  assert.equal(directionFrame(rightHeading + Math.PI, bearing), 6);
});

test('four-direction monsters use front, right, back and left in the same orientation', () => {
  assert.equal(directionFrame(bearing, bearing, 4), 0);
  assert.equal(directionFrame(rightHeading, bearing, 4), 1);
  assert.equal(directionFrame(bearing + Math.PI, bearing, 4), 2);
  assert.equal(directionFrame(rightHeading + Math.PI, bearing, 4), 3);
});

test('direction selection wraps full turns without flipping at zero', () => {
  for (const count of [4, 8]) {
    for (let cell = 0; cell < count; cell++) {
      const heading = bearing - cell * Math.PI * 2 / count;
      for (const turns of [-3, -1, 0, 1, 3]) assert.equal(directionFrame(heading + turns * Math.PI * 2, bearing, count), cell);
    }
  }
});
