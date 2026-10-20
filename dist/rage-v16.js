// Jack is a new conversational target only for the e16 cohort. The old target
// map, release text and RNG contract remain untouched for all historical runs.
import { getRageV14, rageTargetFor, RAGE_NAMES } from './rage-v14.js';

const NAMES = { ...RAGE_NAMES, jack: '傑克' };

export function rageTargetForV16(event) {
  return event?.speaker === 'jack' ? 'jack' : rageTargetFor(event);
}

function jackRelease(run) {
  const context = run.rageContext;
  const hot = run.stats.mood <= 25, calm = run.stats.mood >= 65;
  // A helpful colleague changes the base weight, without removing the effect
  // of the player's mood or consuming an additional random draw.
  const realWeight = Math.max(10, Math.min(64, 23 + (hot ? 23 : calm ? -12 : 0)));
  const phase = context.phase === 'result'
    ? '你剛才已經回了一句，聽完他的回話，這股火才突然湧上來。'
    : '傑克還沒把話說完，你的耐性已經先用光了。';
  const imagined = '你在腦內朝傑克揮出一拳，桌上的筆記跟著飛成滿天紙頁。他扶好眼鏡，居然先替這一秒取了文章標題：「我只是來問你要不要留紀錄。」你想叫他別再寫，他已經追問這篇要用哪個當事人視角。 '
    + phase + ' 回過神，傑克還在原地，你的手也還放在膝上。剛才那場夢只有你看見，連一張真正的筆記都沒有掉。';
  const actual = '椅子猛地碰了一聲，傑克退開，筆記落在地上。他沒有反問你的態度，只看著你說：「我剛才是在跟你一起把事情弄清楚。」旁邊的同事停下手，你也終於看見對方錯愕的表情。 '
    + phase + ' 這次沒有醒來，你真的對眼前的人動了手。接下來的事，得由你自己面對。';
  return {
    id: 'rage-release', title: '受不了了，扁他。',
    body: '眼前正在說話的是傑克。你沒有找別人，這口氣就在這一刻斷了線。',
    wing: '傑克停下來，看著你。', speaker: 'jack', kind: 'rage',
    era: '當場暴走・原創分支', sourceIds: ['characterFiction'],
    choices: [{
      text: '受不了了，扁他。', detail: '', result: '', delta: {},
      effect: 'rageReturn', flags: [], rageTarget: 'jack',
      draw: { label: '剛才發生了什麼', outcomes: [
        { weight: 100 - realWeight, label: '腦內劇場', result: imagined,
          delta: { mood: hot ? 17 : 9, energy: -3, boss: -2 },
          effect: 'rageReturn', flags: ['rage_imagined', 'rage_catharsis'] },
        { weight: realWeight, label: '真的失控了', result: actual,
          delta: { mood: hot ? 10 : -8, energy: -11, boss: -32, trust: -8 },
          effect: 'rageAftermath', flags: ['rage_real'] }
      ] }
    }]
  };
}

export function getRageV16(run) {
  if (run.rageContext?.target !== 'jack') return getRageV14(run);
  if (run.eventId === 'rage-release') return jackRelease(run);
  return getRageV14(run, NAMES);
}
