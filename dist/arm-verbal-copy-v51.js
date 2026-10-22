// Display corrections only. The original spoken sentence remains part of the
// saved life and server replay; this presenter never changes a game outcome.
const SCENE='video-referee-committee';
const BASE='「裁判人數，超過參賽人數」讓我煩成這樣，卻還在想怎麼講才不會讓公司不高興。我的腦袋到底什麼時候連下班都要替別人值班？';
const ORIGINAL=Object.freeze({
 event:Object.freeze([BASE,'幹，你們每項都說最急，最後出事又裝不認識排程。少開一場廢會，少改一次口，進度早就比你催半天有用。']),
 result:Object.freeze([BASE,`幹，${BASE} 我不是來替這堆爛安排把自己耗乾的。`])
});
const DISPLAY=Object.freeze({
 event:'幹，兩個人比腕力，你們他媽一人喊一套，是比誰的嘴比較硬？先閉嘴留一個裁判，別把一場比賽吵成菜市場。',
 result:'幹，剛才一桌人各喊各的，連開始都能吵三個版本。比的是腕力，不是誰比較會靠北；下次先選一個裁判，別讓每張嘴都來當總指揮。'
});
const REACTIONS=Object.freeze({
 ignored:Object.freeze(['你把這句話罵完整，空氣沒有回嘴。','你朝吵成一團的桌邊罵完，幾個人像沒聽見，繼續各喊各的。']),
 retort:Object.freeze(['你連自己也一起罵了進去。話說完了，工作不會因為這句話自己做好。','你罵完才發現自己也跟著搶話，現在只是多了一個喊得特別大聲的觀眾。']),
 support:Object.freeze(['旁邊有人抬頭看你，你把話收在自己這邊，沒有替任何人指名。','旁邊有人笑著點頭，你沒有點名誰，只把「先留一位裁判」又講了一次。'])
});
const WORK_RETURN=' 這場討論散了，你回到座位。交辦還沒做完，下一件差事已經在等。';
const SHOWN_WORK_RETURN=' 場邊這段起鬨告一段落，你回去處理原本的工作。';
const OUTCOME_LABEL='這句話說出口之後';
const OUTCOME_RESULTS=Object.freeze({
 ignored:Object.freeze(['對方沒有接招','現場照樣各喊各的']),
 retort:Object.freeze(['原話反嗆回來','你也成了場邊總指揮']),
 support:Object.freeze(['有人補上前情','旁邊有人跟著點頭'])
});
const applies=(eventId,target,phase)=>eventId===SCENE&&target==='self'&&Object.hasOwn(DISPLAY,phase);

export function displayArmVerbalLineV51(line,{eventId,target,phase='event'}={}){
 if(!applies(eventId,target,phase)||typeof line!=='string')return line;
 return ORIGINAL[phase].includes(line)||line===DISPLAY[phase]?DISPLAY[phase]:line;
}

export function armVerbalTargetLabelV51(eventId,target){
 return eventId===SCENE&&target==='self'?'對現場開罵':'';
}

// A previously rendered quotation may still lead either field in an older
// saved row. Remove only that exact player quotation, never another speaker's
// words, before changing the independently displayed spoken sentence.
function withoutLeadingSpeech(text,lines){
 if(typeof text!=='string')return text;
 const prefixes=lines.flatMap(line=>[`你說：「${line}」`,`你說：${line}`,`你對對方說：「${line}」`]);
 let shown=text;
 for(;;){
  const prefix=prefixes.find(value=>shown.startsWith(value));
  if(!prefix)return shown;
  shown=shown.slice(prefix.length).trimStart();
 }
}

function displayReaction(text,proof){
 const pair=REACTIONS[proof.kind];
 if(typeof text!=='string'||!pair||!text.startsWith(pair[0]))return text;
 let suffix=text.slice(pair[0].length);
 if(proof.phase==='event'&&suffix.startsWith(WORK_RETURN))suffix=SHOWN_WORK_RETURN+suffix.slice(WORK_RETURN.length);
 return pair[1]+suffix;
}

export function displayArmVerbalHistoryV51(row){
 const proof=row?.verbalOutcome;
 // Version 1 used a generic action label rather than its actual spoken line.
 // Keep that evidence intact instead of inventing a quotation for old lives.
 if(proof?.version!==2||row.eventId!==SCENE||proof.origin!==SCENE||row.speaker!=='self'||!applies(proof.origin,proof.target,proof.phase))return row;
 const choiceText=displayArmVerbalLineV51(row.choiceText,{eventId:proof.origin,target:proof.target,phase:proof.phase});
 if(choiceText===row.choiceText&&row.choiceText!==DISPLAY[proof.phase])return row;
 const lines=[row.choiceText,choiceText],body=withoutLeadingSpeech(row.body,lines),result=displayReaction(withoutLeadingSpeech(row.result,lines),proof);
 let eventOutcome=row.eventOutcome,breakdown=row.breakdown;
 const outcome=OUTCOME_RESULTS[proof.kind];
 if(outcome&&eventOutcome?.label===OUTCOME_LABEL&&eventOutcome.result===outcome[0]){
  eventOutcome={...eventOutcome,result:outcome[1]};
  if(Array.isArray(breakdown)){
   const oldLabel=`${OUTCOME_LABEL}：${outcome[0]}`,newLabel=`${OUTCOME_LABEL}：${outcome[1]}`;
   const changed=breakdown.map(part=>part?.source==='choice'&&part.label===oldLabel?{...part,label:newLabel}:part);
   if(changed.some((part,index)=>part!==breakdown[index]))breakdown=changed;
  }
 }
 if(choiceText===row.choiceText&&body===row.body&&result===row.result&&eventOutcome===row.eventOutcome&&breakdown===row.breakdown)return row;
 const shown={...row,choiceText,body,result};
 if(eventOutcome!==row.eventOutcome)shown.eventOutcome=eventOutcome;
 if(breakdown!==row.breakdown)shown.breakdown=breakdown;
 return shown;
}
