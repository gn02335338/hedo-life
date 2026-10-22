import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,applyChoice,advance,requestExit,getEvent,validRun,enableActivitySchedule} from '../dist/engine.js';
import {deriveLeaderboardScoreV56,LEADERBOARD_METRICS_V56} from '../dist/leaderboard-score-v56.js';
import {endingLeaderboardHTMLV56,leaderboardHTMLV56,normalizeLeaderboardNicknameV56,createLeaderboardUIV56,LEADERBOARD_CONSENT_V56} from '../dist/leaderboard-ui-v56.js';

function completed(seed='e39-cal46-kin49-g-e-s-m-00000000'){
 let run=enableActivitySchedule(createRun('system',seed));run={...run,runId:'00000000-0000-4000-8000-000000000056'};
 run=advance(applyChoice(run,0));
 run=requestExit(run);
 const index=getEvent(run).choices.findIndex(choice=>['resign','exit','quit','exitVoluntary'].includes(choice.effect));
 // The ordinary exit menu always exposes a voluntary departure before the
 // optional wealth planning route. Use canonical actions, never injected stats.
 const pick=index>=0?index:getEvent(run).choices.findIndex(choice=>/自己決定|離開|離職/.test(choice.text));
 run=advance(applyChoice(run,Math.max(0,pick)));
 for(let i=0;i<12&&!run.completed;i++)run=advance(applyChoice(run,0));
 assert.equal(run.completed,true);assert.equal(validRun(run),true);return run;
}
const baseRun=completed();
const entry={entryId:'public-safe-entry',runId:baseRun.runId,nickname:'背鍋隊長',value:6410,total:6410,rank:1,roleId:'ai',actualRoleId:'system',turns:12,createdAt:'2026-10-23T04:00:00.000Z'};
const response=(overrides={})=>({version:1,scoreVersion:1,metric:'overall',role:'all',entries:[entry],totalPlayers:1,updatedAt:'2026-10-23T05:00:00.000Z',...overrides});
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};

