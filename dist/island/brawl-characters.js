// Combat uses the same authored illustration as the character book and HUD.
// Keep portraits intact: faces, clothing and signature props identify the person.
const ellipse = (ctx, x, y, rx, ry, fill) => {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
};
function box(ctx, x, y, width, height, radius, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r); ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); ctx.fill();
}
function label(ctx, value, x, y, color) {
  ctx.font = '700 18px "PingFang TC", "Noto Sans TC", sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 5; ctx.strokeStyle = '#f8f4e5'; ctx.lineJoin = 'round'; ctx.strokeText(value, x, y);
  ctx.fillStyle = color; ctx.fillText(value, x, y);
}
function feet(ctx, step, trouser = '#3d4d50') {
  ctx.strokeStyle = trouser; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, -28); ctx.lineTo(-13, -5 + step);
  ctx.moveTo(12, -28); ctx.lineTo(13, -5 - step); ctx.stroke();
  ellipse(ctx, -15, -3 + step, 10, 5, '#f5edda'); ellipse(ctx, 15, -3 - step, 10, 5, '#f5edda');
}
function visitor(ctx, active, direction, step) {
  // The island visitor: cream hiking hat, golden jacket and red backpack.
  box(ctx, -31, -86, 23, 49, 8, '#ad6657');
  feet(ctx, step);
  box(ctx, -25, -87, 50, 60, 12, '#ccaa65');
  ctx.fillStyle = '#f5edda'; ctx.fillRect(-4, -85, 8, 53);
  for (const x of [-17, 13]) box(ctx, x, -84, 5, 44, 2, '#ad6657');
  box(ctx, 6, -68, 13, 17, 2, '#f5edda');
  const handX = direction * (active === 'attack' ? 58 : 32), handY = active === 'attack' ? -79 : -42;
  ctx.strokeStyle = '#ccaa65'; ctx.lineWidth = 13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(direction * 22, -76); ctx.lineTo(handX, handY); ctx.stroke();
  ellipse(ctx, handX, handY, 8, 8, '#e9b48c');
  ellipse(ctx, 0, -111, 25, 28, '#e9b48c');
  ctx.fillStyle = '#5c4337'; ctx.beginPath(); ctx.arc(0, -117, 26, Math.PI, 0);
  ctx.lineTo(24, -110); ctx.lineTo(11, -119); ctx.lineTo(-19, -111); ctx.closePath(); ctx.fill();
  ellipse(ctx, direction * 10, -110, 2.8, 3, '#344b43');
  ctx.strokeStyle = '#a77256'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(direction * 7, -99); ctx.lineTo(direction * 15, -100); ctx.stroke();
  box(ctx, -25, -145, 50, 25, 10, '#f5edda');
  box(ctx, -25, -125, 50, 7, 2, '#ccaa65');
  ellipse(ctx, 0, -119, 35, 6, '#f5edda');
}

export function drawBrawlCharacter(ctx, actor, { isPlayer, name, portrait, elapsed = 0, reducedMotion = false }) {
  const { x, y } = actor, active = actor.action;
  const direction = Math.cos(actor.facing) < 0 ? -1 : 1;
  if (active === 'windup' || actor.telegraphRemaining > 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(actor.facing);
    ctx.fillStyle = '#d4824c36'; ctx.strokeStyle = '#bc6d3d'; ctx.lineWidth = 2;
    const reach = actor.telegraphRadius || 110, halfAngle = actor.telegraphHalfAngle || Math.acos(.35);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, reach, -halfAngle, halfAngle); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ellipse(ctx, x, y + 3, 29, 11, '#25483d29');
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = isPlayer ? '#648e70' : '#bb7f5c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, actor.radius + 8, 10, 0, 0, Math.PI * 2); ctx.stroke();
  // All action transforms pivot at the foot ring, so the art never changes hits.
  ctx.save();
  if (active === 'defeated') ctx.rotate(isPlayer ? -.95 : .95);
  if (actor.invulnerable && !reducedMotion) ctx.globalAlpha = .65 + Math.sin(elapsed * 35) * .12;
  const step = active === 'walk' && !reducedMotion ? Math.sin(elapsed * 15) * 5 : 0;
  if (!reducedMotion) {
    ctx.translate(active === 'attack' ? direction * 10 : 0, active === 'walk' ? -Math.abs(step) : 0);
    ctx.rotate(active === 'hit' ? -direction * .08 : active === 'attack' ? direction * .06 : step * .005);
  }
  if (isPlayer) visitor(ctx, active, direction, step);
  else if (portrait?.complete && portrait.naturalWidth > 0 && portrait.naturalHeight > 0) {
    feet(ctx, step);
    const scale = Math.min(144 / portrait.naturalWidth, 146 / portrait.naturalHeight);
    const width = portrait.naturalWidth * scale, height = portrait.naturalHeight * scale;
    ctx.save(); ctx.scale(direction, 1);
    ctx.shadowColor = '#24463938'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ctx.drawImage(portrait, -width / 2, -18 - height, width, height); ctx.restore();
  } else {
    // Loading or failed art keeps the correct name, never another person's face.
    box(ctx, -35, -108, 70, 88, 14, '#e6d7be');
    label(ctx, String(name || '？').slice(0, 2), 0, -59, '#805b46');
  }
  if (actor.paper) {
    ctx.save(); ctx.translate(-direction * 34, -55); ctx.rotate(.22);
    ctx.fillStyle = '#fff8e5'; ctx.fillRect(-7, -9, 14, 18); ctx.strokeStyle = '#b3aa91'; ctx.strokeRect(-7, -9, 14, 18); ctx.restore();
  }
  ctx.restore();
  if (isPlayer) { ctx.fillStyle = '#426b50'; ctx.beginPath(); ctx.moveTo(-6, -173); ctx.lineTo(6, -173); ctx.lineTo(0, -165); ctx.fill(); }
  label(ctx, name, 0, -186, isPlayer ? '#244e3d' : '#805b46');
  ctx.restore();
}
