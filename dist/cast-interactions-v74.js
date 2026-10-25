import {CAST_IDS_V74,CAST_PROFILES_V74,isCastV74} from './cast-v74.js';
import {PERSONAS} from './persona.js';
import {getRageV71,rageTargetForV71} from './alice-interactions-v71.js';
import {getRageV14} from './rage-v14.js';

export const isPrivateCastSceneV74=(run,event)=>Boolean(isCastV74(run)&&event?.requiresCastV74===true&&event?.id?.startsWith('cast74-')&&event?.scope==='private');
export function privateCastSceneAllowedV74(run,event){
 if(!isPrivateCastSceneV74(run,event))return true;
 return !run.pip?.active&&!run.personnelPending&&!['open','queued'].includes(run.salaryAdvice?.status)
  &&run.stats.energy>30&&run.stats.mood>30&&run.stats.boss>12&&run.flags.cast74_private_last_turn!==run.turn+1;
}
// A private gathering can be breakfast or lunch as well as a night out.
// Apply only to inherited personal-aftermath prose for these new scenes.
export const privateCastTimingTextV74=text=>typeof text==='string'?text.replaceAll('你第一次希望今晚有的只是普通加班','你第一次希望眼前只是普通加班').replaceAll('今晚的行程表','這次聚會的安排').replaceAll('這一晚','這次聚會').replaceAll('今晚','這次').replaceAll('這晚','這次聚會').replaceAll('整晚','整段時間').replaceAll('一個晚上','一段時間').replaceAll('下班','私人場合'):text;
function privateTimingCopy(event,run,context){
 if(!isCastV74(run)||event?.scope!=='private'||!context?.eventId?.startsWith('cast74-'))return event;
 const copy=privateCastTimingTextV74;
 const prose=(value,keys)=>{const next={...value};for(const key of keys)if(typeof next[key]==='string')next[key]=copy(next[key]);return next;};
 return {...prose(event,['title','body','wing']),choices:event.choices.map(choice=>({...prose(choice,['text','result','detail']),...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>prose(outcome,['result']))}}:{})}))};
}
const dreams=Object.freeze({
 wine:'你在腦內揮拳，紅酒卻先把拳頭接進監控面板。十七盞告警一起閃，值班表上每格都寫著你的拳頭；他拔掉一條紙做的網路線，整套加班系統終於第一次準時休眠。',
 peter:'你想像一拳揮過去，P神把怒氣拖進遊戲配裝欄。拳頭還沒落下，系統就要求先裝上「請問可以嗎」護腕；助手精靈把擅自碰別人東西的快捷鍵全部收走。',
 tony:'你在腦內揮拳，8+9卻先把自己改名成另一位剛下班的勇者。江湖系統要求你確認對手到底是哪個Tony，早餐店老闆又跳出來問蛋要幾分熟，整場決鬥最後卡在加不加起司。',
 henry:'你想像一拳打出去，老大在半空展開一張技術決策圖。拳頭被分成可行性、風險和誰拍板三條線，連旁邊那杯白開水都要求列席；最後只有一張寫著「先把話講清楚」的便條準時落地。',
 mia:'你在腦內揮出一拳，米雅遞來一張只問本人意願的表。拳頭填完名字，忽然發現自己的用途那欄還空著；一盒衛生紙推著印表機登場，宣布本次怒氣先去洗手再回來。'
});
const voices=Object.freeze({
 wine:{ignored:'紅酒把工單打開，說先看真正卡住的那一行。你那句重話沒有替系統多一份備援，也沒有讓原本的工時自動消失。',relationship:'紅酒不再口頭替你補缺漏，後續都要求先列明範圍。你少了一個願意順手看一眼的人，多了幾封得自己寫完整的信。',retort:'紅酒回你，懂得問責就也把誰先答應寫進去，別只在出事時找系統工程師。工作沒少一張，你們的聲音倒是都超過了監控門檻。',support:'同事翻出工單和寄送時間，幫忙把真正的交付範圍接回來。紅酒願意一起核對，沒有把有人認同問題當成大家認同你的口氣。'},
 peter:{ignored:'P神把眼前的視窗收起來，說要講就講這次哪一段。你的罵聲沒有替助理職稱補上決定權，原本的安排仍需本人確認。',relationship:'P神往後只回正式交辦，不再主動找你聊遊戲。你把話說重了，兩人之間那點能直接開口的方便也跟著少了一截。',retort:'P神回嗆，有問題可以直接講，別先替他把整個人分類完再來談事情。你們都想把界線說清楚，卻先用掉了一輪願意聽的耐性。',support:'旁邊的人把約定和本人意願分開確認，P神也停下手聽完。事情終於有了具體做法，剛才那句過頭的話仍留在兩人的記憶裡。'},
 tony:{ignored:'8+9回了兩句碎念，最後仍問眼前這件事到底怎麼做。你真的罵了，卻沒有因此多一位自動接單的江湖隊友。',relationship:'8+9不再替你留早餐或遊戲隊伍的位置，工作上也只回必要的訊息。這次沒有掉裝，兩人的交情倒是真的少了一格。',retort:'8+9當場把粗話頂回來，連隔壁的保溫杯都像在等裁判。兩人吵完還是得自己把安排說清楚，嘴快沒有讓任何一份交付先結案。',support:'同事先把真正的問題拉回桌上，請兩人別再搶著加重語氣。8+9肯一起核對，這輪支援沒有附贈替所有罵人的字背書。'},
 henry:{ignored:'老大把討論拉回能拍板的條件，沒有接你那句人身評語。圖還在桌上，說重的話也沒有替任何方案自動取得授權。',relationship:'老大把後續改成正式書面確認，原本願意多解釋的背景不再主動補上。你仍能問問題，但得先把每一個前提自己備齊。',retort:'老大反問你，到底要討論技術決定還是先替眼前的人貼標籤。原本需要一份決策紀錄的事，現在多了一段互相解釋口氣。',support:'同事把已知限制與原本承諾攤開，老大同意照同一份資料往下談。這回有人替問題接話，沒有替任何人的重話頒主管證書。'},
 mia:{ignored:'米雅等你說完，先問眼前真正需要協助的是哪一項。她沒有接那句罵，也沒有把客氣變成替你答應全部條件。',relationship:'米雅把後續聯繫留在正式窗口，原本能多問一句的閒聊先收起來。你還能得到流程說明，卻少了一點她願意主動補上的耐心。',retort:'米雅請你把請求說成請求，不要一邊要人幫忙一邊先罵人。你們把事情和口氣分開談，才發現後者已經用掉比原本流程還多的時間。',support:'同事把缺的資料與需要本人同意的地方列出來，米雅接著逐項確認。這回事情有人一起處理，沒有人因此認可把親切當成可以隨便開罵。'}
});

