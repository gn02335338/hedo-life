import { DEFAULT_OFFICE_FLOOR, OFFICE_FLOORS, isOfficeFloor } from './floors.js';

// Selects a viewing destination only; changing actual presence still requires
// the approved member's explicit elevator or status action.
export function adjacentOfficeFloor(currentFloor, direction, overview = false) {
  if (direction !== 'up' && direction !== 'down') throw new TypeError('Floor direction must be up or down.');
  if (typeof overview !== 'boolean') throw new TypeError('Overview must be a boolean.');
  const topFloor = OFFICE_FLOORS.length;
  // An overview tour starts at an edge, independent of the last viewed floor.
  if (overview) return direction === 'up' ? DEFAULT_OFFICE_FLOOR : topFloor;
  if (!isOfficeFloor(currentFloor)) throw new TypeError('The viewed floor must be an integer from 1 to 7.');
  return direction === 'up' ? Math.min(topFloor, currentFloor + 1) : Math.max(DEFAULT_OFFICE_FLOOR, currentFloor - 1);
}
