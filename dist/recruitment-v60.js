import {ROLE_MAP,RANDOM_BASE_ROLE_IDS_V60} from './roles.js';
import {isRecruitmentV60} from './seed-profile-v60.js';
import {appointmentPayV67,isPatronageBenefitsV67} from './patronage-benefits-v67.js';
export {isRecruitmentV60} from './seed-profile-v60.js';
const hash=value=>{let result=2166136261;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619)>>>0;return result;};
// A special ticket preserves an existing professional record and ending family.
// It never introduces a fourteenth occupation or trusts a client-side flag.
export function directEntryV60(runOrSeed){
 const seed=typeof runOrSeed==='string'?runOrSeed:runOrSeed?.seed;
 if(!isRecruitmentV60(seed)||seed[8]==='n')return null;
 const kind=seed[8]==='s'?'son':'daughter';
 return {kind,roleId:RANDOM_BASE_ROLE_IDS_V60[hash(`${seed}:professional-record`)%RANDOM_BASE_ROLE_IDS_V60.length],gender:kind==='son'?'male':'female',title:kind==='son'?'乾兒子':'乾女兒'};
}
export const entryLabelV60=run=>directEntryV60(run)?'特別任用職缺':ROLE_MAP[run?.roleId]?.name||'';
const choice=(text,result,delta={},extra={})=>({text,result,delta,effect:null,flags:[],detail:'',...extra});
export function withRecruitmentOnboardingV60(event,run){
 const entry=directEntryV60(run);if(!entry||event?.id!=='onboarding')return event;
 const terms=isPatronageBenefitsV67(run)?`希望把待遇另外列清楚：接受任用後月薪 ${appointmentPayV67(run,run.pay)}K，另給一次安家補助，之後每完成兩個工作回合發生活津貼。補助與津貼使用存款指數，仍受 100 上限限制。`:'';
 return {...event,title:'錄取的是特別職缺，報到才知道親屬稱謂。',body:`錄取通知只寫「特別任用職缺」，總經理室說工作內容報到再談，專業履歷仍以${ROLE_MAP[run.roleId].name}建檔。你剛放下包包，翅膀就把新名片推過來：${entry.title}。希望說這是特殊任用，不是升上主管；原來的專業履歷保留，月薪會按新任用調整。${terms}瑞克的手機正好響起，他看了名片一眼，接電話時把椅子往翅膀那邊挪了一點。`,wing:`以後就是自己人。工作可以慢慢熟，先讓我知道你站哪邊。`,participants:['wing','hope','rick'],choices:[
  choice(`收下${entry.title}名片，請希望把任用與薪資寫清楚。`,`你收下新名片，請希望把職稱與月薪一併確認。翅膀說自己人不用那麼見外，瑞克卻把自己的名片翻了過來。你還沒坐穩，這個沒有公開招募的職缺已經有了同業競爭。`,{boss:5,mood:9,trust:-8,lick:3},{effect:'directPatronageAppoint'}),
  choice('先替組織圖加一條家譜線，並註明這不是血緣鑑定。',`希望替組織圖另存一版，沒有替任何人補出血緣。翅膀對「自己人」三個字很滿意，也同意照新任用列薪資；瑞克說椅子已經很擠，你只好先確認自己是不是得連辦公椅一起應徵。`,{boss:3,mood:7,trust:-5,lick:2},{effect:'directPatronageAppoint',wild:true}),
  {...event.choices[2],text:'這個職缺跟想像的不一樣。名片先留著，我今天就離開。',result:'你把名片留在桌上，明確拒絕這份特殊任用。希望收回尚未生效的薪資表，翅膀還在說機會難得，你已經走出門口；瑞克這次沒有出聲挽留。'}
 ]};
}
const WELCOME=Object.freeze([
 {id:'recruitment60-rick',speaker:'rick',era:'特殊任用・瑞克來認人',title:'名片多一張，老闆的電話還是那一支。',body:'瑞克把椅子挪過來，先問翅膀剛才到底怎麼介紹你。他說老闆有事通常先找他，手機也特別放在兩人之間。旁邊那份待辦卻跟著往你這邊滑，像是「自己人」三個字還附送了自動轉單。',wing:'有事先問我。老闆電話來的時候，不要搶著接。',choices:[
  choice('先把誰負責什麼寫清楚。我不接你的整張待辦。','你請瑞克把交辦人與負責範圍寫上去。他把待辦收回一半，說新人先不用知道太多；電話仍留在他的手邊。至少這次，你沒有把稱呼收下、工作也整包收下。',{trust:2,mood:2},{affinityDelta:-2}),
  choice('位置不用讓，老闆電話也不用每次開擴音。','瑞克把手機拿近一點，提醒你自己在這裡待得比較久。你沒有爭那支電話，兩張新舊名片之間卻像突然多了一條分機線。往後能不能合作，還得另外算。',{boss:-1,mood:1},{affinityDelta:-6}),
  choice('請影印機印兩張家譜，至少讓備援有文件。','影印機只認紙張尺寸，不認親疏。瑞克看著兩張一模一樣的家譜，說老闆不是這個意思；你把其中一張收好，今天的備援計畫先通過列印測試。',{mood:3,slack:1},{affinityDelta:-3,wild:true})
 ]},
 {id:'recruitment60-princess',speaker:'princess',era:'特殊任用・公主來認人',title:'家譜又加一格，工作不能只畫箭頭。',body:'公主看了你的新名片，再看一眼底下的專業履歷。瑞克是舊任乾兒子，你是剛進門的新自己人；公主沒拿特殊稱謂，組織圖卻從來沒少過她的位置。她的行事曆已經排滿專注時段，桌上那件急單則還沒有負責人。',wing:'Welcome. Just to be clear, being in the same family chart does not make my tasks yours, or yours mine.',choices:[
  choice('先把負責人與交付日期寫清楚，家譜先放旁邊。','公主打開共同文件，加了負責人與日期兩欄，說："That works. Put the owner next to the task." 你們沒有整包接下待辦，組織圖也暫時不用兼任專案計畫。',{trust:3,mood:2},{affinityDelta:4}),
  choice('既然都是自己人，下一件急單就請妳先接吧。','公主挑起眉毛："That is not how delegation works." 急單留在原位。你拿新稱謂試著轉單，先學會了同一張家譜也有不同權限。',{trust:-2,mood:-1},{affinityDelta:-5}),
  choice('任命玩具鵝代理其他交辦事項主管，先給牠空白行事曆。','公主看著小名牌問："Has the goose approved the job description?" 你替玩具鵝留下整天空檔，她笑了一下；真正那件急單，仍得由真人認領。',{mood:3,slack:1},{affinityDelta:2,wild:true})
 ]}
]);
export function getRecruitmentEventV60(run){
 const c=run?.recruitmentContext,entry=directEntryV60(run);
 if(!entry||!c||c.version!==1||![0,1].includes(c.stage))throw new Error('Invalid recruitment welcome');
 const copy=WELCOME[c.stage];return {...copy,kind:'recruitment',scope:'work',scene:'office_day',sourceIds:['characterFiction'],choices:copy.choices.map(row=>({...row}))};
}
export function recruitmentOutcomeV60(run,event,index,effect){
 const entry=directEntryV60(run);if(!entry)return null;
 if(event.id==='onboarding'&&[0,1].includes(index)&&effect==='directPatronageAppoint')return {version:1,kind:'appointment',variant:entry.kind,target:'rick',affinityDelta:-18};
 if(event.id==='onboarding'&&index===2)return {version:1,kind:'declined',variant:entry.kind,target:'rick',affinityDelta:0};
 if(run.recruitmentContext&&[0,1].includes(run.recruitmentContext.stage)&&event.id===WELCOME[run.recruitmentContext.stage].id&&Number.isInteger(index)&&index>=0&&index<3)return {version:1,kind:'welcome',variant:entry.kind,target:event.speaker,affinityDelta:WELCOME[run.recruitmentContext.stage].choices[index].affinityDelta};
 return null;
}
export function isRecruitmentOutcomeV60(run,row){
 const entry=directEntryV60(run),o=row?.recruitmentOutcome;
 if(!entry||!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!=='affinityDelta,kind,target,variant,version'||o.version!==1||o.variant!==entry.kind||!Number.isInteger(row.choiceIndex)||row.verbalOutcome!==undefined||row.patronageApplicationOutcome!==undefined)return false;
 if(o.kind==='appointment')return row.eventId==='onboarding'&&row.kind==='onboarding'&&row.speaker==='wing'&&[0,1].includes(row.choiceIndex)&&o.target==='rick'&&o.affinityDelta===-18&&row.jobTitle===entry.title&&Number.isInteger(row.pay)&&row.pay===appointmentPayV67(run,createEntryPayV60(run));
 if(o.kind==='declined')return row.eventId==='onboarding'&&row.kind==='onboarding'&&row.speaker==='wing'&&row.choiceIndex===2&&o.target==='rick'&&o.affinityDelta===0;
 const scene=WELCOME.find(copy=>copy.id===row.eventId),pick=scene?.choices[row.choiceIndex];
 return Boolean(o.kind==='welcome'&&row.kind==='recruitment'&&scene?.speaker===row.speaker&&pick&&o.target===scene.speaker&&o.affinityDelta===pick.affinityDelta);
}
// Initial negotiated pay is immutable and already seed-derived by createRun.
const createEntryPayV60=run=>run.offerPay;

