import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Policy inputs deliberately omit RNG, effects, deltas, checks, flags and result
// text. An action is resolved exactly once, after the policy has committed to it.
// Usage: node scripts/simulate-balance-expert.mjs --runs 500
// Options: --dist dist --prefix e9 --label e9-expert --out artifacts/balance
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>{if(x.startsWith('--'))a.push([x.slice(2),v[i+1]]);return a;},[]));
const count=Number(args.runs??500),prefix=args.prefix||'e9',label=args.label||`${prefix}-expert`;
if(!Number.isSafeInteger(count)||count<1)throw Error('--runs must be a positive integer');
const dist=resolve(args.dist||'dist');
const out=resolve(args.out||'artifacts/balance');mkdirSync(out,{recursive:true});
const {ROLES:ALL_ROLES}=await import(pathToFileURL(resolve(dist,'roles.js')));
const cohort=Number(/^e(\d+)(?:-|$)/.exec(prefix)?.[1]||1);
const ROLES=ALL_ROLES.filter(role=>(role.minRules||1)<=cohort);
const selectedRoles=ROLES;
const {createRun,getEvent,applyChoice,advance,requestBreak,canRequestBreak,validRun,replayRun}=await import(pathToFileURL(resolve(dist,'engine.js')));
const policies=['expert-merit','expert-politics'];
const EXPERT_ASSUMPTIONS={
 source:'Runs public-only expert strategies. This script never reads choice delta, check/chance, effect, flags, result text or run RNG before committing. getEvent full object is sanitized by existing publicEvent before the policy receives it. Outcomes are observed only after selection.',
 merit:'Targets visible skill82, trust62, boss62+. Once boss<62, unambiguous politics keyword choices get priority instead of waiting until boss28. Skill above82 has sharply diminished text weight. When boss62..78, diplomacy still receives moderate weight. Prefers merit review when available.',
 politics:'Targets visible lick88 and boss85. Until either target is met, politics keyword choices get priority. After those targets, favors rest/cooperation; basic skill65 and trust40 retain some weight. Prefers politics review when available.',
 limits:'Keyword recognition can misclassify natural language and neither strategy is globally optimal. Numerical targets are an experienced-player planning assumption based on visible stat meters, not a claim about real players. Both always request PIP to continue, negotiate before accepting pay cuts, never voluntarily leave after a pay negotiation, choose PIP defense from visible stronger ability (merit whenever boss<25), and choose post-PIP recovery with politics when boss<45. Both deliberately seek PIP to continue, so PIP entry is conditional strategy behavior, not an independent random-employment probability.',
 common:'Uses paid self-care and the survival-oriented modal handling stated above and avoids intentional early exits. Engine seeds match across the two expert policies within each cohort; policy tie-break RNG is independent. Cohort prefix changes initial RNG, so e8/e9 are distribution comparisons rather than exact same dice.'
};
const labels={'expert-merit':'數值調適成果高手','expert-politics':'數值調適政治高手'};
const ranks=['專業員工','副理','經理','總監','C-level／副總'];
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0||1;}
function policyRandom(seed){let x=hash(seed);return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
const publicEvent=e=>({id:e.id,kind:e.kind,title:e.title,body:e.body,choices:e.choices.map((c,i)=>({text:c.text,available:c.available!==false,index:i}))});
const publicRun=r=>({roleId:r.roleId,actualRoleId:r.actualRoleId,assignment:r.assignment,rank:r.rank,turn:r.turn,pay:r.pay,stats:{...r.stats}});
const keyword={
 work:[/紀錄|記錄|時間線|核對|對照|確認|驗證|測試|查證|評估|資料|證據|交付|測量|重現|條件|需求|範圍|流程|清單|文件|交接|規格|備份|里程碑|版本|維護|工程|原始碼|程式|技術|錯誤|修正|修好|修完|查明|查詢|比對|測試|風險|整理|書面|實際|逐條|問題|報價|上限|目標/],
 politics:[/讚美|稱讚|感謝|肯定|遠見|願景|方向|相信|金句|附和|點頭|照上面|照原|先照|照做|親自|Wing.*指定|全接|拍胸|掌聲|學習|公司.*好|老闆.*夾|老闆.*說|簡報|形象|稱呼|表忠|保留承諾|先讓願景|讓流程|先說.*可以|以新職稱/],
 rest:[/散步|倒水|喝水|休息|下班|收工|睡|吃|宵夜|朋友|關掉|靜音|勿擾|通知|不要參加|先離開|先回去|換個地方|輕鬆|省電|留著|界線|邊界|聯絡|聊聊/],
 cooperative:[/同事|團隊|大家|一起|合作|互助|幫忙|朋友|當事人|工作紀錄|留下|範圍|條件|時間線|資料|聯絡/],
 aggressive:[/當場|公開.*問|質問|嗆|反問|拒絕|不接受|不簽|糾正|不合理|指出|亮出|你說|他說過|要他|請他|反駁|到底|不讀書|不替/],
 terminal:[/我(?:現在|先)?走|離職|辭職|不幹|離開公司|就到這|最後一天|替.*收尾|資遣名義離場/]
};
function hits(text,arr){return arr.reduce((n,re)=>n+(text.match(new RegExp(re.source,'g'))||[]).length,0);}
function visibleScore(choice,run,policy){
 const merit=policy==='expert-merit',t=choice.text,k=Object.fromEntries(Object.entries(keyword).map(([n,v])=>[n,hits(t,v)])),s=run.stats;
 let score=merit
  ?(s.skill<82?2.8:.15)*k.work+(s.trust<62?1.9:.3)*k.cooperative+((s.energy<45||s.mood<45)?2:.8)*k.rest+(s.boss<62?4.6:s.boss<78?2:.1)*k.politics-.5*k.aggressive+(s.boss<62&&k.politics>0?20:0)
  :(s.lick<88||s.boss<85?4:.2)*k.politics+(s.skill<65?1.5:.15)*k.work+(s.trust<40?1.4:.2)*k.cooperative+((s.energy<45||s.mood<45)?2:.8)*k.rest-.8*k.aggressive+((s.lick<88||s.boss<85)&&k.politics>0?20:0);
 if(s.boss<28)score+=(merit?1.2:2)*k.politics-.5*k.aggressive;
 if(s.energy<28||s.mood<28)score+=(merit?1.2:3)*k.rest-.3*k.work;
 if(k.terminal)score-=30;
 return score;
}
function selectChoice(event,run,policy,rng){
 const merit=policy==='expert-merit',cs=event.choices.filter(c=>c.available),s=run.stats;
 const has=i=>cs.some(c=>c.index===i),prefer=(...indices)=>indices.find(has);
 switch(event.id){
 case'onboarding':return merit&&run.assignment!=='honest'&&s.skill>=65?1:0;
 case'career-review':{
  if(cs.some(c=>c.index<2))return merit?prefer(0,1):prefer(1,0);
  return s.energy<24||s.mood<24?3:2;
 }
 case'education-review':return merit?0:2;
 case'salary-cut':return 2;
 case'salary-final':return 0;
 case'crisis-boss':case'paperwork':return 2;
 case'pip-review':return s.skill>=s.lick||s.boss<25?0:1;
 case'pip-passed':return s.boss<45?2:1;
 case'crisis-mood':return has(1)?1:2;
 case'kind-break':case'kind-workday':return has(0)&&s.mood<30&&s.cash>48&&!merit?0:2;
 case'self-care':return s.energy<30&&s.cash>28&&has(2)?2:s.mood<30&&s.cash>20&&has(1)?1:has(0)?0:3;
 case'final-shortfall':return 0;
 case'rank-exit':return has(0)?0:1;
 case'career-exit':return cs.find(c=>!/先回|回座/.test(c.text))?.index??cs[0].index;
 case'exit-menu':return 1;
 case'story-exit':return cs[0].index;
 case'career-step-down':throw Error('Simulation never requests voluntary demotion');
 }
 return cs.map(c=>({index:c.index,score:visibleScore(c,run,policy)+(rng()-.5)*1.8})).sort((a,b)=>b.score-a.score)[0].index;
}
const empty=()=>({n:0,complete:0,unfinished:0,days:0,days2:0,initialAssistant:0,initialSwapped:0,regularized:0,peak:[0,0,0,0,0],promotedRank:[0,0,0,0,0],chiefDays:[],reviewGames:0,reviews:0,reviewBlocked:0,reviewEligible:0,applications:0,promotions:0,applicationSuccess:0,applicationFailure:0,byTarget:Array.from({length:5},()=>({offered:0,eligible:0,applications:0,success:0})),salaryGames:0,salaryOffers:0,salaryAcceptGames:0,salaryAccepted:0,salaryNegotiations:0,salaryRescinded:0,salaryExit:0,pipGames:0,pipEntries:0,pipReviews:0,pipPasses:0,pipFailures:0,pipOtherExit:0,bossCrisisGames:0,bossCrises:0,repeatPipGames:0,pipExtraEntries:0,initialAssistantChief:0,nonAssistantChief:0,forcedExit:0,layoff:0,firedSigned:0,firedRefused:0,burnout:0,broke:0,otherExit:0,earlyExit:0,breaks:0,endingFamilies:{},eventCounts:{},firstChiefTurns:{}});
const familyOf=(ending,role)=>ending?.slice(0,-role.length-1)||'unfinished';
const add=(target,source)=>{for(const [k,v]of Object.entries(source)){if(typeof v==='number')target[k]=(target[k]||0)+v;else if(Array.isArray(v)){if(k==='chiefDays')target[k].push(...v);else if(k==='byTarget')v.forEach((x,i)=>add(target[k][i],x));else v.forEach((x,i)=>target[k][i]+=x);}else if(v&&typeof v==='object')add(target[k],v);}return target;};
function simulate(roleId,policy,i){
 const seed=`${prefix}-bal-${roleId}-${i.toString(36)}`,rng=policyRandom(`choice-${roleId}-${policy}-${i}`);
 let run=createRun(roleId,seed),m=empty(),peak=run.rank,chiefAt=null;
 m.n=1;m.initialAssistant=Number(run.assignment==='assistant');m.initialSwapped=Number(run.assignment==='swapped');
 let hadReview=false,hadSalary=false,hadPip=false,hadBoss=false,accepted=false;
 const promoted=new Set();
 for(let step=0;step<155&&!run.completed;step++){
  if(canRequestBreak(run)&&run.stats.cash>16&&(run.stats.mood<32||run.stats.energy<22)){
   run=requestBreak(run);m.breaks++;
  }
  const full=getEvent(run),event=publicEvent(full),snapshot=publicRun(run);
  m.eventCounts[event.id]=(m.eventCounts[event.id]||0)+1;
  if(event.id==='career-review'){
   m.reviews++;hadReview=true;const target=run.assignment==='assistant'?0:run.rank+1;m.byTarget[target].offered++;
   if(event.choices.some(c=>c.available&&c.index<2)){m.reviewEligible++;m.byTarget[target].eligible++;}else m.reviewBlocked++;
  }
  if(event.id==='salary-cut'){m.salaryOffers++;hadSalary=true;}
  if(event.id==='crisis-boss'){m.bossCrises++;hadBoss=true;}
  if(event.id==='pip-review')m.pipReviews++;
  const index=selectChoice(event,snapshot,policy,rng);
  const oldRank=run.rank,oldAssignment=run.assignment;
  // The following result is observed only after selectChoice has committed.
  const selected=applyChoice(run,index),effect=selected.pendingEffect;
  if(event.id==='career-review'&&index<2){
   const target=oldAssignment==='assistant'?0:oldRank+1;m.applications++;m.byTarget[target].applications++;
   if(['careerPromote','careerRegularize'].includes(effect)){m.applicationSuccess++;m.byTarget[target].success++;}else m.applicationFailure++;
  }
  if(effect==='careerRegularize')m.regularized++;
  if(effect==='careerPromote'){m.promotions++;promoted.add(selected.rank);}
  if(effect==='salaryAccept'){m.salaryAccepted++;accepted=true;}
  if(event.id==='salary-cut'&&index===2)m.salaryNegotiations++;
  if(effect==='salaryRescind')m.salaryRescinded++;
  if(['salary-cut','salary-final'].includes(event.id)&&effect==='ragequit')m.salaryExit++;
  if(effect==='startPip'){m.pipEntries++;hadPip=true;}
  if(effect==='pipPassed')m.pipPasses++;
  if(event.id==='pip-review'&&selected.pendingFamily==='pip_fail')m.pipFailures++;
  if(selected.rank>peak){peak=selected.rank;if(peak===4)chiefAt=selected.turn;}
  run=advance(selected);
 }
 if(!validRun(run))throw Error(`Invalid final state ${roleId} ${policy} ${i}`);
 if(i%100===0){const replay=replayRun(roleId,seed,JSON.parse(JSON.stringify(run.actions)));if(JSON.stringify(replay)!==JSON.stringify(run))throw Error(`Replay differs for ${roleId} ${policy} attempt ${i}`);}
 m.repeatPipGames=Number(m.pipEntries>=2);m.pipExtraEntries=Math.max(0,m.pipEntries-1);m.initialAssistantChief=Number(peak>=4&&m.initialAssistant===1);m.nonAssistantChief=Number(peak>=4&&m.initialAssistant===0);
 m.complete=Number(run.completed);m.unfinished=Number(!run.completed);m.days=Math.min(24,run.turn+1);m.days2=m.days**2;
 for(let r=0;r<=4;r++){m.peak[r]=Number(peak>=r);m.promotedRank[r]=Number(promoted.has(r));}
 if(chiefAt!==null){m.chiefDays.push(chiefAt+1);m.firstChiefTurns[chiefAt+1]=(m.firstChiefTurns[chiefAt+1]||0)+1;}
 m.reviewGames=Number(hadReview);m.salaryGames=Number(hadSalary);m.pipGames=Number(hadPip);m.bossCrisisGames=Number(hadBoss);m.salaryAcceptGames=Number(accepted);
 const family=familyOf(run.endingId,roleId);m.endingFamilies[family]=1;
 m.layoff=Number(family==='layoff');m.firedSigned=Number(family==='fired_signed');m.firedRefused=Number(family==='fired_refused');
 m.forcedExit=Number(['fired_signed','fired_refused','layoff','pip_fail'].includes(family));
 m.burnout=Number(family==='burnout');m.broke=Number(family==='broke');m.otherExit=Number(!m.forcedExit&&run.completed);
 m.earlyExit=Number(run.completed&&run.turn<20);m.pipOtherExit=Number(hadPip&&m.pipReviews===0&&run.completed);
 return m;
}
const wilson=(k,n)=>{if(!n)return null;const z=1.959963984540054,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];};
const rate=(k,n)=>({count:k,denominator:n,rate:n?k/n:null,ci95:wilson(k,n)});
function summarize(m){return {
 n:m.n,completed:m.complete,unfinished:m.unfinished,
 peakReached:m.peak.map((k,i)=>({rank:i,label:ranks[i],...rate(k,m.n)})),
 promotedInto:m.promotedRank.map((k,i)=>({rank:i,label:ranks[i],...rate(k,m.n)})),
 meanDays:{value:m.days/m.n,ci95:[m.days/m.n-1.96*Math.sqrt(Math.max(0,m.days2/m.n-(m.days/m.n)**2)/m.n),m.days/m.n+1.96*Math.sqrt(Math.max(0,m.days2/m.n-(m.days/m.n)**2)/m.n)]},
 earliestChiefDay:m.chiefDays.length?Math.min(...m.chiefDays):null,chiefByInitialAssignment:{assistant:rate(m.initialAssistantChief,m.initialAssistant),nonAssistant:rate(m.nonAssistantChief,m.n-m.initialAssistant)},
 meanFirstChiefDay:m.chiefDays.length?m.chiefDays.reduce((a,b)=>a+b,0)/m.chiefDays.length:null,
 regularized:rate(m.regularized,m.initialAssistant),
 reviews:{games:rate(m.reviewGames,m.n),offered:m.reviews,blocked:rate(m.reviewBlocked,m.reviews),applications:m.applications,succeeded:rate(m.applicationSuccess,m.applications),byTarget:m.byTarget.map((x,i)=>({rank:i,label:ranks[i],...x,eligibility:rate(x.eligible,x.offered),successRate:rate(x.success,x.applications)}))},
 salary:{actualPayCut:rate(m.salaryAcceptGames,m.n),offered:rate(m.salaryGames,m.n),accepted:rate(m.salaryAcceptGames,m.salaryGames),negotiated:m.salaryNegotiations,rescinded:rate(m.salaryRescinded,m.salaryNegotiations),left:rate(m.salaryExit,m.salaryGames)},
 pip:{repeatGames:rate(m.repeatPipGames,m.n),repeatedAmongPip:rate(m.repeatPipGames,m.pipGames),extraEntries:m.pipExtraEntries,entered:rate(m.pipGames,m.n),entries:m.pipEntries,reviews:m.pipReviews,passed:rate(m.pipPasses,m.pipReviews),failed:rate(m.pipFailures,m.pipReviews),otherExitBeforeReview:m.pipOtherExit},
 bossCrisis:rate(m.bossCrisisGames,m.n),forcedExit:rate(m.forcedExit,m.n),withoutPipLayoff:rate(m.layoff,m.n),signedVoluntary:rate(m.firedSigned,m.n),refusedVoluntary:rate(m.firedRefused,m.n),burnout:rate(m.burnout,m.n),broke:rate(m.broke,m.n),earlyExit:rate(m.earlyExit,m.n),otherExit:rate(m.otherExit,m.n),
 initialAssignment:{assistant:m.initialAssistant,swapped:m.initialSwapped},endingFamilies:m.endingFamilies,firstChiefDays:m.firstChiefTurns,
 }}
