// Original private motor club. All tall fixtures sit against the closed facade;
// the outdoor retrieval bay and the road approach have only flush markings.
export function addCollectionVisuals({ building: b, location, box, M, wall, accent, sign }) {
  const front = b.z - b.d / 2;
  box(M.sidewalk, b.x, .17, b.z, b.w + 2, .34, b.d + 2);
  box(M.curb, b.x, .25, b.z, b.w + 2.3, .16, b.d + 2.3);
  box(wall, b.x, b.h / 2, b.z, b.w, b.h, b.d);
  box(M.roof, b.x, b.h + .12, b.z, b.w + .2, .24, b.d + .2);
  for (const side of [-1, 1]) {
    box(M.metal, b.x + side * (b.w / 2 - .16), b.h + .35, b.z, .22, .44, b.d);
    box(M.metal, b.x, b.h + .35, b.z + side * (b.d / 2 - .16), b.w, .44, .22);
    box(accent, b.x + side * (b.w / 2 - .2), 4.5, front - .08, .22, 8.4, .16, 0, false);
    // Two distinct closed garage doors; collection remains an outdoor action.
    const doorX = b.x + side * 7;
    box(M.metal, doorX, 2.55, front - .06, 10.4, 5.1, .12);
    for (let row = 0; row < 12; row++) box(M.roof, doorX, .2 + row * .41, front - .135, 10.15, .055, .025, 0, false);
    box(M.glass, doorX, 4.02, front - .15, 9.45, .7, .03, 0, false);
    for (let i = -3; i <= 3; i++) box(M.white, doorX + i * 1.4, 4.02, front - .175, .055, .73, .025, 0, false);
    box(M.roof, doorX, 5.4, front - .4, 11.4, .2, .9);
    box(accent, doorX, 5.4, front - .86, 11.4, .12, .04, 0, false);
    box(M.lit, doorX, 5.27, front - .42, 9.6, .045, .07, 0, false);
    // Slim wall-mounted access panels do not enter either sidewalk route.
    box(M.metal, b.x + side * 13.4, 1.45, front - .11, .55, .9, .2);
    box(accent, b.x + side * 13.4, 1.62, front - .22, .3, .27, .025, 0, false);
  }
  box(M.roof, b.x, b.h + .43, b.z + 3, 5.4, .6, 4.5);
  for (let i = -3; i <= 3; i++) box(M.metal, b.x + i * .65, b.h + .75, b.z + 3, .17, .055, 3.7, 0, false);

  // A 17m-deep forecourt leaves the entire north approach, bay and safe exit
  // position (bay.x + 4, bay.z) free of raised geometry or decorative vehicles.
  box(M.sidewalk, b.x, -.015, front - 8.5, 42, .035, 17, 0, false);
  box(M.roof, location.x, .008, location.z, 6, .012, 9, 0, false);
  for (const side of [-1, 1]) {
    box(accent, location.x + side * 3, .024, location.z, .14, .025, 9, 0, false);
    box(accent, location.x, .024, location.z + side * 4.5, 6.1, .025, .14, 0, false);
    for (let i = 0; i < 4; i++) box(M.white, b.x + side * (5 + i * 1.5), .025, front - 14.8, .11, .025, 2.4, -.55, false);
  }
  // The departing owned car faces north, toward the street at z60.
  box(accent, location.x, .026, front - 15.2, .19, .028, 2, 0, false);
  box(accent, location.x - .43, .026, front - 15.7, .18, .028, 1.15, -.75, false);
  box(accent, location.x + .43, .026, front - 15.7, .18, .028, 1.15, .75, false);

  const brand = sign('HEDO MOTOR CLUB', 'PRIVATE GARAGE  /  私人車庫', 29, 3.05, '#eadcf3', '#453d58');
  brand.name = 'collection-brand'; brand.position.set(b.x, 7.25, front - .16); brand.rotation.y = Math.PI;
  const bay = sign('YOUR NEXT DRIVE', '私人取車格  /  COLLECTION', 5.2, 1.4, '#e3cfef', '#514b60');
  bay.name = 'collection-retrieval-bay'; bay.position.set(location.x, .042, location.z + 2.8);
  bay.rotation.x = -Math.PI / 2; bay.rotation.z = Math.PI;
  const entrance = sign('私人車庫', 'MEMBERS / DRIVE OUT', 4.5, 1.35, '#eadcf3', '#5c4d70');
  entrance.name = 'collection-entrance'; entrance.position.set(b.x - 14.8, 5.75, front - .17); entrance.rotation.y = Math.PI;
}
