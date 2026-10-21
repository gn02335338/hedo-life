import {PERSONAS} from './persona.js';
import {rageParticipantsFor} from './rage-participants.js';
import {verbalVoiceV30} from './verbal-copy-v30.js';

export const VERBAL_EVENTS_V30=Object.freeze(['verbal-release','verbal-warning','verbal-legal','verbal-legal-result']);
export const VERBAL_KINDS_V30=Object.freeze(['ignored','relationship','retort','support','personnel','legal']);
export const VERBAL_LEGAL_RESULTS_V30=Object.freeze(['withdrawn','settled','pending']);
export const VERBAL_LEGAL_COST_V30=12;

export function verbalTargetsV30(event){
 if(event?.speaker==='exit-team')return rageParticipantsFor(event,'erich');
 if(Object.hasOwn(PERSONAS,event?.speaker||''))return rageParticipantsFor(event,event.speaker);
 return ['self'];
}
const c=(text,result,delta={},effect='verbalReturn',extra={})=>({text,detail:'',result,delta,effect,flags:[],...extra});
const scene=(id,title,body,speaker,choices)=>({id,title,body,speaker,choices,wing:'',kind:'verbal',era:'當場回嘴・實際開口',sourceIds:['characterFiction'],minRules:30});
const boundedLoss=(value,amount)=>Math.max(1-value,amount);
// These short conversations use the same turn as the interrupted scene. Keep
// enough energy/mood to finish their free responses; paid help must leave cash.
const safeDelta=(run,delta)=>Object.fromEntries(Object.entries(delta).map(([key,value])=>[key,['mood','energy'].includes(key)&&value<0?boundedLoss(run.stats[key],value):value]));

function release(run){
 const context=run.verbalContext,{target,eventId:origin,phase}=context,voice=verbalVoiceV30(target,origin,phase,run),s=run.stats;
 const self=target==='self',hot=s.mood<=25,angry=target==='wing'&&s.boss<=18,post=!!run.flags.post_pip_tolerance;
 const weights=self?[50,0,25,25,0,0]:[22,24,20,18,10,6];
 if(!self){
  if(hot){weights[0]-=6;weights[2]+=6;weights[4]+=5;weights[5]+=2;}
  if(angry){weights[0]=5;weights[4]+=22;weights[5]+=8;}
  if(post){weights[0]=Math.max(2,weights[0]-8);weights[4]+=24;weights[5]+=4;}
  if(['hope','erich','jenjen','sonny'].includes(target)){weights[4]+=5;weights[5]+=5;}
  if(['kind','jack','meimei','jonathan'].includes(target)){weights[0]+=7;weights[3]+=8;}
  if(origin==='onboarding'){weights[0]+=8;weights[2]+=4;}
  if(origin.startsWith('pip-')||origin==='salary-final'){weights[4]+=10;weights[5]+=3;}
  if(origin.startsWith('meal-')||origin.startsWith('banquet-'))weights[3]+=8;
 }
 const boss=target==='wing',affinity=self?[0,0,0,0,0,0]:[0,-32,-14,-5,-24,-28];
 const deltas=[{mood:hot?13:7,energy:-1},{mood:5,energy:-2,boss:boss?-15:0},{mood:-12,energy:-4,boss:boss?-12:0},{mood:15,energy:-2},{mood:-9,energy:-3,boss:boss?-24:-3},{mood:-10,energy:-3}];
 const labels=['對方沒有接招','關係一下冷了','原話被反嗆回來','有人替你接了一句','事情轉成人事處理','對方要求正式說明'];
 const outcomes=VERBAL_KINDS_V30.map((kind,index)=>({weight:weights[index],label:labels[index],result:voice[kind],delta:{...safeDelta(run,deltas[index]),energy:deltas[index].energy},
  effect:kind==='legal'?'verbalLegal':kind==='personnel'?'verbalWarning':'verbalReturn',flags:[],verbalKind:kind,affinityDelta:affinity[index]})).filter(outcome=>outcome.weight>0);
 return scene('verbal-release',self?'這次不是心裡罵，是對空氣罵出來。':'這句話，真的越過了會議桌。',
  `你真的開口：${voice.line} ${phase==='result'?'你剛才的選擇已經發生，這次開罵不會把它收回。':'原本的話還沒答完，你先把忍住的那句說了出來。'} 沒有人動手，也不是夢境。`,target,[
   c('惡言相向','',{},'verbalReturn',{draw:{label:'這句話說出口之後',outcomes}})
  ]);
}

