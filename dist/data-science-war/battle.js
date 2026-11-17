import { createIslandBrawl } from '../island/brawl.js';
import { mountIslandBrawl } from '../island/brawl-ui.js';

const OPPONENT = 'data-science-battle-master';

const SKILLS = [
  {
    id: 'runaway-loop', name: '遞迴暴走', kind: 'zone', trigger: 'always',
    tell: '山姆指著你腳下的座標，錯誤訊息開始堆疊。',
    line: '重試第 999 次。重試第 1,000 次。',
    counter: '離開地面的標記圈，別折返撿紙團。',
    windup: 1.35, cooldown: 13, range: 320, radius: 70, damage: 16, color: '#bf6649',
  },
  {
    id: 'prediction-burst', name: '幻覺連發', kind: 'projectile', trigger: 'always',
    tell: '山姆抬手，眼鏡前浮起一份沒有來源的報告。',
    line: '信心百分之百。來源待補。',
    counter: '向側面移動，也可以讓花台擋住報告。',
    windup: 1, cooldown: 9, range: 420, radius: 28, damage: 11, color: '#826cb7',
  },
  {
    id: 'health-check', name: '自我修復程序', kind: 'heal', trigger: 'hurt', once: true,
    tell: '山姆扶好眼鏡，一圈光正朝他聚攏。',
    line: '健康檢查通過，繼續剛才的誤判。',
    counter: '趁讀條還沒結束貼近攻擊，可以打斷回血。',
    windup: 1.5, cooldown: 20, range: 150, radius: 44, heal: 16, color: '#658d64',
  },
];

const OVERLOAD = {
  id: 'context-overflow', name: '上下文溢出', kind: 'rush', trigger: 'time', at: 23, once: true,
  tell: '投影的文字溢出場地，山姆壓低身子準備衝過來。',
  line: '會議延長。剩餘議程全部載入！',
  counter: '離開長條預警的方向，等衝刺結束再靠近。',
  windup: 1.15, cooldown: 99, range: 220, radius: 41, damage: 17, color: '#b85736',
};

