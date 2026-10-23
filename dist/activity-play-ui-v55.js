import {ACTIVITY_PLAY_CONTENT_V55,getActivityPlayV55} from './activity-play-v55.js';

// Only uncommitted gestures and plans live in this controller. The shared
// resolver, not this view, decides the story and every resource consequence.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const content=ACTIVITY_PLAY_CONTENT_V55;
const ARM_DURATION=content.arm.duration,SONG_DURATION=content.banquet.duration;
const SONG_BEATS=content.banquet.beatTimes,armPulses=content.arm.steadyTimes;
const mealNames=content.diet.mealOptions,moveNames=content.diet.exerciseOptions;
const roadOptions=content.roadshow.options,roadCards=content.roadshow.cards;
const dishes=content.dinner.options.map((name,i)=>({name,symbol:['🍚','🥬','🐟','◌'][i],cost:content.dinner.costs[i]}));
const basketballMoves=content.basketball.options;
const evidenceNames=content.review.options,reviewQuestions=content.review.cards;
const icons=Object.freeze({arm:'✊',diet:'▦',roadshow:'↗',dinner:'🍽',banquet:'♪',basketball:'●',review:'✓'});
const titles=Object.freeze({arm:'這一局，手上見真章。',diet:'排一週自己過得下去的日子。',roadshow:'人潮不是商機。先把問題接對。',dinner:'六道菜，十二格預算。',banquet:'First Love 搶麥決鬥，現在接拍。',basketball:'半場五波，先看誰擋在前面。',review:'委員問什麼，就把證據放上去。'});
const intros=Object.freeze({
 arm:'不用再選「我要比」。這次真的按下去，留下你的八秒對決紀錄。保持節奏，猛按也會累；阿福的賽後聲明，等比完再說。',
 diet:'七天的午餐與活動由你安排。點心可以吃，休息日也算安排；這場不收體重、不算熱量，只看你交出的生活紀錄。',
 roadshow:'六位訪客各有問題。選一位，再把他送到適合的展位；最後一起交出接待表，別讓玩具鵝簽下所有承諾。',
 dinner:'一桌四人，先排六道共享菜。每點一道就占用桌上預算；讓大家吃得到，再決定比目魚要占多少版面。',
 banquet:'傑克與水蛇輪流搶麥，你在台下接十二個拍點。沒有原曲音訊，只有這張餐巾做的節拍台。',
 basketball:'傑克、阿福和歐文都到場了。阿福是「移動迷宮」，歐文是「飛天拐子」；看清防守，再點球場位置或下方按鈕操作，打球也可能受傷。',
 review:'四個追問、三種資料夾。先選問題，再放上你打算拿出的佐證；一份資料可以用在不同題，簡報特效不算文件。'
});
const button=(command,text,extra='')=>`<button type="button" data-play-command="${command}" ${extra}>${text}</button>`;
const radioButtons=(command,options,selected,extra='')=>`<div class="play-segment" role="group">${options.map((name,i)=>button(command,esc(name),`data-play-value="${i}" aria-pressed="${selected===i}" ${extra}`)).join('')}</div>`;
const count=(values)=>values.filter(value=>value!==null).length;
const blankState=(id,descriptor)=>({id,roadPresentation:id==='roadshow'&&Array.isArray(descriptor?.optionDetails)?descriptor:null,phase:'ready',mode:'tap',taps:[],beats:[],elapsed:0,selected:0,days:Array.from({length:7},()=>({meal:null,exercise:null})),matches:Array(6).fill(null),plates:Array(6).fill(null),moves:[],evidence:Array(4).fill(null),message:'',locked:false});
const pill=(text,kind='')=>`<span class="play-pill ${kind}">${text}</span>`;
const progress=(label,value,max)=>`<div class="play-progress"><span>${esc(label)} <b data-play-count>${value} / ${max}</b></span><div class="play-progress-track" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><i style="width:${Math.max(0,Math.min(100,value/max*100))}%"></i></div></div>`;
const readiness=state=>state.id==='arm'||state.id==='banquet'?state.phase==='finished':state.id==='diet'?state.days.every(day=>day.meal!==null&&day.exercise!==null):state.id==='roadshow'?count(state.matches)===6:state.id==='dinner'?count(state.plates)===6:state.id==='basketball'?state.moves.length===5:count(state.evidence)===4;
const formFooter=(state)=>`<div class="play-submit-row">${button('reset',state.id==='arm'?'重比一局 ↺':state.id==='banquet'?'重新接拍 ↺':'重新安排 ↺','class="play-reset"')}<button type="button" class="play-submit" data-play-command="commit"${readiness(state)&&!state.locked?'':' disabled'}>${state.locked?'正在記下這一幕…':'交出這一幕的紀錄'} <span aria-hidden="true">→</span></button></div><p class="play-save-note">交出後才揭曉劇情與數值。尚未交出的操作不會保存，離開此頁可重新開始。</p>`;