const report={policySha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),label,cohort:prefix,runsPerCell:count,createdAt:new Date().toISOString(),method:{expertAssumptions:EXPERT_ASSUMPTIONS,
 totalGames:selectedRoles.length*policies.length*count,
 policyInputs:'Expert policies additionally prioritize numerical target deficits stated in expertAssumptions. Current visible stats, rank, salary, job/assignment, event title/body, choice text and availability only. No check/chance, result, delta, flag or RNG input; applyChoice runs once after choice commitment. No injected state and no requestExit before a terminal screen.',
 seedDesign:'The two expert policies share the same generated initial seed for each advertised role and attempt, with independent policy tie-break RNG. Different cohort prefixes have different initial RNG states; cross-cohort comparisons are not exact same-dice pairs. Outputs contain aggregate statistics only, without seeds or action transcripts.',
 promotion:'Apply at every offered review whenever either application is available. The merit expert prefers the delivery option; the politics expert prefers flattery. If both are unavailable train, or defer while exhausted.',
 policies:{'expert-merit':EXPERT_ASSUMPTIONS.merit,'expert-politics':EXPERT_ASSUMPTIONS.politics},
 selfCare:'Manual self-care once available day if cash>16 and (mood<32 or energy<22). Rest menu selected from publicly recognizable costs/preferences. Mood crisis takes paid rest if affordable, otherwise power-saving. Kind accepted only if mood<30, cash>48 and policy permits. No future result inspected.',
 completion:'All policies continue until an engine terminal event, exhaustion/exit, or final career menu. No deliberate early career collection exit/demotion. Runs capped at155 choices. Executive starts manager rank2, so peak manager rate includes entry; promotedInto separates promotions from initial rank.',
 uncertainty:'95% Wilson intervals for game/attempt proportions; normal mean CI for day averages. Strategy mixtures are modeling scenarios, not estimates of actual human population probabilities. Conditional PIP/pay negotiation denominators are explicit; repeat reviews within a run are correlated, so attempt-level intervals are descriptive only.',
 replay:'Every hundredth run per cell full JSON action replay equals actual final state; every final state validRun checked.'},
 sourceSha256:Object.fromEntries(['engine','roles','education','events','events-images','image-scenes-wing','events-video','copy-edits','engine-copy','kind-break','career','story-career','endings','endings-career','endings-stories','events-departures'].map(x=>[x,createHash('sha256').update(readFileSync(resolve(dist,`${x}.js`))).digest('hex')])),cells:[],byPolicy:[],byRole:[]};
