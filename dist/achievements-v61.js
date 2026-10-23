// Food stories are observed only after a real choice resolves. The shared
// story validator owns the r61 gate and the exact structured outcome contract.
import {isOfficeTreatOutcomeV61} from './office-treats-v61.js';

const badge=(id,title,description,group)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`});
export const ACHIEVEMENTS_V61=Object.freeze([
 badge('treat-jack-drink','傑克有請，這次真的有杯。','接受傑克請客，選好飲料，最後真的收到了。謝謝可以只當謝謝，這杯沒有順便變成一份新工作。','office'),
 badge('treat-jack-decline','免費的，我也可以說不要。','面對傑克的請客邀約，明確選擇今天不喝。免費是他的心意，要不要喝仍然可以自己決定。','office'),
 badge('treat-jonathan-toppings','這杯的料，比職責還滿。','點單時見識強哥的昂貴滿料杯。配料一項沒少，助理工程師的責任範圍倒是照舊；這杯點的是他的規格。','office'),
 badge('tea-star-and-half','福利有預算，評分先打折。','參與公司下午茶，確認船長選的一點五星店家與訂單。預算有照流程走，星星卻像先請了半天假。','office'),
 badge('tea-name-check','杯名先核對，罪名先別寫。','在拿錯杯的混亂裡，先核對杯名與訂單。你確認能確認的標籤，沒替自己沒看見的拿杯動作指定主角。','craft'),
 badge('tea-no-scapegoat','福利取消，鍋先別亂分。','翅膀因拿錯杯取消往後的下午茶，你留下已知經過，不指認沒看見的拿杯者。福利被收走，鍋沒有順手塞給一個人。','office'),
 badge('cake-jack-relief','高級蛋糕，物理系必修。','三人合照切完象徵的一刀，傑克留下來獨切到手痛。你幫忙解圍，照安全安排退冰分切，不讓他繼續跟冰塊拚腕力。','banquet'),
 badge('cake-goose-chair','代理主持，耐寒第一。','派玩具鵝代理主持生日場合，並照安排收尾。真人先讓蛋糕退冰；鵝沒有手，反而沒人再叫傑克切快一點。','banquet'),
 badge('cake-let-it-thaw','今年的生日，先等它退冰。','明確選擇等蛋糕退冰，並走完生日會收尾。合照已經拍完，切不開的蛋糕不用再靠傑克的手證明它有多高級。','banquet')
]);

const committed=row=>Boolean(row&&Number.isInteger(row.turn)&&row.turn>=0&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&typeof row.choiceText==='string'&&row.choiceText.trim()&&typeof row.result==='string'&&row.result.trim()&&Array.isArray(row.breakdown));
function factsFrom(run){
 const actions=run.actions.filter(action=>action?.type==='choice'&&/^treats61-/.test(action.eventId||'')),facts=[];let cursor=0;
 for(const [index,row]of run.history.entries()){
  if(row?.kind==='event-departure'||!/^treats61-/.test(row?.eventId||''))continue;
  const action=actions[cursor++];
  if(!committed(row)||!isOfficeTreatOutcomeV61(run,row)||!action||Object.keys(action).sort().join(',')!=='eventId,index,type'||action.eventId!==row.eventId||action.index!==row.choiceIndex)continue;
  facts.push({row,index,outcome:row.treatsOutcome});
 }
 return facts;
}

export function deriveAchievementsV61(run){
 if(!run||typeof run!=='object'||!Array.isArray(run.actions)||!Array.isArray(run.history))return [];
 const facts=factsFrom(run),earned=new Set(),add=(id,condition)=>{if(condition)earned.add(id);};
 const stage=(id,n)=>facts.filter(item=>item.outcome.id===id&&item.outcome.stage===n);
 const after=(earlier,later)=>earlier&&later.index>earlier.index&&later.row.turn===earlier.row.turn;
 const drinks=stage('jack-drinks',0),invited=drinks.find(item=>[0,2].includes(item.row.choiceIndex)&&item.outcome.accepted===true);
 const ordered=invited&&stage('jack-drinks',1).find(item=>after(invited,item)&&[0,1,3].includes(item.row.choiceIndex));
 add('treat-jack-drink',ordered&&stage('jack-drinks',2).some(item=>after(ordered,item)&&item.outcome.done===true));
 add('treat-jack-decline',drinks.some(item=>item.row.choiceIndex===1&&item.outcome.accepted===false&&item.outcome.done===true)||invited&&stage('jack-drinks',1).some(item=>after(invited,item)&&item.row.choiceIndex===2));
 add('treat-jonathan-toppings',invited&&stage('jack-drinks',1).some(item=>after(invited,item)));

 const tea=stage('company-tea',0).find(item=>item.outcome.accepted===true),cups=tea&&stage('company-tea',1).find(item=>after(tea,item));
 add('tea-star-and-half',tea);
 add('tea-name-check',tea&&stage('company-tea',1).some(item=>after(tea,item)&&item.row.choiceIndex===0));
 add('tea-no-scapegoat',cups&&stage('company-tea',2).some(item=>after(cups,item)&&item.row.choiceIndex===0&&item.outcome.done===true));

 for(const [index,id]of [[0,'cake-jack-relief'],[1,'cake-let-it-thaw'],[2,'cake-goose-chair']]){
  const started=stage('birthday-cake',0).find(item=>item.outcome.accepted===true),plan=started&&stage('birthday-cake',1).find(item=>after(started,item)&&item.row.choiceIndex===index);
  add(id,plan&&stage('birthday-cake',2).some(item=>after(plan,item)&&item.outcome.done===true&&item.outcome.result===`cake-shared-${['help','wait','goose'][index]}`));
 }
 return ACHIEVEMENTS_V61.filter(item=>earned.has(item.id)).map(item=>item.id);
}