function armBody(state){
 const steady=state.mode==='steady',n=state.taps.length,active=state.phase==='playing',strain=state.taps.filter((stamp,i)=>i>0&&stamp-state.taps[i-1]<160).length;
 return `<div class="play-mode" aria-label="腕力操作模式">${radioButtons('arm-mode',['八秒連點','穩定八拍'],steady?1:0,active?'disabled':'')}<p>${steady?'不比手速，照自己的步調按八下。滑鼠、觸控或鍵盤都能完成。':'開始後，八秒內重複按「出力」。保持節奏，猛按會累；手累就停，按得太密也不會多計。'}</p></div><div class="arm-arena" aria-label="腕力比賽桌"><div class="arm-player"><span class="arm-you">你</span><b>你的這隻手</b></div><div class="arm-hands" aria-hidden="true"><span>✊</span><i>VS</i><span>✊</span></div><div class="arm-player"><img src="./assets/sonny.png" alt="阿福"><b>阿福</b></div><div class="arm-table" aria-hidden="true"></div></div><div class="play-dual-stat"><div><span>${steady?'穩定出力':'有效出力'}</span><b data-arm-taps>${n}</b></div><div><span>${steady?'完成拍數':'剩餘秒數'}</span><b data-arm-time>${steady?`${n} / 8`:(Math.max(0,ARM_DURATION-state.elapsed)/1000).toFixed(1)}</b></div></div><div class="play-timer-track" role="progressbar" aria-label="本局操作進度" aria-valuemin="0" aria-valuemax="${steady?8:ARM_DURATION}" aria-valuenow="${steady?n:state.elapsed}" data-timer-progress><i style="width:${steady?n/8*100:state.elapsed/ARM_DURATION*100}%"></i></div><p class="arm-cadence" data-arm-cadence>場上節奏：${steady?'穩定八拍':strain>=8?'猛按太密，手開始累了':strain>0?'有幾下太急，找回節奏':'保持自己的步調'}</p><div class="play-action-zone">${state.phase==='ready'?button('start',steady?'準備好了，穩穩比':'開始八秒對決','class="play-start"'):state.phase==='finished'?`<div class="play-finished"><b>這局的出力已記下。</b><span>阿福已開始思考聲明，結果還沒公布。</span></div>`:button('arm-tap',steady?`出力 · 第 ${Math.min(8,n+1)} 拍`:'出力！','class="play-tap arm-tap" aria-describedby="play-help-v55"')}<p id="play-help-v55">${state.phase==='finished'?'這局已完成。交出紀錄看結果，或重新比一場。':active?(steady?'按滿八拍後，再交出紀錄。':'點按按鈕，或聚焦按鈕後按 Space／Enter。'):steady?'準備好再開始，八拍不計反應時間。':'按下開始才計時，不會突然開賽。'}</p></div>`;
}

