import { createIslandBrawl } from '../island/brawl.js';
import { mountIslandBrawl } from '../island/brawl-ui.js';

const OPPONENT = 'data-science-battle-master';
const NAME = '戰鬥大師';

const SKILLS = [
  {
    id: 'runaway-loop', name: '遞迴暴走', kind: 'zone', trigger: 'always',
    tell: '戰鬥大師鎖定你腳下的座標，錯誤訊息開始堆疊。',
    line: '重試第 999 次。重試第 1,000 次。',
    counter: '離開地面的標記圈，別折返撿紙團。',
    windup: 1.35, cooldown: 13, range: 320, radius: 70, damage: 16, color: '#bf6649',
  },
  {
    id: 'prediction-burst', name: '幻覺連發', kind: 'projectile', trigger: 'always',
    tell: '盔甲前方浮起一份沒有來源的報告。',
    line: '信心百分之百。來源待補。',
    counter: '向側面移動，也可以讓花台擋住報告。',
    windup: 1, cooldown: 9, range: 420, radius: 28, damage: 11, color: '#826cb7',
  },
  {
    id: 'health-check', name: '自我修復程序', kind: 'heal', trigger: 'hurt', once: true,
    tell: '盔甲打開散熱片，胸口亮起修復指示燈。',
    line: '健康檢查通過，繼續剛才的誤判。',
    counter: '趁讀條還沒結束貼近攻擊，可以打斷回血。',
    windup: 1.5, cooldown: 20, range: 150, radius: 44, heal: 16, color: '#658d64',
  },
];

const OVERLOAD = {
  id: 'context-overflow', name: '上下文溢出', kind: 'rush', trigger: 'time', at: 23, once: true,
  tell: '投影的文字溢出場地，戰鬥大師擺出衝刺架勢。',
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

function drawBattleMaster(enraged) {
  const light = enraged ? '#ffc36d' : '#efb7ef';
  const steel = enraged ? '#894769' : '#704b84';
  return (ctx, { active, direction, step, pose }) => {
    const frontHand = active === 'attack' || pose === 'skill' ? 65 : 42;
    ctx.save();
    ctx.scale(direction, 1);
    paintShape(ctx, '#412740', [[-28, -108], [-37, -132], [-57, -149], [-35, -143], [-14, -116]]);
    paintShape(ctx, '#68445d', [[22, -109], [32, -142], [53, -156], [44, -134], [37, -112]]);
    paintShape(ctx, '#2c2033', [[-30, -122], [-19, -137], [0, -132], [19, -137], [30, -122], [24, -97], [0, -89], [-24, -97]]);
    paintShape(ctx, steel, [[-28, -91], [-40, -73], [-29, -45], [0, -29], [29, -45], [40, -73], [28, -91]]);
    paintShape(ctx, '#343039', [[-14, -83], [14, -83], [20, -58], [0, -43], [-20, -58]]);
    paintShape(ctx, '#343039', [[-30, -34], [-11, -26], [-12, -9 + step], [-33, -4 + step], [-37, -9 + step]]);
    paintShape(ctx, '#343039', [[30, -34], [11, -26], [12, -9 - step], [33, -4 - step], [37, -9 - step]]);
    paintShape(ctx, '#343039', [[-41, -79], [-47, -63], [-37, -45], [-26, -50], [-28, -71]]);
    paintShape(ctx, '#343039', [[29, -79], [frontHand - 9, -75], [frontHand + 4, -64], [frontHand - 4, -53], [34, -57]]);
    paintShape(ctx, light, [[-20, -118], [-3, -112], [-7, -108], [-17, -111]]);
    paintShape(ctx, light, [[4, -112], [20, -118], [17, -111], [9, -108]]);
    paintShape(ctx, light, [[0, -79], [10, -65], [0, -50], [-10, -65]]);
    ctx.restore();
  };
}

export function startDataScienceBattle({ container, image, seed, enraged = false, onFinish }) {
  const profile = {
    id: OPPONENT,
    title: enraged ? '戰鬥大師完全體' : '戰鬥大師測試機',
    opening: enraged ? '你聽見盔甲裡的散熱風扇越轉越快。' : '會議室的投影凝成一具盔甲。它正在等你的第一步。',
    skills: SKILLS,
    events: [OVERLOAD],
  };
  const model = createIslandBrawl({
    opponentId: OPPONENT,
    seed,
    challenger: { profile, hp: enraged ? 168 : 124, energy: enraged ? 42 : 25 },
  });
  const wrapper = container.ownerDocument.createElement('div');
  wrapper.className = 'island-dialog brawl-dialog data-science-battle';
  container.append(wrapper);

  try {
    const battle = mountIslandBrawl({
      container: wrapper,
      opponent: { id: OPPONENT, name: NAME, image, profile, drawBody: drawBattleMaster(enraged) },
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
