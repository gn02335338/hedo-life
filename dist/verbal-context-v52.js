import {getEvent,getVerbalLine,getVerbalTargets,applyChoice,replayRun} from './engine.js';
import {PERSONAS,publishedDisplayText} from './persona.js';
import {verbalSceneLine} from './verbal-scene-copy.js';
import {hasAuthoredVerbalV52} from './verbal-authored-v52.js';
import {verbalEditorialLineV52} from './verbal-editorial-v52.js';
import {displayArmVerbalLineV51} from './arm-verbal-copy-v51.js';
import {recruitmentVerbalLineV60} from './recruitment-v60.js';

// Presentation never changes the published random stream or action protocol.
// Authored speech takes priority. A fallback answers the visible quote, not a
// domain guessed from a passing word or a metaphor in the scene's body.
const coarse=/幹[，。！？]|他媽|靠北|媽的|狗屁/;
const strong=line=>coarse.test(line)?line:`幹，${line}`;
const clean=(value,max=90)=>publishedDisplayText(String(value??'')).replace(/[\r\n\t]/g,' ').replace(/[「」『』“”]/g,'').trim().replace(/[。！？!?]+$/u,'').slice(0,max);
const hash=value=>{let n=2166136261;for(const char of value)n=Math.imul(n^char.codePointAt(0),16777619)>>>0;return n;};
const visible=event=>({id:event?.id||'',title:event?.title||'眼前這件事',body:event?.body||'',wing:event?.wing||'',speaker:event?.speaker||'self'});

function anchoredLine(event,target,phase){
 const title=clean(event.title,80)||'眼前這件事',who=PERSONAS[target]?.name||'你';
 const quote=target===event.speaker?clean(event.wing):'';
 const index=hash(`${event.id}:${target}:${phase}`)%3;
 if(target==='self'){
  const thought=quote?`我都已經在想「${quote}」了，`:'';
  return phase==='result'
   ?[
    `幹，「${title}」剛才那段已經夠了。${thought}這口氣我現在就講出來，不用再替每個人把場面圓得漂漂亮亮。`,
    `靠北，剛才的「${title}」我已經回了。${thought}接下來至少讓我照自己的意思選，別連不爽都得先演得很有禮貌。`,
    `幹，剛才我就在「${title}」這裡。${thought}我沒有義務把每一個尷尬停頓都替大家補成掌聲。`
   ][index]
   :[
    `幹，眼前這場「${title}」到底還要演多久？${thought}還得裝作什麼都很正常，這也太他媽累了。`,
    `靠北，「${title}」能弄成這樣。${thought}今天這口氣我不吞了，別又指望我笑一下就把整場圓過去。`,
    `幹，現在碰上的就是「${title}」。${thought}我不想再替這場面找漂亮說法，有什麼不爽今天就直接講。`
   ][index];
 }
 if(quote)return phase==='result'
  ?[
   `${who}，幹，剛才你那句「${quote}」，我已經回了。眼前談的是「${title}」，有話就把這一段講完，別又讓我自己猜後半句。`,
   `${who}，靠北，剛才的「${title}」還沒離開現場。你說「${quote}」，這句到底要我怎麼接，現在當面講，別讓它散場又長一個版本。`,
   `${who}，幹，我剛才聽到的就是「${quote}」。這段「${title}」要補什麼現在補，別只留一個口氣，叫別人替你想成完整意思。`
  ][index]
  :[
   `${who}，幹，「${quote}」這句你自己再聽一次。眼前是「${title}」，有什麼意思就講完整，別丟半句話叫我自己猜。`,
   `${who}，靠北，你說「${quote}」，我就得照單全收？現在談「${title}」，先把這句話說清楚，別拿一個口氣當成已經講完。`,
   `${who}，幹，今天是「${title}」，不是猜你在想什麼的比賽。「${quote}」到底要表達哪一件事，你自己講完。`
  ][index];
 return phase==='result'
  ?`${who}，幹，剛才「${title}」那段我已經回了。你也在現場，要補什麼現在講，別等人散了才多一個本來不是這個意思。`
  :`${who}，幹，眼前這場「${title}」你也在。有話就當場講清楚，別只剩旁邊的人在接，回頭又人人都有另一套說法。`;
}