function dietBody(state){
 const completed=state.days.filter(day=>day.meal!==null&&day.exercise!==null).length,day=state.days[state.selected];
 return `${progress('本週已排妥',completed,7)}<div class="diet-calendar" role="group" aria-label="七天飲食與活動行事曆">${state.days.map((row,i)=>button('diet-day',`<span>DAY ${i+1}</span><b>${i===5?'六':i===6?'日':['一','二','三','四','五'][i]}</b><small>${row.meal===null?'＋ 飲食':esc(mealNames[row.meal])}</small><small>${row.exercise===null?'＋ 活動':esc(moveNames[row.exercise])}</small>`,`data-play-value="${i}" class="${state.selected===i?'selected':''} ${row.meal!==null&&row.exercise!==null?'planned':''}" aria-pressed="${state.selected===i}" aria-label="第 ${i+1} 天，${row.meal===null?'飲食未安排':mealNames[row.meal]}，${row.exercise===null?'活動未安排':moveNames[row.exercise]}"`)).join('')}</div><div class="play-editor diet-editor"><div class="play-editor-heading"><span class="play-day-stamp">${state.selected+1}</span><div><span class="play-kicker">DAY ${state.selected+1} / MY CALENDAR</span><h3>今天怎麼過？</h3></div></div><fieldset><legend>飲食安排</legend>${radioButtons('diet-meal',mealNames,day.meal)}</fieldset><fieldset><legend>活動安排</legend>${radioButtons('diet-exercise',moveNames,day.exercise)}</fieldset><div class="diet-editor-bottom"><p>這是虛構辦公室比賽，不需要填真實身體資料。</p>${button('diet-copy','這樣過一天，複製到未排的日子 →',`class="play-small-button"${day.meal!==null&&day.exercise!==null?'':' disabled'}`)}</div></div>`;
}

function roadBody(state){
 if(state.roadPresentation){
  const {cards,options,optionDetails}=state.roadPresentation;
  return `${progress('現場問題已安排',count(state.matches),6)}<div class="road-desk"><div class="road-visitor-list" role="group" aria-label="待處理的現場問題">${cards.map((card,i)=>button('road-visitor',`<span class="play-index">${String(i+1).padStart(2,'0')}</span><span>${esc(card)}<small>${state.matches[i]===null?'尚未安排':`→ ${esc(options[state.matches[i]])}`}</small></span>${state.matches[i]===null?'':'<i aria-hidden="true">✓</i>'}`,`data-play-value="${i}" class="road-visitor ${state.selected===i?'selected':''}" aria-pressed="${state.selected===i}"`)).join('')}</div><div class="road-booths"><span class="play-kicker">第 ${state.selected+1} 題 / 現場回應</span><h3>「${esc(cards[state.selected])}」</h3><p>先決定這一題怎麼接，再一起交出紀錄。</p>${options.map((name,i)=>button('road-match',`<span class="road-booth-icon" aria-hidden="true">${['▣','↔','✉'][i]}</span><b>${esc(name)}</b><small>${esc(optionDetails[i])}</small>`,`data-play-value="${i}" class="road-booth" aria-pressed="${state.matches[state.selected]===i}"`)).join('')}<div class="road-goose" aria-hidden="true">♙ <span>玩具鵝董事長：<br>台上的話先不照單全收。</span></div></div></div>`;
 }
 return `${progress('訪客已分流',count(state.matches),6)}<div class="road-desk"><div class="road-visitor-list" role="group" aria-label="待接待的訪客">${roadCards.map((card,i)=>button('road-visitor',`<span class="play-index">${String(i+1).padStart(2,'0')}</span><span>${esc(card)}<small>${state.matches[i]===null?'等待分流':`→ ${esc(roadOptions[state.matches[i]])}`}</small></span>${state.matches[i]===null?'':'<i aria-hidden="true">✓</i>'}`,`data-play-value="${i}" class="road-visitor ${state.selected===i?'selected':''}" aria-pressed="${state.selected===i}"`)).join('')}</div><div class="road-booths"><span class="play-kicker">接待第 ${state.selected+1} 位訪客</span><h3>「${esc(roadCards[state.selected])}」</h3><p>把問題交給適合的展位。</p>${roadOptions.map((name,i)=>button('road-match',`<span class="road-booth-icon" aria-hidden="true">${['▣','↔','✉'][i]}</span><b>${esc(name)}</b><small>${['展示目前能重現的功能','確認場景、範圍與限制','取得同意，安排下一步'][i]}</small>`,`data-play-value="${i}" class="road-booth" aria-pressed="${state.matches[state.selected]===i}"`)).join('')}<div class="road-goose" aria-hidden="true">♙ <span>玩具鵝董事長：<br>今天先不代簽承諾。</span></div></div></div>`;
}

