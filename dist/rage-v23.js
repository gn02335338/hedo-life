// Five new conversational targets. Earlier targets retain their published
// release and aftermath without an extra random draw or a renamed replay.
import { getRageV14, RAGE_NAMES } from './rage-v14.js';
import { getRageV22, rageTargetForV22 } from './rage-v22.js';

const VOICES = Object.freeze({
  sophie: {
    name: '紅茶',
    body: '紅茶把稽核清單推到你面前，等你說明印表機上那一疊究竟是哪個版本。',
    quote: '「版本先對好。茶的顏色不用你幫我分類。」',
    dream: '你在腦內揮出一拳，稽核清單忽然變成一整張飲料單。紅茶蓋章：「我不是綠茶，請不要擅自換品項。」印表機開始吐出半糖、少冰與待補附件，阿福的故障說明還在第四頁。你正要退單，系統又要求主管核准甜度。',
    real: '你的手真的越過桌沿，紅茶退開，稽核資料散在腳邊。同事立刻把你們隔開。她把清單放下：「附件先停，剛才的事另外記。」'
  },
  jonathan: {
    name: '強哥',
    body: '強哥指著排程裡的空白欄，再指了一下自己名片上的「助理工程師」。',
    quote: '「我只是助理工程師，這個要找有權決定的人。」',
    dream: '你在腦內揮出一拳，強哥舉起「助理工程師」名牌，竟把整張排程擋在外面。你繞到另一邊，名牌自動旋轉，背面寫著「台大資工，不代表有簽核權」。最後連拳頭都被退回，退件理由是找錯職級。',
    real: '你的手真的越過桌沿，強哥往後退，排程表掉在桌邊。同事立刻把你們隔開。他沒有再指名片，只請旁人把剛才看到的事記下來。'
  },
  owen: {
    name: '歐文',
    body: '歐文把墨鏡往上推了一點，手機上還開著跑步路線，等你回覆下一個合作安排。',
    quote: '「先講清楚，這次約的是跑步，還是要開會？」',
    dream: '你在腦內揮出一拳，歐文的墨鏡投影出一條環島跑道。金項鍊變成終點線，他指著旁邊正在充電的特斯拉：「車等充電，我們先跑一圈。」你追到第三個補給站，工作議程還剩六頁，合作備忘錄卻已算完今天的步數。',
    real: '你的手真的越過桌沿，歐文退到椅子旁，墨鏡掉在桌上。同事立刻把你們隔開。他關掉手機上的路線，要求先把眼前發生的事說清楚。'
  },
  sam: {
    name: '山姆',
    body: '山姆把暫停的 Netflix 視窗切到旁邊，開始講這份分析到底應該怎麼做。',
    quote: '「成大一路念上來，這個我會不知道？」',
    dream: '你在腦內揮出一拳，山姆面前跳出「是否繼續觀看」的視窗。他拿出成大學士與碩士兩張證書當遙控器，兩張卻都只有暫停鍵。資料探勘還沒找到答案，演算法先推薦了八部「主管醒來以後」同類影集。你正要按略過片頭，讀書會又自動播放下一集。',
    real: '你的手真的越過桌沿，山姆急忙退開，螢幕仍停在暫停畫面。同事立刻把你們隔開。他這回沒有接著講學歷，現場得先處理剛才那一下。'
  },
  cindy: {
    name: '辛蒂',
    body: '辛蒂把專案時程攤開，先核對哪些簽核人仍在職，再等你回答這一版由誰確認。',
    quote: '「先不要寫人名，確認他明天還在，再填。」',
    dream: '你在腦內揮出一拳，辛蒂把專案甘特圖拉成旋轉門。每位主管的名字一進門就換了一種顏色，只有截止日期牢牢焊在原地。她拿起筆：「人可以異動，這一版誰簽？」你想把門停下來，系統卻寄來一封新的簽核人異動通知。',
    real: '你的手真的越過桌沿，辛蒂退開，專案資料從手中滑落。同事立刻把你們隔開。她沒有繼續追時程，先請大家停止爭執，分開說明剛才的經過。'
  }
});

const NAMES = { ...RAGE_NAMES, jack: '傑克', meimei: '水蛇', helen: '前女友',
  ...Object.fromEntries(Object.entries(VOICES).map(([id, voice]) => [id, voice.name])) };

export function rageTargetForV23(event) {
  return Object.hasOwn(VOICES, event?.speaker) ? event.speaker : rageTargetForV22(event);
}

function release(run, voice) {
  const hot = run.stats.mood <= 25, calm = run.stats.mood >= 65;
  const realWeight = Math.max(12, Math.min(64, 28 + (hot ? 23 : calm ? -12 : 0)));
  const phase = run.rageContext.phase === 'result'
    ? '你剛才已經回了話，聽完對方的回覆，這股火才衝上來。'
    : '對方話還沒講完，你的耐性已經先用完了。';
  return {
    id: 'rage-release', title: '受不了了，扁他。',
    body: `眼前正在說話的是${voice.name}。${voice.body}`,
    wing: voice.quote, speaker: run.rageContext.target, kind: 'rage',
    era: '當場暴走・原創分支', sourceIds: ['characterFiction'],
    choices: [{
      text: '受不了了，扁他。', detail: '', result: '', delta: {},
      effect: 'rageReturn', flags: [], rageTarget: run.rageContext.target,
      draw: { label: '剛才發生了什麼', outcomes: [
        { weight: 100 - realWeight, label: '腦內劇場',
          result: `${voice.dream} ${phase} 你回過神，雙手仍放在膝上。現實裡，${voice.name}還在等你回答。剛才全是腦內幻想，沒有人真的挨打。`,
          delta: { mood: hot ? 17 : 9, energy: -3, boss: -2 },
          effect: 'rageReturn', flags: ['rage_imagined', 'rage_catharsis'] },
        { weight: realWeight, label: '真的失控了',
          result: `${voice.real} ${phase} 你等了一秒，卻沒有醒來。這次真的對眼前的人動了手，原本的爭執和動手的經過都得分開說清楚。`,
          delta: { mood: hot ? 10 : -8, energy: -11, boss: -32, trust: -7 },
          effect: 'rageAftermath', flags: ['rage_real'] }
      ] }
    }]
  };
}

export function getRageV23(run) {
  const target = run.rageContext?.target;
  if (!Object.hasOwn(VOICES, target)) return getRageV22(run);
  const voice = VOICES[target];
  if (run.eventId === 'rage-release') return release(run, voice);
  return getRageV14(run, NAMES);
}
