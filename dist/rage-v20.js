// Water Snake is an original conversational target from e20 onward. Reuse the
// published target contract for everyone else, without extra RNG draws.
import { getRageV14, RAGE_NAMES } from './rage-v14.js';
import { getRageV16, rageTargetForV16 } from './rage-v16.js';

const NAMES = { ...RAGE_NAMES, jack: '傑克', meimei: '水蛇' };

export function rageTargetForV20(event) {
  return event?.speaker === 'meimei' ? 'meimei' : rageTargetForV16(event);
}

function meimeiRelease(run) {
  const context = run.rageContext;
  const hot = run.stats.mood <= 25, calm = run.stats.mood >= 65;
  const realWeight = Math.max(12, Math.min(64, 28 + (hot ? 23 : calm ? -12 : 0)));
  const phase = context.phase === 'result'
    ? '你剛才已經回了話，聽完她接下來那句，這股火才衝上來。'
    : '水蛇還沒講完，你的耐性已經先結束了。';
  const imagined = '你在腦內揮出一拳，水蛇把手上的客戶資料夾一轉，居然攤成了一面報價看板。她指著正中央的空白格問：「這一下算新增需求嗎？我先確認誰買單。」你還沒想好，她已經把會議改約到下週。 '
    + phase + ' 你回過神，手仍放在膝上。水蛇還在原地滑手機，資料夾也好好夾在手裡；剛才那筆離譜的報價，只有你看見。';
  const actual = '你的手真的越過桌沿。水蛇急忙退開，手機和資料夾落在地上，旁邊的同事立刻把你們隔開。她沒有接著談客戶，只看著你問：「你現在是在做什麼？」 '
    + phase + ' 你等了一秒，現場卻沒有醒來的切換。剛才那一下真的發生了，原本的爭執和你動手的經過，都得分開說清楚。';
  return {
    id: 'rage-release', title: '受不了了，扁他。',
    body: '眼前正在說話的是水蛇。你沒有轉去找別人，這口氣就在對話中斷了線。',
    wing: '水蛇停下來，看著你。', speaker: 'meimei', kind: 'rage',
    era: '當場暴走・原創分支', sourceIds: ['characterFiction'],
    choices: [{
      text: '受不了了，扁他。', detail: '', result: '', delta: {},
      effect: 'rageReturn', flags: [], rageTarget: 'meimei',
      draw: { label: '剛才發生了什麼', outcomes: [
        { weight: 100 - realWeight, label: '腦內劇場', result: imagined,
          delta: { mood: hot ? 17 : 9, energy: -3, boss: -2 },
          effect: 'rageReturn', flags: ['rage_imagined', 'rage_catharsis'] },
        { weight: realWeight, label: '真的失控了', result: actual,
          delta: { mood: hot ? 10 : -8, energy: -11, boss: -32, trust: -7 },
          effect: 'rageAftermath', flags: ['rage_real'] }
      ] }
    }]
  };
}

export function getRageV20(run) {
  if (run.rageContext?.target !== 'meimei') return getRageV16(run);
  if (run.eventId === 'rage-release') return meimeiRelease(run);
  return getRageV14(run, NAMES);
}