function dinnerBody(state){
 const cost=state.plates.reduce((sum,index)=>sum+(index===null?0:dishes[index].cost),0),over=cost>12;
 return `<div class="dinner-budget${over?' over-budget':''}"><div><span>桌上共享預算</span><b>${cost}<small> / 12</small></b></div><div class="dinner-budget-squares" aria-label="已安排 ${cost} 格，預算十二格">${Array.from({length:12},(_,i)=>`<i class="${i<cost?'spent':''}" aria-hidden="true"></i>`).join('')}</div><p>${over?'預算被菜單吃掉了。還能修改，超出的安排也可以照單交出。':'這是公司共享預算，不扣個人存款；整桌的反應交出後才知道。'}</p></div><div class="dinner-table"><div class="dinner-guests" aria-label="同桌四人"><span>你</span><span>船長</span><span>歐文</span><span>董事長</span></div><div class="dinner-plates" role="group" aria-label="六道共享菜">${state.plates.map((index,i)=>button('dinner-slot',`<span>第 ${i+1} 道</span><b aria-hidden="true">${index===null?'＋':dishes[index].symbol}</b><small>${index===null?'等你點菜':dishes[index].name}</small>`,`data-play-value="${i}" class="dinner-plate${state.selected===i?' selected':''}" aria-pressed="${state.selected===i}" aria-label="第 ${i+1} 道，${index===null?'尚未點菜':dishes[index].name}"`)).join('')}</div></div><div class="dinner-menu"><div><span class="play-kicker">第 ${state.selected+1} 道 / OPEN MENU</span><h3>這道端什麼上來？</h3></div><div class="dinner-menu-items">${dishes.map((dish,i)=>button('dinner-dish',`<span aria-hidden="true">${dish.symbol}</span><b>${dish.name}</b><small>${dish.cost?`${dish.cost} 格`:'先不上菜'}</small>`,`data-play-value="${i}" aria-pressed="${state.plates[state.selected]===i}"`)).join('')}</div></div><p class="play-local-hint">飯、菜、比目魚可以重複點。這張菜單不替你決定誰要離席，也不先公布滿意度。</p>`;
}

function banquetBody(state){
 const steady=state.mode==='steady',active=state.phase==='playing';
 return `<div class="play-mode" aria-label="搶麥操作模式">${radioButtons('song-mode',['節拍挑戰','輪流接十二拍'],steady?1:0,active?'disabled':'')}<p>${steady?'不計反應時間，按十二下輪流把麥遞給兩位主唱。這是免手速模式。':'光點走到中央拍點時按「接拍」。共十二拍，開始前不用搶。'}</p></div><div class="song-duel"><div class="song-singer"><img src="./assets/jack.png" alt="傑克"><span>傑克</span></div><div class="song-title"><span>FIRST LOVE</span><b>搶麥決鬥</b><small>原創節拍台 · 無歌曲音訊</small></div><div class="song-singer"><img src="./assets/meimei.png" alt="水蛇"><span>水蛇</span></div></div><div class="song-beat-sheet" aria-label="十二拍接力">${SONG_BEATS.map((_,i)=>`<span class="${i<state.beats.length?'played':''}${active&&i===state.beats.length?' current':''}" aria-label="第 ${i+1} 拍${i<state.beats.length?'已操作':''}">${i%2===0?'傑':'蛇'}</span>`).join('')}</div>${!steady?'<div class="song-lane" aria-label="節拍位置"><span class="song-target" aria-hidden="true"></span><i class="song-cursor" data-song-cursor aria-hidden="true"></i><span>準備</span><span>接拍點</span><span>下一拍</span></div>':''}<div class="play-dual-stat"><div><span>已接拍數</span><b data-song-count>${state.beats.length} <small>/ 12</small></b></div><div><span>${steady?'下一位':'剩餘秒數'}</span><b data-song-time>${steady?(state.beats.length>=12?'完成':state.beats.length%2===0?'傑克':'水蛇'):(Math.max(0,SONG_DURATION-state.elapsed)/1000).toFixed(1)}</b></div></div><div class="play-action-zone">${state.phase==='ready'?button('start',steady?'開始輪流接拍':'開始節拍挑戰','class="play-start"'):state.phase==='finished'?'<div class="play-finished"><b>搶麥紀錄完成。</b><span>誰的氣勢壓過誰，交出後才知道。</span></div>':button('song-hit',steady?`遞麥給${state.beats.length%2===0?'傑克':'水蛇'}`:'接拍 ♪','class="play-tap song-tap" aria-describedby="play-song-help-v55"')}<p id="play-song-help-v55">${state.phase==='finished'?'這段接拍已完成。交出紀錄看結果，或重新接一次。':active?'可用觸控、滑鼠或鍵盤 Space／Enter。':'傑克與水蛇交替接唱，願景演講不占拍數。'}</p></div>`;
}