// This offer has no ordinary name card yet. Reuse the same spoken sentence in
// the preview, committed verbal context, consequence and saved history.
export function recruitmentVerbalLineV60(run,event,target,phase='event'){
 if(!directEntryV60(run)||event?.id!=='onboarding'||target!=='wing')return null;
 return phase==='result'
  ?'幹，剛才才把任用條件寫下來，現在又要拿自己人三個字補空白？家譜不是職務說明，薪水照剛才那份走，責任也給我逐項寫清楚。別每次有鍋就喊一家人，問權限又突然變外人。'
  :'幹，徵才網寫特別任用，報到直接替我改輩分？工作內容不肯寫，家譜倒是排得很快。你要招員工還是找人喊你爸，先把薪水跟責任講清楚。';
}
export function withRecruitmentVerbalDecisionV60(event,run){
 const entry=directEntryV60(run),ctx=run?.verbalContext;
 if(!entry||event?.id!=='verbal-v2-decision'||ctx?.eventId!=='onboarding'||ctx.phase!=='event')return event;
 const fromPay=run.pay,appointedPay=appointmentPayV67(run,fromPay);
 return {...event,title:'嗆完還沒算報到，這份特殊任用由你決定。',body:`翅膀把「${entry.title}」的新名片推回來，希望將兩份薪資條件分開放好：原先談的是${fromPay}K，若接受特殊任用，月薪才會調整為${appointedPay}K。你剛才那句已經說出口，這份任用卻還沒有生效；現在決定要不要留下，不必讓家譜替你點頭。`,choices:event.choices.map(choice=>choice.sourceIndex===0?{...choice,text:`我接受${entry.title}的特殊任用與任命後月薪${appointedPay}K，完成報到。`}:choice)};
}
