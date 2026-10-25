import {isCaptainVoyageV73} from './captain-profile-v73.js';

// Original social comedy. These scenes do not assert anyone's private life.
const hash=value=>{let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const pick=(text,result,delta,affinityDelta,code,extra={})=>({text,result,delta,affinityDelta,code,detail:'',flags:[],...extra});
const leave=()=>pick('這趟我先下船，跟大家說一聲再回去。','你說今天到這裡就好，收好自己的東西再離開。船長把你從這趟的人數裡扣掉，沒再替你算下一攤。',{mood:7,energy:4},0,'leave',{done:true,joined:false});
const episodes={
 tower:{speaker:'captain',scene:'rest_cafe',title:'船員任務｜不是划槳，是幫忙守家。',body:'才剛上船，船長已經把手機轉向你。塔防遊戲的怪物擠滿整條路，她說只差一點就過關，手卻停在暫停鍵上。你看著那個一點，發現它至少還包含三波敵人。',wing:'你先幫我看一下。我剛剛真的差一點，真的。',verbal:['幹，我是來玩，不是來承包妳整個帳號。這波一起打，下一波妳自己試。','靠北，過一關不是簽終身代打。手機拿好，別連領獎勵都叫我點。'],choices:[
  pick('先講怎麼擺，讓她自己試一次。','你指著地圖講完路線，沒有把手機接過來直接清台。船長照著擺，最後一隻怪真的倒下，她高興到差點把下一關當成當然也要一起的行程。',{mood:9,energy:-3},5,'tower-coach'),
  pick('接過手機一口氣清完，再把自己的午休一起清掉。','你替她清完三波，順便接了下一關。手機終於還回去時，你已經記得每種怪的走法，卻忘了自己本來要去哪裡。船長倒是十分滿意這趟的戰力。',{mood:2,energy:-8},6,'tower-carry'),
  pick('替殭屍開 PIP，改善目標是不要再走進我家。','你對著最後一波敵人宣讀改善計畫，船長笑到按錯技能。重來一次倒真的守住了；你把手機還給她，宣布本公司第一次有殭屍完成改善。',{mood:10,energy:-2},4,'tower-pip',{wild:true}),leave()
 ]},
 aquarium:{speaker:'captain',scene:'rest_cafe',title:'船員群通知｜今天的海水從相簿灌進來。',body:'船長分享起水族館照片，一張水母接著一張水母，連魚游出鏡頭的三秒也有影片。你只是回了一個貼圖，手機立刻收到第二輪。船票沒印多少字，通知倒是很會自動續頁。',wing:'這隻真的很可愛吧？等一下，我還有另一個角度。',verbal:['幹，我手機快被妳養成水族箱了。照片開相簿，別每一隻魚都來敲一次門。','靠北，我有看，不用讓同一隻水母從十七個角度確認我還在線。'],choices:[
  pick('挑一張最喜歡的回她，再約好晚點一起看相簿。','你認真回了一張，她終於知道你看到了。剩下的放進同一個相簿，聊天接得下去，你的手機也不用每三秒證明一次自己防水。',{mood:8,energy:2},5,'aquarium-album'),
  pick('先把通知靜音，直接說我現在有自己的事。','你說晚點有空再看，沒有把已讀當成無限收圖的同意。船長回了好，手上的事做完後，你才慢慢翻那串海底生物。',{mood:5,energy:4},1,'aquarium-mute'),
  pick('把照片編成《移動海洋台》，替每條魚配上董事會頭銜。','水母成了浮動主管，章魚兼任八個部門。船長笑著補了一張海龜，說這個看起來比較像有在開會。你的手機還在響，這次至少每一張都有笑點。',{mood:11,energy:-2},4,'aquarium-tv',{wild:true}),leave()
 ]},
 dinner:{speaker:'captain',scene:'dinner',title:'靠港補給｜店面有五顆星，評分只有一點五。',body:'船長選的店，招牌亮得像剛完成上市。你打開地圖，看到評分後停了一秒。她問是不是很期待，你想起公司的下午茶，覺得自己的胃好像也有一份歷史資料庫。',wing:'照片看起來很好吃耶。你不要只看星星嘛。',verbal:['幹，這店連星星都快湊不齊，妳還要我用胃替照片驗收？不好吃就認，不要拿交情醃我。','靠北，我答應一起吃飯，不是答應替每一道菜寫五星心得。這口真的不用護航。'],choices:[
  pick('自付 4 點存款，先點一份小的試試。','你先點一份試味道，沒有替整桌的未知一起下注。吃起來普普通通，聊天倒還不錯；船長說下次換你挑，你的胃終於拿到一次投票權。',{cash:-4,mood:8,energy:5},4,'dinner-small'),
  pick('付掉自己那份 3 點存款，笑她選的店比公司願景還難下嚥。','你一邊笑一邊把評價頁轉過去，等她接這一句。',{cash:-3,mood:3},0,'dinner-banter',{outcomes:[
   {code:'laughed',result:'船長先瞪你一眼，接著自己也笑了，說這句有夠嘴賤。你們把剩下的點心分完，下一家改由你提名。',delta:{mood:6},affinityDelta:6},
   {code:'kicked',result:'船長把菜單闔上，說嫌成這樣下次就別跟。你結掉自己那份，真的被踢下這趟船；工作還在，少掉的是下一攤的集合訊息。',delta:{mood:-7},affinityDelta:-9,done:true,joined:false}
  ]}),
  pick('請玩具鵝先吃一口；牠不會吃，所以我們換一家。','玩具鵝端坐在菜單前，維持了牠對餐飲業一貫的沉默。船長笑著問你是不是早就想換店，最後一起去附近買點心。這次導航總算接受了使用者回饋。',{mood:9,energy:3},3,'dinner-goose',{wild:true}),leave()
 ]},
 karaoke:{speaker:'captain',scene:'karaoke',title:'船上娛樂｜報名像大會，包廂像電話亭。',body:'船長訂好唱歌包廂，門一開，所有人先跟沙發對看。報名人數比座位多了一圈，有人坐到螢幕前，字幕直接變成背上的投影。大家都還沒唱，房間已經先唱滿了。',wing:'先擠一下嘛。應該坐得下……吧？',verbal:['幹，人都還沒坐好，字幕先被背擋住。這不是氣氛熱，是人快被壓成一張唱片了。','靠北，我是來唱歌，不是來測試人體壓縮。人數跟包廂差多少，下次先算完。'],choices:[
  pick('自付 6 點存款，問清楚差額再一起換大間。','你問清楚換房的差額，只答應自己那份。換好包廂，大家終於能坐下，第一首歌不必再隔著別人的後腦勺找字幕。',{cash:-6,mood:11,energy:-2},5,'karaoke-upsize'),
  pick('不加錢，輪流坐、輪流唱，別讓同一個人一直站著。','你把位置輪起來，沒有把沒座位的人順手變成服務生。船長唱完也去站一輪，這間包廂仍然太小，至少沒有人被固定分配成螢幕支架。',{mood:6,energy:-3,trust:2},3,'karaoke-rotate'),
  pick('宣布這是 Dolby 人肉環繞音響，先請前排不要替字幕打馬賽克。','前排笑到彎下腰，字幕短暫回到人間。你們改輪流進去唱，門外開了清唱副本；船長補了一張兩邊的合照，這次人數總算都有拍進去。',{mood:10,energy:-3},4,'karaoke-surround',{wild:true}),leave()
 ]},
 cola:{speaker:'jack',scene:'rest_cafe',title:'補給站來人｜傑克的可樂不是通關密語。',body:'船長去拿飲料，傑克剛好坐到旁邊，看到你手上的船員貼圖，掏出一罐可樂。旁邊還黏了一張手寫的暈船藥標籤。他說喝什麼是小事，今天有沒有吃飯、有沒有自己的安排才是大事。船長拿著飲料回來，問你們又在發明什麼。',wing:'我是請你保留自己的行程，沒有要幫這罐飲料申請醫材許可。',verbal:['幹，一張貼圖就替我掛海事科？可樂我喝，人生不用你替我開藥單。','靠北，聊天而已不用發診斷書。我的下班時間我會顧，先把那張藥袋收起來。'],captainVerbal:['靠北，揪出去玩就揪出去玩，別每個點頭都自動加進下一攤。我的行程不是船上的公用設施。','幹，我今天有自己的安排。不是回了訊息，就得把下半輩子的接送都排給妳。'],choices:[
  pick('可樂照喝，提醒也收下；下一趟有空再回。','你收下可樂，把藥袋標籤貼到玩具鵝身上。傑克說牠看起來比較需要提醒，船長則問下一趟到底誰有空。這次你照自己的行事曆回答，沒拿笑話替任何人下決定。',{mood:8,energy:4},5,'cola-own-calendar'),
  pick('我今天先下船。保留朋友，也保留自己的晚上。','你說今天玩夠了，接下來有自己的安排。傑克替你把空罐丟好，船長回了一個收到；你把今天留在今天，沒有再多排一站。',{mood:10,energy:6},3,'cola-leave',{done:true,joined:false}),
  pick('暈船藥改成泡泡糖，請玩具鵝擔任唯一需要嚼的船員。','傑克看著根本不會嚼的玩具鵝，說這次處方終於開對對象。船長拍了一張發回群組，沒有再往下替你排下一整晚；大家笑完，各自確認自己的時間。',{mood:10,energy:2},3,'cola-goose',{wild:true}),leave()
 ]}
};
const boarding={speaker:'captain',scene:'rest_cafe',title:'船長私訊｜欸，要不要上船？',body:'下班前，船長把一張手畫船票傳給你。你們已經聊過幾次，這回她沒丟全公司群組，而是問你要不要一起走：「這趟有吃的、有玩的，航線我來帶。」船票沒有船名，集合時間倒是寫得很準。',wing:'欸，你要不要上船？先說，救生衣自備，玩得開心就好。',verbal:['幹，邀我就講清楚要去哪、幾點回。別只發一張船票，後面整晚都靠我猜航線。','靠北，上船不是把我的行事曆整本交給妳。今天怎麼玩就講今天，別自動續約。'],choices:[
 pick('好啊，上船。這趟一起玩，晚上幾點回先說好。','你回了上船，船長立刻傳來船員貼圖。你把今天的時間講好，再收下那張沒有船名的船票；這趟行程正式開始。',{mood:8,energy:2},6,'boarding-yes',{joined:true}),
 pick('謝啦，今天不上船。我有自己的安排，改天再聊。','你說今天有別的安排，船長回了一個收到，沒有追問你要去哪裡。船票留在聊天裡，你照自己的安排回家。',{mood:4,energy:3},0,'boarding-no',{done:true,joined:false}),
 pick('先讓玩具鵝當大副。我穿救生衣上船，但牠負責暈。','船長看著你替玩具鵝畫的船員證笑了，說牠最好不要連飲料都喝兩份。你們約好今天的時間，帶著一位不會划船的大副出發。',{mood:9},4,'boarding-goose',{joined:true,wild:true})
]};
const harbor={speaker:'captain',scene:'rest_cafe',title:'這趟靠岸｜船票不會替你決定下一個晚上。',body:'這趟行程到了尾聲。船長把今天的照片傳進小群組，玩具鵝出鏡的次數比你還多。你們笑完各自收東西，明天仍回到原本的工作；要不要再跟下一趟，可以等下一次真的有空再說。',wing:'今天很好玩吧？下次我再揪，你有空再回就好。',verbal:['幹，今天很好玩跟下一趟一定要到，是兩件事。照片可以傳，別替我預約全年航班。','靠北，今天就到這裡。別讓一張船票比公司的門禁卡還難交回去。'],choices:[
 pick('保留船員身分，下次有空再出航。','你收好船員貼圖，答應有空再一起玩。這趟上船到此收尾。下一趟等她再揪，你先把今晚留給自己。',{mood:8,energy:4},5,'harbor-stay',{done:true,joined:true}),
 pick('這趟玩得夠了。我先下船，朋友照當。','你把今天留在今天，說之後先不跟團。船長收起下一個集合點，沒有把你的下船寫成翻臉；行程結束，你回到自己的安排。',{mood:10,energy:6},1,'harbor-leave',{done:true,joined:false}),
 pick('頒發一次性大副勳章給玩具鵝，禁止牠替我自動續航。','玩具鵝獲頒一枚紙製勳章，效期到今天靠岸為止。船長替牠拍好照，你們各自回家；這趟沒有新職稱，只有一位光榮退役的臨時大副。',{mood:11,energy:3},4,'harbor-goose',{done:true,joined:true,wild:true})
]};
export const CAPTAIN_EPISODE_IDS_V73=Object.freeze(Object.keys(episodes));
const routes=(seed,turn)=>{const pool=[...CAPTAIN_EPISODE_IDS_V73],first=hash(`${seed}:${turn}:captain-a`)%pool.length,a=pool.splice(first,1)[0];return[a,pool[hash(`${seed}:${turn}:captain-b`)%pool.length]];};
const contexts=['captainVoyageContext','treatsContext','blockchainContext','recruitmentContext','shareholderContext','activityInvitationContext','hiddenEncounterContext','activityContext','chapterContext','companyContext','rageContext','verbalContext','patronageReplyContext','patronageContext','raiseContext','mealContext','personnelPending','departureContext'];
export function dueCaptainVoyageV73(run,affinity){
 if(!isCaptainVoyageV73(run)||run.characterGender!=='male'||!run.flags||run.flags.captain73_offered||run.completed||run.pending||run.pip?.active||run.flags.floor_watch||run.pendingFamily||contexts.some(key=>run[key]))return false;
 if(!Number.isInteger(run.turn)||run.turn<3||run.turn>22||!Number.isFinite(run.stats?.energy)||!Number.isFinite(run.stats?.mood)||run.stats.energy<40||run.stats.mood<35||run.salaryAdvice?.status==='open')return false;
 if(!Number.isFinite(affinity?.score)||affinity.score<70||!Number.isInteger(affinity.encounters)||affinity.encounters<2)return false;
 return hash(`${run.seed}:${run.turn}:captain-invite`)/4294967296<Math.min(.62,.38+(affinity.score-70)*.008);
}
export function createCaptainVoyageContextV73(run,returnEventId){
 if(!isCaptainVoyageV73(run)||typeof returnEventId!=='string'||!returnEventId)throw Error('Invalid captain voyage start');
 return {version:1,stage:0,startTurn:run.turn,episodes:routes(run.seed,run.turn),returnEventId};
}
function current(run){const c=run?.captainVoyageContext;if(!isCaptainVoyageV73(run)||!c||c.version!==1||!Number.isInteger(c.stage)||c.stage<0||c.stage>3||c.startTurn!==run.turn||typeof c.returnEventId!=='string'||JSON.stringify(c.episodes)!==JSON.stringify(routes(run.seed,c.startTurn)))throw Error('Invalid captain voyage context');return c;}
function copyAt(episode){return episode==='boarding'?boarding:episode==='harbor'?harbor:episodes[episode];}
const episodeAt=c=>c.stage===0?'boarding':c.stage===3?'harbor':c.episodes[c.stage-1];
function affordable(run,choice){return (run.stats?.cash||0)>=Math.max(0,-(choice.delta.cash||0));}
export function getCaptainVoyageEventV73(run){
 const c=current(run),episode=episodeAt(c),copy=copyAt(episode),participants=episode==='cola'?['jack','captain']:['captain'];
 return {id:`captain73-${c.stage}-${episode}`,kind:'captain-voyage',minRules:39,era:c.stage===0?'私人邀約・船票來了':c.stage===3?'私人航程・準備靠岸':'私人航程・進行中',title:copy.title,body:copy.body,wing:copy.wing,speaker:copy.speaker,scope:'private',privateContext:true,scene:copy.scene,participants,illustrationPeople:participants,sourceIds:['captainFictionV73','characterFiction'],verbalLinesV73:[...copy.verbal],verbalTargetsV73:Object.fromEntries(participants.map(id=>[id,[...(id==='captain'&&episode==='cola'?copy.captainVerbal:copy.verbal)]])),captainVoyage:{version:1,stage:c.stage,total:4,episode},choices:copy.choices.map(choice=>({...structuredClone(choice),available:affordable(run,choice)}))};
}
function chosenVariant(choice,ticket){return choice.outcomes?.[ticket<.65?0:1]||null;}
export function resolveCaptainVoyageChoiceV73(run,index,ticket=.5){
 if(!Number.isFinite(ticket)||ticket<0||ticket>=1)throw Error('Invalid captain voyage luck');
 const c=current(run),episode=episodeAt(c),copy=copyAt(episode),choice=copy.choices[index];
 if(!Number.isInteger(index)||!choice||!affordable(run,choice))throw Error('Unavailable captain voyage choice');
 const variant=chosenVariant(choice,ticket),done=variant?.done??choice.done??false,joined=variant?.joined??choice.joined??true;
 const code=variant?`${choice.code}-${variant.code}`:choice.code;
 return {choiceText:choice.text,result:`${choice.result}${variant?' '+variant.result:''}`,delta:{...choice.delta},luckDelta:variant?{...variant.delta}:{},label:done?'這趟私人航程已結束':c.stage===0?'你已登船':'這一站已結算',done,joined,nextStage:c.stage+1,outcome:{version:1,stage:c.stage,episode,target:copy.speaker,affinityDelta:variant?.affinityDelta??choice.affinityDelta,decision:done?(joined?'finished':c.stage===0?'refused':variant?.code==='kicked'?'kicked':'left'):'aboard',result:code}};
}
export function isCaptainVoyageOutcomeV73(run,row){
 const o=row?.captainVoyageOutcome;
 if(!isCaptainVoyageV73(run)||!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!=='affinityDelta,decision,episode,result,stage,target,version'||o.version!==1||!Number.isInteger(o.stage)||o.stage<0||o.stage>3||row.kind!=='captain-voyage'||!Number.isInteger(row.choiceIndex)||!Number.isInteger(row.turn)||row.eventId!==`captain73-${o.stage}-${o.episode}`)return false;
 const episode=o.stage===0?'boarding':o.stage===3?'harbor':routes(run.seed,row.turn)[o.stage-1];if(o.episode!==episode)return false;
 if(['verbalOutcome','mealOutcome','patronageOutcome','departureOutcome','recruitmentOutcome','activityOutcome','shareholderOutcome','hiddenOutcome','treatsOutcome','blockchainOutcome','relationshipOutcome'].some(key=>row[key]!==undefined))return false;
 const copy=copyAt(episode),choice=copy?.choices[row.choiceIndex];if(!choice||o.target!==copy.speaker||row.speaker!==copy.speaker)return false;
 for(const ticket of choice.outcomes?[.2,.8]:[.5]){
  const fake={...run,turn:row.turn,stats:{cash:100},captainVoyageContext:{version:1,stage:o.stage,startTurn:row.turn,episodes:routes(run.seed,row.turn),returnEventId:'history'}};
  const expected=resolveCaptainVoyageChoiceV73(fake,row.choiceIndex,ticket).outcome;
  if(Object.keys(expected).every(key=>o[key]===expected[key]))return true;
 }
 return false;
}
export function captainVoyagePhaseV73(run,event){
 if(!isCaptainVoyageV73(run)||!run.captainVoyageContext||event?.id!==`captain73-${run.captainVoyageContext.stage}-${episodeAt(run.captainVoyageContext)}`)return null;
 const c=run.captainVoyageContext,row=run.history?.at(-1),o=row?.captainVoyageOutcome,resolved=run.pending&&row?.eventId===event.id&&isCaptainVoyageOutcomeV73(run,row),done=resolved&&['finished','refused','left','kicked'].includes(o.decision);
 return {stage:c.stage,total:4,phase:done?'end':resolved?'result':c.stage===0?'start':'progress',label:done?'這趟私人航程已結束':resolved?'這一幕已回應':c.stage===0?'私人上船邀約':'私人航程進行中',nextLabel:done?'回到原本的事':'繼續這趟航程'};
}
