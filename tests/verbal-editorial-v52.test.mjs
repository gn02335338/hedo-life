import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../dist/events.js';
import {verbalEditorialLineV52,VERBAL_EDITORIAL_SCENE_IDS_V52} from '../dist/verbal-editorial-v52.js';

const byId=new Map(EVENTS.map(event=>[event.id,event]));
const line=(id,phase='event',target)=>verbalEditorialLineV52({event:byId.get(id),target,phase});
const coarse=/幹[，。！？]|他媽|靠北|媽的|狗屁/;

test('consultant replies distinguish all thirty existing academic, administrative and accounting scenes',()=>{
 const professorEvents=EVENTS.filter(event=>event.id.startsWith('professor37-'));
 assert.equal(professorEvents.length,30);
 const utterances=new Set();
 for(const event of professorEvents)for(const phase of ['event','result']){
  const text=line(event.id,phase);
  assert.ok(text,event.id);assert.match(text,/林老師/);assert.match(text,coarse);
  assert.doesNotMatch(text,/林澤教授|白板上的問號|明天交的台大畢業證書/,event.id);
  assert.ok(!utterances.has(text),`${event.id}: recycled consultant reply`);utterances.add(text);
 }
 assert.match(line('professor37-guest-network-window'),/訪客帳號|登入/);
 assert.match(line('professor37-industry-accounting-docs'),/材料|顧問|活動|憑證/);
 assert.match(line('professor37-visit-room-reservation'),/會議室|預約/);
 assert.match(line('professor37-semester-exchange-rate'),/三年半|四年|半年/);
});

test('meal and spectator scenes discuss the visible problem rather than a work-delivery template',()=>{
 const checks=[
  ['dinner-budget',/肉片|加點|預算|點多少|吃不飽/],
  ['spencer-menu-freedom',/生魚片|套餐|統一配給/],
  ['quiz26-sam-aftermeal',/離職|考核|績效/],
  ['quiz26-banquet-cup',/拍|杯子|起鬨/],
  ['quiz26-drink-seal',/杯子|飲料|杯酒/],
  ['quiz26-breakfast-replay',/早餐|蛋餅/],
  ['q26-sake-cup',/容量|酒|飲料杯/],
  ['sonny-announcement-withdrawn',/耳機|注意力|消息|欲言又止/],
  ['sonny-lunch-perfume',/蛋餅|早餐店|奶茶|油煙|午餐|煎台/],
  ['cast35-meimei-first-love-enlist',/First Love|前奏|麥克風/],
  ['video-rick-commentary',/腕力|戰報|出力|場邊/]
 ];
 for(const [id,topic]of checks)for(const phase of ['event','result']){
  const text=line(id,phase);assert.match(text,topic,id);assert.match(text,coarse,id);
  assert.doesNotMatch(text,/要我負責哪一段|做到哪裡算完|工作條件來談|沒讀懂空氣/,id);
 }
});

test('misleading incidental words do not turn technical reviews, CRM, onboarding or training into dinners',()=>{
 const checks=[
  ['cast39-princess-robot-review',/評審|進度|驗收|機器人/],
  ['cast39-joyce-crm-title',/CRM|聯絡人|管線|商機/],
  ['cast39-janet-cindy-vacancy',/權限|工時|分身|追蹤|部門/],
  ['cast39-captain-desk-boat',/新人|報到|設備|帳號/],
  ['cast39-captain-chair-count',/實作|椅子|訓練|操作/],
  ['cast35-jonathan-half-year-scope',/半年|一年|兩週|拆項/]
 ];
 for(const [id,topic]of checks)for(const phase of ['event','result']){
  const text=line(id,phase);assert.match(text,topic,id);
  assert.doesNotMatch(text,/每個人的胃|誰真的答應|請假要哪張單|感覺不對|沒有想法|設計師替你/,id);
 }
});

test('a helpful speaker is addressed through the visible disagreement, without reversing their own warning',()=>{
 for(const id of ['cast35-helen-meal-cutoff','cast35-helen-banquet-absence','quiz26-drink-seal','professor37-name-card-experiment','professor37-visit-room-reservation']){
  assert.match(line(id),/既然|也說|你也|就別|先叫/,id);
 }
 assert.match(line('cast35-helen-banquet-absence'),/你人不在/);
 assert.doesNotMatch(line('cast35-helen-banquet-absence'),/你又派|妳又派|你要求|妳要求/);
});

test('authored replies belong only to their main visible speaker and never assume another target caused the problem',()=>{
 assert.equal(VERBAL_EDITORIAL_SCENE_IDS_V52.length,55);
 for(const id of VERBAL_EDITORIAL_SCENE_IDS_V52){
  const event=byId.get(id);assert.ok(event,id);
  const speaker=event.speaker||'wing';
  for(const phase of ['event','result']){
   const text=verbalEditorialLineV52({event,target:speaker,phase});
   assert.ok(text.length>35&&text.length<260,`${id}: unreasonable line length`);
   assert.match(text,coarse,id);assert.doesNotMatch(text,/undefined|NaN|https?:\/\//,id);
   assert.equal(verbalEditorialLineV52({event:{...event,speaker:'someone-else'},target:speaker,phase}),null,id);
   assert.equal(verbalEditorialLineV52({event,target:speaker==='self'?'wing':'self',phase}),null,id);
  }
  assert.notEqual(line(id),line(id,'result'),id);
 }
 assert.equal(verbalEditorialLineV52(),null);
 assert.equal(verbalEditorialLineV52({event:{id:'unrelated-event',speaker:'professor'}}),null);
});

test('dialogue reads no future choice, check, draw, state, affinity or outcome',()=>{
 const noRunReads=new Proxy({}, {get(){throw new Error('run or future state was read');}});
 for(const id of VERBAL_EDITORIAL_SCENE_IDS_V52){
  const source=byId.get(id),visible={id:source.id,speaker:source.speaker};
  for(const key of ['choices','draw','result','outcome','check','delta'])Object.defineProperty(visible,key,{get(){throw new Error(`future ${key} was read`);}});
  for(const phase of ['event','result']){
   assert.equal(verbalEditorialLineV52({event:visible,run:noRunReads,phase}),line(id,phase),`${id}/${phase}`);
  }
 }
});
