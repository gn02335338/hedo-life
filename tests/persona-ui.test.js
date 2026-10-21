import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS,displayName,displayText,replayText,applyPersonaCopy} from '../dist/persona.js';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {LEGACY_ENDINGS} from '../dist/legacy.js';
import {ACHIEVEMENTS} from '../dist/achievements.js';
import {SOURCES} from '../dist/public-sources.js';
import {getRageV20,rageTargetForV20} from '../dist/rage-v20.js';
import {getRageV16} from '../dist/rage-v16.js';

test('all named game characters have stable IDs, public aliases and original portrait paths',()=>{
 const expected={wing:'翅膀',spencer:'屎潘蛇',erich:'法師',sonny:'阿福',jenjen:'真真',rick:'瑞克',kind:'阿良',hope:'希望',jack:'傑克',meimei:'水蛇',helen:'前女友',sophie:'紅茶',jonathan:'強哥',owen:'歐文',sam:'山姆',cindy:'辛蒂',professor:'林澤教授'};
 assert.deepEqual(Object.fromEntries(Object.keys(PERSONAS).map(id=>[id,displayName(id)])),expected);
 for(const [id,person]of Object.entries(PERSONAS)){
  assert.equal(person.image,`./assets/${id}.png`);
  assert.ok(Object.isFrozen(person));assert.ok(person.title.length>0);
 }
 assert.equal(PERSONAS.rick.name,'瑞克');assert.equal(PERSONAS.rick.title,'老闆乾兒子');
 assert.equal(PERSONAS.jack.title,'研發部經理');
 assert.equal(PERSONAS.meimei.title,'業務經理');
 assert.equal(PERSONAS.meimei.portrait,true);
 assert.equal(displayName('self'),'self');
});

test('the five new character identities use supplied titles and display-only aliases without rewriting replay prose',()=>{
 const expected={sophie:'稽核主管',jonathan:'助理工程師',owen:'商務開發總監',sam:'資深資料探勘工程師',cindy:'資深專案管理師'};
 for(const [id,title]of Object.entries(expected)){assert.equal(PERSONAS[id].title,title);assert.equal(PERSONAS[id].portrait,true);assert.ok(PERSONAS[id].about);}
 assert.match(PERSONAS.sophie.about,/不是綠茶/);assert.match(PERSONAS.sophie.about,/戲稱為夫妻.*沒人能確認/);
 assert.match(PERSONAS.jonathan.about,/台大資工/);assert.match(PERSONAS.jonathan.about,/助理工程師能決定/);
 for(const trait of ['墨鏡','金項鏈','特斯拉','約跑'])assert.ok(PERSONAS.owen.about.includes(trait));
 for(const trait of ['成大學士加碩士','傑克的前主管','Netflix','午睡'])assert.ok(PERSONAS.sam.about.includes(trait));
 assert.match(PERSONAS.cindy.about,/曾經喜愛.*看不順眼/);
 const text='Sophie／蘇菲和Jonathan找Owen，Sam跟Cindy在旁邊。';
 assert.equal(displayText(text),'紅茶／紅茶和強哥找歐文，山姆跟辛蒂在旁邊。');
 assert.equal(replayText(text),text,'new names remain presentation-only for historical proof text');
 const protectedText='Samantha Sampler sam rage_sam ./assets/Sophie.png https://example.test/Jonathan?Sam=Cindy';
 assert.equal(displayText(protectedText),protectedText);
 const event={speaker:'sophie',body:text,choices:[{text:'問Jonathan',result:'Cindy記下來'}]};
 assert.deepEqual(applyPersonaCopy(event),event,'the new public names never rewrite committed engine prose');
});