const totals=empty(),policyTotals=Object.fromEntries(policies.map(p=>[p,empty()]));
for(const role of selectedRoles){const roleTotal=empty();for(const policy of policies){const m=empty();for(let i=0;i<count;i++)add(m,simulate(role.id,policy,i));report.cells.push({roleId:role.id,roleName:role.name,policy,policyName:labels[policy],...summarize(m),raw:m});add(roleTotal,m);add(policyTotals[policy],m);add(totals,m);console.log(JSON.stringify({label,role:role.id,policy,n:count,chief:(m.peak[4]/m.n).toFixed(4),pip:(m.pipGames/m.n).toFixed(4),salary:(m.salaryGames/m.n).toFixed(4),forced:(m.forcedExit/m.n).toFixed(4),days:(m.days/m.n).toFixed(2),unfinished:m.unfinished}));}report.byRole.push({roleId:role.id,roleName:role.name,...summarize(roleTotal)});}
report.byPolicy=policies.map(policy=>({policy,policyName:labels[policy],...summarize(policyTotals[policy])}));report.total=summarize(totals);
writeFileSync(resolve(out,`${label}.json`),JSON.stringify(report,null,2)+'\n');
const pct=r=>r.rate===null?'—':`${(r.rate*100).toFixed(1)}% [${r.ci95.map(x=>(x*100).toFixed(1)).join('–')}]`;
let md=`# ${label} 平衡模擬\n\n${report.method.totalGames.toLocaleString()} 局：九職業 × 兩種高手策略 × 每格 ${count.toLocaleString()} 局。括號為 95% CI。\n\n`;
md+='| 策略 | 升副理或以上 | 升經理或以上* | 到總監 | 到 C-level | 降薪提議 | 進 PIP | 被動離場 | 平均天數 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const p of report.byPolicy)md+=`| ${p.policyName} | ${pct(p.peakReached[1])} | ${pct(p.peakReached[2])} | ${pct(p.peakReached[3])} | ${pct(p.peakReached[4])} | ${pct(p.salary.offered)} | ${pct(p.pip.entered)} | ${pct(p.forcedExit)} | ${p.meanDays.value.toFixed(2)} |\n`;
md+='\n* 空降主管初始就是經理，peak 包含初始職級；JSON promotedInto 另計真正升進該階。\n\n';
md+='| 職業（兩高手策略等權） | 到總監 | 到 C-level | 降薪提議 | 進 PIP | 未走 PIP 資遣 | 被騙簽自願 | 被動離場 | 平均天數 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const p of report.byRole)md+=`| ${p.roleName} | ${pct(p.peakReached[3])} | ${pct(p.peakReached[4])} | ${pct(p.salary.offered)} | ${pct(p.pip.entered)} | ${pct(p.withoutPipLayoff)} | ${pct(p.signedVoluntary)} | ${pct(p.forcedExit)} | ${p.meanDays.value.toFixed(2)} |\n`;
md+='\n## 方法與限制\n\n'+Object.entries(report.method).map(([k,v])=>`- ${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join('\n')+'\n';
md+='\n## 完整分格\n\n| 職業 | 策略 | 到 C-level | 降薪提議 | 進 PIP | PIP 通過（已評核） | 被動離場 | 平均天數 |\n|---|---|---:|---:|---:|---:|---:|---:|\n';
for(const p of report.cells)md+=`| ${p.roleName} | ${p.policyName} | ${pct(p.peakReached[4])} | ${pct(p.salary.offered)} | ${pct(p.pip.entered)} | ${pct(p.pip.passed)} | ${pct(p.forcedExit)} | ${p.meanDays.value.toFixed(2)} |\n`;
writeFileSync(resolve(out,`${label}.md`),md);
console.log(JSON.stringify({label,total:report.total,report:resolve(out,`${label}.json`)}));