function harness({run=baseRun,cloud={}}={}){
 const listeners=new Map();let html='',currentRun=run;const mineDetails={open:false},ruleDetails={open:false};
 const document={activeElement:null,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
 const dialog={open:false,scrollTop:0,ownerDocument:document,querySelector(selector){if(selector==='[data-leaderboard-board]'&&html.includes('data-leaderboard-board'))return {};if(selector==='.lb-my-entries'&&html.includes('class="lb-my-entries"'))return mineDetails;if(selector==='.lb-rules'&&html.includes('class="lb-rules"'))return ruleDetails;return null;}};
 const calls={submit:[],rename:[],remove:[],board:[],mine:0};let serverEntries=[];
 const api={leaderboard:async query=>{calls.board.push(query);return response({metric:query.metric,role:query.role});},myLeaderboard:async()=>{calls.mine++;return {entries:serverEntries};},submitLeaderboard:async(state,nickname)=>{calls.submit.push({run:state,nickname});serverEntries=[{...entry,nickname,runId:state.runId}];return {published:true};},renameLeaderboard:async(runId,nickname)=>{calls.rename.push({runId,nickname});serverEntries=serverEntries.map(row=>row.runId===runId?{...row,nickname}:row);return {published:true};},removeLeaderboard:async runId=>{calls.remove.push(runId);serverEntries=serverEntries.filter(row=>row.runId!==runId);return {removed:true};},...cloud};
 const ui=createLeaderboardUIV56({dialog,openDialog(value){html=value;dialog.open=true;mineDetails.open=/<details class="lb-my-entries"[^>]*\bopen\b/.test(value);ruleDetails.open=/<details class="lb-rules"[^>]*\bopen\b/.test(value);},cloud:api,getRun:()=>currentRun,document});
 const dispatch=(type,target)=>{for(const fn of listeners.get(type)||[])fn({target,preventDefault(){}});};
 const form=(scope='ending',index=0,name='移動旅人',consent=true)=>{
  const input={value:name},checkbox={checked:consent},message={textContent:''};
  const node={dataset:{lbForm:scope,lbIndex:String(index)},closest(selector){return selector==='[data-lb-form]'?this:null;},querySelector(selector){return selector==='[data-lb-name]'?input:selector==='[data-lb-consent]'?checkbox:selector==='[role="status"]'?message:null;}};
  return {node,input,checkbox,message};
 };
 return{ui,calls,form,dispatch,openDetails(){mineDetails.open=true;ruleDetails.open=true;},detailsOpen:()=>({mine:mineDetails.open,rules:ruleDetails.open}),html:()=>html,ending:()=>ui.endingHTML(currentRun),setRun(value){currentRun=value;},setEntries(value){serverEntries=value;},command(command,scope='ending',index=0){dispatch('click',{closest:selector=>selector==='[data-lb-command]'?{dataset:{lbCommand:command,lbScope:scope,lbIndex:String(index)}}:null});}};
}

test('ending score is a read-only six-part visualization with explicit opt-in and skip',()=>{
 const before=JSON.stringify(baseRun),score=deriveLeaderboardScoreV56(baseRun),html=endingLeaderboardHTMLV56(baseRun);
 assert.equal(JSON.stringify(baseRun),before);assert.equal((html.match(/class="lb-score-row"/g)||[]).length,6);
 assert.match(html,new RegExp(score.total.toLocaleString('zh-TW')));assert.match(html,/role="meter"/);assert.match(html,/aria-valuemax="3000"/);
 assert.match(html,/這次不留名/);assert.match(html,/type="checkbox"\s+\s*>/);assert.ok(html.includes(LEADERBOARD_CONSENT_V56));
 assert.doesNotMatch(html,/endingId|ragequit-system|00000000-0000/);assert.doesNotMatch(html,/data-lb-consent[^>]*checked/);
 assert.equal(endingLeaderboardHTMLV56({...baseRun,completed:false}),'');
});

test('old completed lives keep score preview but cannot publish to the current season',()=>{
 const old=completed('e39-cal46-kin49-g-e-s-0000000000'),html=endingLeaderboardHTMLV56(old);
 assert.match(html,/綜合分數/);assert.match(html,/本季採目前規則/);assert.doesNotMatch(html,/data-lb-form|留名，加入排行榜/);
});

test('public board supports every metric, role aliases, ties and no ending or identity leaks',()=>{
 const html=leaderboardHTMLV56({data:response({entries:[{...entry,nickname:'<script>偷襲</script>',endingId:'nasdaq-system',endingTitle:'不應外洩',playerId:'private-player',seed:'private-seed'},{...entry,rank:1,nickname:'同分玩家',entryId:'safe-2',actualRoleId:'design'},{...entry,rank:3,nickname:'第三位',entryId:'safe-3',actualRoleId:'executive'}]}),metric:'overall'});
 for(const metric of LEADERBOARD_METRICS_V56)assert.ok(html.includes(`value="${metric.id}"`));
 assert.match(html,/&lt;script&gt;偷襲&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>|nasdaq-system|不應外洩|private-player|private-seed/);
 assert.match(html,/產品設計/);assert.doesNotMatch(html,/空降主管/);assert.match(html,/高階主管/);
 assert.equal((html.match(/aria-label="第 1 名"/g)||[]).length,2);assert.match(html,/第 3 名/);assert.match(html,/1、1、3/);assert.match(html,/前 50 名/);
});

test('missing public records remain unknown rather than fabricated zero or first place',()=>{
 const html=leaderboardHTMLV56({data:null,error:'連不上'});assert.match(html,/等待取得已留名人數/);assert.match(html,/先不替任何人編名次/);assert.doesNotMatch(html,/class="lb-rank-row/);
 const empty=leaderboardHTMLV56({data:response({entries:[],totalPlayers:0})});assert.match(empty,/0 位匿名玩家符合此榜/);assert.match(empty,/第一個名字還沒出現/);
});

test('nickname normalization accepts Unicode aliases but blocks personal links and unsafe markup',()=>{
 assert.equal(normalizeLeaderboardNicknameV56('  ＪＫ　同學  '),'JK 同學');assert.equal(normalizeLeaderboardNicknameV56('🚀🚀'),'🚀🚀');
 for(const name of ['a','x'.repeat(17),'<名字>','名\u202e字','https://abc.tw','jack@abc.tw'])assert.throws(()=>normalizeLeaderboardNicknameV56(name));
});

test('opening a board and viewing an ending never submit, rename or withdraw',async()=>{
 const h=harness();h.ending();await h.ui.open();assert.equal(h.calls.board.length,1);assert.equal(h.calls.mine,1);assert.deepEqual(h.calls.submit,[]);assert.deepEqual(h.calls.remove,[]);assert.deepEqual(h.calls.rename,[]);
});

test('explicit submission requires valid nickname and unchecked consent never publishes',async()=>{
 const h=harness(),no=h.form('ending',0,'移動旅人',false);h.dispatch('submit',no.node);await tick();assert.equal(h.calls.submit.length,0);assert.match(h.ending(),/公開前，請先勾選/);
 const invalid=h.form('ending',0,'<我>',true);h.dispatch('submit',invalid.node);await tick();assert.equal(h.calls.submit.length,0);assert.match(h.ending(),/不放連結/);
 const yes=h.form('ending',0,'背鍋大使',true);h.dispatch('submit',yes.node);h.dispatch('submit',yes.node);await tick();assert.equal(h.calls.submit.length,1);assert.equal(h.calls.submit[0].run,baseRun);assert.equal(h.calls.submit[0].nickname,'背鍋大使');assert.match(h.ending(),/留名已確認/);assert.match(h.ending(),/這局已以/);assert.doesNotMatch(h.ending(),/data-lb-consent[^>]*checked/);
});

test('offline submit preserves the typed name and never pretends to be published',async()=>{
 const h=harness({cloud:{submitLeaderboard:async()=>{throw new Error('offline');}}}),form=h.form('ending',0,'離線躲雨',true);h.dispatch('submit',form.node);await tick();const html=h.ending();assert.match(html,/value="離線躲雨"/);assert.match(html,/還不能確認結果/);assert.match(html,/恢復連線後可重試同一局，不會重複刊登/);assert.doesNotMatch(html,/留名已確認|這局已以/);
});

test('an accepted POST without a confirming read remains unknown, not a fake success',async()=>{
 const h=harness({cloud:{myLeaderboard:async()=>{throw new Error('offline');}}});h.dispatch('submit',h.form().node);await tick();assert.match(h.ending(),/還沒查到最新留名/);assert.doesNotMatch(h.ending(),/留名已確認|這局已以/);
});

test('skip never posts and can be undone without dismissing the ending',async()=>{
 const h=harness();h.command('skip');assert.match(h.ending(),/這局先不公開/);assert.doesNotMatch(h.ending(),/data-lb-form/);assert.deepEqual(h.calls.submit,[]);
 h.command('unskip');assert.match(h.ending(),/data-lb-form/);assert.deepEqual(h.calls.submit,[]);
});

test('published previous lives can rename using metadata only and withdraw after confirmation',async()=>{
 const h=harness();h.setEntries([{...entry,runId:'old-owned-life',nickname:'舊化名'}]);await h.ui.open();
 h.dispatch('submit',h.form('mine',0,'新的背鍋名',true).node);await tick();assert.equal(h.calls.submit.length,0);assert.deepEqual(h.calls.rename,[{runId:'old-owned-life',nickname:'新的背鍋名'}]);assert.match(h.html(),/留名已確認/);
 h.command('withdraw','mine');assert.deepEqual(h.calls.remove,[]);assert.match(h.html(),/確認撤下/);
 h.command('withdraw-confirm','mine');await tick();assert.deepEqual(h.calls.remove,['old-owned-life']);assert.match(h.html(),/目前沒有公開留名/);
});

test('edited names invalidate an earlier public-consent check',async()=>{
 const h=harness(),form=h.form('ending',0,'修改名字',true);
 const input={...form.input,closest:selector=>selector==='[data-lb-form]'?form.node:null,hasAttribute:name=>name==='data-lb-name'};
 h.dispatch('input',input);assert.equal(form.checkbox.checked,false);h.dispatch('submit',form.node);await tick();assert.equal(h.calls.submit.length,0);
});

test('filter requests discard stale responses and do not mix occupations',async()=>{
 const pending=[];const h=harness({cloud:{leaderboard:query=>new Promise(resolve=>pending.push({query,resolve}))}});
 const opening=h.ui.open();assert.equal(pending.length,1);
 h.dispatch('change',{dataset:{lbFilter:'role'},value:'sales'});assert.equal(pending.length,2);
 pending[1].resolve(response({role:'sales',entries:[{...entry,nickname:'業務榜',actualRoleId:'sales'}]}));await tick();
 pending[0].resolve(response({entries:[{...entry,nickname:'過期榜'}]}));await opening;await tick();assert.match(h.html(),/業務榜/);assert.doesNotMatch(h.html(),/過期榜/);
});

test('app wiring adds global and home entry and keeps an optional inline ending prompt',async()=>{
 const [app,index,css]=await Promise.all([readFile(new URL('../dist/app.js',import.meta.url),'utf8'),readFile(new URL('../dist/index.html',import.meta.url),'utf8'),readFile(new URL('../dist/leaderboard-v56.css',import.meta.url),'utf8')]);
 assert.match(app,/typeof createLeaderboardUIV56==='function'/);assert.match(app,/leaderboardUI\.endingHTML\(run\)/);assert.match(app,/leaderboardUI\.mountEnding\(main\)/);assert.match(app,/if\(action==='leaderboard'\)void leaderboardUI\.open\(\)/);assert.match(app,/home-leaderboard-entry/);assert.match(index,/data-action="leaderboard"/);assert.match(index,/leaderboard-v56\.css/);assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/prefers-reduced-motion/);
});

test('own record pagination keeps earlier rows and manages old names outside the first page',async()=>{
 const old={...entry,runId:'older-owned-life',entryId:'older-entry',nickname:'以前的名字'};const queries=[];
 const h=harness({cloud:{myLeaderboard:async({after}={})=>{queries.push(after);return after?{entries:[old],hasMore:false,nextCursor:null}:{entries:[entry],hasMore:true,nextCursor:'opaque-cursor'};},renameLeaderboard:async(runId,nickname)=>({version:1,published:true,entry:{...old,runId,nickname}})}});
 await h.ui.open();assert.match(h.html(),/載入更多我的紀錄/);h.openDetails();h.command('mine-more');assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});await tick();assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});assert.deepEqual(queries,[null,'opaque-cursor']);assert.match(h.html(),/背鍋隊長/);assert.match(h.html(),/以前的名字/);
 h.dispatch('submit',h.form('mine',1,'很久以前的背鍋',true).node);await tick();assert.match(h.html(),/很久以前的背鍋/);assert.match(h.html(),/留名已確認/);assert.equal(queries.length,2);
});

