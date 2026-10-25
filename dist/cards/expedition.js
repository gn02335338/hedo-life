import {CARD_CATALOG,CARD_MAP,STAGES} from './catalog.js';

// Original office deck-building adventure. Collection state and legacy battles
// remain separate; all expedition randomness uses the server's existing stream.
export const EXPEDITION_ARCHETYPES=Object.freeze({
 evidence:{id:'evidence',name:'佐證流',description:'每回合首次打出佐證牌，多加 1 層佐證並獲得 3 格擋。先留紀錄，再放大傷害。'},
 slack:{id:'slack',name:'摸魚流',description:'每回合首次打出格擋牌，多獲得 2 格擋並抽 1 張牌。把省下的力氣用在下一手。'},
 lick:{id:'lick',name:'場面流',description:'每回合首次打出支援牌，回復 1 費用。先把場面接住，再安排真正要做的事。'},
});
export const EXPEDITION_RELICS=Object.freeze({
 'paper-goose':{id:'paper-goose',name:'紙鵝主席',description:'每次造成傷害額外 +2。'},
 'black-coffee':{id:'black-coffee',name:'偷外帶的咖啡',description:'每場第一回合多 1 費用。'},
 'signed-minutes':{id:'signed-minutes',name:'有簽名的紀錄',description:'每場開局，對手獲得 2 層佐證。'},
 'nap-pillow':{id:'nap-pillow',name:'安靜午睡枕',description:'每場戰鬥開始恢復 8 生命。'},
 'first-love-mic':{id:'first-love-mic',name:'搶來的麥克風',description:'每回合打出第 3 張牌時，額外造成 5 傷害。'},
 'visitor-badge':{id:'visitor-badge',name:'不想交回的門禁卡',description:'每場開局獲得 8 格擋。'},
});
export const EXPEDITION_ACTION_TYPES=Object.freeze(['start-expedition','expedition-room','expedition-play','expedition-end-turn','expedition-reward','expedition-rest','expedition-event','abandon-expedition']);
const has=(value,key)=>Object.hasOwn(value,key);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const basic=Object.freeze({
 'base-strike':{name:'先把工作做完',cost:1,effect:'pressure',power:10,tags:['攻擊']},
 'base-guard':{name:'先把界線畫好',cost:1,effect:'shield',power:8,tags:['格擋']},
 'base-evidence':{name:'先寄會議紀錄',cost:1,effect:'expose',power:6,tags:['攻擊','佐證']},
 'base-recess':{name:'把會議切成午休',cost:1,effect:'shield',power:7,tags:['格擋','抽牌']},
 'base-praise':{name:'開場先接一句',cost:0,effect:'focus',power:0,tags:['支援','抽牌','耗盡']},
 'base-note':{name:'留一份附件',cost:0,effect:'note',power:1,tags:['支援','耗盡']},
 'base-burden':{name:'多出來的背鍋單',cost:1,effect:'burden',power:0,tags:['負擔','耗盡']},
});
const catalog=id=>typeof id==='string'&&has(CARD_MAP,id)?CARD_MAP[id]:null;
export function getExpeditionItemPassive(cardId,level=1){
 const card=catalog(cardId);if(!card||card.kind!=='item')return '';
 if(!Number.isInteger(level)||level<1||level>5)level=1;
 const power=(card.power||0)+(level-1)*3;
 const text={
  heal:`本輪耐心上限 +${Math.floor(power/2)}。`,
  shield:`每場開局獲得 ${Math.round(power/2)} 格擋；對手行動後清空。`,
  pressure:`每次造成傷害額外 +${Math.max(1,Math.floor(power/4))}。`,
  focus:`非基礎牌的主要效果強度 +${Math.max(1,Math.floor(power/4))}（傷害、格擋、恢復或弱化）；抽牌、折扣與額外傷害不變。`,
  expose:`每場開局，對手獲得 ${Math.max(1,Math.floor(power/4))} 層佐證。與遺物相加，最多 10 層。`,
  drain:`每場前 2 次攻勢各降低 ${Math.floor(power/3)}，最低仍有 3 攻勢。`,
 };
 return text[card.effect]||'';
}