function basketballBody(state){
 const round=Math.min(state.moves.length,4),defenders=[{name:'阿福',tag:'移動迷宮',id:'sonny',line:content.basketball.cards[0],hint:'人跟球不用走同一條路，隊友正在另一側招手。'},{name:'歐文',tag:'飛天拐子',id:'owen',line:content.basketball.cards[1],hint:'近身接觸要留意，外側還有一點空間。'},{name:'空檔',tag:'終於沒有主管',id:null,line:content.basketball.cards[2],hint:'看清楚再動作，不用把每一球都打成進度會議。'},{name:'阿福',tag:'迷宮第二期工程',id:'sonny',line:content.basketball.cards[3],hint:'禁區塞滿時，外側也可以找機會；不用每球硬闖迷宮。'},{name:'歐文',tag:'飛天拐子返場',id:'owen',line:content.basketball.cards[4],hint:'最後一波也可以交給空檔隊友，不用追著手肘走。'}][round];
 return `${progress('今晚的五波進攻',state.moves.length,5)}<div class="basket-court" aria-label="半場進攻板"><span class="basket-hoop" aria-hidden="true">▤</span><span class="basket-lane" aria-hidden="true"></span><button type="button" class="court-player court-player-jack" data-play-command="basket-move" data-play-value="0" aria-label="把球傳給空檔的傑克"${state.moves.length>=5?' disabled':''}><img src="./assets/jack.png" alt="傑克在空檔"><small>傳球給傑克</small></button>${state.moves.length<5?`<span class="court-player court-defender">${defenders.id?`<img src="./assets/${defenders.id}.png" alt="${defenders.name}">`:'<i aria-hidden="true">↗</i>'}<small>${defenders.name}</small></span>`:''}<span class="court-player court-you"><b>你</b><small>● 持球</small></span><span class="court-arrow" aria-hidden="true">↗</span>${state.moves.length<5?'<button type="button" class="court-target court-drive-target" data-play-command="basket-move" data-play-value="1"><span aria-hidden="true">↗</span><small>切入籃下</small></button><button type="button" class="court-target court-shoot-target" data-play-command="basket-move" data-play-value="2"><span aria-hidden="true">⌁</span><small>外線出手</small></button>':''}</div>${state.moves.length===5?'<div class="play-finished basket-finished"><b>五波打完，先把球收好。</b><span>戰績、體力與有沒有擦撞，交出紀錄後一起揭曉。</span></div>':`<div class="basket-matchup"><div>${pill(`第 ${round+1} 波`)}${pill(defenders.tag,'play-opponent-pill')}</div><h3>${esc(defenders.line)}</h3><p>${esc(defenders.hint)}</p><div class="basket-actions">${basketballMoves.map((name,i)=>button('basket-move',`<span aria-hidden="true">${['↔','↗','⌁'][i]}</span><b>${name}</b>`,`data-play-value="${i}"`)).join('')}</div></div>`}<ol class="basket-log" aria-label="已安排的進攻">${state.moves.map((move,i)=>`<li><span>${i+1}</span>${basketballMoves[move]} <small>操作已記下</small></li>`).join('')}</ol><p class="play-local-hint">這裡顯示你的操作，不先公布命中、受傷或體力變化。所有人都可以選擇不硬碰。</p>`;
}

function reviewBody(state){
 return `${progress('已備妥回答',count(state.evidence),4)}<div class="review-board"><div class="review-questions" role="group" aria-label="審查追問">${reviewQuestions.map((question,i)=>button('review-question',`<span class="play-index">Q${i+1}</span><b>${esc(question)}</b><small>${state.evidence[i]===null?'尚未放入資料':`📎 ${evidenceNames[state.evidence[i]]}`}</small>`,`data-play-value="${i}" class="review-question${state.selected===i?' selected':''}" aria-pressed="${state.selected===i}"`)).join('')}</div><div class="review-files"><span class="play-kicker">Q${state.selected+1} / 請拿出佐證</span><h3>${esc(reviewQuestions[state.selected])}</h3><p>點一份資料，放進這一題的回答。</p>${evidenceNames.map((name,i)=>button('review-file',`<span class="file-tab" aria-hidden="true">${['✓','§','＄'][i]}</span><b>${name}</b><small>${['測試版本、條件與驗收標準','授權範圍、資料來源與同意','時數、人員與經費對照'][i]}</small>`,`data-play-value="${i}" class="review-file" aria-pressed="${state.evidence[state.selected]===i}"`)).join('')}<p class="review-file-note">玩具鵝的名片不在證據清單。<br>同一份佐證可回答不只一題。</p></div></div>`;
}