test('authoritative publication and removal replies work without fabricating extra scores',async()=>{
 let unavailable=false;const h=harness({cloud:{submitLeaderboard:async(state,nickname)=>{unavailable=true;return {version:1,published:true,entry:{...entry,runId:state.runId,nickname}};},myLeaderboard:async()=>{if(unavailable)throw new Error('offline');return {entries:[]};},removeLeaderboard:async runId=>({version:1,removed:true,runId})}});
 h.dispatch('submit',h.form().node);await tick();assert.match(h.ending(),/留名已確認/);h.command('withdraw');h.command('withdraw-confirm');await tick();assert.match(h.ending(),/已確認撤下這局留名/);assert.doesNotMatch(h.ending(),/這局已以/);
});

test('malformed public responses stay unavailable instead of displaying made-up ranks',async()=>{
 const h=harness({cloud:{leaderboard:async()=>response({entries:[{...entry,value:9999999,nickname:'不應列出'}]})}});await h.ui.open();assert.match(h.html(),/排行榜目前連不上/);assert.doesNotMatch(h.html(),/不應列出/);
});

test('own-name management and score rules stay expanded through confirmation, mutation and refresh',async()=>{
 const h=harness();h.setEntries([entry]);await h.ui.open();h.openDetails();
 h.command('withdraw','mine');assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});assert.match(h.html(),/<details class="lb-my-entries" open>/);assert.match(h.html(),/data-lb-command="withdraw-confirm"/);
 h.command('withdraw-cancel','mine');assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});assert.doesNotMatch(h.html(),/data-lb-command="withdraw-confirm"/);
 h.dispatch('submit',h.form('mine',0,'還在名單裡',true).node);assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});await tick();assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});assert.match(h.html(),/留名已確認/);
 h.command('refresh');await tick();assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});
 h.command('mine-refresh');assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});await tick();assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});
 h.command('withdraw','mine');h.command('withdraw-confirm','mine');await tick();assert.deepEqual(h.detailsOpen(),{mine:true,rules:true});assert.match(h.html(),/目前沒有公開留名/);
});