test('display aliases handle Chinese-adjacent names and existing nicknames without changing identifiers or URLs',()=>{
 assert.equal(displayText('Wing問Rick，Hope跟Erich／JenJen／Sonny在旁邊。Spencer叫Jack跟Kind過來。'),'翅膀問瑞克，希望跟法師／真真／阿福在旁邊。屎潘蛇叫傑克跟阿良過來。');
 assert.equal(displayText('阿良（Kind）、Rick（乾兒子）、Jack（傑克）、林澤教授。'),'阿良、瑞克、傑克、林澤教授。');
 assert.equal(displayText('SPENCER / WING / RICK / HOPE'),'屎潘蛇 / 翅膀 / 瑞克 / 希望');
 const unchanged='kind hopeful Wingman Rickshaw wing rage_wing WingFeature ./assets/Wing.png https://example.test/Wing?Kind=Hope';
 assert.equal(displayText(unchanged),unchanged);
 assert.equal(displayText('空降主管／資深空降主管／禾多人生'),'高階主管／資深高階主管／移動人生');
 assert.equal(displayText('空降事業部經理'),'事業部經理');
 assert.equal(displayText('https://example.test/Wing。Wing回來了'),'https://example.test/Wing。翅膀回來了');
 assert.equal(displayText('美美／Meimei／MeiMei／MEIMEI'),'水蛇／水蛇／水蛇／水蛇');
 const meimeiIdentifiers='meimei rage_meimei ./assets/meimei.png https://example.test/Meimei';
 assert.equal(displayText(meimeiIdentifiers),meimeiIdentifiers);
});

test('Zhen Zhen is a display rename while canonical replay prose and identifiers remain stable',()=>{
 const text='JenJen／JENJEN／Moon Dog正在等你，真真也在。';
 assert.equal(displayText(text),'真真／真真／真真正在等你，真真也在。');
 assert.equal(replayText(text),'Moon Dog／Moon Dog／Moon Dog正在等你，真真也在。');
 assert.equal(displayText(displayText(text)),displayText(text));
 const identifiers='jenjen rage_jenjen ./assets/jenjen.png https://example.test/Moon-Dog?JenJen=MoonDog Moon_Dog Moon Doggy';
 assert.equal(displayText(identifiers),identifiers);
 const event={id:'legacy-exit',speaker:'jenjen',body:'JenJen與Moon Dog都是這份舊紀錄裡的名字。',choices:[{text:'請JenJen說明',result:'Moon Dog拿出交接表',delta:{trust:4}}]};
 const before=JSON.stringify(event),canonical=applyPersonaCopy(event);
 assert.equal(canonical.body,'Moon Dog與Moon Dog都是這份舊紀錄裡的名字。');
 assert.equal(displayText(canonical.body),'真真與真真都是這份舊紀錄裡的名字。');
 assert.equal(canonical.speaker,'jenjen');assert.deepEqual(canonical.choices[0].delta,{trust:4});
 assert.equal(JSON.stringify(event),before);
});

test('Professor Lin and monthly pay render current wording without changing canonical or saved history',()=>{
 const original='林澤教授與林澤來了，顧問教授留下建議。原本遊戲月薪35K，新的月薪28K。';
 const canonical='顧問教授與顧問教授來了，顧問教授留下建議。原本遊戲月薪35K，新的月薪28K。';
 const shown='林澤教授與林澤教授來了，林澤教授留下建議。原本月薪35K，新的月薪28K。';
 assert.equal(replayText(original),canonical,'frozen replay prose retains its published names and salary label');
 assert.equal(displayText(original),shown);
 assert.equal(displayText(canonical),shown,'saved history with the former alias renders the requested name');
 assert.equal(displayText(shown),shown,'displaying the restored name repeatedly does not duplicate 教授');
 const event={id:'advisor-test',speaker:'wing',body:original,choices:[{text:'請顧問教授看薪資單',result:'遊戲月薪28K；林澤教授建議保留紀錄。',delta:{trust:3}}]};
 const before=JSON.stringify(event),next=applyPersonaCopy(event);
 assert.equal(next.body,canonical);
 assert.equal(next.choices[0].text,'請顧問教授看薪資單');
 assert.equal(next.choices[0].result,'遊戲月薪28K；顧問教授建議保留紀錄。');
 assert.equal(displayText(next.choices[0].text),'請林澤教授看薪資單');
 assert.equal(displayText(next.choices[0].result),'月薪28K；林澤教授建議保留紀錄。');
 assert.equal(next.id,event.id);assert.equal(next.speaker,event.speaker);assert.deepEqual(next.choices[0].delta,event.choices[0].delta);
 assert.equal(JSON.stringify(event),before,'current display wording never mutates history or proof inputs');
 const protectedText='advisor-ties advisor_school ./assets/顧問教授.png ../archive/林澤教授-遊戲月薪.json https://example.test/顧問教授?salary=遊戲月薪#林澤';
 assert.equal(displayText(protectedText),protectedText,'source links, relative assets and stable identifiers are preserved');
});