function bodyFor(state){return ({arm:armBody,diet:dietBody,roadshow:roadBody,dinner:dinnerBody,banquet:banquetBody,basketball:basketballBody,review:reviewBody})[state.id](state);}
function contentHTML(state){
 return `<div class="activity-play-heading"><span class="play-kicker"><i aria-hidden="true"></i> PLAY THE MOMENT / 動手玩這一幕</span><span class="play-heading-icon" aria-hidden="true">${icons[state.id]}</span><h2>${state.roadPresentation?esc(state.roadPresentation.title):titles[state.id]}</h2><p>${state.roadPresentation?esc(state.roadPresentation.instructions):intros[state.id]}</p></div><div class="activity-play-board play-board-${state.id}">${bodyFor(state)}</div><p class="play-feedback" data-play-feedback role="status" aria-live="polite" aria-atomic="true">${esc(state.message||'操作先記在這裡，劇情結果還沒揭曉。')}</p>${formFooter(state)}`;
}

export function renderActivityPlayHTMLV55(run,event){
 const descriptor=getActivityPlayV55(run);
 if(!descriptor||event?.id!==`activity44-${descriptor.id}-1`)return'';
 const state=blankState(descriptor.id,descriptor);
 return `<section class="activity-play" data-activity-play-v55="${descriptor.id}" aria-label="${esc(state.roadPresentation?.title||titles[descriptor.id])}">${contentHTML(state)}</section>`;
}