const validLevel=level=>Number.isInteger(level)&&level>=1&&level<=5;
function describe(effect,power,level,kind){
 const extra=level-1;
 if(effect==='pressure')return `造成 ${power} 傷害${kind==='character'?'；對手已有佐證時，再追加 5 傷害':''}。`;
 if(effect==='expose')return `造成 ${power} 傷害，增加 ${2+Math.floor(extra/2)+(kind==='event'?2:0)} 層佐證。每層讓之後的傷害 +1，最多 10 層。`;
 if(effect==='shield')return `${kind==='character'?`造成 ${4+extra} 傷害，`:''}獲得 ${power} 格擋。格擋在對手行動後消失。`;
 if(effect==='heal')return `${kind==='character'?`造成 ${4+extra} 傷害，`:''}恢復最多 ${power} 生命。每場最多用牌恢復 30 生命。`;
 if(effect==='focus'||effect==='charge')return `抽 ${2+Math.floor(extra/2)} 張牌，下一張牌減少 ${1+Math.floor(level/2)} 費用。本場耗盡。`;
 if(effect==='drain'||effect==='weaken')return `${kind==='character'?`造成 ${6+extra} 傷害，`:''}讓接下來 2 次攻勢各降低 ${power}。`;
 if(effect==='damage')return `造成 ${power} 傷害。本場耗盡。`;
 if(effect==='note')return '抽 1 張牌，獲得 2 格擋。本場耗盡。';
 return '花 1 費用把這張背鍋單劃掉。本場耗盡。';
}
export function getExpeditionCardMeta(id,level=1){
 if(!validLevel(level))level=1;
 const card=catalog(id),base=has(basic,id)?basic[id]:null;
 if(!card&&!base)return null;
 let effect=base?.effect||card.effect,kind=base?'basic':card.kind,cost=base?.cost,power=base?.power+(level-1)*(effect==='shield'?3:3),tags=base?[...base.tags]:[];
 if(card?.kind==='character'){
  cost=effect==='pressure'?2:1;
  power=({pressure:18,expose:8,shield:8,heal:6,focus:0,drain:5}[effect]??10)+(level-1)*(effect==='drain'?1:2);
  tags=effect==='pressure'?['攻擊','連鎖']:effect==='expose'?['攻擊','佐證']:effect==='shield'?['格擋']:effect==='heal'?['支援','恢復']:effect==='focus'?['支援','抽牌','耗盡']:['攻擊','打斷'];
 }else if(card?.kind==='item'){
  effect=effect==='focus'?'focus':effect;cost=effect==='pressure'?2:1;
  power=({pressure:19,expose:9,shield:12,heal:9,focus:0,drain:6}[effect]??10)+(level-1)*2;
  tags=effect==='expose'?['佐證']:effect==='shield'?['格擋']:effect==='heal'?['支援','恢復']:effect==='focus'?['支援','抽牌','耗盡']:effect==='drain'?['打斷']:['攻擊'];
 }else if(card?.kind==='event'){
  cost=['damage','heal','shield'].includes(effect)?2:1;
  power=({heal:16,shield:22,damage:30,charge:0,expose:10,weaken:8}[effect]??10)+(level-1)*3;
  tags=effect==='damage'?['攻擊','耗盡']:effect==='heal'?['支援','恢復','耗盡']:effect==='shield'?['格擋','耗盡']:effect==='expose'?['佐證','耗盡']:effect==='weaken'?['打斷','耗盡']:['支援','抽牌','耗盡'];
 }
 const perks={
  'base-recess':'再抽 1 張牌。','person-jack':'另加 1 層佐證並抽 1 張牌。','person-jonathan':'對手目前攻勢達 16 時，額外獲得 5 格擋。','person-captain':'出牌後生命不足一半時，再抽 1 張。','person-alice':'額外再抽 1 張攻略。','person-sonny':'打斷對手下一次攻勢，至少降低 2。','person-kind':'若有 3 活動幣，自動付費多恢復 4 生命。','person-professor':'下一張牌至少減少 2 費用。','event-firstlove':'若這是本回合第 3 張以後的牌，再追加 14 基礎傷害。','event-roadshow':'再抽 1 張，這杯還能外帶。','event-allin':'回復 1 費用。','item-cake':'對手正在蓄力時，額外獲得 8 格擋。'
 };
 const title=base?.name||(card.kind==='character'?`${card.name}｜${card.skill}`:card.name),text=describe(effect,power,level,kind)+(perks[id]?' '+perks[id]:'');
 return {id,name:title,title,kind,rarity:card?.rarity||'N',portrait:card?.portrait||null,cost,effect,power,tags,text,description:text,exhaust:tags.includes('耗盡')};
}
const shuffle=(rows,rng,state)=>{for(let i=rows.length-1;i>0;i--){const j=Math.floor(rng(state)*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;};
const pushLog=(run,note)=>{run.log=[...(run.log||[]),note].slice(-24);if(run.battle)run.battle.log=[...(run.battle.log||[]),note].slice(-16);};
const instance=(run,cardId,level=1)=>({uid:`c${run.nextUid++}`,cardId,level});
function roomOptions(run,rng,state){
 const n=run.room+1,variant=rng(state)<.5;
 if(n===1)return [{kind:'battle',title:'臨時需求會議',description:'一般戰鬥。勝利後可選一張本輪用牌。',modifier:variant?'quiet':'rush'},{kind:'battle',title:'附件版本攻防',description:'另一場一般戰鬥，場地規則不同。',modifier:variant?'paper':'quiet'}];
 if(n===2)return [{kind:'battle',title:'跨部門交接',description:'再拿一份戰後選牌與活動幣。',modifier:variant?'paper':'rush'},{kind:'rest',title:'茶水間空檔',description:'恢復生命，或花 6 活動幣升級本輪牌組。'}];
 if(n===3)return [{kind:'event',title:variant?'愛麗絲的借牌桌':'三百元咖啡攤',description:'用本輪活動幣換補給，或試試別的辦法。',eventId:variant?'alice':'coffee'},{kind:'battle',title:'追加一場需求訪談',description:'打一場一般戰鬥，爭取新的連鎖牌。',modifier:variant?'quiet':'paper'}];
 if(n===4)return [{kind:'elite',title:'理由伯特別記者會',description:'較強的對手；勝利額外取得一件本輪遺物。',modifier:'rush'},{kind:'rest',title:'會前最後一次喘息',description:'恢復生命，或花 6 活動幣升級本輪牌組。'}];
 return [{kind:'boss',title:STAGES[run.stage-1].name,description:'本章最終會議。完成後才結算首次通關獎勵。',modifier:variant?'paper':'rush'}];
}
function nextRoom(run,rng,state){
 run.phase='route';run.battle=null;run.block=0;run.rewardChoices=[];run.event=null;run.roomChoices=roomOptions(run,rng,state);
}
function ownCard(state,id,kind,fail){const card=catalog(id);if(!card||!has(state.collection,id)||card.kind!==kind)fail('not_owned','請先把已收藏的角色、物品與事件編入隊伍。');return card;}
function start(state,action,rng,fail){
 if(state.battle?.status==='active')fail('legacy_battle_active','先完成或撤退舊版挑戰，再開新的牌組冒險。');
 if(state.expedition?.status==='active')fail('expedition_active','這輪冒險還沒結束，先繼續或撤退。');
 if(!Number.isInteger(action.stage)||action.stage<1||action.stage>10||!has(EXPEDITION_ARCHETYPES,action.archetype))fail('invalid_expedition','請選擇章節與牌組風格。');
 if(action.stage>1&&!state.campaign.completed.includes(action.stage-1))fail('stage_locked','先完成前一章的最終會議。');
 if(!Array.isArray(state.deck)||state.deck.length!==3||new Set(state.deck).size!==3)fail('invalid_deck','先選好三位不同的同事。');
 const people=state.deck.map(id=>ownCard(state,id,'character',fail)),item=ownCard(state,state.loadout.item,'item',fail);ownCard(state,state.loadout.event,'event',fail);
 const extra=people.reduce((sum,p)=>sum+Math.max(0,p.hp-60)+(state.collection[p.id].level-1)*8,0);
 const itemLevel=state.collection[item.id].level,itemStrength=(item.power||0)+(itemLevel-1)*3;
 const maxHp=105+Math.floor(extra/4)+(item.effect==='heal'?Math.floor(itemStrength/2):0);
 const run={version:2,status:'active',phase:'route',stage:action.stage,archetype:action.archetype,room:0,totalRooms:5,hp:maxHp,maxHp,block:0,coins:10,deck:[],relics:[],nextUid:0,roomChoices:[],rewardChoices:[],event:null,battle:null,log:[],reward:null,item:{id:item.id,effect:item.effect,power:itemStrength}};
 for(const id of state.deck)for(let i=0;i<2;i++)run.deck.push(instance(run,id,state.collection[id].level));
 for(let i=0;i<3;i++){run.deck.push(instance(run,'base-strike'));run.deck.push(instance(run,'base-guard'));}
 run.deck[6]=instance(run,{evidence:'base-evidence',slack:'base-recess',lick:'base-praise'}[run.archetype]);
 run.deck.push(instance(run,state.loadout.event,state.collection[state.loadout.event].level));
 state.expedition=run;pushLog(run,`第 ${run.stage} 章開始。選擇${EXPEDITION_ARCHETYPES[run.archetype].name}，帶著 ${run.deck.length} 張牌進辦公室。`);nextRoom(run,rng,state);state.lastResult={type:'expedition-start',stage:run.stage};
}
function needRun(state,phase,fail){const run=state.expedition;if(!run||run.version!==2||run.status!=='active')fail('no_expedition','目前沒有進行中的冒險。');if(phase&&run.phase!==phase)fail('wrong_expedition_phase','先完成眼前這一幕，再進行下一步。');return run;}
function intent(run){
 const b=run.battle,e=b.enemy,t=b.turn,base=e.attack;
 if(t%4===0)return {kind:'rush',label:'主管蓄力・整段追加',damage:Math.max(3,base+8-(e.weakTurns?e.weak:0)),block:0};
 if(t%3===0&&e.style==='shield')return {kind:'guard',label:'理由先講完・防守反擊',damage:Math.max(3,Math.floor(base*.65)-(e.weakTurns?e.weak:0)),block:12+run.stage};
 if(t%3===0&&e.style==='heal')return {kind:'heal',label:'重新整理說法',damage:Math.max(3,Math.floor(base*.5)-(e.weakTurns?e.weak:0)),block:0,heal:8+run.stage};
 return {kind:'attack',label:t%3===0?'群組催件・追問':'一般交辦・反擊',damage:Math.max(3,base+(t%3===0?3:0)-(e.weakTurns?e.weak:0)),block:0};
}
function drawCards(state,run,count,rng){
 const b=run.battle;for(let n=0;n<count&&b.hand.length<10;n++){
  if(!b.drawPile.length){if(!b.discard.length)break;b.drawPile=shuffle(b.discard.splice(0),rng,state);}
  b.hand.push(b.drawPile.pop());
 }
}
function beginTurn(state,run,rng){
 const b=run.battle;b.energy=3+(b.turn===1&&run.relics.includes('black-coffee')?1:0);b.maxEnergy=b.energy;b.played=0;b.discount=0;b.firstExpose=false;b.firstShield=false;b.firstSupport=false;b.turnDamageBonus=0;
 drawCards(state,run,5,rng);b.enemy.intent=intent(run);
}
function beginBattle(state,run,option,rng){
 const boss=option.kind==='boss',elite=option.kind==='elite',stage=STAGES[run.stage-1];
 const hp=boss?110+run.stage*14:elite?80+run.stage*10+run.room*4:50+run.stage*7+run.room*5;
 const portrait=boss?stage.portrait:elite?'/assets/sonny.png':option.modifier==='paper'?'/assets/jonathan.png':'/assets/captain.png';
 const name=boss?stage.name:elite?'阿福的理由伯記者會':option.title;
 run.phase='battle';run.roomChoices=[];run.rewardChoices=[];run.block=(run.relics.includes('visitor-badge')?8:0)+(run.item.effect==='shield'?Math.round(run.item.power/2):0);
 if(run.relics.includes('nap-pillow'))run.hp=Math.min(run.maxHp,run.hp+8);
 run.battle={turn:1,energy:3,maxEnergy:3,hand:[],drawPile:shuffle(structuredClone(run.deck),rng,state),discard:[],exhaust:[],healed:0,played:0,discount:0,firstExpose:false,firstShield:false,firstSupport:false,turnDamageBonus:0,kind:option.kind,modifier:option.modifier,modifierLabel:({quiet:'安靜會議：每回合首次格擋再 +2。',paper:'附件滿桌：每回合第一張佐證牌抽 1 張。',rush:'臨時插單：第 4、8、12 回合有重攻勢。'})[option.modifier],enemy:{name,portrait,hp,maxHp:hp,block:0,exposed:Math.min(10,(run.relics.includes('signed-minutes')?2:0)+(run.item.effect==='expose'?Math.max(1,Math.floor(run.item.power/4)):0)),weak:run.item.effect==='drain'?Math.floor(run.item.power/3):0,weakTurns:run.item.effect==='drain'?2:0,attack:12+run.stage+run.room+(boss?4:elite?3:0),style:boss?stage.style:elite?'shield':option.modifier==='paper'?'shield':'pressure',intent:null},log:[]};
 pushLog(run,`第 ${run.room} / 5 站：${name}。每回合 3 費用，最多 20 回合；看對手意圖再出牌。`);beginTurn(state,run,rng);
}
function hit(run,raw,notes){
 const b=run.battle,e=b.enemy,bonus=e.exposed+(run.relics.includes('paper-goose')?2:0)+(run.item.effect==='pressure'?Math.max(1,Math.floor(run.item.power/4)):0);
 const total=Math.max(0,Math.round(raw)+bonus),blocked=Math.min(e.block,total);e.block-=blocked;const dealt=Math.min(e.hp,total-blocked);e.hp-=dealt;
 if(dealt||blocked)notes.push(`對手受到 ${dealt} 傷害${blocked?`，擋下 ${blocked}`:''}。`);return dealt;
}
function heal(run,amount,notes){
 const b=run.battle,actual=Math.min(amount,run.maxHp-run.hp,30-b.healed);run.hp+=Math.max(0,actual);b.healed+=Math.max(0,actual);notes.push(`恢復 ${Math.max(0,actual)} 生命（本場用牌恢復 ${b.healed} / 30）。`);
}
function winning(state,run,rng){
 const b=run.battle;
 if(b.enemy.hp>0)return false;
 const rewardCoins=8+run.stage+(b.kind==='elite'?6:0);run.coins+=rewardCoins;
 pushLog(run,`這場會議結束。取得 ${rewardCoins} 枚本輪活動幣。`);
 if(b.kind==='boss'){
  const first=!state.campaign.completed.includes(run.stage),tickets=first?STAGES[run.stage-1].reward:0,shards=first?8+run.stage*2:0;
  if(first){state.campaign.completed.push(run.stage);state.campaign.completed.sort((a,b)=>a-b);state.tickets+=tickets;state.shards+=shards;}
  run.status='won';run.phase='finished';run.reward={tickets,shards,firstClear:first};
  run.summary={title:'這場最終會議，換你把話說完。',body:first?`第 ${run.stage} 章首次完成，獲得 ${tickets} 張券與 ${shards} 碎片。這輪借用牌與活動幣留在本次紀錄，不加入永久收藏。`:'這章先前已領過首勝獎勵。這次保留冒險紀錄，不重複發券或碎片。'};
  pushLog(run,run.summary.body);state.lastResult={type:'expedition-complete',stage:run.stage,reward:{...run.reward}};return true;
 }
 if(b.kind==='elite'){
  const choices=Object.keys(EXPEDITION_RELICS).filter(id=>!run.relics.includes(id));
  if(choices.length){const id=choices[Math.floor(rng(state)*choices.length)];run.relics.push(id);pushLog(run,`帶走本輪遺物：${EXPEDITION_RELICS[id].name}。`);}
 }
 const pool=[...CARD_CATALOG.map(card=>card.id),'base-note','base-strike','base-guard'],picked=[];
 while(picked.length<3){const id=pool[Math.floor(rng(state)*pool.length)];if(picked.includes(id))continue;picked.push(id);}
 run.rewardChoices=picked.map(id=>instance(run,id,catalog(id)?Math.min(3,state.collection[id]?.level||1):1));
 run.phase='reward';state.lastResult={type:'expedition-battle-won',stage:run.stage,room:run.room};return true;
}
function lost(state,run,reason){run.status='lost';run.phase='finished';run.summary={title:'這輪先散會，收藏不用交回去。',body:reason+' 人物、物品、卡券與既有通關紀錄都保留。本輪活動幣與借用牌不會轉成永久獎勵。'};pushLog(run,run.summary.body);state.lastResult={type:'expedition-lost',stage:run.stage,room:run.room};}
function play(state,run,index,rng,fail){
 const b=run.battle;
 if(!Number.isInteger(index)||index<0||index>=b.hand.length)fail('invalid_hand','請選擇目前手牌裡的一張。');
 if(b.played>=20)fail('turn_card_limit','本回合已出 20 張牌，先結束回合。');
 const entry=b.hand[index],card=getExpeditionCardMeta(entry.cardId,entry.level);
 const cost=Math.max(0,card.cost-b.discount);if(b.energy<cost)fail('not_enough_energy','費用不足，換一張牌或結束回合。');
 b.energy-=cost;b.discount=0;b.played++;b.hand.splice(index,1);const notes=[`打出「${card.name}」，花 ${cost} 費用。`],level=entry.level;
 if(card.tags.includes('支援')&&run.archetype==='lick'&&!b.firstSupport){b.firstSupport=true;b.energy=Math.min(6,b.energy+1);b.maxEnergy=Math.max(b.maxEnergy,b.energy);notes.push('場面先接住，回復 1 費用。');}
 const raw=card.power+(run.item.effect==='focus'&&card.kind!=='basic'?Math.max(1,Math.floor(run.item.power/4)):0);
 switch(card.effect){
  case'pressure':hit(run,raw+(card.kind==='character'&&b.enemy.exposed>0?5:0),notes);break;
  case'damage':hit(run,raw,notes);break;
  case'expose':{
   hit(run,raw,notes);let stacks=2+Math.floor((level-1)/2)+(card.kind==='event'?2:0);
   if(run.archetype==='evidence'&&!b.firstExpose){stacks++;run.block+=3;notes.push('佐證流：第一份紀錄多加 1 層佐證，獲得 3 格擋。');}
   if(!b.firstExpose&&b.modifier==='paper'){drawCards(state,run,1,rng);notes.push('附件滿桌：多抽 1 張牌。');}
   b.firstExpose=true;b.enemy.exposed=Math.min(10,b.enemy.exposed+stacks);notes.push(`對手佐證累積到 ${b.enemy.exposed} 層。`);break;
  }
  case'shield':{
   if(card.kind==='character')hit(run,4+(level-1),notes);
   let amount=raw;
   if(!b.firstShield&&b.modifier==='quiet')amount+=2;
   if(!b.firstShield&&run.archetype==='slack'){amount+=2;drawCards(state,run,1,rng);notes.push('摸魚流：把省下來的力氣換成一張牌。');}
   b.firstShield=true;run.block+=amount;notes.push(`獲得 ${amount} 格擋，現有 ${run.block}。`);break;
  }
  case'heal':if(card.kind==='character')hit(run,4+(level-1),notes);heal(run,raw,notes);break;
  case'focus':case'charge':{const count=2+Math.floor((level-1)/2);drawCards(state,run,count,rng);b.discount=1+Math.floor(level/2);notes.push(`抽 ${count} 張牌，下一張牌減 ${b.discount} 費用。`);break;}
  case'drain':case'weaken':if(card.kind==='character')hit(run,6+(level-1),notes);b.enemy.weak=Math.max(b.enemy.weak,Math.min(12,raw));b.enemy.weakTurns=2;notes.push(`對手接下來兩次攻勢降低 ${b.enemy.weak}。`);break;
  case'note':drawCards(state,run,1,rng);run.block+=2;notes.push('留了附件，多抽 1 張牌並獲得 2 格擋。');break;
  case'burden':notes.push('這張背鍋單暫時離開牌組。');break;
 }
 // Original personal signatures distinguish cards within the same role.
 if(entry.cardId==='person-jack'){b.enemy.exposed=Math.min(10,b.enemy.exposed+1);drawCards(state,run,1,rng);notes.push('傑克留下原始紀錄：多 1 層佐證，再抽 1 張。');}
 if(entry.cardId==='base-recess'){drawCards(state,run,1,rng);notes.push('把會議切成午休，再抽 1 張牌。');}
 if(entry.cardId==='person-jonathan'&&b.enemy.intent.damage>=16){run.block+=5;notes.push('強哥搬出助理職稱，額外獲得 5 格擋。');}
 if(entry.cardId==='person-captain'&&run.hp<run.maxHp/2){drawCards(state,run,1,rng);notes.push('船長替補給留了位置，再抽 1 張。');}
 if(entry.cardId==='person-alice'){drawCards(state,run,1,rng);notes.push('愛麗絲補一張攻略：再抽 1 張。');}
 if(entry.cardId==='person-sonny'){b.enemy.weak=Math.max(b.enemy.weak,2);b.enemy.weakTurns=Math.max(1,b.enemy.weakTurns);notes.push('理由伯先開記者會，打斷一次小攻勢。');}
 if(entry.cardId==='person-kind'&&run.coins>=3){run.coins-=3;heal(run,4,notes);notes.push('阿良安排加碼補給，花 3 枚本輪活動幣。');}
 if(entry.cardId==='person-professor'){b.discount=Math.max(2,b.discount);notes.push('林老師把重點講清楚，下一張牌改為減 2 費用。');}
 if(entry.cardId==='event-firstlove'&&b.played>=3){hit(run,14,notes);notes.push('第三張以後搶到副歌，追加 14 基礎傷害。');}
 if(entry.cardId==='event-roadshow'){drawCards(state,run,1,rng);notes.push('傑克順手外帶，多抽 1 張。');}
 if(entry.cardId==='event-allin'){b.energy=Math.min(6,b.energy+1);b.maxEnergy=Math.max(b.maxEnergy,b.energy);notes.push('這次真的最後一抽：回復 1 費用。');}
 if(entry.cardId==='item-cake'&&b.enemy.intent.kind==='rush'){run.block+=8;notes.push('未退冰蛋糕替重攻勢多擋 8。');}
 if(run.relics.includes('first-love-mic')&&b.played===3){hit(run,5,notes);notes.push('搶來的麥克風：第三張牌追加 5 基礎傷害。');}
 if(card.exhaust)b.exhaust.push(entry);else b.discard.push(entry);
 for(const note of notes)pushLog(run,note);
 b.enemy.intent=intent(run);state.lastResult={type:'expedition-play',cardId:entry.cardId,notes};winning(state,run,rng);
}
function endTurn(state,run,rng){
 const b=run.battle,e=b.enemy,plan=intent(run),blocked=Math.min(run.block,plan.damage),damage=Math.min(run.hp,plan.damage-blocked);
 run.hp-=damage;pushLog(run,`對方「${plan.label}」造成 ${damage} 傷害，格擋擋下 ${blocked}。`);run.block=0;
 if(plan.block){e.block=Math.min(30,e.block+plan.block);pushLog(run,`對手獲得 ${plan.block} 格擋。`);}
 if(plan.heal){const actual=Math.min(plan.heal,e.maxHp-e.hp);e.hp+=actual;pushLog(run,`對手重新整理說法，恢復 ${actual} 生命。`);}
 if(e.weakTurns>0)e.weakTurns--;
 b.discard.push(...b.hand.splice(0));
 if(run.hp<=0)return lost(state,run,'你已經沒力氣繼續這場會議。');
 if(b.turn>=20)return lost(state,run,'會議已經拖滿 20 回合，這輪被迫散場。');
 b.turn++;beginTurn(state,run,rng);state.lastResult={type:'expedition-turn',turn:b.turn};
}
function enterRoom(state,run,choice,rng,fail){
 if(!Number.isInteger(choice)||choice<0||choice>=run.roomChoices.length)fail('invalid_room','請選擇眼前的一條路。');
 const option=run.roomChoices[choice];run.room++;run.roomChoices=[];pushLog(run,`走進${option.title}。`);
 if(['battle','elite','boss'].includes(option.kind))return beginBattle(state,run,option,rng);
 if(option.kind==='rest'){run.phase='rest';run.battle=null;return;}
 run.phase='event';run.battle=null;
 run.event=option.eventId==='alice'?{id:'alice',title:'愛麗絲的借牌桌',body:'愛麗絲把幾張牌攤開：這些可以借你打完這輪，不會直接變成永久收藏。活動幣也只算這次冒險。',choices:[{title:'花 8 活動幣，借一張稀有牌。',description:'至少 R，只有這輪能用。',cost:8},{title:'先不借，聽完攻略喘口氣。',description:'恢復 6 生命，不花活動幣。',cost:0}]}:{id:'coffee',title:'三百元咖啡，這裡只收活動幣。',body:'水蛇提醒員工別喝，傑克已經拿著外帶杯走過去。你看看自己的狀態，再決定這杯到底要不要跟。',choices:[{title:'花 8 活動幣，買一杯補給。',description:'恢復 18 生命，拿到本輪咖啡遺物。',cost:8},{title:'替攤位整理收據，換一份酬勞。',description:'獲得 10 活動幣；忙完可能帶回額外的背鍋單。',cost:0}]};
}
function reward(run,choice,rng,state,fail){
 if(!Number.isInteger(choice)||choice<0||choice>3||choice<3&&!run.rewardChoices[choice])fail('invalid_reward','請選擇一張戰後牌，或先不加入。');
 if(choice<3){const row=run.rewardChoices[choice];run.deck.push({...row});pushLog(run,`本輪加入「${getExpeditionCardMeta(row.cardId,row.level).name}」。這是借用牌，沒有加入永久收藏。`);}else pushLog(run,'這次不加牌，讓原本的連鎖更容易抽到。');
 nextRoom(run,rng,state);
}
function rest(run,action,rng,state,fail){
 if(action.choice==='heal'){
  if(has(action,'cardIndex'))fail('invalid_rest','恢復時不需要指定卡片。');
  const actual=Math.min(26,run.maxHp-run.hp);run.hp+=actual;pushLog(run,`空檔恢復 ${actual} 生命。`);
 }else if(action.choice==='upgrade'){
  if(run.coins<6)fail('not_enough_coins','升級需要 6 枚本輪活動幣。');
  const index=action.cardIndex;if(!Number.isInteger(index)||index<0||index>=run.deck.length)fail('invalid_run_card','請選擇本輪牌組的一張牌。');
  const card=run.deck[index];if(card.level>=5)fail('max_level','這張牌本輪已達 Lv.5。');
  run.coins-=6;card.level++;pushLog(run,`花 6 活動幣，把「${getExpeditionCardMeta(card.cardId,card.level).name}」升到 Lv.${card.level}。永久收藏等級不變。`);
 }else fail('invalid_rest','請選擇恢復生命或升級一張牌。');
 nextRoom(run,rng,state);
}
function eventChoice(state,run,choice,rng,fail){
 if(!Number.isInteger(choice)||choice<0||choice>1)fail('invalid_event','請選擇眼前事件的一個回應。');
 const event=run.event,cost=event.choices[choice].cost;if(run.coins<cost)fail('not_enough_coins','這個選項需要更多本輪活動幣。');run.coins-=cost;
 if(event.id==='alice'&&choice===0){const pool=CARD_CATALOG.filter(card=>card.rarity!=='N');const card=pool[Math.floor(rng(state)*pool.length)];run.deck.push(instance(run,card.id));pushLog(run,`愛麗絲借你「${card.name}」。本輪打完要歸還，不加入永久收藏。`);}
 else if(event.id==='alice'){const actual=Math.min(6,run.maxHp-run.hp);run.hp+=actual;pushLog(run,`你把攻略聽完，恢復 ${actual} 生命。`);}
 else if(choice===0){const actual=Math.min(18,run.maxHp-run.hp);run.hp+=actual;if(!run.relics.includes('black-coffee'))run.relics.push('black-coffee');pushLog(run,`恢復 ${actual} 生命，帶走本輪遺物「偷外帶的咖啡」。`);}
 else{run.coins+=10;if(rng(state)<.55){run.deck.push(instance(run,'base-burden'));pushLog(run,'你拿到 10 活動幣，也被順便塞了一張背鍋單。');}else pushLog(run,'收據剛好都對得起來，你拿到 10 活動幣，沒多背一份。');}
 nextRoom(run,rng,state);state.lastResult={type:'expedition-event',room:run.room};
}
export function applyExpeditionAction(state,action,{rng,fail}){
 const allowed={
  'start-expedition':['type','stage','archetype'],'expedition-room':['type','choice'],'expedition-play':['type','handIndex'],'expedition-end-turn':['type'],'expedition-reward':['type','choice'],'expedition-rest':['type','choice','cardIndex'],'expedition-event':['type','choice'],'abandon-expedition':['type'],
 }[action.type];
 if(!allowed||Object.keys(action).some(key=>!allowed.includes(key)))fail('invalid_action','這個冒險操作無法辨識。');
 if(action.type==='start-expedition')return start(state,action,rng,fail);
 const run=needRun(state,null,fail);
 if(action.type==='abandon-expedition'){run.status='abandoned';run.phase='finished';run.summary={title:'你收起牌，這輪先到這裡。',body:'沒有扣掉永久卡片，也沒有領取本章首勝。調整隊伍後，可以重新開始。'};pushLog(run,run.summary.body);state.lastResult={type:'expedition-abandoned'};return;}
 const phase={'expedition-room':'route','expedition-play':'battle','expedition-end-turn':'battle','expedition-reward':'reward','expedition-rest':'rest','expedition-event':'event'}[action.type];needRun(state,phase,fail);
 if(action.type==='expedition-room')enterRoom(state,run,action.choice,rng,fail);
 if(action.type==='expedition-play')play(state,run,action.handIndex,rng,fail);
 if(action.type==='expedition-end-turn')endTurn(state,run,rng);
 if(action.type==='expedition-reward')reward(run,action.choice,rng,state,fail);
 if(action.type==='expedition-rest')rest(run,action,rng,state,fail);
 if(action.type==='expedition-event')eventChoice(state,run,action.choice,rng,fail);
}
export function projectExpedition(expedition){
 if(!expedition)return expedition;
 const safe=structuredClone(expedition);delete safe.nextUid;
 if(safe.roomChoices)for(const row of safe.roomChoices){delete row.eventId;}
 if(safe.battle){
  const b=safe.battle;b.drawCount=b.drawPile.length;b.drawComposition=[...b.drawPile].sort((a,b)=>a.cardId.localeCompare(b.cardId)||a.uid.localeCompare(b.uid));delete b.drawPile;
  b.discardCount=b.discard.length;b.exhaustCount=b.exhaust.length;b.block=safe.block;b.maxTurns=20;
  b.hand=b.hand.map(row=>({...row,cost:Math.max(0,getExpeditionCardMeta(row.cardId,row.level).cost-b.discount)}));
 }
 return safe;
}
