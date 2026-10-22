import {professorVerbalReactionsV37} from './verbal-professor-v37.js';
import {castVerbalReactionsV39} from './verbal-cast-v39.js';
import {PERSONAS} from './persona.js';
import {careerTitle} from './career-api.js';
import {verbalSceneLine} from './verbal-scene-copy.js';

export const VERBAL_V2_EVENTS=Object.freeze(['verbal-v2-warning','verbal-v2-legal','verbal-v2-legal-result','verbal-v2-decision']);
const kinds=['ignored','relationship','retort','support','personnel','legal'];
const name=target=>target==='self'?'你':PERSONAS[target]?.name||'對方';
const c=(text,result,delta={},effect='verbalV2Resolve',extra={})=>({text,detail:'',result,delta,effect,flags:[],...extra});
const modal=(id,title,body,speaker,choices)=>({id,title,body,speaker,choices,wing:'',kind:'verbal',era:'口舌風波・接著發生的事',sourceIds:['characterFiction']});
export const verbalLineV2=(run,event,target,phase)=>verbalSceneLine({event,target,run,phase});
const safe=(run,delta)=>Object.fromEntries(Object.entries(delta).map(([key,value])=>[key,['mood','energy'].includes(key)&&value<0?Math.max(value,1-run.stats[key]):value]));