export function castVerbalReactionsV74(target,{privateScene=false}={}){
 const p=CAST_PROFILES_V74[target];if(!p)return {};
 if(privateScene)return {
  ignored:`${p.name}把話題停在這裡，沒有接下你的罵。這次私人安排不會替任何人的工作作決定，眼前的氣氛則真的冷了幾秒。`,
  relationship:`${p.name}收起原本能開玩笑的口氣，之後的私人邀約變得客氣。這次聚會沒有變成人事面談，交情卻實際少了一截。`,
  retort:`${p.name}當場回嗆，說私人安排也該先問本人。旁邊的人請你們把聲音放低，沒有誰需要把這攤送回公司請示。`,
  support:'同桌的人把剛才真正沒講清楚的約定重新問一遍，讓每個人自己回答願不願意。問題得到支持，過頭的罵聲仍要由開口的人負責。',
  legal:`${p.name}保留原話與在場經過，要求後續把意思說清楚。這輪是私人爭議，沒有替你新增離職或資遣。`
 };
 return {...voices[target],personnel:`${p.name}要求把這次原話和工作安排分開留下，再由人事窗口確認後續。這不是你已經提出自願離職，正式通知仍要另行看清楚。`,legal:`${p.name}保留原話與前後文，要求正式釐清。原本的工作問題與當場說法分開處理，遊戲沒有替任何現實程序預告勝負。`};
}
export function castVerbalLineV74(run,event,target,phase='event'){
 if(!isCastV74(run))return null;
 const at=phase==='result'?1:0;
 if(Object.hasOwn(event?.verbalTargetsV74||{},target))return event.verbalTargetsV74[target]?.[at]||null;
 if(event?.requiresCastV74&&event.speaker===target&&event.verbalLinesV74?.[at])return event.verbalLinesV74[at];
 if(event?.requiresCastV74&&event.participants?.includes(target)){
  const who=PERSONAS[target]?.name||'你';
  const authored=event.verbalLinesV74?.[at],primary=PERSONAS[event.speaker]?.name;
  if(authored){
   const escaped=primary?.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const line=escaped?authored.replace(new RegExp(`(^|[。！？!?]\\s*)${escaped}[，,、]\\s*`,'g'),'$1'):authored;
   return line.startsWith(`${who}，`)?line:`${who}，${line}`;
  }
  return event.scope==='private'?`${who}，幹，這次要去哪、誰願意去，當面問清楚。不要替別人的私人時間先按同意，再讓本人負責收場。`:`${who}，靠北，剛才這件事先把負責人和範圍講清楚。別把別人還沒答應的部分，直接寫成今天就要交的工作。`;
 }
 if(!CAST_IDS_V74.includes(target))return null;
 return event?.scope==='private'||event?.privateContext?`${CAST_PROFILES_V74[target].name}，幹，這是私人安排，不是誰自動欠你一段時間。問本人想不想參加，別拿交情替人答應。`:`${CAST_PROFILES_V74[target].name}，靠北，眼前這項先講清楚。誰答應哪段就照原話留下，別把一句幫忙弄成整包都歸我。`;
}
export function withCastVerbalScenarioV74(event,run){
 const c=run?.verbalContext;
 event=privateTimingCopy(event,run,c);
 if(!isCastV74(run)||c?.stage!=='release')return event;
 const privateScene=event.scope==='private'||event.privateContext===true;
 const voice=castVerbalReactionsV74(c.target,{privateScene});
 if(!CAST_IDS_V74.includes(c.target)&&!(privateScene&&c.eventId?.startsWith('cast74-')))return event;
 if(!CAST_IDS_V74.includes(c.target))Object.assign(voice,{ignored:`${PERSONAS[c.target]?.name||'對方'}停下話題，沒有接你的罵。這攤的安排仍按本人意願，沒有因此改成一場公司談話。`,relationship:'對方收起原本能開玩笑的口氣，這一輪的交情實際冷了些。私人邀約沒有改變你的任職，卻也不會替難聽的話自動按下撤回。',retort:'對方立刻反嗆，請你別替別人的私人時間先作主。同桌的人把聲音壓下來，讓每個人重新說自己答應了什麼。',support:'同桌的人把真正沒講清楚的約定攤開，讓每個人自己回覆。有人支持把事情說清楚，沒有因此替罵人的口氣背書。',legal:'對方保留原話與在場經過，要求後續正式說明。這輪是私人爭議，沒有替你新增離職或資遣。'});
 return {...event,choices:event.choices.map(choice=>({...choice,...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>voice[outcome.verbalKind]?{...outcome,result:voice[outcome.verbalKind]}:outcome)}}:{})}))};
}
export const rageTargetForV74=(run,event)=>isCastV74(run)&&CAST_IDS_V74.includes(event?.speaker)?event.speaker:rageTargetForV71(run,event);
export function withCastRageCopyV74(event,run){
 event=privateTimingCopy(event,run,run?.rageContext);
 const id=run?.rageContext?.target;if(!isCastV74(run)||event.id!=='rage-release')return event;
 if(event.scope==='private'&&run.rageContext.eventId?.startsWith('cast74-'))event={...event,body:`${PERSONAS[id]?.name||'對方'}仍在剛才的私人聚會裡。${run.rageContext.phase==='result'?'剛才已經發生的回覆與花費都保留，這一下不能倒帶。':'原本那句話還沒答完，對方仍在等你。'}你握緊手，沒有轉去找一位只被提到名字的人。`};
 if(!CAST_IDS_V74.includes(id))return event;
 const p=CAST_PROFILES_V74[id],phase=run.rageContext.phase==='result'?'剛才已經做出的選擇仍然算數。':'原本的話還沒答完，對方仍在眼前。';
 return {...event,speaker:id,choices:event.choices.map(choice=>({...choice,...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({...outcome,result:outcome.label==='腦內劇場'?`${dreams[id]}你眨眼，雙手仍在原位；${p.name}沒有挨打，剛才全是想像。${phase}`:`你真的出手打到${p.name}，旁邊的人立刻把你們隔開，確認有沒有人受傷。${phase}這次沒有夢醒，原本的爭點與出手後的責任必須分開處理。`}))}}:{})}))};
}
export function getRageV74(run){
 const id=run?.rageContext?.target;if(!isCastV74(run)||!CAST_IDS_V74.includes(id))return getRageV71(run);
 if(run.eventId!=='rage-release')return getRageV14(run,Object.fromEntries(Object.entries(PERSONAS).map(([key,p])=>[key,p.name])));
 const p=CAST_PROFILES_V74[id],hot=run.stats.mood<=25,realWeight=hot?53:run.stats.mood>=65?17:31;
 return withCastRageCopyV74({id:'rage-release',speaker:id,kind:'rage',minRules:39,era:'當場暴走・原創分支',sourceIds:['castFictionV74','characterFiction'],title:'受不了了，扁他。',body:`${p.name}就在剛才的場合，原本的事仍擺在你們之間。你握緊手，沒有轉去找一位只被提到名字的人。`,wing:'先停一下。你現在要說的是哪件事？',choices:[{text:'受不了了，扁他。',detail:'',result:'',delta:{},flags:[],effect:'rageReturn',rageTarget:id,draw:{label:'剛才發生了什麼',outcomes:[
  {weight:100-realWeight,label:'腦內劇場',result:'',delta:{mood:hot?17:9,energy:-3,boss:0},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},
  {weight:realWeight,label:'真的失控了',result:'',delta:{mood:hot?10:-8,energy:-11,boss:0,trust:-7},effect:'rageAftermath',flags:['rage_real']}
 ]}}]},run);
}