test('Water Snake is a conversational rage target while published character releases stay identical',()=>{
 assert.equal(rageTargetForV20({speaker:'meimei'}),'meimei');
 assert.equal(rageTargetForV20({speaker:'jack'}),'jack');
 assert.equal(rageTargetForV20({id:'paperwork',speaker:'exit-team'}),'jenjen');
 assert.equal(rageTargetForV20({id:'exit',speaker:'exit-team'}),'erich');
 assert.equal(rageTargetForV20({speaker:'self'}),null);
 assert.equal(rageTargetForV20(null),null);
 for(const target of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack']){
  const run={eventId:'rage-release',stats:{mood:50,boss:50},turn:5,rageContext:{target,eventId:'workday',phase:'event'}};
  assert.deepEqual(getRageV20(run),getRageV16(run),target);
 }
 const run={eventId:'rage-release',stats:{mood:50,boss:50},turn:5,rageContext:{target:'meimei',eventId:'workday',phase:'event'}};
 const original=JSON.stringify(run),event=getRageV20(run),outcomes=event.choices[0].draw.outcomes;
 assert.equal(event.speaker,'meimei');assert.equal(event.choices[0].rageTarget,'meimei');
 assert.deepEqual(event.sourceIds,['characterFiction']);
 assert.doesNotMatch(JSON.stringify(event),/美美|漫畫|Meimei/);
 assert.equal(outcomes.reduce((sum,item)=>sum+item.weight,0),100);
 assert.deepEqual(outcomes.map(item=>[item.label,item.effect]),[['腦內劇場','rageReturn'],['真的失控了','rageAftermath']]);
 assert.match(outcomes[0].result,/腦內.*資料夾/);assert.match(outcomes[0].result,/手仍放在膝上/);
 assert.match(outcomes[1].result,/真的發生/);assert.ok(outcomes[1].flags.includes('rage_real'));
 const hot=getRageV20({...run,stats:{...run.stats,mood:10}}).choices[0].draw.outcomes[1].weight;
 const calm=getRageV20({...run,stats:{...run.stats,mood:90}}).choices[0].draw.outcomes[1].weight;
 assert.ok(hot>outcomes[1].weight&&outcomes[1].weight>calm);
 assert.match(getRageV20({...run,rageContext:{...run.rageContext,phase:'result'}}).choices[0].draw.outcomes[0].result,/剛才已經回了話/);
 for(const eventId of ['rage-aftermath','rage-legal','rage-showdown']){
  const after=getRageV20({...run,eventId});
  assert.match(after.body,/水蛇/);assert.doesNotMatch(after.body,/undefined|美美/);
 }
 assert.equal(JSON.stringify(run),original,'rendering the scene consumes no RNG or input state');
});

test('all public collections can be displayed with aliases while original catalog data stays unchanged',()=>{
 const catalogs=[ROLES,ENDINGS,LEGACY_ENDINGS,ACHIEVEMENTS,SOURCES],before=JSON.stringify(catalogs);
 let processed=0;
 function visit(value){
  if(typeof value==='string'){
   const result=displayText(value);processed++;
   assert.equal(displayText(result),result,'display formatting is safe to apply twice');
   if(!/^(?:https?:\/\/|\.\/)/.test(value)&&!/^[-a-z0-9_/]+$/.test(value)){
    assert.doesNotMatch(result,/(?<![A-Za-z0-9_])(?:Wing|WING|Spencer|Rick|Hope|Erich|JenJen|Sonny|Kind|Jack)(?![A-Za-z0-9_])|顧問教授|遊戲月薪|空降主管/);
   }
  }else if(Array.isArray(value))value.forEach(visit);
  else if(value&&typeof value==='object')Object.values(value).forEach(visit);
 }
 catalogs.forEach(visit);
 assert.ok(processed>2000);assert.equal(JSON.stringify(catalogs),before);
 assert.equal(displayText(ROLES.find(role=>role.id==='executive').name),'高階主管');
 assert.equal(SOURCES.officialHome.url,'https://www.avividai.com/');
});