function release(run,source){
 const ctx=run.verbalContext,target=ctx.target,self=target==='self',who=name(target),hot=run.stats.mood<=25;
 const weights=self?[45,0,25,30,0,0]:source.id==='onboarding'?[16,19,20,15,24,6]:[20,24,20,18,12,6];
 if(!self){if(hot){weights[0]-=5;weights[4]+=8;weights[5]+=3;}if(run.flags.post_pip_tolerance){weights[4]+=24;weights[0]=Math.max(2,weights[0]-8);}if(target==='wing'&&run.stats.boss<=18){weights[4]+=20;weights[5]+=5;}if(['hope','erich'].includes(target))weights[5]+=5;}
 const reactions={
  ignored:self?'你把這句話罵完整，空氣沒有回嘴。':`${who}看你一眼，當沒聽到，把話題硬往下帶。你剛才省下的忍耐，沒有替待辦省掉半行。`,
  relationship:`${who}笑不出來了。原本能當面喬的事，往後都要你寄信、附圖，再抄兩個人。你那句話只花幾秒，後面的信倒是越寫越長。`,
  retort:self?'你連自己也一起罵了進去。話說完了，工作不會因為這句話自己做好。':`${who}當場反嗆回來，兩個人把聲音拉高，卻沒有誰因此多做一份交付。`,
  support:self?'旁邊有人抬頭看你，你把話收在自己這邊，沒有替任何人指名。':'旁邊有人把剛才的版本翻出來，替你的工作爭點接了一句；對方也記住了是誰先開口。',
  personnel:source.id==='onboarding'?'翅膀把尚未填完的報到資料抽回去：「不用辦了。」你今天的工作當場沒了，這不是你自己提出離職。':`${who}把這句話交給人事窗口，接下來談的已經不只是原本那件事。`,
  legal:`${who}要求把原話留下來，這句話進入正式說明；對方的解讀與你的意思都還沒有被判定。`
 };
 if(target==='professor'&&/^e(?:37|38|39)-/.test(run?.seed||''))Object.assign(reactions,professorVerbalReactionsV37());
 if(/^e39-/.test(run?.seed||''))Object.assign(reactions,castVerbalReactionsV39(target));
 const affinity=self?[0,0,0,0,0,0]:[0,-32,-15,-5,-25,-28],boss=target==='wing';
 const deltas=[{mood:hot?12:7,energy:-1},{mood:3,energy:-2,boss:boss?-15:0},{mood:-10,energy:-4,boss:boss?-12:0},{mood:12,energy:-2},{mood:-10,energy:-3,boss:boss?-24:0},{mood:-9,energy:-3}];
 const outcomes=kinds.map((kind,index)=>({weight:weights[index],label:{ignored:'對方沒有接招',relationship:'關係當場冷掉',retort:'原話反嗆回來',support:'有人補上前情',personnel:'人事接手',legal:'進入正式說明'}[kind],
  result:`你說：「${ctx.line}」${reactions[kind]}${ctx.phase==='event'&&['daily','fantasy'].includes(source.kind)?' 這場討論散了，你回到座位。交辦還沒做完，下一件差事已經在等。':''}`,
  delta:deltas[index],effect:source.id==='onboarding'&&ctx.phase==='event'&&kind==='personnel'?'layoff':kind==='personnel'?'verbalV2Personnel':kind==='legal'?'verbalV2Legal':'verbalV2Resolve',flags:[],verbalKind:kind,affinityDelta:affinity[index]})).filter(item=>item.weight>0);
 return {...source,speaker:target,wing:'',title:'你把這句話說出口，事情接著往下走。',
  body:`你說：「${ctx.line}」這是當場說出口的回應，沒有動手，也不是腦內想像。`,
  kind:ctx.phase==='event'&&['daily','fantasy','onboarding'].includes(source.kind)?source.kind:'verbal',
  choices:[c(ctx.line,'',{},'verbalV2Resolve',{draw:{label:'這句話說出口之後',outcomes}})]};
}
export function getVerbalScenarioV2(run,source){
 const ctx=run.verbalContext;if(ctx?.version!==2)throw new Error('Missing scenario verbal context');
 const who=name(ctx.target);
 if(ctx.stage==='release')return release(run,source);
 if(ctx.stage==='warning')return modal('verbal-v2-warning','這句話被記下，原本的事也得有個收尾。',`${who}找來希望。她把談話紀錄推到你面前：「剛才那個口氣，我們需要了解一下。」原本的工作問題還沒回答，先多了一張以你為主詞的表。`,'hope',[
  c('收下紀錄、附上異議，把這件事往下處理。','你把自己的說法附在後面，沒有替空白結論簽一張全部同意。'),
  c('為失言道歉，但原本的條件仍要明講。','你為說出口的那句道歉，沒有把薪水、職稱或爭議一併交給對方決定。',{mood:2}),
  c('我自己決定離開，請把交接與日期寫清楚。','這一次，你明確提出離開。不是公司替你把離場改寫成自願。',{mood:8},'ragequit')
 ]);
 if(ctx.stage==='legal'){
  const outcomes=['withdrawn','settled','pending'],texts={withdrawn:'對方核對前後文後，撤回這輪要求。話說過了，工作裡的問題沒有因此自動消失。',settled:'雙方把這次能接受的說明寫下來，爭執先停在這一頁，沒有自動賠償或任何人被判定勝訴。',pending:'雙方仍有不同說法，這輪留下待處理紀錄；接下來的安排不代表你接受對方全部主張。'};
  const answer=(text,weights,paid=false)=>c(text,'',{},'verbalV2LegalResult',{available:!paid||(run.stats.cash>12&&run.stats.energy>2),draw:{label:'這次回覆之後',outcomes:outcomes.map((result,index)=>({weight:weights[index],label:{withdrawn:'本輪要求撤回',settled:'說明成文',pending:'仍待處理'}[result],result:texts[result],delta:safe(run,{mood:result==='pending'?-3:4,energy:-1,...(paid?{cash:-12}:{})}),effect:'verbalV2LegalResult',flags:[],verbalLegalResult:result}))}});
  return modal('verbal-v2-legal','原話留下來，現在由你正式回覆。',`${who}要求釐清剛才那句話。這輪有新的回覆選擇，沒有替任何現實程序預告勝負。`,ctx.target,[answer('整理這場對話的前後文，逐句說明。',[45,25,30]),answer('為失言道歉，把不接受的指控分開寫。',[25,50,25]),answer('花12存款，請律師協助正式回覆。',[35,35,30],true)]);
 }
 if(ctx.stage==='legal-result')return modal('verbal-v2-legal-result','這輪說明留下來，接著處理原本的事。',`本輪結果：${{withdrawn:'要求撤回',settled:'說明成文',pending:'仍待處理'}[ctx.legalResult]}。這不是把時鐘倒回剛才，已說的話與已做的決定都不會被收回。`,ctx.target,[c('收好本輪紀錄，繼續接下來的安排。','你把這輪資料收好，沒有把說明當成沒有發生過。')]);
 if(ctx.stage!=='decision')throw new Error('Invalid verbal scenario stage');
 const onboarding=source.id==='onboarding',indices=onboarding?[0,2]:source.choices.map((_,index)=>index),title=onboarding?careerTitle(run):'';
 const decisionBody=onboarding
  ?`翅膀把名片推回來，職稱寫著「${title}」，月薪${run.pay}K。「嘴巴講完了，這份工作你到底要不要做？」錄取通知還在你手上，桌上這份條件仍等你親自決定。`
  :/^salary-|^raise-/.test(source.id)
   ?`${who}等你講完，又把薪資條件放回兩人中間：「所以你現在怎麼決定？」剛才那句沒有讓數字變好看，這次輪到你把要接受、爭取或離開的意思講明白。`
   :/^pip-|^paperwork$|^crisis-boss$|^dismissal-|^labor-|^floor-|^watch-/.test(source.id)
    ?`${who}把文件翻回需要你回覆的那一頁。你剛才的話已經留下紀錄，對方卻還在等工作、評核或離場的答覆。你把紙轉向自己，這次先看清楚每一句到底要你答應什麼。`
    :/^career-|^promotion-|^patronage-/.test(source.id)
     ?`${who}把話拉回任用條件：「那你接下來要怎麼做？」嗆完沒有新名片掉下來，責任與待遇還擺在桌上，等你給一個確定的答覆。`
     :`${who}把話題拉回眼前的安排，等你說接下來怎麼做。你剛才那句已經收不回來，這一次的決定也由你自己講清楚。`;
 return modal('verbal-v2-decision',onboarding?'嗆話說了，新任用條件仍由你決定。':'話已說完，現在把真正的決定講清楚。',
  decisionBody,ctx.target,
  indices.map(index=>({...c(onboarding?(index===0?`我接受${title}、月薪${run.pay}K，完成報到。`:'我不接受這份任用，現在離開。'):`現在明確回覆：${source.choices[index].text}`,'',{},'verbalV2Choose'),available:source.choices[index].available,sourceIndex:index})));
}
