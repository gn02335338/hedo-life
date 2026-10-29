import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAPTAIN_EPISODE_IDS_V73,createCaptainVoyageContextV73,getCaptainVoyageEventV73,resolveCaptainVoyageChoiceV73} from '../dist/captain-voyage-v73.js';
import {captainVoyageHTMLV73,captainVoyageReturnHTMLV73,captainVoyageStatusHTMLV73,captainVoyageLegacyNoticeV73} from '../dist/captain-voyage-ui-v73.js';
import {sceneIllustration,renderSceneIllustration} from '../dist/illustrations-v38.js';

const seed=attempt=>'e39-r73-n-'+attempt.toString(16).padStart(22,'0');
function scene(episode='boarding'){
 for(let n=0;n<128;n++){
  const run={seed:seed(n),characterGender:'male',turn:7,stats:{cash:100,energy:80,mood:80},flags:{},history:[]},context=createCaptainVoyageContextV73(run,'source-work');
  const stage=episode==='boarding'?0:episode==='harbor'?3:context.episodes.indexOf(episode)+1;
  if(stage===0&&episode!=='boarding')continue;
  run.captainVoyageContext={...context,stage};return run;
 }
 throw Error('No matching sample '+episode);
}
function pending(run,index=0,ticket=.5){
 const event=getCaptainVoyageEventV73(run),result=resolveCaptainVoyageChoiceV73(run,index,ticket),row={eventId:event.id,kind:event.kind,speaker:event.speaker,turn:run.turn,choiceIndex:index,captainVoyageOutcome:result.outcome};
 return {...run,pending:true,history:[row]};
}

test('invitation and progress notices reveal the current phase without the two future outing titles',()=>{
 const run=scene(),event=getCaptainVoyageEventV73(run),before=structuredClone(run),html=captainVoyageHTMLV73(run,event);
 assert.match(html,/activity-phase-start/);assert.match(html,/私人邀約/);assert.match(html,/要不要上船/);assert.doesNotMatch(html,/role="status"|已經靠岸|\d+%|成功率/);
 for(const stage of [1,2]){const future=getCaptainVoyageEventV73({...run,captainVoyageContext:{...run.captainVoyageContext,stage}});assert.ok(!html.includes(future.title));}
 const progress=scene('karaoke'),part=captainVoyageHTMLV73(progress,getCaptainVoyageEventV73(progress));assert.match(part,/activity-phase-progress/);assert.match(part,/下一站選完才揭曉/);assert.doesNotMatch(part,/已經靠岸/);assert.deepEqual(run,before);
});

test('a chosen response first shows a result phase; an actual rejection, departure or final result alone shows an ending',()=>{
 const run=scene(),event=getCaptainVoyageEventV73(run),answered=captainVoyageHTMLV73(pending(run),event);
 assert.match(answered,/activity-phase-result/);assert.match(answered,/這一幕已有結果/);assert.doesNotMatch(answered,/已經靠岸/);
 const final=scene('harbor'),last=getCaptainVoyageEventV73(final),before=captainVoyageHTMLV73(final,last);assert.match(before,/activity-phase-progress/);assert.match(before,/這是最後一幕/);assert.doesNotMatch(before,/已經靠岸|下一站選完才揭曉/);
 for(const [source,index]of [[run,1],[final,0],[scene('tower'),3]]){
  const ended=captainVoyageHTMLV73(pending(source,index),getCaptainVoyageEventV73(source));assert.match(ended,/activity-phase-end/);assert.match(ended,/role="status"/);assert.match(ended,/已經靠岸/);assert.match(ended,/工作與職稱都還在/);
 }
});

test('return notice appears only after a verified settled trip and does not become a repeated next-work-event banner',()=>{
 const final=scene('harbor'),done=pending(final),returned={...done,pending:false,captainVoyageContext:null},work={id:'source-work',kind:'daily'};
 const html=captainVoyageReturnHTMLV73(returned,work);assert.match(html,/私人航程已收尾/);assert.match(html,/沒有多算工作回合/);
 for(const patch of [{pending:true},{completed:true},{captainVoyageContext:final.captainVoyageContext},{seed:returned.seed.replace('-r73-','-r72-')},{history:[...returned.history,{eventId:'another-work',kind:'daily'}]}])assert.equal(captainVoyageReturnHTMLV73({...returned,...patch},work),'');
 const stale={...returned,history:[{...returned.history[0],captainVoyageOutcome:{...returned.history[0].captainVoyageOutcome,version:2}}]};assert.equal(captainVoyageReturnHTMLV73(stale,work),'');
 assert.equal(captainVoyageReturnHTMLV73(returned,{kind:'company'}),'');assert.match(captainVoyageReturnHTMLV73(returned,{kind:'work-gap'}),/私人航程已收尾/);
});

test('crew status and the old-profile notice are local to the right life rather than anonymous-player attributes',()=>{
 const run=scene();assert.equal(captainVoyageStatusHTMLV73(run),'');
 const member={...run,flags:{captain73_joined:1}},live=captainVoyageStatusHTMLV73(member);assert.match(live,/這趟已上船/);assert.match(live,/仍可.*下船/);
 assert.match(captainVoyageStatusHTMLV73({...member,captainVoyageContext:null}),/這局一起出航過/);
 assert.equal(captainVoyageStatusHTMLV73({...member,seed:member.seed.replace('-r73-','-r72-')}),'');
 for(const marker of ['n','s','d']){const html=captainVoyageLegacyNoticeV73({seed:'e39-r72-'+marker+'-'+'a'.repeat(22)});assert.match(html,/data-action="new"/);assert.match(html,/重新應徵/);assert.doesNotMatch(html,/70|男性|水族館|包廂|踢下|成功率|\d+%/);}
 for(const old of [null,run,{seed:'e39-r71-n-'+'a'.repeat(22)},{seed:'e39-r74-n-'+'a'.repeat(22)}])assert.equal(captainVoyageLegacyNoticeV73(old),'');
});

test('each private outing uses its assigned scene and the people actually present, including both people at the cola stop',()=>{
 const expected={tower:'rest_cafe',aquarium:'rest_cafe',dinner:'dinner',karaoke:'karaoke',cola:'rest_cafe'};
 for(const episode of CAPTAIN_EPISODE_IDS_V73){
  const run=scene(episode),event=getCaptainVoyageEventV73(run),art=sceneIllustration(event,{roleId:'admin',people:event.illustrationPeople}),html=renderSceneIllustration(event,{people:event.illustrationPeople});
  assert.equal(art.theme,expected[episode]);assert.deepEqual(art.people,episode==='cola'?['jack','captain']:['captain']);assert.match(html,/私人場合/);assert.match(html,/captain\.png/);assert.doesNotMatch(html,/wing\.png/);
  if(episode==='cola')assert.match(html,/jack\.png/);
 }
});

test('the actual app wires the phase, return, membership and illustration hooks and creates r75 lives',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/captainVoyageHTMLV73\(run,ev\)/);assert.match(app,/captainVoyageReturnHTMLV73\(run,event\)/);assert.match(app,/captainVoyageStatusHTMLV73\(run\)/);assert.match(app,/captainVoyageLegacyNoticeV73\(run\)/);
 assert.match(app,/\['office-treat','event-departure','blockchain','captain-voyage'\]\.includes\(ev\.kind\)/);assert.match(app,/recruitmentSeedV60\(entropy,kind,75\)/);
});
