// Helen joins the conversation from e22 onward. Keep published targets on
// their existing path; displaying a release never consumes a random draw.
import { getRageV14, RAGE_NAMES } from './rage-v14.js';
import { getRageV20, rageTargetForV20 } from './rage-v20.js';

const NAMES = { ...RAGE_NAMES, jack: '傑克', meimei: '水蛇', helen: '前女友' };

export function rageTargetForV22(event) {
  return event?.speaker === 'helen' ? 'helen' : rageTargetForV20(event);
}

function helenRelease(run) {
  const context = run.rageContext;
  const hot = run.stats.mood <= 25, calm = run.stats.mood >= 65;
  const realWeight = Math.max(12, Math.min(64, 28 + (hot ? 23 : calm ? -12 : 0)));
  const phase = context.phase === 'result'
    ? '你剛才已經回了話，聽見又多一項待辦，這股火才衝上來。'
    : '前女友還沒講到下一版，你已經不想再聽任何「順便」。';
  const imagined = '你在腦內揮出一拳，前女友手上的產品路線圖忽然展成機場跑道。每張需求單都戴著安全帽降落，塔台還傳來翅膀的聲音：「這個也很簡單吧？」她拿起對講機問：「離職同事還在 Slack，算可用人力嗎？」你正想關掉塔台，交接單又要求指定一位現任負責人。 '
    + phase + ' 你回過神，雙手仍放在膝上。現實裡，前女友還拿著原本那張路線圖，桌上也沒有跑道。剛才的失控全是腦內幻想，沒有人真的挨打。';
  const actual = '你的手真的越過桌沿，前女友急忙退到投影幕旁，交接資料散了一地。旁邊的同事立刻把你們隔開。她把簡報關掉：「產品爭議先停，剛才這件事要另外記錄。」 '
    + phase + ' 你等了一秒，卻沒有醒來。這次真的對眼前的人動了手，需求單不能替你撤回這一下，接下來得把事情說清楚。';
  return {
    id: 'rage-release', title: '受不了了，扁他。',
    body: '眼前正在說話的是前女友。她把產品待辦轉向你，正等你回應，這口氣卻在對話中斷了線。',
    wing: '前女友停下來，把交接資料放在桌上。', speaker: 'helen', kind: 'rage',
    era: '當場暴走・原創分支', sourceIds: ['characterFiction'],
    choices: [{
      text: '受不了了，扁他。', detail: '', result: '', delta: {},
      effect: 'rageReturn', flags: [], rageTarget: 'helen',
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

export function getRageV22(run) {
  if (run.rageContext?.target !== 'helen') return getRageV20(run);
  if (run.eventId === 'rage-release') return helenRelease(run);
  return getRageV14(run, NAMES);
}