export function mountActivityPlayV55({root,run,event,onCommit}={}){
 const descriptor=getActivityPlayV55(run),panel=root?.matches?.('[data-activity-play-v55]')?root:root?.querySelector?.('[data-activity-play-v55]');
 if(!descriptor||!panel||event?.id!==`activity44-${descriptor.id}-1`||typeof onCommit!=='function')return()=>{};
 let state=blankState(descriptor.id,descriptor),alive=true,frame=null,started=0,lastGesture=-Infinity,lastPaint=0;
 const doc=panel.ownerDocument,win=doc.defaultView;
 const now=()=>win.performance.now();
 const cancelFrame=()=>{if(frame!==null)win.cancelAnimationFrame(frame);frame=null;};
 const query=selector=>panel.querySelector(selector);
 const feedback=message=>{state.message=message;const element=query('[data-play-feedback]');if(element)element.textContent=message;};
 const paint=()=>{
  if(!alive)return;
  const active=doc.activeElement,focus=active&&panel.contains(active)?{command:active.dataset.playCommand,value:active.dataset.playValue}:null;
  panel.innerHTML=contentHTML(state);
  if(focus){const target=[...panel.querySelectorAll('[data-play-command]')].find(button=>button.dataset.playCommand===focus.command&&button.dataset.playValue===focus.value&&!button.disabled);target?.focus({preventScroll:true});}
 };
 const finish=()=>{cancelFrame();state.phase='finished';state.elapsed=state.id==='arm'?ARM_DURATION:SONG_DURATION;paint();feedback(state.id==='arm'?(state.mode==='steady'?'穩定八拍已完成，可以交出或重比。':'八秒已到。出力紀錄完成，可以交出或重比。'):'十二拍的這段演出已結束，可以交出或重來。');query('[data-play-command="commit"]')?.focus({preventScroll:true});};
 const updateClock=time=>{
  if(!alive||state.phase!=='playing'||state.mode==='steady')return;
  const duration=state.id==='arm'?ARM_DURATION:SONG_DURATION;
  state.elapsed=Math.min(duration,Math.max(0,time-started));
  if(state.elapsed>=duration){finish();return;}
  if(time-lastPaint>=70){
   const display=query(state.id==='arm'?'[data-arm-time]':'[data-song-time]');if(display)display.textContent=((duration-state.elapsed)/1000).toFixed(1);
   const meter=query('[data-timer-progress]');if(meter){meter.setAttribute('aria-valuenow',String(Math.round(state.elapsed)));meter.firstElementChild.style.width=`${state.elapsed/duration*100}%`;}
   if(state.id==='banquet'){
    const cursor=query('[data-song-cursor]');if(cursor){const nearest=SONG_BEATS.find(target=>target>=state.elapsed-300)??SONG_BEATS.at(-1);cursor.style.left=`${Math.max(2,Math.min(98,50+(state.elapsed-nearest)/600*100))}%`;}
   }
   lastPaint=time;
  }
  frame=win.requestAnimationFrame(updateClock);
 };
 const start=()=>{
  if(state.phase!=='ready')return;
  state.phase='playing';state.elapsed=0;state.taps=[];state.beats=[];lastGesture=-Infinity;started=now();lastPaint=0;paint();
  feedback(state.mode==='steady'?'照自己的步調操作，每一下都會記下。':state.id==='arm'?'開始！八秒內按出力，累了也可以停手。':'開始！光點靠近中央拍點時接拍。');
  query(`[data-play-command="${state.id==='arm'?'arm-tap':'song-hit'}"]`)?.focus({preventScroll:true});
  if(state.mode!=='steady')frame=win.requestAnimationFrame(updateClock);
 };
 const inputFor=()=>state.id==='arm'?{kind:'arm',mode:state.mode,taps:[...state.taps]}:state.id==='diet'?{kind:'diet',days:state.days.map(day=>({...day}))}:state.id==='roadshow'?{kind:'roadshow',matches:[...state.matches]}:state.id==='dinner'?{kind:'dinner',plates:[...state.plates]}:state.id==='banquet'?{kind:'banquet',beats:[...state.beats]}:state.id==='basketball'?{kind:'basketball',moves:[...state.moves]}:{kind:'review',evidence:[...state.evidence]};
 const afterSelection=message=>{state.message=message;paint();};
 const onClick=event=>{
  const target=event.target.closest?.('[data-play-command]');if(!target||!panel.contains(target))return;
  event.stopPropagation();
  if(!alive||state.locked||target.disabled)return;
  const command=target.dataset.playCommand,value=Number(target.dataset.playValue);
  if(command==='reset'){cancelFrame();const mode=state.mode;state=blankState(descriptor.id,descriptor);state.mode=mode;paint();query('[data-play-command="start"]')?.focus({preventScroll:true});return;}
  if(command==='commit'){
   if(!readiness(state))return;
   state.locked=true;paint();feedback('正在記下這一幕，接著揭曉結果。');
   try{Promise.resolve(onCommit(inputFor())).then(result=>{if(result===false&&alive){state.locked=false;paint();feedback('目前進度已有變動，這份操作尚未送出。確認這一幕後，可以重新交出。');}}).catch(()=>{if(alive){state.locked=false;paint();feedback('這一幕還沒送出。請再試一次，或重新整理確認目前進度。');}});}catch{state.locked=false;paint();feedback('這一幕還沒送出。請確認目前進度後再試。');}return;
  }
  if(command==='start'){start();return;}
  if(command==='arm-mode'||command==='song-mode'){if(state.phase==='playing')return;cancelFrame();state=blankState(descriptor.id,descriptor);state.mode=value===1?'steady':'tap';paint();return;}
  if(command==='arm-tap'){
   if(state.phase!=='playing')return;
   const stamp=now(),elapsed=Math.floor(stamp-started);if(state.mode!=='steady'&&elapsed>=ARM_DURATION){finish();return;}
   if(stamp-lastGesture<80)return;lastGesture=stamp;
   if(state.taps.length>=100)return;
   state.taps.push(state.mode==='steady'?armPulses[state.taps.length]:Math.max(0,elapsed));
   if(state.mode==='steady'){if(state.taps.length===8){finish();return;}paint();feedback(`第 ${state.taps.length} 拍出力記下。`);}
   else{query('[data-arm-taps]').textContent=String(state.taps.length);const strain=state.taps.filter((value,i)=>i>0&&value-state.taps[i-1]<160).length;query('[data-arm-cadence]').textContent=`場上節奏：${strain>=8?'猛按太密，手開始累了':strain>0?'有幾下太急，找回節奏':'保持自己的步調'}`;query('.arm-hands')?.classList.toggle('arm-pushed',state.taps.length%2===1);if(state.taps.length%5===0)feedback(`已記下 ${state.taps.length} 次有效出力。`);}return;
  }
  if(command==='song-hit'){
   if(state.phase!=='playing'||state.beats.length>=12)return;
   const stamp=now(),elapsed=Math.floor(stamp-started);if(state.mode!=='steady'&&elapsed>=SONG_DURATION){finish();return;}
   if(stamp-lastGesture<80)return;lastGesture=stamp;
   const beat=state.mode==='steady'?SONG_BEATS[state.beats.length]:Math.max(0,elapsed);state.beats.push(beat);
   if(state.mode==='steady'){if(state.beats.length===12){finish();return;}paint();feedback(`第 ${state.beats.length} 拍，麥克風接住了。`);}
   else{
    query('[data-song-count]').innerHTML=`${state.beats.length} <small>/ 12</small>`;
    [...panel.querySelectorAll('.song-beat-sheet>span')].forEach((node,i)=>{node.classList.toggle('played',i<state.beats.length);node.classList.toggle('current',i===state.beats.length);});
    const distance=Math.min(...SONG_BEATS.map(target=>Math.abs(target-beat)));if(state.beats.length===12){target.disabled=true;target.textContent='十二拍已記下';feedback('十二下操作都已記下，等這段演出結束再交出。');}else feedback(distance<=180?'拍點接住！先記下，等表演結束。':'這一下已記下。下一拍慢慢找節奏。');
   }return;
  }
  if(command==='diet-day'){state.selected=value;paint();return;}
  if(command==='diet-meal'||command==='diet-exercise'){state.days[state.selected][command==='diet-meal'?'meal':'exercise']=value;afterSelection(`第 ${state.selected+1} 天的${command==='diet-meal'?'飲食':'活動'}已安排。`);return;}
  if(command==='diet-copy'){const source=state.days[state.selected];if(source.meal===null||source.exercise===null)return;state.days=state.days.map(day=>({meal:day.meal??source.meal,exercise:day.exercise??source.exercise}));afterSelection('這份步調已複製到未排的格子。每一天仍然可以再調整。');return;}
  if(command==='road-visitor'||command==='dinner-slot'||command==='review-question'){state.selected=value;paint();return;}
  if(command==='road-match'){state.matches[state.selected]=value;afterSelection(state.roadPresentation?`第 ${state.selected+1} 題先交給「${state.roadPresentation.options[value]}」。`:`第 ${state.selected+1} 位訪客安排到「${roadOptions[value]}」。`);return;}
  if(command==='dinner-dish'){state.plates[state.selected]=value;afterSelection(`第 ${state.selected+1} 道安排「${dishes[value].name}」。`);return;}
  if(command==='basket-move'){if(state.moves.length>=5)return;state.moves.push(value);afterSelection(`第 ${state.moves.length} 波已記下「${basketballMoves[value]}」。${state.moves.length<5?'接著看下一波的防守。':'五波打完，準備交出紀錄。'}`);return;}
  if(command==='review-file'){state.evidence[state.selected]=value;afterSelection(`Q${state.selected+1} 已放入「${evidenceNames[value]}」。`);}
 };
 const onKey=event=>{if(event.repeat&&(event.key===' '||event.key==='Enter')&&event.target.closest?.('[data-play-command]'))event.preventDefault();};
 const onVisibility=()=>{if(doc.hidden&&state.phase==='playing'&&state.mode!=='steady'){cancelFrame();state.phase='ready';state.taps=[];state.beats=[];state.elapsed=0;state.message='剛才暫離了畫面，本局尚未交出。準備好再重新開始，不計剛才那段時間。';paint();}};
 panel.addEventListener('click',onClick);panel.addEventListener('keydown',onKey);doc.addEventListener('visibilitychange',onVisibility);
 return()=>{alive=false;cancelFrame();panel.removeEventListener('click',onClick);panel.removeEventListener('keydown',onKey);doc.removeEventListener('visibilitychange',onVisibility);};
}
