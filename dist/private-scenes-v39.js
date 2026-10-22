import {PERSONAS} from './persona.js';

const privateIds=new Set(['kind-break','kind-workday','banquet-afterparty','self-care']);
export function isPrivateSceneV39(event){
 return Boolean(event)&&(event.scope==='private'||event.privateContext===true||privateIds.has(event.id)||/^meal-(?:with-|guests-)/.test(event.id||''));
}
export function privateReturnEffectV39(source,run){
 if(['kind-break','kind-workday','self-care'].includes(source?.id))return 'cancelBreak';
 if(source?.id==='banquet-afterparty')return 'banquetFinish';
 if(/^meal-with-/.test(source?.id||''))return 'mealFinish';
 if(/^meal-guests-/.test(source?.id||''))return 'mealCancel';
 return null;
}
const name=target=>target==='self'?'你自己':PERSONAS[target]?.name||'對方';
const c=(text,result,delta={},effect='rageReturn',flags=[],extra={})=>({text,detail:'',result,delta,effect,flags,...extra});
const event=(id,title,body,speaker,choices)=>({id,title,body,speaker,wing:'',choices,kind:id.startsWith('rage-')?'rage-world':'verbal',scope:'private',era:'私人場合・自己的後續',sourceIds:['characterFiction']});
const result=(weight,label,text,delta,effect,flags=[])=>({weight,label,result:text,delta,effect,flags});