const legalText={
 withdrawn:'對方看過前後文，撤回了這一輪要求。事情停在這裡，沒有誰被遊戲宣判有罪；剛才說出口的話與留下的隔閡仍然都在。',
 settled:'雙方把原話、說明與願意接受的收尾方式寫下來，這一輪爭議先停住。沒有自動賠償，也沒有誰突然贏走整間公司；各自收好確認過的文字。',
 pending:'雙方目前沒有談攏，這份往來先留下待處理。故事沒有替任何現實程序預告結果，你也沒有因為回去上班，就答應對方的全部說法。'
};
function legal(run){
 const target=run.verbalContext.target,name=verbalVoiceV30(target,run.verbalContext.eventId,run.verbalContext.phase,run).name;
 const proposal=(text,weights,paid=false)=>c(text,'',{},'verbalLegalResult',{
  available:!paid||(run.stats.cash>VERBAL_LEGAL_COST_V30&&run.stats.energy>2&&run.stats.mood>0),
  draw:{label:'這輪回覆之後',outcomes:VERBAL_LEGAL_RESULTS_V30.map((outcome,index)=>({weight:weights[index],label:{withdrawn:'本輪要求撤回',settled:'這次說明成文',pending:'爭議仍待處理'}[outcome],result:legalText[outcome],
   delta:safeDelta(run,{mood:outcome==='pending'?-4:5,energy:paid?-2:-1,...(paid?{cash:-VERBAL_LEGAL_COST_V30}:{})}),effect:'verbalLegalResult',flags:[],verbalLegalResult:outcome}))}
 });
 return scene('verbal-legal','對方說要正式處理，你也有話要釐清。',`${name}要求把剛才的話留下紀錄。原本的工作先停在這裡，這輪遊戲爭議尚未有結果；你可以說明、道歉，或付費請人協助回覆。這些選擇都不保證對方接受。`,target,[
  proposal('整理原話與前後文，把自己說了什麼講清楚。',[45,25,30]),
  proposal('為失言道歉，也把自己不接受的指控寫清楚。',[25,50,25]),
  proposal(`花 ${VERBAL_LEGAL_COST_V30} 存款，請律師協助正式回覆。`,[35,35,30],true)
 ]);
}
export function getVerbalEventV30(run){
 if(!/^e(?:30|31|32|33|34|35|36|37)-/.test(run?.seed||'')||!run.verbalContext||!VERBAL_EVENTS_V30.includes(run.eventId))throw new Error('Invalid verbal scene');
 const context=run.verbalContext,voice=verbalVoiceV30(context.target,context.eventId,context.phase,run);
 if(run.eventId==='verbal-release')return release(run);
 if(run.eventId==='verbal-warning')return scene('verbal-warning','回嘴的事，被做成一份書面提醒。',`${voice.name}把剛才的對話交給希望。希望請你確認收到提醒，不是讓你承認上面的每一句話，也沒有因此開始另一輪PIP。原本的工作還停在剛才那一幕。`,'hope',[
  c('記下收到的內容與自己的異議，回去處理原本的事。','你把不同意的地方另寫一份，沒有替空白結論補上自己的簽名。這一輪先停在提醒，原本的選擇還在。',safeDelta(run,{mood:-3}), 'verbalReturn'),
  c('為剛才的語氣道歉，不把其他條件一併答應。','你承認剛才罵出口的那句，沒有順手承認整張表。希望收下說明，這次先回原本的談話。',{mood:3},'verbalReturn'),
  c('把這張提醒折成離職信的信封，這次自己離開。','你沒有再等對方安排下一輪改善。交接仍然要做，但離開的決定這次是自己提出的。',{mood:12},'ragequit',{wild:true})
 ]);
 if(run.eventId==='verbal-legal')return legal(run);
 if(!VERBAL_LEGAL_RESULTS_V30.includes(context.legalResult))throw new Error('Missing verbal legal result');
 return scene('verbal-legal-result',{withdrawn:'這輪要求撤回，話還是說過了。',settled:'說明寫下來，爭執先停在這裡。',pending:'這一頁先留待處理，沒有假裝和好。'}[context.legalResult],legalText[context.legalResult],context.target,[
  c('收好這輪紀錄，回到剛才還沒處理完的事情。','你把這份往來另外存好。原本的工作與已做出的選擇沒有被改寫，這次先從停下來的地方繼續。')
 ]);
}
