import { ISLAND_VISITOR_LOOK, getIslandCharacterLook } from './character-looks.js';

// One small, rounded paper-doll style for the visitor and every colleague.
// The illustration informs colours and features; the arena never pastes it in.
const ellipse = (ctx, x, y, rx, ry, fill) => {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
};
function box(ctx, x, y, width, height, radius, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r); ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}
function path(ctx, points, fill) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function label(ctx, value, x, y, color) {
  ctx.font = '700 18px "PingFang TC", "Noto Sans TC", sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 5; ctx.strokeStyle = '#f8f4e5'; ctx.lineJoin = 'round'; ctx.strokeText(value, x, y);
  ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function glasses(ctx, type, y = -111) {
  ctx.strokeStyle = '#48554e'; ctx.lineWidth = 2;
  for (const x of [-10, 10]) {
    if (type === 'round') { ctx.beginPath(); ctx.ellipse(x, y, 8, 7, 0, 0, Math.PI * 2); ctx.stroke(); }
    else { box(ctx, x - 8, y - 6, 16, 12, 3, type === 'sunglasses' ? '#3b4c49' : null); ctx.stroke(); }
  }
  ctx.beginPath(); ctx.moveTo(-2, y); ctx.lineTo(2, y); ctx.moveTo(-25, y - 2); ctx.lineTo(-19, y); ctx.moveTo(19, y); ctx.lineTo(25, y - 2); ctx.stroke();
}
function head(ctx, look, direction) {
  const props = look.accessories;
  ellipse(ctx, -24, -109, 4, 7, look.skin); ellipse(ctx, 24, -109, 4, 7, look.skin);
  ellipse(ctx, 0, -111, 25, 28, look.skin);
  // Hair remains simple solid shapes, just like the visitor's hiking-hat face.
  if (look.hairStyle !== 'bald') {
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(0, -117, 26, Math.PI, 0);
    if (look.hairStyle === 'swept') {
      ctx.lineTo(25, -108); ctx.lineTo(15, -123); ctx.lineTo(-2, -117); ctx.lineTo(4, -129); ctx.lineTo(-22, -113);
    } else if (look.hairStyle === 'crop') {
      ctx.lineTo(24, -119); ctx.lineTo(-24, -119);
    } else if (look.hairStyle === 'bob') {
      ctx.lineTo(26, -95); ctx.lineTo(19, -96); ctx.lineTo(19, -119); ctx.lineTo(-18, -115); ctx.lineTo(-20, -94); ctx.lineTo(-27, -97);
    } else {
      ctx.lineTo(25, -109); ctx.lineTo(16, -120); ctx.lineTo(0, -116); ctx.lineTo(-9, -123); ctx.lineTo(-23, -111);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ellipse(ctx, -23, -117, 4, 10, look.hair); ellipse(ctx, 23, -117, 4, 10, look.hair);
  }
  const faceShift = direction * 3;
  for (const x of [-8, 9]) ellipse(ctx, x + faceShift, -110, 2.4, 2.8, '#344b43');
  ellipse(ctx, faceShift - 16, -102, 4, 2, '#d89c7b35'); ellipse(ctx, faceShift + 16, -102, 4, 2, '#d89c7b35');
  ctx.strokeStyle = '#a77256'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(faceShift - 3, -98); ctx.quadraticCurveTo(faceShift + 2, -95, faceShift + 7, -99); ctx.stroke();
  if (look.glasses !== 'none') glasses(ctx, look.glasses);
  if (props.includes('sunglasses')) glasses(ctx, 'sunglasses', -132);
  if (props.includes('mask')) { box(ctx, -19, -109, 39, 17, 6, '#d5a4ab'); ctx.strokeStyle = '#b4878e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-13, -102); ctx.lineTo(13, -102); ctx.stroke(); }
  if (props.includes('ribbon')) { ellipse(ctx, 21, -134, 8, 5, '#c58591'); ellipse(ctx, 31, -134, 8, 5, '#c58591'); ellipse(ctx, 26, -133, 4, 4, '#af6e7b'); }
  if (props.includes('cap')) { box(ctx, -26, -144, 52, 23, 11, look.inner); ellipse(ctx, direction * 8, -121, 34, 5, look.inner); }
  if (props.includes('crown')) { path(ctx, [[-24,-132],[-27,-153],[-12,-144],[0,-159],[12,-144],[27,-153],[24,-132]], '#c9ab64'); box(ctx, -24, -135, 48, 8, 2, '#b79850'); }
  if (props.includes('hat')) { box(ctx, -25, -145, 50, 25, 10, '#f5edda'); box(ctx, -25, -125, 50, 7, 2, '#ccaa65'); ellipse(ctx, 0, -119, 35, 6, '#f5edda'); }
}
function prop(ctx, type, x, y, look) {
  ctx.save(); ctx.translate(x, y);
  if (type === 'book' || type === 'clipboard') {
    box(ctx, -12, -15, 24, 31, 3, type === 'book' ? '#587384' : '#c7ad7e');
    box(ctx, -8, -11, 16, 24, 1, '#f1ebd9');
    if (type === 'book') { box(ctx, -11, -14, 4, 29, 1, '#3f6073'); }
    else { box(ctx, -6, -18, 12, 6, 2, '#8a9b91'); for (let row = -5; row < 10; row += 6) { ctx.fillStyle = '#b0b7a3'; ctx.fillRect(-5, row, 10, 1.5); } }
  } else if (type === 'coffee') {
    box(ctx, -9, -10, 18, 23, 4, '#f1ead8'); box(ctx, -11, -13, 22, 5, 2, '#6a5c4e'); box(ctx, -9, -2, 18, 6, 1, '#c2a47a');
  } else if (type === 'bag') {
    box(ctx, -15, -7, 30, 27, 4, '#94775b'); box(ctx, -6, -14, 12, 10, 3); ctx.strokeStyle = '#80654e'; ctx.lineWidth = 3; ctx.stroke(); box(ctx, -3, 2, 6, 6, 1, '#c7ab6b');
  } else if (type === 'phone') {
    box(ctx, -8, -15, 16, 29, 3, '#52636a'); box(ctx, -5, -11, 10, 19, 1, '#b0c4c4'); ellipse(ctx, 0, 11, 1.5, 1.5, '#f3edda');
  } else if (type === 'gamepad') {
    box(ctx, -19, -8, 38, 20, 7, '#78837b'); ctx.fillStyle = '#e9e5d6'; ctx.fillRect(-12, -3, 11, 3); ctx.fillRect(-8, -7, 3, 11); ellipse(ctx, 10, -2, 3, 3, '#c78b7c'); ellipse(ctx, 15, 3, 2.5, 2.5, '#c4b26e');
  } else if (type === 'cigarette') {
    box(ctx, -3, -20, 5, 24, 1, '#f3eddf'); box(ctx, -3, -22, 5, 4, 1, '#be8061'); box(ctx, -3, -2, 5, 8, 1, '#c5a277');
  } else if (type === 'keys') {
    ctx.strokeStyle = '#9b9e8b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -8, 6, 0, Math.PI * 2); ctx.moveTo(-3, -2); ctx.lineTo(-7, 14); ctx.lineTo(-1, 14); ctx.moveTo(3, -2); ctx.lineTo(6, 10); ctx.lineTo(11, 10); ctx.stroke();
  } else if (type === 'mic') {
    box(ctx, -4, -4, 8, 24, 3, '#59696b'); ellipse(ctx, 0, -9, 9, 11, '#95a39a');
  } else if (type === 'bowl') {
    ellipse(ctx, 0, -4, 19, 7, '#d2b286'); ctx.fillStyle = '#edf0dd'; ctx.beginPath(); ctx.arc(0, -3, 18, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a08e67'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(13, -23); ctx.moveTo(0, -6); ctx.lineTo(17, -21); ctx.stroke();
  } else if (type === 'badge') {
    box(ctx, -7, -8, 14, 19, 2, '#f3edda'); box(ctx, -4, -5, 8, 7, 1, look.shirt); ctx.fillStyle = '#9bafaa'; ctx.fillRect(-4, 5, 8, 2);
  } else if (type === 'tablet' || type === 'laptop') {
    box(ctx, -16, -16, 32, 28, 3, '#63777d'); box(ctx, -12, -12, 24, 19, 1, '#b1c7c5');
    if (type === 'laptop') { box(ctx, -21, 10, 42, 5, 2, '#91a09b'); box(ctx, -10, 11, 20, 1, 0, '#53686b'); }
  } else if (type === 'calculator') {
    box(ctx, -12, -17, 24, 34, 3, '#5d7777'); box(ctx, -8, -12, 16, 8, 1, '#bbccb3');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box(ctx, -8 + col * 6, row * 5, 4, 3, 1, '#e5e3cc');
  } else if (['card', 'cards', 'envelope'].includes(type)) {
    if (type === 'cards') { box(ctx, -14, -12, 20, 29, 2, '#d5ac86'); box(ctx, -9, -15, 20, 29, 2, '#a3bba5'); }
    box(ctx, type === 'cards' ? -4 : -15, -10, type === 'cards' ? 20 : 30, type === 'cards' ? 29 : 20, 2, '#f3edda');
    if (type === 'envelope') { ctx.strokeStyle = '#b1ad93'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-14,-8); ctx.lineTo(0,2); ctx.lineTo(14,-8); ctx.stroke(); }
    else ellipse(ctx, type === 'cards' ? 6 : 0, 0, 4, 4, '#c58f8a');
  } else if (type === 'can') {
    box(ctx, -9, -15, 18, 30, 5, '#ba7d86'); ellipse(ctx, 0, -14, 9, 3, '#d8ded2'); box(ctx, -9, -5, 18, 9, 1, '#e3d8c5');
  } else if (type === 'snack') {
    path(ctx, [[-13,-15],[12,-17],[15,15],[-11,17]], '#c5a16c'); ellipse(ctx, 1, 0, 8, 7, '#e5d6a4');
  } else if (type === 'hourglass') {
    path(ctx, [[-10,-14],[10,-14],[3,0],[10,14],[-10,14],[-3,0]], '#c7dad2');
    path(ctx, [[-7,-10],[7,-10],[0,-1]], '#d5b16e'); path(ctx, [[0,3],[8,12],[-8,12]], '#d5b16e');
    box(ctx, -13, -17, 26, 5, 2, '#987b5f'); box(ctx, -13, 13, 26, 5, 2, '#987b5f');
  } else if (type === 'boat') {
    path(ctx, [[-21,5],[21,5],[12,16],[-11,16]], '#6d8e9d'); path(ctx, [[-1,-21],[-1,3],[-16,3]], '#f3edda'); path(ctx, [[3,-16],[17,2],[3,2]], '#c28c7e');
  } else if (type === 'cane') {
    ctx.strokeStyle = '#927959'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.quadraticCurveTo(10, -14, 10, 0); ctx.lineTo(10, 45); ctx.stroke();
    ellipse(ctx, 10, 45, 4.5, 2.5, '#46554c');
  }
  ctx.restore();
}
function doll(ctx, look, active, direction, step, pose) {
  const props = look.accessories;
  if (['long', 'bob', 'bun'].includes(look.hairStyle)) box(ctx, -27, -126, 54, look.hairStyle === 'long' ? 82 : 52, 22, look.hair);
  if (look.hairStyle === 'bun') ellipse(ctx, -17, -141, 14, 14, look.hair);
  if (props.includes('backpack')) box(ctx, -31, -86, 23, 49, 8, '#ad6657');
  // All bodies share the same head size, short limbs and soft unoutlined clothes.
  ctx.strokeStyle = look.trousers; ctx.lineWidth = 12; ctx.lineCap = 'round';
  const leftRatio = Math.max(.25, Math.min(1, look.leftLegRatio || 1));
  const shortSide = direction, feet = [];
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const isShort = leftRatio < 1 && side === shortSide, stride = side < 0 ? step : -step;
    const legLength = 24 * (isShort ? leftRatio : 1), hipY = -5 - legLength;
    const kicking = isShort && pose === 'kick';
    const footX = side * 13 + (kicking ? direction * 9 : 0);
    const footY = -5 + stride * (isShort ? leftRatio * .5 : 1) - (kicking ? 20 : 0);
    ctx.moveTo(side * 12, hipY); ctx.lineTo(footX, footY);
    feet.push({ x: footX + side * 2, y: footY + 2, kicking });
  }
  ctx.stroke();
  for (const foot of feet) {
    if (foot.kicking) ellipse(ctx, foot.x + direction * 3, foot.y, 14, 9, '#d5b76666');
    ellipse(ctx, foot.x, foot.y, 10, 5, foot.kicking ? '#d7b04d' : look.sportShoes ? '#e6e9e1' : '#f5edda');
    if (look.sportShoes) { box(ctx, foot.x - 8, foot.y - 3, 16, 3, 1, '#8c9b96'); box(ctx, foot.x - 10, foot.y + 2, 20, 3, 1, '#f5f3e9'); }
  }
  const isLayered = ['vest', 'blazer', 'cardigan'].includes(look.clothing);
  const sleeve = look.clothing === 'vest' ? look.inner : look.shirt;
  const attacking = active === 'attack' || pose === 'skill';
  const healing = ['heal', 'bath', 'pizza'].includes(pose);
  const restingHands = healing || pose === 'guard';
  const frontX = direction * (attacking ? 58 : restingHands && !props.includes('cane') ? 12 : 32), frontY = attacking ? -79 : restingHands && !props.includes('cane') ? -65 : -43;
  const backX = -direction * (restingHands ? 14 : 31), backY = restingHands ? -65 : -43 + step * .4;
  ctx.strokeStyle = sleeve; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(-direction * 22, -75); ctx.lineTo(backX, backY); ctx.stroke();
  ellipse(ctx, backX, backY, 8, 8, look.skin);
  box(ctx, -25, -87, 50, look.clothing === 'dress' ? 72 : 60, 12, look.shirt);
  if (leftRatio < 1) {
    // A lower left hip/hem lets both soles rest on the ground while the visible
    // left leg remains half as long. Facing mirrors the person's own left side.
    const hemY = -5 - 24 * leftRatio;
    path(ctx, [[0,-34],[direction*25,-31],[direction*24,hemY],[direction*7,hemY],[0,-27]], look.shirt);
  }
  if (look.clothing === 'vest') {
    path(ctx, [[-14,-87],[14,-87],[0,-64]], look.inner);
    path(ctx, [[-13,-87],[0,-80],[-7,-72]], look.inner); path(ctx, [[13,-87],[0,-80],[7,-72]], look.inner);
  } else if (isLayered) {
    box(ctx, props.includes('backpack') ? -4 : -10, -84, props.includes('backpack') ? 8 : 20, 53, 3, look.inner);
  } else if (look.clothing !== 'tee' && look.clothing !== 'dress') {
    path(ctx, [[-17,-86],[0,-76],[-6,-66]], look.inner); path(ctx, [[17,-86],[0,-76],[6,-66]], look.inner);
    for (let y = -62; y < -35; y += 11) ellipse(ctx, 0, y, 1.4, 1.4, '#f1ebd9');
  }
  if ((look.clothing === 'polo' && look.inner !== '#f5edda') || (look.clothing === 'tee' && look.inner === '#e5e7dc')) {
    box(ctx, -25, -83, 5, 18, 2, look.inner); box(ctx, 20, -83, 5, 18, 2, look.inner);
  }
  if (look.tie) path(ctx, [[-4,-77],[4,-77],[6,-49],[0,-43],[-6,-49]], look.tie);
  if (props.includes('backpack')) {
    for (const x of [-17, 13]) box(ctx, x, -84, 5, 44, 2, '#ad6657'); box(ctx, 6, -68, 13, 17, 2, '#f5edda');
  }
  if (props.includes('badge')) { ctx.strokeStyle = '#b2c1b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -86); ctx.lineTo(0, -64); ctx.lineTo(10, -86); ctx.stroke(); prop(ctx, 'badge', 0, -56, look); }
  if (props.includes('necklace')) { ctx.strokeStyle = '#cbb477'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-13,-86); ctx.lineTo(0,-68); ctx.lineTo(13,-86); ctx.stroke(); ellipse(ctx,0,-68,3,4,'#cbb477'); }
  if (props.includes('pin')) { ellipse(ctx,16,-73,5,5,'#c9ac69'); ellipse(ctx,16,-73,2,2,'#e5dfbb'); }
  if (props.includes('sport-emblem')) {
    box(ctx, -10, -68, 20, 3, 1, look.inner); box(ctx, -12, -72, 4, 11, 1, look.inner); box(ctx, 8, -72, 4, 11, 1, look.inner);
    box(ctx, -16, -70, 3, 7, 1, '#eee7df'); box(ctx, 13, -70, 3, 7, 1, '#eee7df');
  }
  const held = props.filter(item => ['book','clipboard','coffee','bag','phone','gamepad','cigarette','keys','mic','bowl','tablet','laptop','calculator','card','cards','envelope','can','snack','hourglass','boat'].includes(item));
  if (held.indexOf('bag') >= 2) prop(ctx, 'bag', -direction * 43, -24, look);
  if (held[0]) prop(ctx, held[0], backX, backY, look);
  ctx.strokeStyle = sleeve; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(direction * 22, -76); ctx.lineTo(frontX, frontY); ctx.stroke();
  ellipse(ctx, frontX, frontY, 8, 8, look.skin);
  if (props.includes('cane')) { ctx.save(); ctx.translate(frontX + direction * 2, frontY); ctx.scale(direction, 1); prop(ctx, 'cane', 0, 0, look); ctx.restore(); }
  if (held.length > 1) prop(ctx, held[1], frontX, frontY - 4, look);
  head(ctx, look, direction);
  if (pose === 'bath') {
    // A soap-and-sandalwood cloud remains a fully clothed cartoon recovery pose.
    for (const [x,y,r] of [[-30,-49,13],[-13,-37,15],[9,-39,16],[28,-47,12],[-20,-20,11],[17,-21,13]]) ellipse(ctx,x,y,r,r*.8,'#eaf0dfdf');
    for (const [x,y,r] of [[-34,-106,5],[37,-124,6],[26,-153,4]]) { ctx.strokeStyle = '#d9e7cc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }
    box(ctx, -9, -53, 19, 13, 4, '#d8c49d');
    ctx.strokeStyle = '#b79d78'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4,-48); ctx.lineTo(5,-48); ctx.stroke();
  } else if (pose === 'pizza') {
    const pizzaX = direction * 13, pizzaY = -86;
    path(ctx, [[pizzaX-13,pizzaY-13],[pizzaX+15,pizzaY-9],[pizzaX+2,pizzaY+16]], '#dfbf78');
    ctx.strokeStyle = '#bd8b5b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pizzaX-13,pizzaY-13); ctx.lineTo(pizzaX+15,pizzaY-9); ctx.stroke();
    for (const [dx,dy] of [[-3,-4],[6,-1],[1,6]]) ellipse(ctx,pizzaX+dx,pizzaY+dy,3,3,'#b96e58');
  }
  if (healing) {
    for (const [x,y] of [[-43,-109],[39,-93]]) { box(ctx,x-6,y-2,12,4,1,'#8caf79'); box(ctx,x-2,y-6,4,12,1,'#8caf79'); }
  } else if (pose === 'guard') {
    ctx.strokeStyle = '#a7bfb8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0,-66,34,44,0,0,Math.PI*2); ctx.stroke();
  }
}

export function drawBrawlAvatar(ctx, { id, isPlayer = false }) {
  const look = isPlayer ? ISLAND_VISITOR_LOOK : getIslandCharacterLook(id);
  ctx.save(); ctx.translate(36, 44); ctx.scale(.88, .88); ctx.translate(0, 111);
  if (['long', 'bob', 'bun'].includes(look.hairStyle)) box(ctx, -27, -126, 54, 70, 22, look.hair);
  if (look.hairStyle === 'bun') ellipse(ctx, -17, -141, 14, 14, look.hair);
  head(ctx, look, 1); ctx.restore();
}

export function drawBrawlCharacter(ctx, actor, { isPlayer, name, elapsed = 0, reducedMotion = false }) {
  const { x, y } = actor, active = actor.action;
  const pose = actor.pose || active;
  const look = isPlayer ? ISLAND_VISITOR_LOOK : getIslandCharacterLook(actor.id);
  const direction = Math.cos(actor.facing) < 0 ? -1 : 1;
  if ((active === 'windup' || actor.telegraphRemaining > 0) && (!actor.telegraphKind || actor.telegraphKind === 'cone')) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(actor.facing);
    ctx.fillStyle = '#d4824c36'; ctx.strokeStyle = '#bc6d3d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, actor.telegraphRadius || 110, -(actor.telegraphHalfAngle || Math.acos(.35)), actor.telegraphHalfAngle || Math.acos(.35)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ellipse(ctx, x, y + 3, 29, 11, '#25483d29');
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = isPlayer ? '#648e70' : '#bb7f5c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, actor.radius + 8, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  if (active === 'defeated') ctx.rotate(isPlayer ? -.95 : .95);
  else if (pose === 'down') { ctx.translate(-direction * 73, -23); ctx.rotate(direction * Math.PI / 2); }
  if (actor.invulnerable && !reducedMotion) ctx.globalAlpha = .65 + Math.sin(elapsed * 35) * .12;
  const step = active === 'walk' && !reducedMotion ? Math.sin(elapsed * 15) * 5 : 0;
  if (!reducedMotion) { ctx.translate(active === 'attack' || pose === 'skill' || pose === 'kick' ? direction * 10 : 0, active === 'walk' ? -Math.abs(step) : 0); ctx.rotate(active === 'hit' ? -direction * .08 : active === 'attack' ? direction * .06 : step * .005); }
  doll(ctx, look, active, direction, step, pose);
  if (actor.paper) { ctx.save(); ctx.translate(-direction * 34, -55); ctx.rotate(.22); ctx.fillStyle = '#fff8e5'; ctx.fillRect(-7, -9, 14, 18); ctx.strokeStyle = '#b3aa91'; ctx.strokeRect(-7, -9, 14, 18); ctx.restore(); }
  ctx.restore();
  if (isPlayer) { ctx.fillStyle = '#426b50'; ctx.beginPath(); ctx.moveTo(-6, -173); ctx.lineTo(6, -173); ctx.lineTo(0, -165); ctx.fill(); }
  label(ctx, name, 0, pose === 'down' ? -68 : -186, isPlayer ? '#244e3d' : '#805b46'); ctx.restore();
}
