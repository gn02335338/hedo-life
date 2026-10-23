import {CAST_IDS_V65,CAST_PROFILES_V65,isCastV65} from './cast-v65.js';
import {PERSONAS} from './persona.js';
import {getRageV14} from './rage-v14.js';
import {getRageV39,rageTargetForV39} from './rage-cast-v39.js';

const dreams={
 zoe:'你在腦內揮出一拳，拳風卻先被201排進活動流程。麥克風宣布本輪怒氣滿意度調查，所有問卷都填很滿意，只有你的拳頭因為沒寫部門被退件。台上的冷凍櫃忽然開始主持，要求大家等解凍後再鼓掌。',
 action:'你想像拳頭衝到順哥眼前，卻被登記成區塊鏈上的待確認交易。高粱瓶排隊當節點，誰都說自己還需要共識。你等到白板長出鬍子，拳頭仍卡在確認中，唯一完成的是飲水機的流動性報告。',
 hester:'你在腦內一拳揮出，海姐把拳風分成需求、提案與待跟進三格。你的怒氣還沒成交，就先被問有沒有聯絡同意。整桌名片變成會飛的待辦，追著拳頭要求先說清楚想解決什麼。',
 simon:'你想像一拳打出去，丁哥卻把它拆成八個設計版本。第一版被說太小，第二版又太兇，最後全場選回第一版。拳頭還在匯出，綽號全才副理的滑鼠已經先替自己送出下班申請。',
 james:'你在腦內朝詹姆士揮拳，他卻騎著門禁卡變成的紙馬繞過七道大門。每扇門都喊歡迎回來，每次出門又有人遞交接單。你追完一圈，拳頭回到起點，卡套反而先集滿了一盤青菜。',
 johnny:'你想像拳頭砸向強尼的專案表，整張表卻突然展開成第三個維度。你的拳頭被排進本週交付，八個問號各占一位主管。強尼拿著變更單追過來，請你先回答這一下要取消哪一個原本的需求。'
};
export function rageTargetForV65(event){
 return CAST_IDS_V65.includes(event?.speaker)&&event.minRules>=39?event.speaker:rageTargetForV39(event);
}
export function getRageV65(run){
 const id=run?.rageContext?.target;
 if(!isCastV65(run)||!CAST_IDS_V65.includes(id))return getRageV39(run);
 if(run.eventId!=='rage-release')return getRageV14(run,Object.fromEntries(Object.entries(PERSONAS).map(([key,p])=>[key,p.name])));
 const p=CAST_PROFILES_V65[id],ctx=run.rageContext,hot=run.stats.mood<=25,realWeight=Math.max(12,Math.min(64,28+(hot?23:run.stats.mood>=65?-12:0))),meal=ctx.eventId===`meal-with-${id}`;
 const phase=ctx.phase==='result'?'剛才已經發生的回應仍留在紀錄裡，這一下不能把它撤回。':'原本的事情還沒作答，對方也仍在等你的回覆。';
 return {id:'rage-release',kind:'rage',speaker:id,minRules:39,...(meal?{privateContext:true}:{}),era:'當場暴走・原創分支',sourceIds:['castFictionV65','characterFiction'],title:'受不了了，扁他。',body:`${p.name}就在剛才的場合，沒有轉去找不在場的人。${meal?'你們還在那頓尚未結束的飯局裡。':'工作與交辦還留在原處，旁邊的人也看見你握緊了手。'}`,wing:'先停一下，把你現在要說的那件事講清楚。',choices:[{text:'受不了了，扁他。',detail:'',result:'',delta:{},flags:[],effect:'rageReturn',rageTarget:id,draw:{label:'剛才發生了什麼',outcomes:[
  {weight:100-realWeight,label:'腦內劇場',result:`${dreams[id]}${phase}你眨了一下眼，雙手仍在原處；${p.name}沒有挨打，剛才全是腦內的夢境。`,delta:{mood:hot?17:9,energy:-3,boss:0},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},
  {weight:realWeight,label:'真的失控了',result:`你真的出手打到${p.name}。對方往後退，附近的人立刻把你們隔開，原本的對話停了下來。${phase}沒有夢醒，也沒有重來；在場的人各自留下經過，出手造成的責任與原本的爭點得分開面對。`,delta:{mood:hot?10:-8,energy:-11,boss:0,trust:-7},effect:'rageAftermath',flags:['rage_real']}
 ]}}]};
}
