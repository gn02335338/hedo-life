// Original outdoor workshop. The forecourt and service markings sit flush with
// the road; every tall fixture hugs the solid building wall, outside the bay
// and the two sidewalk routes. There is no hidden indoor transition.
export function addGarageVisuals({ building: b, location, box, cylinder, M, wall, sign }) {
  const front = b.z - b.d / 2, roof = b.h;
  // The smaller building keeps a narrow raised sidewalk for pedestrians; it
  // begins behind z24.85 and never crosses the z0→18 service approach.
  box(M.sidewalk, b.x, .17, b.z, b.w + 2, .34, b.d + 2);
  box(M.curb, b.x, .25, b.z, b.w + 2.3, .16, b.d + 2.3);
  // The shell exactly follows the shared BUILDINGS footprint. A distinct low
  // industrial roof replaces the ordinary block's podium and tower.
  box(wall, b.x, roof / 2, b.z, b.w, roof, b.d);
  box(M.roof, b.x, roof + .12, b.z, b.w + .2, .24, b.d + .2);
  for (const side of [-1, 1]) {
    box(M.metal, b.x + side * (b.w / 2 - .16), roof + .36, b.z, .22, .46, b.d);
    box(M.metal, b.x, roof + .36, b.z + side * (b.d / 2 - .16), b.w, .46, .22);
    box(M.teal, b.x + side * (b.w / 2 - .2), 4.55, front - .08, .24, 8.5, .16, 0, false);
  }
  for (const x of [-8, 8]) {
    box(M.roof, b.x + x, roof + .48, b.z + 2, 4.2, .7, 4.5);
    for (let i = -2; i <= 2; i++) box(M.metal, b.x + x + i * .62, roof + .85, b.z + 2, .18, .06, 3.7, 0, false);
  }

  // Closed north-facing roller door, small clerestory and shallow canopy. The
  // actual servicing point is the open-air painted bay, eight metres in front.
  box(M.metal, b.x, 2.65, front - .06, 11, 5.3, .12);
  for (let row = 0; row < 12; row++) box(M.roof, b.x, .25 + row * .42, front - .135, 10.75, .055, .025, 0, false);
  box(M.glass, b.x, 4.25, front - .15, 9.8, .65, .03, 0, false);
  for (let i = -3; i <= 3; i++) box(M.white, b.x + i * 1.45, 4.25, front - .175, .055, .68, .025, 0, false);
  box(M.roof, b.x, 5.55, front - .5, 12.2, .24, 1.1);
  box(M.lit, b.x, 5.37, front - .6, 10.8, .055, .08, 0, false);
  box(M.teal, b.x, 5.6, front - 1.06, 12.2, .13, .05, 0, false);

  // A parked lift and tool station are pressed against the closed facade.
  // Their maximum .35m projection fits inside the existing .45m pedestrian
  // collision clearance; nothing tall is placed in the driveable forecourt.
  box(M.metal, b.x - 11.2, 2.6, front - .045, 8.2, 5.2, .09);
  for (const x of [-14, -8.4]) {
    box(M.teal, b.x + x, 2.45, front - .18, .38, 4.9, .26);
    box(M.roof, b.x + x, .12, front - .18, .8, .2, .3);
    box(M.metal, b.x + x, 2.45, front - .325, .13, 4.15, .025, 0, false);
    box(M.yellow, b.x + x, .65, front - .34, .4, .46, .025, 0, false);
  }
  box(M.teal, b.x - 11.2, 4.9, front - .18, 5.95, .26, .26);
  for (const x of [-13.7, -8.7]) box(M.roof, b.x + x, .47, front - .23, 1.2, .14, .24);
  box(M.white, b.x - 14, 1.55, front - .335, .28, .42, .03, 0, false);
  box(M.red, b.x - 14, 1.62, front - .36, .1, .1, .025, 0, false);
  box(M.metal, b.x + 11.3, 3.1, front - .05, 8.5, 4.7, .1);
  box(M.roof, b.x + 10.2, 1, front - .17, 4.1, 1.7, .28);
  for (let row = 0; row < 4; row++) {
    box(M.metal, b.x + 10.2, .4 + row * .38, front - .32, 3.8, .026, .025, 0, false);
    box(M.white, b.x + 10.2, .55 + row * .38, front - .34, 1.2, .04, .025, 0, false);
  }
  box(M.roof, b.x + 10, 3.45, front - .13, 4.5, 1.7, .14);
  for (let i = 0; i < 6; i++) {
    box(M.white, b.x + 8.3 + i * .62, 3.45, front - .22, .075, .7 - i % 3 * .1, .025, 0, false);
    box(M.white, b.x + 8.3 + i * .62, 3.82 - i % 3 * .05, front - .22, .22, .12, .025, 0, false);
  }
  for (let i = 0; i < 4; i++) cylinder(M.metal, b.x + 14.8, .16 + i * .28, front + .12, .42, .24);
  box(M.yellow, b.x + 14.8, 1.5, front - .1, .66, .2, .24);

  // Markings are road-height geometry, not a raised curb or collision shape.
  box(M.sidewalk, b.x, -.015, 17.5, 42, .035, 17, 0, false);
  box(M.roof, location.x, .008, location.z, 6, .012, 9, 0, false);
  for (const side of [-1, 1]) {
    box(M.teal, location.x + side * 3, .024, location.z, .14, .025, 9, 0, false);
    box(M.teal, location.x, .024, location.z + side * 4.5, 6.1, .025, .14, 0, false);
    // A wide central driveway remains open from the street to the bay.
    for (let i = 0; i < 4; i++) box(M.white, b.x + side * (5 + i * 1.5), .025, 11.2, .11, .025, 2.4, -.55, false);
  }
  box(M.white, location.x, .026, 10.7, .2, .028, 2, 0, false);
  box(M.white, location.x - .45, .026, 11.2, .18, .028, 1.2, .75, false);
  box(M.white, location.x + .45, .026, 11.2, .18, .028, 1.2, -.75, false);

  const brand = sign('禾多修車廠', 'HEDO MOTOR WORKS  /  REPAIR · PAINT · TUNE', 23.5, 3.05, '#f1e4c9', '#264e52');
  brand.name = 'garage-brand'; brand.position.set(b.x, 7.35, front - .16); brand.rotation.y = Math.PI;
  const bayLabel = sign('SERVICE 01', '停入服務格  /  PARK HERE', 5.1, 1.45, '#bce4d0', '#3f5557');
  bayLabel.name = 'garage-service-bay'; bayLabel.position.set(location.x, .042, location.z + 2.8); bayLabel.rotation.x = -Math.PI / 2;
  // The floor text faces the approaching driver (heading PI, travelling +Z).
  bayLabel.rotation.z = Math.PI;
  const service = sign('修車 · 改色 · 調校', 'OPEN / DRIVE IN', 7.4, 1.2, '#bce4d0', '#264e52');
  service.name = 'garage-services'; service.position.set(b.x + 11.3, 5.7, front - .17); service.rotation.y = Math.PI;
}