// These are deliberately about the current request, not private biographies.
export function castPatronageVoiceV74(target){
 const p=CAST_PROFILES_V74[target];if(!p)return null;
 return {line:`${p.name}，這項先照我的安排。自己人的事情，先替我接好。`,privateLine:`${p.name}，這次先聽我的。自己人這桌，安排就照我說的走。`,
  obliged:`${p.name}先接下眼前那一段，也把需要你負責的部分留下。你取得一點方便，沒有取得無限追加工作的權限；這句交辦是你自己開口的。`,
  retort:`${p.name}問你，名片上是不是還印著替別人決定的權限。你想省掉一輪確認，先收到一段本人並未答應的說明；這輪事情收在明確的拒絕裡。`,
  reported:`${p.name}找原本負責人核對，把你的要求完整留下。自己人沒有自動變成新的決策窗口，你那句先處理倒是有了能追問的名字。`,
  welcomed:`你把真正需要協助的部分說清楚，${p.name}便替你接了一段。這次少用一點架子，對方反而願意多幫一點；你仍負責自己答應的事。`};
}
export function castPrivatePatronageV74(target){
 const p=CAST_PROFILES_V74[target];return p?[
  `${p.name}配合了一項安排，接著把自己的時間說清楚。你得到一點面子，沒有得到整段行程的私人助理；這攤先照本人願意的部分走。`,
  `${p.name}說私人場合沒有自己人專用服務，請每個人自己決定。你那句命令被擋回來，這次卻沒有因此變成人事談話。`,
  `${p.name}轉去問同桌的人怎麼安排，沒有再等你發號施令。你仍有原本的工作，這一輪的私人主場則沒能靠稱號保留。`,
  `你把命令改成邀請，${p.name}也願意多留一段聊天。沒有人替誰安排整段行程，這次的熟悉反而真的接住了眼前這一攤。`
 ]:null;
}