function privateRage(run){
 const context=run.rageContext;if(!context)throw new Error('Missing private rage context');
 const who=name(context.target),late=context.phase==='result';
 const origin=late?'剛才那筆錢已經付了，這晚卻還沒結束。':'原本只是問今晚怎麼安排，話還沒聊完。';
 if(run.eventId==='rage-release'){
  const hot=run.stats.mood<=25,realWeight=hot?56:run.stats.mood>=65?18:34;
  return {...event('rage-release','受不了了，扁他。',`${who}還在眼前。${origin}你握緊手，連自己都聽見了呼吸聲。`,context.target,[{
   ...c('受不了了，扁他。',''),rageTarget:context.target,draw:{label:'剛才發生了什麼',outcomes:[
    result(100-realWeight,'腦內劇場',`你在腦內朝${who}揮了一拳，對方那串理由被打成一排問號。你眨眼，自己的手仍放在桌邊。對方還在講，你剛才只偷偷替這段對話加了一場動作戲。`,{mood:hot?17:9,energy:-3,boss:0},'rageReturn',['rage_imagined','rage_catharsis']),
    result(realWeight,'真的失控了',`你的手真的揮了出去，杯子碰倒，${who}往後退。旁邊的人立刻把你們隔開，有人遞紙巾，也有人拿起電話。你等了一秒，沒有醒來；這一晚得收拾的，已經不只桌上那灘水。`,{mood:hot?10:-8,energy:-11,boss:0,trust:-4},'rageAftermath',['rage_real'])
   ]}
  }]),kind:'rage'};
 }
 if(run.eventId==='rage-aftermath')return event('rage-aftermath','杯子扶正了，人先坐遠一點。',`${who}坐在另一邊，旁邊的人請你先別靠過去。有人問哪裡痛，有人確認剛才誰站在哪裡。你把手收回來，才發現原本打算說的那句話，現在已經用不上了。`,context.target,[
  c('到派出所，各自把今晚看到的事說清楚。','你們分開說明經過，連誰先站起來都得重新核對。那句「反正就是他先」被追問了好幾次，終於拆成幾句能記下來的話。',{mood:-3,energy:-2},'rageLegal',['private39_police']),
  c('先看傷，安排就醫，收據與聯繫方式都留下。','今晚的行程表被換成掛號與交通安排。你留下聯繫方式，看著原本要拿來吃喝的錢，開始有了另一種用途。',{mood:-2,energy:-2},'rageShowdown',['private39_medical']),
  c('收起保溫杯麥克風，改開一場不准搶話的收據記者會。','保溫杯被請下台，紙筆正式接班。你們輪流說看見什麼、花了什麼；這次有人一搶話，旁邊的人就把杯蓋蓋上。',{mood:2},'ragePublic',['private39_records'],{wild:true})
 ]);
 if(run.eventId==='rage-legal')return event('rage-legal','兩份筆錄，三個版本。',`${who}坐在等候區另一頭。你們連杯子倒向哪邊都記得不一樣，旁人又補上一個版本。紙杯裡的水喝完了，事情還沒核對完；你第一次希望今晚有的只是普通加班。`,context.target,[
  c('把確定的經過與聯繫方式留下，等後續正式通知。','你把記得的經過說清楚，不確定的地方另外註記。那一下沒有被刪掉，前面的對話也留下來了。副本收進包裡，你先把自己帶回家，後續照通知處理。',{mood:3,energy:-1},'rageReturn',['private39_personal_legal','private39_resolved']),
  c('願意談個人調解，先把雙方能確認的部分寫下來。','你們先列出能確認的事項，談不攏的另外留著。對方沒有突然變成朋友，這一晚也沒有人當場獲判勝負；至少接下來該聯繫誰，終於寫清楚了。',{mood:5,energy:-1},'rageReturn',['private39_mediation','private39_resolved']),
  c('申請停用「都是別人的錯」快捷鍵，整段經過改手動輸入。','你把每一步重新講完，發現這比那句快捷鍵長得多。等候區的水又喝掉一杯，包裡多了一份要好好保管的紀錄。今晚總算能先各自回家。',{mood:4},'rageReturn',['private39_records','private39_resolved'],{wild:true})
 ]);
 if(run.eventId==='rage-showdown')return event('rage-showdown','帳單是實際的，氣勢不能折抵。','掛號與交通收據排在一起，字都不大，金額卻很清楚。原本要點的那杯飲料還沒喝到，你先開始算今晚到底花了多少。',context.target,[
  c('先付 12 存款的這輪費用，保存收據、後續再核對。','你付了列明的這輪費用，把收據收好。今晚的餐費沒有很驚人，後來這一筆倒讓你記得很久。',{cash:-12,mood:4},'rageReturn',['private39_medical','private39_resolved'],{available:run.stats.cash>12}),
  c('先確認付款方式，沒有核對清楚的部分留下書面。','你請對方逐項列明，不再靠音量猜金額。還要核對的部分留給後續聯繫，收據先夾進包裡，今晚不再加點。',{mood:2,energy:-2},'rageReturn',['private39_bills','private39_resolved']),
  c('替氣勢申請健保卡，申請失敗後自己認真看收據。','氣勢找不到證件，也拿不出錢。你把玩笑收起來，核對收據、留下聯繫方式，終於肯替今晚按下散場。',{mood:3},'rageReturn',['private39_bills','private39_resolved'],{wild:true})
 ]);
 if(run.eventId==='rage-public')return event('rage-public','收據記者會，最後一位提問。','紙上分成經過、費用與後續聯繫三欄。保溫杯已經冷了，旁邊的人只想知道什麼時候能各自回家。你看了一眼手機，這次決定別再補發一段長文。',context.target,[
  c('把彼此的版本分開保存，停止公開追罵。','你收好各自的紀錄，沒有把私人資料丟上網，也不再搶最後一句。需要處理的部分留下窗口，今晚先散了。',{mood:5},'rageReturn',['private39_records','private39_resolved']),
  c('把「年度最佳失控」獎座收起來，先把自己帶回家。','沒有人頒獎，倒有人把你的包遞過來。你留下後續聯繫方式，帶走紙筆與冷掉的保溫杯，結束這場誰都不想加演的晚上。',{mood:4,energy:-1},'rageReturn',['private39_records','private39_resolved'],{wild:true})
 ]);
 throw new Error('Unknown private rage scene');
}

