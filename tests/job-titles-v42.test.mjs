import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,getEvent,getVerbalLine,requestVerbal,requestExit,applyChoice,advance,jobTitle,validRun} from '../dist/engine.js';
import {CAREER_LADDERS_V17} from '../dist/career-v17.js';
import {ENDINGS} from '../dist/endings.js';
import {displayPlayerTitleV42,displayPlayerCareerTextV42,displayPlayerEventV42,displayPlayerHistoryV42,displayPlayerVerbalLineV42,displayPlayerEndingV42} from '../dist/job-titles-v42.js';

test('the system career has explicit system titles while AI, MIS, NPC and patronage titles retain their identity',()=>{
 assert.deepEqual(CAREER_LADDERS_V17.system.map(title=>displayPlayerTitleV42(title,'system')),
  ['助理系統工程師','系統工程師','資深系統工程師','主任系統工程師','系統工程副理','系統工程經理','系統工程總監','技術長 CTO']);
 for(const id of ['ai','mis','project','sales',undefined])for(const title of ['助理工程師','工程師','AI工程師','MIS工程師','乾兒子','乾女兒'])assert.equal(displayPlayerTitleV42(title,id),title);
 assert.equal(displayPlayerTitleV42('系統工程師','system'),'系統工程師');
 assert.equal(displayPlayerTitleV42(null,'system'),null);
});

test('the photographed AI-to-system hiring draw renders a consistent title without altering any replay evidence',()=>{
 const run=createRun('ai','e38-title-audit-0'),event=getEvent(run),line=getVerbalLine(run,'wing'),before=JSON.stringify(run),canonicalEvent=JSON.stringify(event);
 assert.equal(run.actualRoleId,'system');assert.equal(jobTitle(run),'工程師');assert.match(line,/報到卻叫我做工程師/);
 const shown=displayPlayerEventV42(event,run),spoken=displayPlayerVerbalLineV42(line,run);
 assert.match(shown.body,/做系統工程師的工作，實際職稱是「系統工程師」/);
 assert.match(spoken,/錄取信寫AI工程師，報到卻叫我做系統工程師/);
 assert.equal(JSON.stringify(event),canonicalEvent);assert.equal(JSON.stringify(run),before);assert.equal(validRun(run),true);
 assert.deepEqual(displayPlayerEventV42(shown,run),shown,'projection is idempotent');
 const spokenRun=requestVerbal(run,undefined,2),row=spokenRun.history.at(-1),canonicalSpeech=JSON.stringify(spokenRun),spokenRow=displayPlayerHistoryV42(row,spokenRun);
 assert.match(spokenRow.choiceText,/報到卻叫我做系統工程師/);
 assert.match(spokenRow.result,/目前實際職稱：系統工程師。/);
 assert.equal(spokenRow.jobTitle,'系統工程師');
 assert.equal(JSON.stringify(spokenRun),canonicalSpeech);assert.equal(validRun(spokenRun),true);
});

test('career, education, salary and hiring follow-up language changes only explicit player title slots',()=>{
 const context={actualRoleId:'system',eventId:'career-review'};
 assert.equal(displayPlayerCareerTextV42('你目前是工程師，這次想談資深工程師。強哥的職稱是助理工程師。',context),'你目前是系統工程師，這次想談資深系統工程師。強哥的職稱是助理工程師。');
 assert.equal(displayPlayerCareerTextV42('你把成果拿出來，談到了工程副理。職稱變更：工程副理。',context),'你把成果拿出來，談到了系統工程副理。職稱變更：系統工程副理。');
 assert.equal(displayPlayerCareerTextV42('職稱變更：工程師 → 資深工程師。月薪 50K → 56K。',context),'職稱變更：系統工程師 → 資深系統工程師。月薪 50K → 56K。');
 assert.equal(displayPlayerCareerTextV42('接下來先以工程師的身分工作。你把管理職交回，留下工程副理的位置。',{...context,eventId:'career-step-down'}),'接下來先以系統工程師的身分工作。你把管理職交回，留下系統工程副理的位置。');
 assert.equal(displayPlayerCareerTextV42('你現在的職稱是工程師，他問的卻不是剛才做了什麼。',{...context,eventId:'education-scrutiny'}),'你現在的職稱是系統工程師，他問的卻不是剛才做了什麼。');
 assert.equal(displayPlayerCareerTextV42('目前月薪是 50K，職稱是工程師。',{...context,eventId:'raise-request'}),'目前月薪是 50K，職稱是系統工程師。');
 assert.equal(displayPlayerCareerTextV42('翅膀把名片推回來，職稱寫著「工程師」，月薪50K。',{...context,eventId:'verbal-v2-decision'}),'翅膀把名片推回來，職稱寫著「系統工程師」，月薪50K。');
 assert.equal(displayPlayerCareerTextV42('我接受工程師、月薪50K，完成報到。',{...context,eventId:'verbal-v2-decision'}),'我接受系統工程師、月薪50K，完成報到。');
 const npc='強哥，助理工程師那面盾先放下。工程師也有下班時間，瑞克不是工程經理。';
 assert.equal(displayPlayerCareerTextV42(npc,context),npc);
 assert.equal(displayPlayerCareerTextV42('強哥的職稱是助理工程師。',{...context,eventId:'jonathan-assistant-shield'}),'強哥的職稱是助理工程師。');
 assert.equal(displayPlayerCareerTextV42('你目前是助理工程師。',{...context,actualRoleId:'ai'}),'你目前是助理工程師。');
});

