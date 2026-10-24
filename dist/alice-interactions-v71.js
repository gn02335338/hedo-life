import {isCareerContentV71,ALICE_PROFILE_V71} from './career-content-v71.js';
import {MEAL_GUEST_IDS_V65,MEAL_EVENTS_V65,getMealEventV65} from './meals-cast-v65.js';
import {getRageV65,rageTargetForV65} from './rage-cast-v65.js';
import {getRageV14} from './rage-v14.js';
import {PERSONAS} from './persona.js';
import {characterHistoryChanges} from './character-stats.js';
import {countsFriendlyPatronageEncounterV68} from './patronage-familiarity-v68.js';

export const MEAL_GUEST_IDS_V71=Object.freeze([...MEAL_GUEST_IDS_V65,'alice']);
export const MEAL_EVENTS_V71=Object.freeze([...MEAL_EVENTS_V65,'meal-with-alice']);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const empty=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});
export function aliceInvitationProfileV71(run){
 let familiarity=0,affinity=50,realHits=0,recentInsults=0;
 for(const change of characterHistoryChanges(run).filter(row=>row.id==='alice')){
  const row=run.history[change.historyIndex];affinity+=change.affinityDelta;realHits+=change.realHits;
  if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome&&countsFriendlyPatronageEncounterV68(run,row))familiarity++;
  if(row.verbalOutcome&&change.affinityDelta<0&&Number.isInteger(row.turn)&&run.turn-row.turn<=3)recentInsults++;
 }
 const sameDepartment=run.actualRoleId==='hr';
 return {familiarity,affinity,realHits,recentInsults,acceptChance:clamp((sameDepartment?.56:.44)+Math.min(6,familiarity)*.065+(affinity-50)*.004-Math.min(.75,realHits*.4)-Math.min(.30,recentInsults*.12),.03,.85)};
}
function invitation(run){
 const p=ALICE_PROFILE_V71,flag=`meal_invite_alice_day_${run.turn}`,attempted=!!run.flags?.[flag],{acceptChance}=aliceInvitationProfileV71(run);
 return empty(attempted?'愛麗絲今天已經問過了。':`傳訊息約愛麗絲吃飯（成行餐費 ${p.cost} 存款）`,'mealPick',{mealTarget:'alice',mealCost:p.cost,available:!attempted&&run.stats.cash>=p.cost,draw:{label:'飯局邀請回覆',outcomes:[
  {weight:acceptChance,label:'答應赴約',result:'愛麗絲說今晚剛好有空，先約好時間。手機上的活動先不開，這次只答應吃飯，還沒有付餐費。',delta:{},flags:[flag],effect:'mealPick'},
  {weight:1-acceptChance,label:'今天約不到',result:'愛麗絲說今天已經有安排，改天再問。你收起菜單，沒有用餐或付費，也沒有替拒絕加上一段友情扣分。',delta:{},flags:[flag],effect:'mealDeclined'}
 ]}});
}
const chat=[
 ['聊聊最近想玩的遊戲，先問愛麗絲今天想不想聊。',[
  '愛麗絲把最近研究的隊伍講得很起勁，也認真聽你說近況。手機一直放在桌邊，兩個人倒是把飯吃熱了。',
  '你們交換幾句遊戲與生活近況，話題不用每一段都接滿。吃完各自回家，這頓沒有附加活動出席表。',
  '你順口追問和船長到底誰先不理誰，愛麗絲把話停住。原本只是吃飯，你卻差點把桌子變成同事關係審查會。'
 ]],
 ['把菜單當十連抽，保底一定有一盤真的能吃的青菜。',[
  '愛麗絲替青菜加上金色邊框，你替白飯配出場音效。兩人笑到服務生也問今天抽到什麼，最後菜倒是一樣也沒剩。',
  '愛麗絲笑說今天只抽一道主菜，不追加第二輪。你們收起手機正常吃飯，玩笑剛好停在舒服的位置。',
  '愛麗絲說今天想安靜吃飯，你卻連每一道菜都要配抽卡音效。你把手機收起來時，這場玩笑已經比本人想玩的多了兩輪。'
 ]]
];
function dinner(run){
 if(run.mealContext?.page!==3||run.mealContext.guest!=='alice')throw Error('Invalid Alice dinner context');
 const profile=aliceInvitationProfileV71(run),cost=ALICE_PROFILE_V71.cost;
 return {id:'meal-with-alice',speaker:'alice',kind:'self-care',minRules:39,privateContext:true,era:'下班飯局・卡池先休息',sourceIds:['aliceFictionV71','characterFiction'],title:'今天先吃飯，卡池不會替你把飯吃熱。',body:'愛麗絲把手機扣在桌上，說晚餐不用搶活動首殺。你們先看菜單，船長的名字沒有被放進問題清單；想聊什麼，等本人願意再說。',wing:'先吃飯。要玩等吃完，不想聊遊戲也可以。',choices:[...chat.map(([text,flavor],replyIndex)=>{
  const warm=clamp(.43+Math.min(5,profile.familiarity)*.035+(profile.affinity-50)*.003-(replyIndex?.025:0),.2,.76),mine=clamp((replyIndex?.24:.15)+profile.realHits*.12+profile.recentInsults*.04-(profile.affinity-50)*.001,.06,.45),neutral=Math.max(.03,1-warm-mine),delta={cash:-cost,mood:replyIndex?34:31,energy:replyIndex?15:18,trust:replyIndex?4:6,...(replyIndex?{slack:5}:{})};
  return {text:`${text}（花費 ${cost} 存款）`,detail:'',result:'',delta,flags:['spend_mood','spend_network','meal_shared','meal_guest_alice'],effect:'mealFinish',mealCost:cost,available:run.stats.cash>=cost,...(replyIndex?{wild:true}:{}),draw:{label:'餐桌氣氛',outcomes:[['warm','聊得很開',warm,Math.min(12,8+Math.min(3,profile.familiarity))],['neutral','平常吃飯',neutral,0],['mine','不小心踩雷',mine,replyIndex?-9:-6]].map(([reaction,label,weight,affinityDelta],index)=>({weight,label,result:flavor[index],delta:{...delta},mealOutcome:{version:1,target:'alice',replyIndex,reaction,affinityDelta}}))}};
 }),empty('今天先取消，不把一頓飯變成誰欠誰。','mealCancel',{result:'你向愛麗絲說明今天先不吃，兩人各自收起菜單。沒有正式用餐，也沒有付餐費。'})]};
}
export function getMealEventV71(run){
 if(!isCareerContentV71(run))return getMealEventV65(run);
 if(!['self-care','crisis-mood'].includes(run.mealContext?.origin))throw Error('Invalid Alice meal origin');
 if(run.eventId==='meal-with-alice')return dinner(run);
 const event=getMealEventV65(run);
 if(event.id!=='meal-guests-d')return event;
 return {...event,body:event.body.replace('六位同事','七位同事'),choices:[...event.choices.slice(0,6),invitation(run),...event.choices.slice(6)]};
}
export const rageTargetForV71=(run,event)=>isCareerContentV71(run)&&event?.speaker==='alice'?'alice':rageTargetForV65(event);
export function withAliceRageCopyV71(event,run){
 if(!isCareerContentV71(run)||run.rageContext?.target!=='alice'||event.id!=='rage-release')return event;
 const phase=run.rageContext.phase==='result'?'剛才已經選過的回應仍算數，不能靠這一下倒帶。':'原本的話還沒回，愛麗絲仍在等你說接下來怎麼安排。';
 return {...event,speaker:'alice',choices:event.choices.map(choice=>({...choice,...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({...outcome,result:outcome.label==='腦內劇場'?`你在腦內揮出一拳，愛麗絲卻把拳頭畫成保底倒數的卡片。金光亮了，抽出來的是一張「請先把話講完」。你眨眼，雙手還在桌邊；愛麗絲沒有挨打，整段都只是想像。${phase}`:`你真的出手打到愛麗絲。手機被放到一邊，旁人把你們隔開，確認有沒有人受傷。沒有金光，也沒有重抽；原本的爭點與出手的後果必須分開處理。${phase}`}))}}:{})}))};
}
export function getRageV71(run){
 if(!isCareerContentV71(run)||run.rageContext?.target!=='alice')return getRageV65(run);
 if(run.eventId!=='rage-release')return getRageV14(run,Object.fromEntries(Object.entries(PERSONAS).map(([id,person])=>[id,person.name])));
 const hot=run.stats.mood<=25,realWeight=hot?53:run.stats.mood>=65?17:31;
 return withAliceRageCopyV71({id:'rage-release',speaker:'alice',kind:'rage',minRules:39,era:'當場暴走・原創分支',sourceIds:['aliceFictionV71','characterFiction'],title:'受不了了，扁他。',body:'愛麗絲就在剛才的場合，原本的事還擺在兩人之間。你握緊手，這次的動作不會由遊戲幫你取消。',wing:'先把手機放下。你現在到底想說哪件事？',choices:[{...empty('受不了了，扁他。','rageReturn'),rageTarget:'alice',draw:{label:'剛才發生了什麼',outcomes:[{weight:100-realWeight,label:'腦內劇場',result:'',delta:{mood:hot?17:9,energy:-3,boss:0},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},{weight:realWeight,label:'真的失控了',result:'',delta:{mood:hot?10:-8,energy:-11,boss:0,trust:-7},effect:'rageAftermath',flags:['rage_real']}]}}]},run);
}
export function aliceVerbalLineV71(run,event,target,phase='event'){
 if(!isCareerContentV71(run)||target!=='alice')return null;
 if(event?.id==='meal-with-alice')return phase==='result'?'愛麗絲，靠北，剛才講好的晚餐就照原話。不要把吃完飯又改成陪你無限再一局。':'愛麗絲，幹，這頓飯不是限時活動。聊什麼、玩不玩都先問本人，別把我的晚上拿去補你的進度。';
 return event?.verbalLinesV71?.[phase==='result'?1:0]||'愛麗絲，幹，眼前的安排先講清楚。我的時間不是遊戲體力，別一句再一下就當作可以無限追加。';
}
export function withAliceVerbalScenarioV71(event,run){
 if(!isCareerContentV71(run)||run.verbalContext?.target!=='alice'||run.verbalContext.stage!=='release')return event;
 const privateScene=event.privateContext===true||event.scope==='private',voice={ignored:'愛麗絲把手機扣回桌上，說先停在這裡。你的火氣沒有換到一張新卡，原本那個安排仍得照本人意願確認。',relationship:'愛麗絲不再主動丟遊戲邀請，後續有事只回必要的幾句。你的重話沒有被當作同事之間的音效。',retort:'愛麗絲回你，自己也不喜歡被人替私人時間作主，為什麼你要先把人罵一遍才願意談界線。兩人都收起手機，話卻沒有因此比較容易說。',support:'旁邊的人把剛才真正漏講的約定列出來，愛麗絲同意逐項確認。問題終於有人一起看，剛才的口氣也沒有被抽卡特效蓋掉。',personnel:'愛麗絲把原話與工作安排分開留下，找人事窗口確認後續。這不是你已經自願離職，正式條件仍得另外看清楚。',legal:privateScene?'愛麗絲保留這段私人對話，要求把原話與前後文核對。晚餐沒有變成解僱通知，但傷人的說法也不能按重抽刪除。':'愛麗絲保留原話與在場經過，要求正式釐清。你原本想問的工作安排與說出口的方式，接下來分開處理。'};
 return {...event,choices:event.choices.map(choice=>({...choice,...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>voice[outcome.verbalKind]?{...outcome,result:voice[outcome.verbalKind]}:outcome)}}:{})}))};
}