export function displayContextVerbalLineV52(line,{event,target,run,phase='event'}={}){
 if(typeof line!=='string'||!line||!event?.id||!['event','result'].includes(phase)||!(target==='self'||Object.hasOwn(PERSONAS,target)))return line;
 const recruitment=recruitmentVerbalLineV60(run,event,target,phase);
 if(recruitment)return recruitment;
 const source=visible(event);
 if(source.id==='video-referee-committee'&&target==='self')return displayArmVerbalLineV51(line,{eventId:source.id,target,phase});
 const editorial=verbalEditorialLineV52({event:source,target,run,phase});
 if(editorial)return strong(editorial);
 if(hasAuthoredVerbalV52(source,target)){
  const authored=verbalSceneLine({event:source,target,run,phase});
  if(authored)return strong(authored);
 }
 return anchoredLine(source,target,phase);
}

// Resolve only the requested speech. Exact prefix keys allow immutable later
// run objects to reuse a small visible snapshot without keeping full histories.
const cache=new WeakMap(),prefixCache=new Map(),PREFIX_CACHE_LIMIT=64;
const rememberPrefix=(key,value)=>{
 prefixCache.delete(key);prefixCache.set(key,value);
 if(prefixCache.size>PREFIX_CACHE_LIMIT)prefixCache.delete(prefixCache.keys().next().value);
 return value;
};
const stateForCopy=run=>({seed:run.seed,roleId:run.roleId,actualRoleId:run.actualRoleId,assignment:run.assignment,
 salaryAdvice:run.salaryAdvice?{...run.salaryAdvice}:null,raiseContext:run.raiseContext?{...run.raiseContext}:null});
const matchesRow=(context,row)=>!!context&&context.rowIndex>=0&&context.original===row?.choiceText&&row.eventId===context.event.id&&row.speaker===context.target&&row.verbalOutcome?.version===2&&row.verbalOutcome.origin===context.event.id&&row.verbalOutcome.phase===context.phase&&row.verbalOutcome.target===context.target;
function speechContext(run,rowIndex){
 if(!run||typeof run!=='object'||!Array.isArray(run.actions)||!Array.isArray(run.history)||run.actions.length>300)return null;
 let rows=cache.get(run);if(!rows){rows=new Map();cache.set(run,rows);}
 const row=run.history[rowIndex],proof=row?.verbalOutcome;
 if(rows.has(rowIndex)){const found=rows.get(rowIndex);return matchesRow(found,row)?found:null;}
 if(proof?.version!==2)return null;
 for(let index=0;index<run.actions.length;index++){
  const action=run.actions[index];
  if(action?.type!=='verbal'||action.version!==2||action.eventId!==proof.origin||action.phase!==proof.phase||action.target!==undefined&&action.target!==proof.target)continue;
  const key=JSON.stringify([run.roleId,run.seed,run.actions.slice(0,index+1)]);
  let context=prefixCache.get(key);
  if(context)rememberPrefix(key,context);
  else try{
   let before;
   if(action.phase==='result'){
    const previous=run.actions[index-1];if(previous?.type!=='choice')continue;
    const prefix=replayRun(run.roleId,run.seed,run.actions.slice(0,index-1));
    if(getEvent(prefix)?.id!==previous.eventId)continue;
    before=applyChoice(prefix,previous.index);
   }else before=replayRun(run.roleId,run.seed,run.actions.slice(0,index));
   const event=getEvent(before),target=action.target??getVerbalTargets(before)[0]??'self';
   context=rememberPrefix(key,{rowIndex:before.history.length,original:getVerbalLine(before,target),event:visible(event),target,phase:action.phase,run:stateForCopy(before)});
  }catch{continue;}
  if(context.rowIndex!==rowIndex||!matchesRow(context,row))continue;
  rows.set(rowIndex,context);return context;
 }
 rows.set(rowIndex,null);return null;
}

function trimLeadingQuote(text,lines){
 if(typeof text!=='string')return text;
 const prefixes=lines.flatMap(line=>[`你說：「${line}」`,`你說：${line}`,`你對對方說：「${line}」`]);
 let result=text;
 for(;;){const prefix=prefixes.find(value=>result.startsWith(value));if(!prefix)return result;result=result.slice(prefix.length).trimStart();}
}

export function displayContextVerbalHistoryV52(row,{run,rawRow=row}={}){
 if(rawRow?.verbalOutcome?.version!==2||!Array.isArray(run?.history))return row;
 const index=run.history.indexOf(rawRow);if(index<0)return row;
 const context=speechContext(run,index);if(!context)return row;
 const choiceText=displayContextVerbalLineV52(rawRow.choiceText,context);
 const body=trimLeadingQuote(row.body,[rawRow.choiceText,row.choiceText,choiceText]);
 const result=trimLeadingQuote(row.result,[rawRow.choiceText,row.choiceText,choiceText]);
 if(choiceText===row.choiceText&&body===row.body&&result===row.result)return row;
 return {...row,choiceText,body,result};
}