test('a visible-event projection never opens unrevealed choice outcomes or RNG branches',()=>{
 const forbidden=()=>{throw new Error('future outcome was read');},choice={text:'我接受工程師、月薪50K，完成報到。',available:true};
 for(const name of ['result','check','draw','delta','effect'])Object.defineProperty(choice,name,{get:forbidden,enumerable:true});
 const event={id:'verbal-v2-decision',body:'職稱寫著「工程師」。',choices:[choice]};
 const projected=displayPlayerEventV42(event,{actualRoleId:'system'});
 assert.equal(projected.choices[0].text,'我接受系統工程師、月薪50K，完成報到。');
 assert.equal(Object.getOwnPropertyDescriptor(projected.choices[0],'result').get,forbidden);
 assert.equal(projected.choices[0].available,true);assert.equal(choice.text,'我接受工程師、月薪50K，完成報到。');
});

test('historical title and pre-negotiation prose use their own evidence after the player wins the original role back',()=>{
 let accepted;
 for(let index=0;index<150;index++){
  const source=createRun('ai',`e38-title-restore-${index}`);
  if(source.actualRoleId!=='system')continue;
  const next=applyChoice(source,1);
  if(next.actualRoleId==='ai'){accepted=next;break;}
 }
 assert.ok(accepted);const row=accepted.history.at(-1),before=JSON.stringify(accepted),shown=displayPlayerHistoryV42(row,accepted);
 assert.equal(row.jobTitle,'AI工程師');assert.equal(shown.jobTitle,'AI工程師');
 assert.match(row.body,/實際職稱是「工程師」/);assert.match(shown.body,/實際職稱是「系統工程師」/);
 assert.equal(JSON.stringify(accepted),before);assert.equal(validRun(accepted),true);
 const old={eventId:'career-duty-1',jobTitle:'工程師',body:'你目前是工程師。',choiceText:'留下紀錄。',result:'強哥指著自己的助理工程師名片。'};
 const oldShown=displayPlayerHistoryV42(old,{roleId:'ai',actualRoleId:'ai'});
 assert.equal(oldShown.jobTitle,'系統工程師');assert.equal(oldShown.body,'你目前是系統工程師。');assert.equal(oldShown.result,old.result);
});

test('historical assistant assignments distinguish system support from AI or uncertain legacy records',()=>{
 const row={eventId:'onboarding',jobTitle:'助理工程師',body:'錄取通知上的職務是「專案經理」，報到時卻改以「助理工程師」任用。',choiceText:'先接受。',result:'強哥仍是助理工程師。'};
 for(const roleId of ['system','project','mis']){
  const shown=displayPlayerHistoryV42(row,{roleId,actualRoleId:roleId});
  assert.equal(shown.jobTitle,'助理系統工程師');assert.match(shown.body,/改以「助理系統工程師」/);assert.equal(shown.result,row.result);
 }
 for(const roleId of ['ai','sales',undefined])assert.deepEqual(displayPlayerHistoryV42(row,{roleId,actualRoleId:'system'}),row,'current role alone cannot reclassify an old assistant');
 assert.equal(displayPlayerHistoryV42(null,{}),null);
});

