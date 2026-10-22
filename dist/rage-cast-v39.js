import {PERSONAS} from './persona.js';
import {CAST_IDS_V39,CAST_PROFILES_V39} from './cast-v39.js';
import {getRageV14} from './rage-v14.js';
import {getRageV37,rageTargetForV37} from './rage-v37.js';

const dreams={
 annie_yu:'你的拳頭在半空變成一封轉寄信，安妮余按下一次轉寄，整個辦公室立刻長出八十八個「請幫我」。你追著最後一封信跑到天邊，才發現收件人仍寫著未確認的主管，拳頭連登記都還在排隊。',
 princess:'你在腦內一拳揮出，拳頭卻先被測試框攔下。公主把白板上的家譜擦掉，請它拿出可重現步驟；整排點頭的人忽然變成測試假人，只有你的怒氣還在要求免測上線。',
 joyce:'你想像自己一拳打斷簡報，914卻把拳風拆成三張成長曲線，說下季還能再放大。你追著投影片要求具體交付，最後被一個巨大的待追蹤標籤黏在會議室門口，連拳頭都還在銷售漏斗裡。',
 janet:'你的拳頭在腦內抵達桌沿，立刻被一張補件單接住。Janet請它附上出拳目的、動線與兩份空白收據，連怒氣都要先開成本中心。你填到第三張，橡皮擦已先宣布月底關帳。',
 captain:'你在想像裡一拳揮出，辦公桌忽然變成超載的紙船。船長替二十五位乘客發出十五件紙救生衣，請大家發揮彈性；你還沒找到自己的座位，拳頭已被登記為臨時兼任船槳。'
};
export function rageTargetForV39(event){
 if(event?.minRules>=39&&CAST_IDS_V39.includes(event.speaker))return event.speaker;
 return rageTargetForV37(event);
}
export function getRageV39(run){
 const id=run?.rageContext?.target;
 if(!/^e39-/.test(run?.seed||'')||!CAST_IDS_V39.includes(id))return getRageV37(run);
 if(run.eventId!=='rage-release')return getRageV14(run,Object.fromEntries(Object.entries(PERSONAS).map(([key,p])=>[key,p.name])));
 const p=CAST_PROFILES_V39[id],ctx=run.rageContext,hot=run.stats.mood<=25,calm=run.stats.mood>=65,realWeight=Math.max(12,Math.min(64,28+(hot?23:calm?-12:0)));
 const meal=ctx.eventId===`meal-with-${id}`,phase=ctx.phase==='result'?'剛才那個回應已經發生，不能靠這一下把它倒帶。':'對方還在等你的答覆，原本的安排尚未完成。';
 return {id:'rage-release',kind:'rage',speaker:id,minRules:39,...(meal?{privateContext:true}:{}),era:'當場暴走・原創分支',sourceIds:['castFictionV39','characterFiction'],title:'受不了了，扁他。',
  body:`${p.name}就在眼前。${meal?'你們還在吃同一頓飯，這是兩人的私下場合，不會憑空多出老闆或人事通知。':'你們還在剛才那個工作場合，沒有轉去找不在場的人。'}`,
  wing:'先停一下。你現在要講的是哪件事？',
  choices:[{text:'受不了了，扁他。',detail:'',result:'',delta:{},flags:[],effect:'rageReturn',rageTarget:id,draw:{label:'剛才發生了什麼',outcomes:[
   {weight:100-realWeight,label:'腦內劇場',result:`${dreams[id]}${phase}你眨了一下眼，雙手仍留在原處；${p.name}沒有挨打，剛才整段只發生在你的腦海裡。`,delta:{mood:hot?17:9,energy:-3,boss:0},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},
   {weight:realWeight,label:'真的失控了',result:`你真的出手打到了${p.name}。對方猛地往後退，附近的人立刻把你們隔開，原本的對話停了下來。${meal?'店家請雙方先分開，確認有人可以作證剛才的經過。':'在場的人分別記下剛才的動作與原話。'}${phase}沒有夢醒的切換，這次真的動了手；原本的爭點與出手造成的後果，接下來都得另外面對。`,delta:{mood:hot?10:-8,energy:-11,boss:0,trust:-7},effect:'rageAftermath',flags:['rage_real']}
  ]}}]};
}