function privateVerbal(run,source){
 const context=run.verbalContext;if(context?.version!==2)throw new Error('Missing private verbal context');
 const who=name(context.target),self=context.target==='self';
 if(context.stage==='release'){
  const kinds=self?['ignored','retort','support']:['ignored','relationship','retort','support','legal'];
  const reactions={ignored:self?'空氣沒有回嘴，你連自己的回音都懶得接。':`${who}看你一眼，把話題停在這裡。你的重話落了地，沒有人替它續攤。`,relationship:`${who}收起笑臉。你後來再傳訊息問有沒有空，畫面只停在已讀；原本很會答應的人，這次連「下次啦」都省了。`,retort:self?'你連自己都罵了進去，旁邊的人問要不要先喝口水。':`${who}立刻反嗆。你們越講越大聲，旁邊的人只好遞來一杯水，問能不能先讓杯子講兩句。`,support:'旁邊的人把真正沒講清楚的約定接回來，一項項問誰答應了什麼。你終於不用再拿音量替細節加粗。',legal:`${who}把你的原話打進手機，問你要不要再確認一次。剛才講得很快，現在每個字都被停在螢幕上。`};
  const labels={ignored:'對方沒有接招',relationship:'關係當場冷掉',retort:'原話反嗆回來',support:'有人補上前情',legal:'進入正式說明'};
  const weights={ignored:34,relationship:26,retort:20,support:15,legal:5},affinity={ignored:0,relationship:-32,retort:-15,support:-5,legal:-28};
  return {...source,scope:'private',speaker:context.target,wing:'',kind:'verbal',title:'這句話，真的在私下說出口了。',body:`你把那句話回了過去，${self?'旁邊的人也聽見了':`${who}停下手邊的動作`}。原本還能笑著帶過的氣氛，等著下一句接話。`,choices:[c(context.line,'',{},'verbalV2Resolve',[],{draw:{label:'這句話說出口之後',outcomes:kinds.map(kind=>({weight:weights[kind],label:labels[kind],result:`你說：「${context.line}」${reactions[kind]}`,delta:{mood:kind==='retort'?-4:kind==='legal'?-3:5,energy:-1,boss:0},effect:kind==='legal'?'verbalV2Legal':'verbalV2Resolve',flags:['private39_verbal'],verbalKind:kind,affinityDelta:self?0:affinity[kind]}))}})]};
 }
 if(context.stage==='legal')return event('verbal-v2-legal','剛才那句，現在逐字看。',`${who}把原話放在兩人中間，問你到底指的是什麼。你看著自己幾秒前講完的一串話，開始把費用、約定與氣話分開；這次得用完整句子接。`,context.target,[
  c('逐句說明原話與前後文，把費用或約定另行核對。','你把前後文說清楚，金額與約定另外列出來。對方仍有不同說法，這輪先留下待核對的紀錄。',{},'verbalV2LegalResult',['private39_personal_legal'],{verbalLegalResult:'pending'}),
  c('為傷人的說法道歉，沒有同意的付款條件另外寫清楚。','你收回過頭的說法，對方也把自己的意思重新講一遍。雙方把這輪能接受的說明寫下來，總算不用再靠猜誰今天比較不爽。',{mood:3},'verbalV2LegalResult',['private39_personal_legal'],{verbalLegalResult:'settled'}),
  c('請保溫杯暫停發言，改讓完整紀錄當主講人。','保溫杯被移到桌邊，手機裡的訊息依序打開。前情比杯子還長，今晚卻終於有人肯從第一句開始看；對不上的部分，留待後續核對。',{mood:2},'verbalV2LegalResult',['private39_personal_legal'],{verbalLegalResult:'pending',wild:true})
 ]);
 if(context.stage==='legal-result')return event('verbal-v2-legal-result','這輪先說到這裡。',`這次個人爭議${context.legalResult==='settled'?'留下雙方可接受的說明':'仍有待處理的部分'}。你收好紀錄，各自準備離開；這場私人風波沒有更改你的任職狀態。`,context.target,[c('收好紀錄，回到原本尚未完成的安排。','你把手機收進口袋，不再補發最後一段長文。今晚先散，還需要處理的事情照留下的方式聯繫。',{},'verbalV2Resolve',['private39_resolved'])]);
 throw new Error('Unknown private verbal stage');
}

// A private argument can cost resources, but cannot silently turn a one-point
// meter into the employment-exit resolver before its personal aftermath ends.
function privateResources(run,scene){
 const safe=delta=>Object.fromEntries(Object.entries(delta||{}).map(([key,value])=>[key,['energy','mood','cash'].includes(key)&&value<0?Math.max(value,1-run.stats[key]):value]));
 return {...scene,choices:scene.choices.map(choice=>({...choice,delta:safe(choice.delta),...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({...outcome,delta:safe(outcome.delta)}))}}:{})}))};
}
export const getPrivateRageV39=run=>privateResources(run,privateRage(run));
export const getPrivateVerbalScenarioV39=(run,source)=>privateResources(run,privateVerbal(run,source));
