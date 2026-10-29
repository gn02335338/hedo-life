import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {isCastV74} from '../dist/cast-profile-v74.js';
import {castLegacyNoticeV74} from '../dist/cast-notice-v74.js';
import {recruitmentSeedV60,isRecruitmentV60} from '../dist/seed-profile-v60.js';
import {isOfficeTreatsV61} from '../dist/office-treats-v61.js';
import {isLifeBalanceV62} from '../dist/life-balance-v62.js';
import {isParticipationV63} from '../dist/participation-profile-v63.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {isExpansionV66} from '../dist/expansion-profile-v66.js';
import {isPatronageBenefitsV67} from '../dist/patronage-benefits-v67.js';
import {isPatronageFamiliarityV68} from '../dist/patronage-familiarity-v68.js';
import {isPatronageProgressV69} from '../dist/patronage-progress-v69.js';
import {isKindRecoveryV70} from '../dist/kind-recovery-v70.js';
import {isCareerContentV71} from '../dist/career-content-v71.js';
import {isLifeSystemsV72} from '../dist/life-systems-v72.js';
import {isCaptainVoyageV73} from '../dist/captain-profile-v73.js';
import {castPrivateNoticeV74,castPrivateReturnV74} from '../dist/cast-private-ui-v74.js';

test('fresh cast profiles inherit the complete current feature chain and reject future or malformed seeds',()=>{
 const gates=[isCastV74,isRecruitmentV60,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63,isExpansionV65,isExpansionV66,isPatronageBenefitsV67,isPatronageFamiliarityV68,isPatronageProgressV69,isKindRecoveryV70,isCareerContentV71,isLifeSystemsV72,isCaptainVoyageV73];
 for(const profile of [74,75])for(const kind of ['normal','godson','goddaughter']){
  const seed=recruitmentSeedV60('a'.repeat(22),kind,profile);
  assert.equal(seed.length,32);
  for(const gate of gates){assert.equal(gate(seed),true,gate.name);assert.equal(gate({seed}),true,gate.name);}
 }
 for(const seed of [null,undefined,'',74,'e39-r73-n-'+'a'.repeat(22),'e39-r76-n-'+'a'.repeat(22),'e39-r74-x-'+'a'.repeat(22),'e39-r74-n-'+'a'.repeat(21),'e39-r74-n-'+'a'.repeat(23),'e39-r74-n-'+'A'.repeat(22)])assert.equal(isCastV74(seed),false);
 assert.throws(()=>recruitmentSeedV60('a'.repeat(22),'normal',76));
});

test('the latest previous profile receives an invitation to reapply without revealing choices or outcomes',()=>{
 for(const marker of ['n','s','d']){
  const html=castLegacyNoticeV74({seed:'e39-r73-'+marker+'-'+'a'.repeat(22)});
  assert.match(html,/重新應徵/);assert.match(html,/紅酒/);assert.match(html,/data-action="new"/);
  assert.doesNotMatch(html,/\d+%|機率|好感.*\d|結局|性騷|感情|偷加/);
 }
 for(const value of [null,{}, {seed:'e39-r72-n-'+'a'.repeat(22)},{seed:'e39-r74-n-'+'a'.repeat(22)},{seed:'e39-r75-n-'+'a'.repeat(22)}])assert.equal(castLegacyNoticeV74(value),'');
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/recruitmentSeedV60\(entropy,kind,75\)/);assert.match(app,/castLegacyNoticeV74\(run\)/);
});

test('all five shipped avatars retain transparency, bounded size and the checked public-art hashes',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../research/portraits-v74.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.portraits.map(row=>row.id),['wine','peter','tony','henry','mia']);
 assert.doesNotMatch(JSON.stringify(manifest),/\/Users\/|notion|signed|\.jpg/i);
 for(const row of manifest.portraits){
  assert.equal(row.path,`./assets/avatars-v74/${row.id}.webp`);
  const data=readFileSync(new URL('../dist/'+row.path.slice(2),import.meta.url)),metadata=await sharp(data).metadata(),stats=await sharp(data).stats();
  assert.equal(metadata.format,'webp');assert.equal(metadata.hasAlpha,true);assert.equal(stats.isOpaque,false);
  assert.ok(metadata.width<=560&&metadata.height<=760);assert.ok(data.length<650000);
  assert.equal(row.bytes,data.length);assert.equal(row.sha256,createHash('sha256').update(data).digest('hex'));
 }
});

test('private gatherings announce their start, committed finish and return without ending a pending scene early',()=>{
 const run={seed:'e39-r74-n-'+'a'.repeat(22),pending:false,history:[]},event={id:'cast74-henry-party-invite',kind:'private-social',scope:'private',requiresCastV74:true};
 assert.match(castPrivateNoticeV74(run,event),/私人小聚開始/);
 assert.doesNotMatch(castPrivateNoticeV74(run,event),/這段小聚已收尾/);
 const stale={...run,pending:true,history:[{eventId:'another-event',kind:'private-social'}]};
 assert.doesNotMatch(castPrivateNoticeV74(stale,event),/這段小聚已收尾/);
 const committed={...run,pending:true,history:[{eventId:event.id,kind:'private-social'}]};
 assert.match(castPrivateNoticeV74(committed,event),/這段小聚已收尾/);
 assert.match(castPrivateNoticeV74(committed,event),/role="status"/);
 assert.equal(castPrivateReturnV74(committed,{kind:'daily'}),'');
 assert.match(castPrivateReturnV74({...committed,pending:false},{kind:'daily'}),/小聚結束/);
 assert.equal(castPrivateReturnV74({...committed,pending:false},{kind:'company'}),'');
 assert.equal(castPrivateNoticeV74({...run,seed:run.seed.replace('r74','r73')},event),'');
 assert.equal(castPrivateNoticeV74(run,{...event,kind:'daily'}),'');
 assert.equal(castPrivateReturnV74({...committed,pending:false,completed:true},{kind:'daily'}),'');
});