test('searchable unlocked stories and certificate text use the same public names as the story screen',()=>{
 const ending=ENDINGS.find(row=>/Rick/.test(row.body));assert.ok(ending);
 const displayed=displayText([ending.title,ending.body,ending.subtitle].join(' '));
 assert.ok(displayed.includes('瑞克'));assert.ok(!displayed.includes('Rick'));
 assert.equal(displayText('老闆乾兒子'),displayText('Rick'));
 const certificate=displayText('Wing簽收：資深空降主管。');
 assert.equal(certificate,'翅膀簽收：資深高階主管。');
});

function mechanics(event){
 const fields=(value,keys)=>Object.fromEntries(Object.entries(value).map(([key,item])=>[key,keys.includes(key)&&typeof item==='string'?'[prose]':item]));
 const next=fields(event,['title','body','wing']);
 if(Array.isArray(event.choices))next.choices=event.choices.map(choice=>{
  const item=fields(choice,['text','detail','result']);
  if(choice.check){
   item.check={...choice.check};
   for(const key of ['success','failure'])if(choice.check[key])item.check[key]=fields(choice.check[key],['result']);
  }
  if(choice.draw){
   item.draw=fields(choice.draw,['label']);
   if(Array.isArray(choice.draw.outcomes))item.draw.outcomes=choice.draw.outcomes.map(outcome=>fields(outcome,['label','result']));
  }
  return item;
 });
 return next;
}

test('event copy changes only authored prose, with nested outcomes and undefined fields preserved',()=>{
 const availability=()=>true;
 const event={
  id:'Wing-event',speaker:'wing',sourceIds:['Rick','https://example.test/Wing'],
  title:'Wing跟空降主管開會',body:'Rick找林澤教授。https://example.test/Wing',wing:'Hope來了',
  flags:['Spencer'],effect:'Sonny',era:'Wing-era',metadata:{Wing:'Rick'},
  choices:[{
   text:'Erich請你坐下',detail:'JenJen放下表格',result:'Sonny關帳號',available:availability,
   effect:'Hope',flags:['Rick'],delta:{boss:-5},rageTarget:'wing',
   check:{ability:'skill',base:.4,success:{result:'Wing答應',effect:'Rick',flags:['Hope']},failure:{result:'Hope拒絕',delta:{boss:-5}}},
   draw:{label:'Spencer抽籤',outcomes:[{weight:.2,label:'Rick中獎',result:'Kind答應',flags:['Wing'],effect:'Hope'},{weight:.8,result:undefined,flags:['Spencer']}]},
  },{text:'Jack記下來',detail:undefined,result:undefined}],
 };
 const original=JSON.stringify(event),result=applyPersonaCopy(event);
 assert.equal(result.title,'翅膀跟高階主管開會');assert.equal(result.wing,'希望來了');
 assert.equal(result.body,'老闆乾兒子找顧問教授。https://example.test/Wing');
 assert.equal(result.choices[0].text,'法師請你坐下');assert.equal(result.choices[0].detail,'Moon Dog放下表格');
 assert.equal(result.choices[0].result,'阿福關帳號');
 assert.equal(result.choices[0].check.success.result,'翅膀答應');assert.equal(result.choices[0].check.failure.result,'希望拒絕');
 assert.equal(result.choices[0].draw.label,'屎潘蛇抽籤');assert.equal(result.choices[0].draw.outcomes[0].label,'老闆乾兒子中獎');
 assert.equal(result.choices[0].draw.outcomes[0].result,'阿良答應');
 assert.equal(result.choices[1].text,'傑克記下來');
 assert.deepEqual(mechanics(result),mechanics(event));assert.equal(JSON.stringify(event),original);
 assert.equal(result.choices[0].available,availability);
 assert.deepEqual(Object.keys(result),Object.keys(event));
 assert.deepEqual(Object.keys(result.choices[1]),Object.keys(event.choices[1]));
 assert.ok(Object.hasOwn(result.choices[1],'detail'));assert.equal(result.choices[1].detail,undefined);
 assert.ok(Object.hasOwn(result.choices[0].draw.outcomes[1],'result'));
 assert.ok(!Object.hasOwn(result.choices[0].draw.outcomes[1],'label'));
 assert.deepEqual(applyPersonaCopy(result),result);
 assert.equal(applyPersonaCopy(null),null);
});