test('system ending cards use the player profession while other ending roles, NPCs and canonical cards remain unchanged',()=>{
 const before=JSON.stringify(ENDINGS);
 const senior=ENDINGS.find(ending=>ending.id==='career_senior-system'),principal=ENDINGS.find(ending=>ending.id==='career_principal-system'),assistant=ENDINGS.find(ending=>ending.id==='career_assistant-system');
 assert.equal(displayPlayerEndingV42(senior).title,'資深系統工程師的復原紀錄');
 assert.equal(displayPlayerEndingV42(principal).title,'主任系統工程師留下決策理由');
 assert.match(displayPlayerEndingV42(assistant).body,/你的職稱還是助理系統工程師/);
 assert.equal(displayPlayerEndingV42(ENDINGS.find(ending=>ending.id==='promotion-system')).title,'系統工程副理兼全組工程師');
 assert.equal(displayPlayerEndingV42(ENDINGS.find(ending=>ending.id==='ragequit-system')).subtitle,'這次離線的是系統工程師');
 for(const ending of ENDINGS.filter(ending=>ending.roleId!=='system'))assert.equal(displayPlayerEndingV42(ending),ending);
 const npc={roleId:'system',title:'遇到強哥',body:'強哥的職稱是助理工程師，他是工程經理。你目前是工程師。'};
 assert.equal(displayPlayerEndingV42(npc).body,'強哥的職稱是助理工程師，他是工程經理。你目前是系統工程師。');
 const shown=displayPlayerEndingV42(senior);assert.deepEqual(displayPlayerEndingV42(shown),shown);
 assert.equal(JSON.stringify(ENDINGS),before);assert.equal(displayPlayerEndingV42(null),null);
});

test('departure, raise, special appointment and original onboarding title slots keep the system profession explicit',()=>{
 const working=advance(applyChoice(createRun('ai','e38-title-audit-0'),0)),leaving=requestExit(working),before=JSON.stringify(leaving);
 assert.equal(leaving.eventId,'exit-menu');
 assert.match(displayPlayerEventV42(getEvent(leaving),leaving).body,/第\d+個工作回合，(?:職稱是)?系統工程師，心情/);
 assert.equal(JSON.stringify(leaving),before);assert.equal(validRun(leaving),true);
 const cases=[
  {eventId:'exit-menu',jobTitle:'工程師',body:'第2個工作回合，工程師，心情57。你不需要等到敲鐘，才有權把這段人生結束。',expected:'第2個工作回合，系統工程師，心情57。'},
  {eventId:'raise-confirmation',jobTitle:'工程師',result:'書面調薪生效：遊戲月薪 50K → 56K。職級維持工程師，之後的薪資入帳會使用新月薪。',expected:'職級維持系統工程師，之後'},
  {eventId:'patronage-application',jobTitle:'乾女兒',result:'正式任用：資深工程師 → 乾女兒；月薪 56K → 70K。',expected:'正式任用：資深系統工程師 → 乾女兒；'},
  {eventId:'onboarding',jobTitle:'助理工程師',body:'你應徵的是「專案經理」，報到時的實際職稱卻被改成「助理工程師」。',expected:'實際職稱卻被改成「助理系統工程師」'},
  {eventId:'onboarding',jobTitle:'工程師',body:'你應徵的是「系統工程師」，報到後的實際職稱也是「工程師」；這次沒有被改派。',expected:'報到後的實際職稱也是「系統工程師」'}
 ];
 for(const row of cases){
  const canonical=JSON.stringify(row),shown=displayPlayerHistoryV42(row,{roleId:'project',actualRoleId:'ai'});
  assert.ok((shown.result||shown.body).includes(row.expected));assert.equal(JSON.stringify(row),canonical);
  if(row.jobTitle==='乾女兒')assert.equal(shown.jobTitle,'乾女兒','new special title is preserved');
 }
 const ai={id:'patronage-application',body:'正式任用：AI工程師 → 乾女兒；月薪 56K → 70K。',choices:[]};
 assert.equal(displayPlayerEventV42(ai,{actualRoleId:'ai'}),ai);
});
