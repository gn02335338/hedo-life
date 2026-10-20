import { VIDEO_EVENTS } from './events-video.js';
import { WILD_EXPANDED } from './wild-expanded.js';
import { getBanquet } from './banquet.js';
import { displayText } from './persona.js';

// Presentation corrections for two recollections. The original choice indices,
// random draws, speaker, deltas and replay history remain the engine's evidence.
// These are original game lines, not private transcripts or verbatim quotes.
const ARM={
 title:'十秒還沒開始，理由已經加賽。',
 body:'傑克邀阿福上桌比腕力。阿福一下說這裡抽筋，一下說那裡拉到，又說肚子太飽、吃不下披薩；大家看著他拿走第三片，決定先不追究披薩的單位。傑克把條件讓到只比十秒、沒分出勝負就算阿福贏，而且不錄影。阿福終於把手伸出來，嘴上還在替尚未發生的比賽補但書。',
 wing:'先說喔，十秒沒分勝負算我贏，不能錄影。我不是不比，是剛才有點拉到。',
 choices:[
  {text:'幫傑克計十秒，手機收起來，請阿福現在決定。',result:'你照約計時，手機留在口袋。傑克在十秒內贏了，阿福先說剛才抽筋，又問十秒究竟從哪一秒開始算，最後改口：「你們把我的手弄傷了啦。」你把約好的條件和結束時間記下來；比賽已經停了，理由還在延長賽。'},
  {text:'拿披薩盒開「理由伯記者會」，每片餅皮插一支紙麥克風。',result:'你坐在旁邊吃披薩，看著傑克在十秒內贏了，再替阿福安排賽後訪問。他依序發布抽筋、拉到、吃太飽三份聲明，再把第三片披薩更正為補充能量。有人提到剛才的輸贏，他立刻補充：「我沒有輸，是抽筋，手還被你們弄傷。」你那片餅皮還沒吃完，他的聲明已經修到第四版。'},
  {text:'先收桌，頒給阿福「尚未出賽世界冠軍」。',result:'你提議這場先不比，把披薩盒折成一座冠軍獎盃。阿福收下，要求加註自己不是不敢比，只是今天狀況不好，前幾場也只是抽筋，不能算輸。傑克收好計時器，讓大家先休息；人還沒上桌，阿福的勝利聲明已經講到第四點。'}
 ]
};
const SONG={
 body:'抽獎箱放在門口，同事還在猜老闆乾兒子今晚穿紅還是白，歌單已經先開戰。水蛇排了 First Love，傑克一聽歌名就往麥克風靠，兩人隔著桌子喊話，誰都不像準備把這首讓出去。老闆乾兒子忙著替翅膀試音，翅膀則想先補充 NASDAQ 進度。菜剛上，搶歌決鬥和上市說明會已經撞在同一段前奏。',
 wing:'他們兩個都說要唱 First Love。你們先別把麥拿走，翅膀等一下還要講話。',
 text:'替傑克和水蛇掛上「First Love 決鬥」擂台牌，準備搶麥計分。',
 label:'First Love 搶麥決鬥',
 outcomes:[
  {label:'傑克搶麥成功',result:'前奏一響，傑克先把 First Love 唱進麥克風。水蛇拿著另一支麥追問：「那是我點的，你怎麼先唱？」傑克沒把主場讓回去，你到台前替兩人舉牌計分，全桌笑著起鬨。這場決鬥的戰績，最後記成傑克搶走水蛇的歌；你的工作是記分，不是代打主唱。'},
  {label:'搶麥戰被願景加時',result:'傑克先搶到 First Love 的開場，水蛇正準備把麥搶回來，翅膀就拿起第三支麥，說要先補充兩句上市規劃。兩位選手只好各握一支麥等他講完。你在台前替擂台牌加上「願景暫停中」，原本十幾秒的前奏，硬是等成一場法說會；搶歌的人還是傑克，拖台錢的另有其人。'}
 ]
};

export function displayChronicleEvent(event){
 if(!event||!Array.isArray(event.choices))return event;
 if(event.id==='video-pizza-overtime')return {...event,title:ARM.title,body:ARM.body,wing:ARM.wing,choices:event.choices.map((choice,index)=>ARM.choices[index]?{...choice,...ARM.choices[index]}:choice)};
 if(event.id!=='banquet-welcome')return event;
 return {...event,body:SONG.body,wing:SONG.wing,choices:event.choices.map((choice,index)=>index===1?{
  ...choice,text:SONG.text,...(choice.draw?{draw:{...choice.draw,label:SONG.label,outcomes:choice.draw.outcomes.map((outcome,i)=>SONG.outcomes[i]?{...outcome,...SONG.outcomes[i]}:outcome)}}:{})
 }:choice)};
}

function replaceResolvedPrefix(value,original,replacement){
 if(typeof value!=='string'||typeof original!=='string')return value;
 const text=displayText(value),prefix=displayText(original);
 // Preserve the actual appended RNG, resource and employment notes. Unknown
 // historical wording stays intact rather than inventing an outcome.
 return text.startsWith(prefix)?replacement+text.slice(prefix.length):value;
}

export function displayChronicleHistory(history){
 if(!history||!Number.isInteger(history.choiceIndex)||history.choiceIndex<0)return history;
 if(history.eventId==='video-pizza-overtime'){
  const patch=ARM.choices[history.choiceIndex];if(!patch)return history;
  const source=VIDEO_EVENTS.find(event=>event.id===history.eventId),base=source.choices[history.choiceIndex];
  const wild=WILD_EXPANDED[history.eventId],originals=[base.result,...(wild?.index===history.choiceIndex?[wild.result]:[])];
  let result=history.result;
  for(const original of originals){const replaced=replaceResolvedPrefix(history.result,original,patch.result);if(replaced!==history.result){result=replaced;break;}}
  return {...history,title:ARM.title,body:ARM.body,wing:ARM.wing,choiceText:patch.text,result};
 }
 if(history.eventId!=='banquet-welcome')return history;
 const next={...history,body:SONG.body,wing:SONG.wing};
 if(history.choiceIndex!==1)return next;
 const original=getBanquet({eventId:'banquet-welcome'}).choices[1].draw;
 const index=original.outcomes.findIndex(outcome=>outcome.label===history.eventOutcome?.result);
 // A history already formatted by this presenter is safe to render again.
 const shown=SONG.outcomes.findIndex(outcome=>outcome.label===history.eventOutcome?.result);
 const selected=index>=0?index:shown;
 if(selected<0)return next;
 const outcome=SONG.outcomes[selected],old=original.outcomes[selected];
 next.choiceText=SONG.text;
 next.result=replaceResolvedPrefix(history.result,old.result,outcome.result);
 next.eventOutcome={...history.eventOutcome,label:SONG.label,result:outcome.label};
 if(Array.isArray(history.breakdown))next.breakdown=history.breakdown.map(part=>part.source==='choice'&&part.label===`${original.label}：${old.label}`?{...part,label:`${SONG.label}：${outcome.label}`}:part);
 return next;
}