test('ending score rules can remain expanded when its name status rerenders',()=>{
 const html=endingLeaderboardHTMLV56(baseRun,{rulesOpen:true,checking:true});assert.match(html,/<details class="lb-rules" open>/);assert.match(html,/正在確認這局是否已留名/);
});

test('a mine read begun before publication cannot remove an acknowledged new listing',async()=>{
 let finishOldRead;const oldRead=new Promise(resolve=>{finishOldRead=resolve;});
 const h=harness({cloud:{myLeaderboard:()=>oldRead,submitLeaderboard:async(run,nickname)=>({version:1,published:true,entry:{...entry,runId:run.runId,nickname}})}});
 const opening=h.ui.open();h.dispatch('submit',h.form('ending',0,'新刊登的名字',true).node);await tick();assert.match(h.ending(),/這局已以/);
 finishOldRead({entries:[]});await opening;await tick();assert.match(h.ending(),/這局已以/);assert.match(h.ending(),/新刊登的名字/);assert.doesNotMatch(h.ending(),/正在確認這局是否已留名/);
});

test('a mine read begun before withdrawal cannot resurrect a removed listing',async()=>{
 let finishOldRead,queries=0;const oldRead=new Promise(resolve=>{finishOldRead=resolve;});
 const h=harness({cloud:{myLeaderboard:()=>++queries===1?Promise.resolve({entries:[entry]}):oldRead,removeLeaderboard:async runId=>({version:1,removed:true,runId})}});
 await h.ui.open();h.command('mine-refresh');h.command('withdraw','ending');h.command('withdraw-confirm','ending');await tick();assert.doesNotMatch(h.ending(),/這局已以/);assert.match(h.ending(),/已確認撤下/);
 finishOldRead({entries:[entry]});await tick();assert.doesNotMatch(h.ending(),/這局已以/);assert.match(h.ending(),/已確認撤下/);assert.doesNotMatch(h.ending(),/正在確認這局是否已留名/);
});
