// Player inputs are bounded evidence of a local game, never a trusted score.
// The canonical engine derives performance and draws the fictional outcome.
export const isActivityPlayV55=run=>/^e39-cal46-kin49-g-e-s-m-/.test(typeof run==='string'?run:run?.seed||'');
const ids=['arm','diet','roadshow','dinner','banquet','basketball','review'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const ACTIVITY_PLAY_CONTENT_V55=Object.freeze({
 arm:{title:'八秒上桌，這回輪到你。',instructions:'按開始後，在八秒內按動出力鍵，保持節奏；連續猛按也會累。也可選不計時的八拍模式。比賽只在畫面裡進行，不必真的用手腕硬撐。',duration:8000,steadyTimes:[500,1500,2500,3500,4500,5500,6500,7500]},
 diet:{title:'把七天排成做得到的樣子。',instructions:'替這場遊戲的七天安排飲食與活動。正常吃飯、點心和休息都能放進計畫；這裡比的是安排能否持續，不評比身材。',mealOptions:['正常吃飯','正餐加點心','咖啡代替正餐'],exerciseOptions:['下樓散步','伸展一下','休息日'],days:7},
 roadshow:{title:'六位訪客，先把問題送對地方。',instructions:'把每張訪客問題卡交給合適的展位。願景不用搶答，真的能接下來的才算。',options:['現場展示','需求與限制','聯絡與後續'],cards:['能不能現在看離線版？','設備限制可以先確認嗎？','願意測試，後續找誰聯絡？','我們只缺小範圍整合，先談適用嗎？','我要看可重現的執行畫面。','收名片前，請先問我同不同意聯絡。']},
 dinner:{title:'十二點預算，排好六道共享菜。',instructions:'替全桌排六道菜，預算共十二點。別讓整桌只吃裝飾，也別把下一年度的錢先花完。這是公司共享預算，不扣你的存款。',options:['白飯','青菜','比目魚','空盤裝飾'],costs:[1,2,4,0],budget:12,slots:6},
 banquet:{title:'First Love 加演，節拍交給你。',instructions:'傑克和水蛇又搶到同一段副歌。跟著亮起的拍點替兩人打拍子；也可改用不計時的逐拍模式。',duration:7800,beatTimes:Array.from({length:12},(_,i)=>500+i*600)},
 basketball:{title:'移動迷宮，飛天拐子，還有你的球。',instructions:'阿福和歐文也來了。依五波防守選擇傳球、切入或外線出手；選擇會影響配合與碰撞風險。這是原創球場綽號與虛構賽況。',options:['傳球換位','切入籃下','外線出手'],cards:['阿福「移動迷宮」站住路線，傑克在側邊空了。','歐文「飛天拐子」往禁區衝，外線有空位。','眼前出現空檔，隊友把禁區拉開。','阿福又把禁區塞滿，外圍還有出手空間。','歐文起跳，傑克在另一側舉手。'],defenders:['sonny','owen',null,'sonny','owen']},
 review:{title:'別把願景交成附件，先對好四份證據。',instructions:'替委員的四個問題配上能核對的佐證。回答可以很短，文件不能只剩公司形容詞。',options:['驗收與測試紀錄','授權與同意文件','工時與單據'],cards:['這個成果能重現嗎？','資料能合法用在這個範圍嗎？','經費如何對上投入的人力？','這項功能依什麼標準驗收？']}
});

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
function array(value,length,max){
 if(!Array.isArray(value)||value.length!==length||!Array.from(value).every(n=>Number.isInteger(n)&&n>=0&&n<=max))throw new Error('Invalid activity play entries');
}
function timestamps(value,maxLength,maxTime){
 if(!Array.isArray(value)||value.length>maxLength||!Array.from(value).every((n,i)=>Number.isInteger(n)&&n>=0&&n<=maxTime&&(i===0||n>value[i-1])))throw new Error('Invalid activity play timing');
}
const matches=(entries,targets)=>entries.reduce((sum,n,i)=>sum+Number(n===targets[i]),0);
const timingHits=(entries,targets,window)=>{
 const unused=new Set(targets.map((_,i)=>i));let hits=0;
 for(const value of entries){let nearest=-1,distance=Infinity;for(const i of unused){const d=Math.abs(value-targets[i]);if(d<distance){nearest=i;distance=d;}}if(distance<=window){unused.delete(nearest);hits++;}}
 return hits;
};

export function deriveActivityPlayV55(input,id){
 if(!ids.includes(id)||!input||input.kind!==id)throw new Error('Invalid activity play kind');
 let score=0,summary='',measures={};
 if(id==='arm'){
  if(!exact(input,['kind','mode','taps'])||!['tap','steady'].includes(input.mode))throw new Error('Invalid arm play');
  timestamps(input.taps,100,8000);
  if(input.taps.some((n,i)=>i>0&&n-input.taps[i-1]<80))throw new Error('Arm play timing too dense');
  if(input.mode==='steady'){
   if(input.taps.length!==8)throw new Error('Invalid steady arm play');
   const hits=timingHits(input.taps,ACTIVITY_PLAY_CONTENT_V55.arm.steadyTimes,350);score=Math.round(hits/8*100);measures={mode:'steady',hits,total:8};summary=`你完成八拍出力，對上 ${hits} 拍。`;
  }else{
   const span=input.taps.length>1?input.taps.at(-1)-input.taps[0]:0,strain=input.taps.filter((n,i)=>i>0&&n-input.taps[i-1]<160).length;
   score=clamp(Math.round(Math.min(input.taps.length/28,1)*60+Math.min(span/6000,1)*40-Math.min(strain*2,45)),0,100);measures={mode:'tap',taps:input.taps.length,span,strain};summary=`八秒內出力 ${input.taps.length} 次${strain>=8?'，猛按讓後段有點吃力':''}。`;
  }
 }else if(id==='diet'){
  if(!exact(input,['kind','days'])||!Array.isArray(input.days)||input.days.length!==7||!Array.from(input.days).every(day=>exact(day,['meal','exercise'])&&[0,1,2].includes(day.meal)&&[0,1,2].includes(day.exercise)))throw new Error('Invalid diet calendar');
  const meals=input.days.filter(day=>day.meal!==2).length,active=input.days.filter(day=>day.exercise!==2).length,rest=input.days.filter(day=>day.exercise===2).length;
  // Rest and an ordinary meal with dessert are both valid; the calendar rewards
  // a repeatable mix rather than deprivation or a body measurement.
  score=clamp(meals*8+Math.min(active,5)*6+(rest>0?10:0),0,100);measures={meals,active,rest};summary=`七天已排好：${meals} 天有正餐、${active} 天散步或伸展、${rest} 天休息。`;
 }else if(id==='dinner'){
  if(!exact(input,['kind','plates']))throw new Error('Invalid dinner plan');array(input.plates,6,3);
  const cost=input.plates.reduce((sum,n)=>sum+ACTIVITY_PLAY_CONTENT_V55.dinner.costs[n],0),fed=input.plates.filter(n=>n!==3).length,variety=new Set(input.plates.filter(n=>n!==3)).size;
  score=clamp(fed*7+variety*10+(cost<=12?15:-35),0,100);if(variety<3)score=Math.min(score,74);measures={cost,budget:12,fed,variety};summary=`六道共享菜排定，使用 ${cost}／12 點公司預算。`;
 }else if(id==='banquet'){
  if(!exact(input,['kind','beats']))throw new Error('Invalid banquet rhythm');timestamps(input.beats,12,7800);
  const hits=timingHits(input.beats,ACTIVITY_PLAY_CONTENT_V55.banquet.beatTimes,260);score=Math.round(hits/12*100);measures={hits,total:12};summary=`十二拍加演，你對上 ${hits} 拍。`;
 }else{
  const key=id==='roadshow'?'matches':id==='review'?'evidence':'moves',length=id==='roadshow'?6:id==='review'?4:5;
  if(!exact(input,['kind',key]))throw new Error('Invalid activity puzzle');array(input[key],length,2);
  const targets=id==='roadshow'?[0,1,2,1,0,2]:id==='review'?[0,1,2,0]:[0,2,1,2,0],hits=matches(input[key],targets);
  score=Math.round(hits/length*100);measures={hits,total:length};
  if(id==='basketball'){measures.drives=input.moves.filter(n=>n===1).length;measures.crowdedDrives=input.moves.filter((n,i)=>n===1&&i!==2).length;summary='你完成五波攻守，球場選擇已記下。';}
  else summary=id==='roadshow'?`六張訪客問題卡，${hits} 張送到合適展位。`:`四份證據，${hits} 份對上問題。`;
 }
 const grade=score>=75?2:score>=40?1:0;
 return {input:structuredClone(input),grade,score,summary,measures};
}

export function getActivityPlayV55(run){
 const x=run?.activityContext;
 if(!isActivityPlayV55(run)||run.pending||run.completed||!x||x.version!==1||x.stage!==1||!ids.includes(x.id)||run.eventId!==`activity44-${x.id}-1`)return null;
 return {id:x.id,version:1,...structuredClone(ACTIVITY_PLAY_CONTENT_V55[x.id])};
}

export function withActivityPlayEventV55(run,event){
 if(!isActivityPlayV55(run)||!run.activityContext)return event;
 const x=run.activityContext,out={...event,choices:event.choices.map(choice=>({...choice}))};
 if(x.id==='arm'){
  out.activity={...out.activity,mechanic:'議定規則 → 八秒出力 → 理由伯記者會'};
  if(x.stage===0){out.body='傑克把桌面清空，這回請你和阿福上桌。阿福先問有沒有錄影，再說今天吃太飽。披薩盒裡又少了一片。你們提議先比一小場，他想了一下，說開始的那一秒也要先定義。';out.choices[0].text='先訂好時間、喊停與平手規則，再把手放上桌。';}
  if(x.stage===1){out.speaker='sonny';out.wing='我今天狀況沒有調到正式比賽，先說在前面。';out.title=ACTIVITY_PLAY_CONTENT_V55.arm.title;out.body='你和阿福把手放上桌，傑克負責喊開始、喊停。強哥拿著計時器，先聲明助理工程師不負責賽後口頭補充。畫面裡的八秒開始後，這一場由你出力；阿福的但書暫時排隊。';}
  if(x.stage===2&&x.plan!=='unplayed')out.body='你把手收回來，傑克也收起計時器。阿福先檢討椅子高度，再補充剛才那一下可能拉到，最後說自己的狀況不能用這一場代表。比賽已經結束，追加說明還在熱身。';
 }
 if(x.id==='basketball'){
  out.participants=['jack','sonny','owen','jonathan'];
  if(x.stage===0)out.body='傑克在群組貼球場時間，阿福和歐文也來了。大家把阿福在禁區繞來繞去的走位叫「移動迷宮」，歐文每次起跳都被喊「飛天拐子」。傑克先講好別硬碰，有人不舒服就換人。強哥問助理工程師能不能只當候補，傑克說可以，但先暖身。';
  if(x.stage===1){out.title=ACTIVITY_PLAY_CONTENT_V55.basketball.title;out.body='阿福在禁區把路線繞成迷宮，歐文正往籃框飛。傑克在側邊舉手，強哥在場邊聲明助攻不負最終交付責任。五波球輪你決定怎麼打：有人擋路就找空檔，別把每一球都打成硬碰硬。';}
  if(x.stage===2&&x.performance?.injured){out.title='先到場邊，比分不用拿身體換。';out.body='剛才那一下碰撞讓你有點瘀青，傑克已經叫候補上場。阿福開始解釋自己的路線，歐文把手放下來遞水。這回不用再上去證明什麼，最後一波留在場邊決定怎麼收隊。';out.choices=out.choices.map((choice,i)=>({...choice,text:['在場邊喊位置，讓隊友照空檔完成最後一球。','坐著補水，明確說今天不再上場。','把移動迷宮和飛天拐子列入賽後導航更新，請強哥簽收。'][i]}));}
 }
 if(x.stage===1){out.activityPlay={id:x.id,version:1};out.title=ACTIVITY_PLAY_CONTENT_V55[x.id].title;out.choices[1].text='完成這次現場互動，看看接下來怎麼發展。';}
 return out;
}

export function resolveActivityPlayV55(run,input,ticket){
 const x=run.activityContext,id=x?.id;
 if(!getActivityPlayV55(run)||!Number.isFinite(ticket)||ticket<0||ticket>=1)throw new Error('Unavailable activity play');
 const played=deriveActivityPlayV55(input,id),{grade,score,measures}=played;
 let injury=false,injuryTarget=null,risk=0;
 if(id==='basketball'){
  risk=clamp(.025+measures.drives*.025+measures.crowdedDrives*.035+(run.stats.energy<30?.035:0)-(x.plan==='court'?.015:0),.01,.35);
  injury=ticket<risk;
  if(injury){const sonny=[0,3].filter(i=>input.moves[i]===1).length,owen=[1,4].filter(i=>input.moves[i]===1).length;injuryTarget=owen>sonny?'owen':sonny>owen?'sonny':ticket<risk*.5?'sonny':'owen';}
 }
 const draw=id==='basketball'?(ticket-risk)/(1-risk):ticket;
 const success=!injury&&draw<clamp([.22,.50,.77][grade]+(x.score||0)*.018-(x.pressure||0)*.018,.12,.9);
 let gain=grade===2?(success?4:3):grade===1?(success?3:1):(success?1:0),load=grade===2?(success?0:1):grade===1?1:2;
 let label='',result='',delta={},flags=[],plan=x.plan||'';
 if(id==='arm'){
  if(input.taps.length===0){label='你喊停，這場沒有開比';result='八秒跑完，你沒有出力，直接把這場喊停。阿福立刻說自己本來也不是今天要比。傑克收起計時器，提醒沒開比就沒有勝負；紙獎盃倒是已經有人想先領。';plan='unplayed';gain=0;load=2;delta={energy:-1,mood:3,trust:2};flags.push('activity44_arm_unplayed');}
  else{label=success?'你拿下這回對決':'這回平手，條款照走';result=played.summary+(success?' 你把阿福的手壓過中線，傑克一喊停就收手。阿福正要補充今天的狀況，強哥先把結果存檔，說追加但書請開新版本。':' 阿福撐住最後一拍，你照剛才約定收手，不重開加賽。阿福一邊收下平手條款，一邊提醒這不代表正式實力；傑克問那正式實力是不是要先排特休。');delta={energy:-6,mood:success?7:2,trust:3};flags.push(success?'activity44_arm_played':'activity44_arm_draw');}
 }else if(id==='diet'){
  label=grade===2?'七天安排留得下來':grade===1?'計畫有幾格需要鬆一點':'行事曆被會議吃掉';result=played.summary+(grade===2?' 安妮余看到點心和休息也有位置，說這張表終於不像加班表。紅茶把別人的體重欄劃掉：照自己做得到的安排就好。':grade===1?' 臨時工作還是擠進了幾格，紅茶請你先保留正常吃飯，不用拿沒做到的一天抵銷整週。安妮余把蛋塔放回自己的盤子，沒有替它寫檢討。':' 行事曆裡好幾天只剩咖啡，主辦看完請你把吃飯時間還給自己。這場比賽沒有要求靠餓肚子獲勝，你可以在結算時留下真正做得到的習慣。');delta={energy:grade===2?6:grade===1?3:1,mood:grade===2?7:2,trust:2};
 }else if(id==='roadshow'){
  label=success?'訪客找到能回答的人':'分流完成，問題還要補';result=played.summary+(success?' 真真終於不用把所有人塞給同一位助理工程師。翅膀想把路過人潮也報成商機，你指著最後一欄：先問人家同不同意聯絡。':' 有人站錯展位，強哥差點又以助理工程師身分退出聊天室。你把問題重新交到負責人手上，先列待確認，沒有現場憑空承諾。');delta={energy:-5,skill:2,trust:success?5:2,mood:success?5:-2};
 }else if(id==='dinner'){
  label=grade===2?'共享菜真的有大家的份':measures.cost>12?'預算先吃完，菜還在等':'這桌菜色還能調一調';result=played.summary+(grade===2?' 飯、青菜和比目魚都轉到桌上，歐文終於吃到不是裝飾的那一份。屎潘蛇確認沒有超支，把下次再吃更好的那句收回半句。':measures.cost>12?' 屎潘蛇把菜單按住，說超出的先別送單。歐文指著還沒上桌的比目魚，船長拿白飯補位；沒有把公司超支偷偷扣進你的存款。':measures.variety===1&&input.plates.includes(0)?' 白飯一盤接一盤，歐文問比目魚是不是遠端出席。船長先確認大家有沒有吃飽，再請你把下一輪菜色排得豐富一點。':measures.fed<4?' 空盤轉得很勤，飯菜的存在感卻不太夠。船長請大家先分現有的菜，歐文把玩具鵝往旁邊挪：牠看起來也不能吃。':' 菜有上桌，搭配卻有點偏。船長請大家先分好現有的份量，歐文看著菜單提醒，下次不用讓同一道菜連續上班。');delta={energy:grade===2?7:3,mood:grade===2?8:1,trust:grade===2?5:2};
 }else if(id==='banquet'){
  label=success?'副歌沒被願景搶走':'節拍歪了，兩人還是繼續搶';result=played.summary+(success?' 傑克和水蛇跟著拍點唱進副歌，瑞克想把掌聲轉給翅膀，手舉起來才發現全桌都在看麥克風。這段加演終於沒有插播上市簡報。':' 傑克比你快半拍，水蛇又把自己的副歌搶回來。瑞克以為終於能接願景簡報，卻被全桌的拍手聲蓋過；尾牙沒有因為沒對上拍就變成績效會議。');delta={energy:-3,mood:success?9:3,trust:3};
 }else if(id==='basketball'){
  label=injury?'這波碰撞，先下場休息':success?'五波配合打出空檔':'球沒全進，配合留得下來';
  result=injury?(injuryTarget==='sonny'?`${measures.drives?'你切進阿福的「移動迷宮」':'你換位時碰上阿福的「移動迷宮」'}，腳步擠在同一路線上，一下碰撞留下點瘀青。阿福從站位講到地板，理由比球還會轉；傑克先叫停，把你換到板凳補水。`:`${measures.drives?'你和歐文同時衝向禁區':'你傳完球正要換位'}，「飛天拐子」落下時擦撞到你，留下一點瘀青。歐文收手道歉、遞水，傑克直接叫候補上場，沒有把這次碰撞演成誰比較有鬥志。`):(success?'你看準阿福堵住的路線，讓球先離開迷宮；歐文飛起來時，你已把球傳到另一側。傑克接到空檔球，強哥終於肯認領這次助攻。':'你們幾波傳得不錯，也有球沒投進。阿福繞到一半忘記自己守誰，歐文起跳後才發現球已傳走；傑克叫大家換人喝水，失誤不用帶回明天的工單。');
  delta={energy:injury?-18:-6,mood:injury?-6:success?8:2,trust:3};if(injury){load+=3;flags.push('activity55_basketball_bruise',`activity55_basketball_${injuryTarget}_collision`);}flags.push('activity55_basketball_played');
 }else{
  label=success?'問題與佐證對上了':'先把缺件列清楚';result=played.summary+(success?' 委員照頁碼找到能核對的內容，水蛇終於不用靠眼神替附件補字。正式審查結果仍待通知，這一輪至少知道每個承諾要找哪份資料。':' 有份附件對不上問題，委員請你先列缺件。你沒有拿願景補成證據，水蛇記下責任人與補件期限；這次不是現場宣布過關，也不用假裝每一頁都存在。');delta={energy:-5,skill:2,trust:success?5:2,mood:success?5:-2};
 }
 return {result,label,delta,flags,score:clamp((x.score||0)+gain,0,12),pressure:clamp((x.pressure||0)+load,0,12),plan,done:false,choiceText:played.summary,performance:{version:1,grade,score,summary:played.summary,measures,injured:injury,injuryTarget}};
}
