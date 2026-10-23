import {isExpansionV65} from './expansion-profile-v65.js';
export const CAMEL_NAMES_V65=Object.freeze(['阿福','強哥','玩具鵝']);
export const CAMEL_RULES_V65=Object.freeze(['三色骰袋每三輪補滿；每輪抽一色、擲一到三點。','該色名牌連同上方整疊前進，碰到同格就疊到頂上。','同格以最上面領先；每輪支持猜對一點，最後排名每對一名再得兩點。','點數只供這場活動使用，不收現金；移動的是桌上名牌，真人不用抬人或承重。']);
const clone=x=>structuredClone(x);
const permutation=x=>Array.isArray(x)&&x.length===3&&Array.from(x).every(Number.isInteger)&&[...x].sort().join(',')==='0,1,2';
export function deriveCamelInputV65(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='kind,move,prediction'||input.kind!=='camel'||!Number.isInteger(input.move)||input.move<0||input.move>2||!permutation(input.prediction))throw new Error('Invalid camel input');
 return {input:clone(input),grade:0,score:0,summary:`你支持${CAMEL_NAMES_V65[input.move]}領先，排名預測已登記。`,measures:{move:input.move,prediction:[...input.prediction]}};
}
export const initialCamelV65=()=>({round:0,board:[{position:0,stack:[0,1,2]}],bag:[0,1,2],prediction:null,points:0});
const current=run=>run.activityContext?.camel||initialCamelV65();
export function getCamelPlayV65(run){
 const c=current(run);if(!isExpansionV65(run)||run.activityContext?.id!=='camel'||run.activityContext.stage!==1||c.round>=6||run.pending||run.completed)return null;
 return {id:'camel',version:1,title:'真人駱駝大賽｜這一輪，你挺誰？',instructions:'先排前三名預測，再選本輪支持的人。按擲骰才揭曉骰色與點數；預測第一次送出後就不能改。',names:[...CAMEL_NAMES_V65],rules:[...CAMEL_RULES_V65],steps:6,round:c.round,board:clone(c.board),prediction:clone(c.prediction),points:c.points};
}
export function resolveCamelPlayV65(run,input,ticket){
 if(!getCamelPlayV65(run)||!Number.isFinite(ticket)||ticket<0||ticket>=1)throw new Error('Unavailable camel play');
 const played=deriveCamelInputV65(input),c=clone(current(run));
 if(c.prediction&&c.prediction.join(',')!==input.prediction.join(','))throw new Error('Camel prediction already locked');
 c.prediction=[...input.prediction];const before=clone(c.board),bag=c.bag.length?[...c.bag]:[0,1,2],value=Math.floor(ticket*4294967296),pick=value%bag.length,color=bag.splice(pick,1)[0],die=1+Math.floor(value/Math.max(1,c.bag.length||3))%3;
 const source=c.board.find(cell=>cell.stack.includes(color)),at=source.stack.indexOf(color),carried=source.stack.splice(at),destination=source.position+die;
 c.board=c.board.filter(cell=>cell.stack.length);let cell=c.board.find(row=>row.position===destination);if(!cell){cell={position:destination,stack:[]};c.board.push(cell);}cell.stack.push(...carried);c.board.sort((a,b)=>a.position-b.position);
 const ranking=[...c.board].sort((a,b)=>b.position-a.position).flatMap(row=>[...row.stack].reverse()),hit=input.move===ranking[0];c.round++;const done=c.round===6,finalHits=done?c.prediction.filter((id,index)=>id===ranking[index]).length:0;c.points+=Number(hit)+finalHits*2;c.bag=bag;
 const camel={version:1,round:c.round,move:input.move,color,die,before,after:clone(c.board),ranking,hit,points:c.points,finalHits,done};
 return {choiceText:played.summary,label:done?'六輪骰完，名牌排定':'這輪名牌已移動',result:`第 ${c.round} 輪抽到${CAMEL_NAMES_V65[color]}，前進 ${die} 格；名牌上方的整疊一起走，沒有真人被抬起來。現在領先的是${CAMEL_NAMES_V65[ranking[0]]}。${hit?'你本輪支持猜對，得到一點。':'你本輪沒猜中，下一輪再選支持。'}${done?` 最後排名：${ranking.map(id=>CAMEL_NAMES_V65[id]).join('、')}；排名預測對 ${finalHits} 名，累積 ${c.points} 活動點。`:' 排名預測仍鎖著，骰袋不會因為多看一次畫面重抽。'}`,delta:done?{mood:3,trust:2}:{},flags:[],score:c.points,pressure:0,plan:run.activityContext.plan||'names',done:false,stayStage:!done,camelState:c,camel,performance:{version:1,grade:played.grade,score:played.score,summary:played.summary,measures:played.measures,injured:false,injuryTarget:null}};
}
export function getCamelSceneV65(run){
 const x=run.activityContext,s=x.stage,c=current(run),base={id:`activity44-camel-${s}`,kind:'activity',speaker:'simon',scope:'private',scene:'meeting',era:'福委會・真人駱駝大賽',sourceIds:['characterFiction'],participants:['simon','sonny','jonathan'],activity:{id:'camel',stage:s,total:3,mechanic:'丁哥開場 → 六輪骰色與疊堆 → 活動點結算',scoreMax:12,pressureMax:12,scoreLabel:'活動點',score:x.score||0,pressureLabel:'追加規則',pressure:x.pressure||0}};
 const choice=text=>({text});
 if(s===0)return {...base,title:'真人駱駝大賽開始｜人坐好，名牌去跑。',body:'丁哥把福委會的桌子清出一條跑道，宣布真人駱駝大賽。阿福先問誰要扛誰，丁哥立刻把三張紙名牌推過來：人只負責報位置，不抬人。強哥說助理工程師不保固駱駝，玩具鵝則被排進第三道。',wing:'今天比的是骰子和猜排名。現金放口袋，腰也不用借別人。',choices:[choice('核對疊堆規則，讓名牌代替真人上場。'),choice('先請阿福把「我本來就知道」寫在賽前聲明。'),{...choice('替玩具鵝掛代理駱駝證，真人坐著指揮。'),wild:true}]};
 if(s===1)return {...base,title:'骰袋裡還有顏色，場上已經有理由。',body:`這是第 ${c.round+1}／6 輪。每次抽一色、擲一到三點，該色和上方整疊一起走。阿福看著自己被帶著跑，先聲明這不代表他有移動；強哥問被疊上去算不算新增職責。`,wing:'先猜誰領先，再開骰袋。猜錯不用掏錢，也不准搬真人。',choices:[choice('這輪不擲了，保留目前位置準備收隊。'),choice('支持一位，擲骰揭曉這一輪。'),{...choice('請玩具鵝宣布提早散場，名牌先下班。'),wild:true}]};
 return {...base,title:'真人駱駝大賽結束｜腰沒借出去，理由已疊三層。',body:`丁哥封好骰袋。${c.round===6?`六輪已結算，你留下 ${c.points} 活動點。`:'你提前停止擲骰，沒有假裝跑完六輪。'}阿福說自己原本預計的名次不是現在這個，強哥提醒名牌不是助理工程師。活動點只留在這張表上，不換現金，也不替工作加一份考績。`,wing:'先把桌上的名牌還我，真人各自拿回自己的包。',choices:[choice('收好活動點紀錄，謝謝丁哥主辦。'),choice('請阿福把賽後但書附在名牌背面，別拿來改排名。'),{...choice('任命玩具鵝為下一屆駱駝理事長，真人解散。'),wild:true}]};
}
export function resolveCamelChoiceV65(run,index){
 const x=run.activityContext;if(!isExpansionV65(run)||![0,1,2].includes(index)||x.id!=='camel')throw new Error('Invalid camel choice');
 if(x.stage===0)return {label:'紙名牌進場',result:['丁哥確認大家看懂規則，三張名牌在起點疊好。真人留在椅子上，接下來只需要支持、猜排名和擲骰。','阿福先寫「本來就知道」，丁哥把那張紙標成賽前感想。規則照公告，沒有為理由多開一個骰袋。','玩具鵝收下代理證，丁哥替牠把名牌擺好。牠不會喊腰痛，人類也沒有必要示範。'][index],delta:{mood:2,trust:1},flags:[],score:0,pressure:0,plan:['rules','statement','goose'][index],done:false};
 if(x.stage===1)return {label:'提早停止擲骰',result:'你說這輪先到這裡，丁哥封好骰袋，保留已發生的位置與點數。這次沒有湊滿六輪，未完成的名次不會補抽。',delta:{},flags:[],score:x.score||0,pressure:0,plan:x.plan||'names',done:false};
 return {label:'真人駱駝大賽已收隊',result:['你把名牌和點數表交回丁哥。熱鬧留在桌上，沒有多一筆個人帳單，這場到此結束。','阿福把三份理由貼到名牌背面，丁哥照原本結算表收隊。聲明可以留，排名沒有重排。','玩具鵝理事長宣布今日散會。丁哥收好道具，真人各自離席，沒有下一輪加班駱駝。'][index],delta:{mood:3,trust:2},flags:[],score:x.score||0,pressure:0,plan:x.plan||'names',done:true};
}