function paintShape(ctx, color, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function fillEllipse(ctx, color, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSam(enraged) {
  const skin = enraged ? '#cd6884' : '#eea384';
  const shade = enraged ? '#a74868' : '#cf715e';
  const hair = '#2e202e';
  const jacket = '#392a43';
  return (ctx, { active, direction, step, pose }) => {
    const attacking = active === 'attack' || pose === 'skill';
    const frontHand = attacking ? 52 : 35;
    const frontHeight = attacking ? -72 : -46;
    ctx.save();
    ctx.scale(direction, 1);
    paintShape(ctx, '#35303c', [[-23, -34], [-5, -32], [-8, -9 + step], [-24, -9 + step]]);
    paintShape(ctx, '#35303c', [[23, -34], [5, -32], [8, -9 - step], [24, -9 - step]]);
    fillEllipse(ctx, '#e7d5ce', -18, -7 + step, 11, 6);
    fillEllipse(ctx, '#e7d5ce', 18, -7 - step, 11, 6);
    paintShape(ctx, jacket, [[-25, -81], [-38, -66], [-37, -46], [-25, -43], [-17, -76]]);
    paintShape(ctx, jacket, [[-24, -84], [24, -84], [30, -68], [26, -33], [-25, -33], [-30, -68]]);
    paintShape(ctx, '#b0a1b0', [[-12, -83], [12, -83], [16, -36], [-12, -36]]);
    paintShape(ctx, '#ae4965', [[-24, -83], [-12, -85], [-3, -67], [-19, -74]]);
    paintShape(ctx, '#eeb8ae', [[23, -83], [12, -85], [4, -67], [20, -75]]);
    paintShape(ctx, jacket, [[23, -80], [frontHand, frontHeight - 9], [frontHand + 3, frontHeight + 5], [27, -55]]);
    fillEllipse(ctx, skin, frontHand, frontHeight, 8, 8);
    fillEllipse(ctx, shade, -31, -45, 7, 8);

    if (enraged) {
      paintShape(ctx, '#712e47', [[-23, -119], [-40, -136], [-48, -160], [-33, -147], [-18, -138], [-9, -122]]);
      paintShape(ctx, '#c26867', [[18, -121], [34, -138], [43, -163], [48, -143], [40, -125], [30, -117]]);
    }
    fillEllipse(ctx, shade, -24, -109, 7, 10);
    fillEllipse(ctx, skin, 4, -111, 28, 27);
    paintShape(ctx, hair, [[-23, -107], [-27, -130], [-16, -139], [-32, -139], [-15, -150], [3, -149], [-3, -155], [24, -143], [30, -133], [27, -119], [18, -132], [5, -125], [11, -136], [-7, -126], [-7, -133], [-19, -124]]);
    paintShape(ctx, '#8f415a', [[-16, -142], [3, -147], [19, -139], [0, -139], [-13, -132], [-9, -139]]);
    const eye = enraged ? '#ffdc8d' : '#49303c';
    fillEllipse(ctx, eye, -6, -112, 3.5, 3.5);
    fillEllipse(ctx, eye, 18, -112, 3.5, 3.5);
    ctx.strokeStyle = '#281c2c';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(-17, -119, 20, 13);
    ctx.rect(9, -119, 20, 13);
    ctx.moveTo(3, -115);
    ctx.lineTo(9, -115);
    ctx.moveTo(-17, -116);
    ctx.lineTo(-25, -120);
    ctx.stroke();
    ctx.strokeStyle = shade;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, -96);
    ctx.quadraticCurveTo(10, enraged ? -104 : -91, 18, -96);
    ctx.stroke();
    ctx.restore();
  };
}

export function startDataScienceBattle({ container, image, seed, enraged = false, loadout = null, onFinish }) {
  const name = enraged ? '山姆・戰鬥大師' : '山姆';
  const profile = {
    id: OPPONENT,
    title: enraged ? '怒氣全開' : '讀書會主持人',
    opening: enraged ? '山姆把眼鏡推回鼻梁，鏡片後亮著金色的光。' : '山姆捲起袖口，把剛才的講義放在場邊。',
    skills: SKILLS,
    events: [OVERLOAD],
  };
  const hasItem = typeof loadout?.itemLabel === 'string' && loadout.itemLabel.trim() !== '';
  const model = createIslandBrawl({
    opponentId: OPPONENT,
    seed,
    challenger: {
      profile,
      hp: enraged ? 168 : 124,
      energy: enraged ? 42 : 25,
      playerHp: hasItem ? loadout.maxHp ?? 224 : undefined,
      playerEnergy: hasItem ? loadout.startingEnergy ?? 100 : undefined,
    },
  });
  const wrapper = container.ownerDocument.createElement('div');
  wrapper.className = 'island-dialog brawl-dialog data-science-battle';
  if (hasItem) {
    const { player } = model.getState();
    const note = container.ownerDocument.createElement('p');
    note.className = 'data-science-loadout';
    note.textContent = `已裝備 ${loadout.itemLabel}｜體力 ${player.hp} · 起始氣勢 ${player.energy}%`;
    wrapper.append(note);
  }
  container.append(wrapper);

  try {
    const battle = mountIslandBrawl({
      container: wrapper,
      opponent: { id: OPPONENT, name, image, profile, drawBody: drawSam(enraged) },
      model,
      reducedMotion: container.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches,
      onFinish(outcome, summary) {
        if (summary.reason === 'forfeit') onFinish('quit', { ...summary, outcome: 'quit' });
        else onFinish(outcome, summary);
      },
    });
    return {
      ...battle,
      destroy() {
        battle.destroy();
        wrapper.remove();
      },
    };
  } catch (error) {
    wrapper.remove();
    throw error;
  }
}
