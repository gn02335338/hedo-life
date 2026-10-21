// Fictional character traits and a deliberately absurd employment route.
// Gender belongs to the rolled character, never to the anonymous player.
export const PATRONAGE_EVENT_V29='patronage-application';
export const isV29=run=>/^e29-/.test(run?.seed||'');
export const characterGenderLabelV29=run=>isV29(run)?({male:'男',female:'女'}[run.characterGender]||'未擲骰'):'未設定';
export const patronageTitleV29=run=>isV29(run)?run.patronage?.title||null:null;
export const canKindDarkInviteV29=run=>!isV29(run)||run.characterGender==='male';
export const patronageWorkCountV29=run=>(run?.history||[]).filter(row=>['daily','fantasy'].includes(row.kind)).length-(run?.pending&&['daily','fantasy'].includes(run.history.at(-1)?.kind)?1:0);
export function patronageEligibleV29(run){
 if(!isV29(run)||run.completed||run.patronage||run.patronageContext||run.pip?.active||run.flags.floor_watch||run.flags.post_pip_tolerance)return false;
 const work=patronageWorkCountV29(run);
 return work>=3&&run.turn<20&&(run.flags.patronage_offers||0)<2&&work-(run.flags.patronage_last_offer_work??-5)>=5;
}
const c=(text,result,delta={},effect=null,extra={})=>({text,result,delta,effect,detail:'',flags:[],...extra});
export function withPatronageEntryV29(event,run){
 if(isV29(run)&&run.patronage&&event?.id==='rank-exit')return {...event,body:`目前的任用職稱是${run.patronage.title}，原本的專業職級與工作經歷仍保留。你可以帶著這份經歷離開，也能另看創業與退休安排；一般升遷暫時不與這份特殊任用混算。`,choices:event.choices.map(choice=>choice.effect==='careerStepDown'?{...choice,available:false}:choice)};
 if(event?.id!=='career-review'||!patronageEligibleV29(run))return event;
 return {...event,choices:[...event.choices,c('正規升遷先等等。我想應徵乾兒子／乾女兒。','你把作品集往旁邊挪，詢問這間公司有沒有另一種任用制度。翅膀沒有立刻否認，希望倒是先把組織圖收了起來。',{},'patronageApply')]};
}
export function getPatronageEventV29(run){
 if(!isV29(run)||run.eventId!==PATRONAGE_EVENT_V29||!run.patronageContext)throw new Error('Invalid patronage application');
 const title=run.characterGender==='female'?'乾女兒':'乾兒子',s=run.stats;
 const checked=(text,wild=false)=>c(text,'',{},null,{...(wild?{wild:true}:{}),check:{
  chance:Math.max(.12,Math.min(wild?.65:.78,(wild?.05:.06)+s.lick*(wild?.004:.0055)+s.boss*(wild?.002:.003))),
  success:{result:`翅膀看完那份沒有任何血緣證明的申請，竟然點頭：「以後就是自己人。」希望把新職稱登記為${title}，月薪也跟著調整。瑞克抬頭看了一眼，第一次沒有立刻附和。這不是升上技術長，原來的專業履歷仍在；只是從今天起，有些額外的鍋終於會繞過你的桌子。`,delta:{boss:8,mood:14,trust:-12,lick:7},effect:'patronageAppoint'},
  failure:{result:'翅膀把申請推回來：「自己人是我說了算，不是你來申請。」瑞克在旁邊補一句老闆說得對。希望把這次談話登記成職涯諮詢，職稱與月薪都沒有改；你倒是替公司發現了一個不肯公開招募的職缺。',delta:{boss:-12,mood:-12,trust:2},effect:'patronageReject'}
 }});
 return {id:PATRONAGE_EVENT_V29,kind:'career',speaker:'wing',era:'特殊任用・原創職場諷刺',sourceIds:['characterFiction'],minRules:29,
  title:'職缺不在徵才網，位置卻一直有人坐。',
  body:`你最近看見瑞克又替翅膀接完一通電話，工作單卻轉到了別人的桌上。你試著問希望，除了原本的專業職涯，是否還能應徵「乾兒子／乾女兒」。希望說職缺沒有公告，還是帶你走進翅膀的辦公室；瑞克坐在旁邊，希望拿著登記表，三個人一起等你開口。這份虛構履歷的角色性別是${characterGenderLabelV29(run)}；若被任用，職稱會登記為${title}。你還沒有獲得承諾。`,
  wing:'「能力可以慢慢學，重點是你有沒有站在我這邊。」',
  choices:[checked(`正式遞出應徵書：我想當${title}。`),checked(`請印表機當見證人，當場列印一份${title}認證書。`,true),c('算了。我還是想靠專業領薪水。','你把這份不存在於徵才網的職缺留在原地。希望替你開門，原本的工作與薪資都還在。這次沒有任用，也沒有多花一個工作日。',{mood:5,trust:4},'patronageReturn')]
 };
}

// The female character gets a public, neutral afterparty conversation. The
// existing indexes and transition effects stay useful to the banquet flow.
export function withGenderContextV29(event,run){
 if(!isV29(run)||canKindDarkInviteV29(run)||event?.id!=='banquet-afterparty')return event;
 const responses=[
  ['問阿良要不要一起吃甜點，找一家還開著的店。','阿良一口答應，說去拿外套。你在門口等了一會，他傳來「我先走了，下次一定」。甜點還沒點，錢也沒花；你決定不用替他的出席率繼續值班。'],
  ['拿尾牙菜單組甜點董事會，請阿良擔任必須親自出席的董事長。','阿良笑著答應出席，連開會地點都選好了。等你拿好包包，他卻只剩群組裡一句「馬上回」。董事會宣布流會，你沒花續攤錢，還多學會一種不用再等的散場方式。'],
  ['不等續攤。自己吃碗麵，再搭車回家。','你找了間還開著的麵店，吃完叫車。地址、價格和到家時間都有著落，這次沒有把自己的晚上交給別人的「等一下」。'],
  ['今天到這裡，我先回家。明天的工作明天再說。','你跟門口的同事道別，把手機切成勿擾。今晚不用多解釋，也不用留下來等誰；剩下的時間終於可以自己安排。']
 ];
 return {...event,title:'散場後，先決定自己的晚上。',body:'尾牙的水果還沒吃完，阿良已經在找外套。他問大家要不要再吃個甜點，嘴上答應得比訂位還快。你看看時間，決定這個晚上要和誰走到哪裡。',wing:'「吃甜點可以啊，等我一下。」',choices:event.choices.map((choice,index)=>({...choice,text:responses[index][0],result:responses[index][1]}))};
}
