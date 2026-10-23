import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {displayPersona,displayText} from '../dist/persona.js';

// The descriptor is the public engine boundary. This harness exercises the
// actual view/controller without injecting a win, a probability, or saved stats.
const source=readFileSync(new URL('../dist/shareholders-ui-v58.js',import.meta.url),'utf8');
const context=vm.createContext({getShareholderPlayV58:run=>run?.pending||run?.completed?null:run?.view||null,displayPersona,displayText});
vm.runInContext(source.replace(/^import .*;\n/gm,'').replace(/export function /g,'function '),context);
const render=run=>context.shareholderGameHTMLV58(run),mount=(root,options)=>context.mountShareholderGameV58(root,options);
const copy=value=>JSON.parse(JSON.stringify(value));
const descriptor=()=>({version:1,eventId:'shareholder58-hearing-0',round:0,roundLabel:'機會與保證',title:'今天，請把大好機會說清楚。',speaker:'wing',wing:'大企業都認股了，員工更該把握。',
 statements:[{id:0,text:'投資人名單就在這裡。',pressed:false},{id:1,text:'時間到了自然會上市。',pressed:false},{id:2,text:'員工拿到的條件都一樣。',pressed:false}],
 evidence:Array.from({length:6},(_,i)=>({id:`file-${i}`,title:`文件 ${i+1}`,body:`第 ${i+1} 份文件的內文，日期與條件都可以慢慢核對。`})),credibility:3,pressure:1,jackHint:'早知道拿去買正2，現在就財富自由了。',feedback:null});
const tick=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function controls({view=descriptor(),onPlay,runId}={}){
 const run={view,...(runId?{runId}:{})},snapshot=copy(run),events=new Map(),commits=[],doc={activeElement:null},nodes=[];
 const panel={ownerDocument:doc,innerHTML:render(run),matches:()=>true,contains:node=>node?.outside!==true,querySelectorAll:()=>nodes,addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{if(events.get(type)===fn)events.delete(type);}};
 const cleanup=mount(panel,{run,onPlay:input=>{commits.push(copy(input));return onPlay?.(input);}});
 const target=(command,value,extra={})=>({dataset:{shareholderCommand:command,...(value===undefined?{}:{shareholderValue:String(value)})},disabled:false,...extra});
 const click=(command,value,extra={})=>{const node=target(command,value,extra);events.get('click')?.({target:{closest:()=>node},stopPropagation(){}});};
 const repeat=()=>{let prevented=false;events.get('keydown')?.({repeat:true,key:'Enter',target:{closest:()=>target('press')},preventDefault(){prevented=true;}});return prevented;};
 return {run,snapshot,panel,events,commits,cleanup,click,repeat,doc,nodes,target};
}

test('the hearing displays six participants, Jack, all testimony and six readable documents',()=>{
 const view=descriptor(),run={view},before=copy(run),html=render(run);
 assert.deepEqual(run,before);assert.match(html,/data-shareholder-game-v58/);assert.match(html,/第 1 \/ 4 輪/);
 for(const id of ['wing','spencer','erich','jenjen','janet','sonny','jack'])assert.ok(html.includes(`./assets/${id}.png`),id);
 for(const row of view.statements)assert.ok(html.includes(row.text));
 for(const row of view.evidence){assert.ok(html.includes(row.title));assert.ok(html.includes(row.body));}
 assert.match(html,/發言可信度/);assert.match(html,/會場壓力/);assert.match(html,/正2/);assert.match(html,/不計手速/);
 assert.match(html,/data-shareholder-command="present" class="shareholder-present" disabled/);
 assert.match(html,/role="status" aria-live="polite"/);assert.match(html,/aria-current="step"/);
 assert.doesNotMatch(html,/correctEvidence|rightStatement|chanceOutcome|successRate|機率\s*\d|好感\s*[+-]\d/);
 assert.equal(render({...run,pending:true}),'');assert.equal(render({...run,completed:true}),'');assert.equal(render({}),'');
});

test('testimony and evidence selection remain drafts until an explicit statement is committed',()=>{
 const ui=controls();ui.click('present');assert.equal(ui.commits.length,0);
 ui.click('statement',2);ui.click('evidence','file-4');ui.click('evidence','file-1');
 assert.equal(ui.commits.length,0);assert.deepEqual(ui.run,ui.snapshot);assert.match(ui.panel.innerHTML,/文件已放到手邊，還沒提出/);
 assert.match(ui.panel.innerHTML,/手邊文件：文件 2/);
 ui.click('present');ui.click('present');ui.click('press');ui.click('yield');
 assert.deepEqual(ui.commits,[{mode:'present',statement:2,evidence:'file-1'}]);
 assert.match(ui.panel.innerHTML,/這次發言已送出/);ui.cleanup();
});

test('questioning submits the selected statement without an evidence selection',()=>{
 const ui=controls();ui.click('statement',1);ui.click('evidence','file-5');ui.click('press');ui.click('press');
 assert.deepEqual(ui.commits,[{mode:'press',statement:1,evidence:null}]);assert.deepEqual(ui.run,ui.snapshot);ui.cleanup();
});

test('already questioned statements cannot be questioned twice, but still accept evidence',()=>{
 const view=descriptor();view.statements[0].pressed=true;view.feedback='對方回答：具體日期之後再說。';
 const ui=controls({view});assert.match(ui.panel.innerHTML,/這句已追問過/);assert.match(ui.panel.innerHTML,/具體日期之後再說/);
 ui.click('press');assert.equal(ui.commits.length,0);ui.click('evidence','file-3');ui.click('present');
 assert.deepEqual(ui.commits,[{mode:'present',statement:0,evidence:'file-3'}]);ui.cleanup();
});

test('yield is an explicit action, while invalid draft controls and unrelated clicks do nothing',()=>{
 const ui=controls();ui.click('statement',12);ui.click('evidence','not-a-file');ui.click('missing');ui.click('press',undefined,{outside:true});ui.click('press',undefined,{disabled:true});
 assert.equal(ui.commits.length,0);assert.deepEqual(ui.run,ui.snapshot);ui.click('statement',2);ui.click('yield');
 assert.deepEqual(ui.commits,[{mode:'yield',statement:0,evidence:null}]);ui.cleanup();
});

test('a rejected action preserves local selections and unlocks a deliberate retry',async()=>{
 const ui=controls({onPlay:()=>false});ui.click('statement',1);ui.click('evidence','file-2');ui.click('present');await tick();
 assert.match(ui.panel.innerHTML,/目前進度已有變動/);assert.match(ui.panel.innerHTML,/手邊文件：文件 3/);
 ui.click('present');await tick();assert.equal(ui.commits.length,2);assert.deepEqual(ui.commits[0],ui.commits[1]);ui.cleanup();
});

test('failed callbacks do not report a result or change resources, and can be retried',async()=>{
 for(const onPlay of [()=>{throw new Error('test');},()=>Promise.reject(new Error('test'))]){
  const ui=controls({onPlay});ui.click('press');await tick();assert.match(ui.panel.innerHTML,/這次發言尚未完成/);assert.deepEqual(ui.run,ui.snapshot);
  ui.click('press');await tick();assert.equal(ui.commits.length,2);ui.cleanup();
 }
});

test('native controls retain keyboard focus, ignore held keys, and remove every listener on cleanup',async()=>{
 let reject;const ui=controls({onPlay:()=>new Promise(resolve=>reject=resolve)}),focused=ui.target('statement',1);let restored=0;
 focused.focus=()=>restored++;ui.nodes.push(focused);ui.doc.activeElement=focused;
 ui.click('statement',1);assert.equal(restored,1);assert.equal(ui.repeat(),true);
 ui.click('press');const lockedHTML=ui.panel.innerHTML;ui.cleanup();assert.equal(ui.events.size,0);
 reject(false);await tick();assert.equal(ui.panel.innerHTML,lockedHTML,'an old promise cannot repaint a later scene');
 ui.click('yield');assert.equal(ui.commits.length,1);assert.deepEqual(ui.run,ui.snapshot);
});

test('local drafts survive a pending result in the same round, but never carry a lock, another round, or another life',()=>{
 const runId='shareholder-ui-cache-life',first=controls({runId});
 first.click('statement',1);first.click('evidence','file-4');first.click('press');first.cleanup();
 const view=descriptor();view.statements[1].pressed=true;view.feedback='剛才已經說清楚這一句。';
 const second=controls({runId,view});assert.match(second.panel.innerHTML,/data-shareholder-value="1" aria-pressed="true"/);assert.match(second.panel.innerHTML,/手邊文件：文件 5/);
 second.click('present');assert.deepEqual(second.commits,[{mode:'present',statement:1,evidence:'file-4'}],'a returned view is unlocked and keeps the deliberate target');second.cleanup();
 const next=controls({runId,view:{...descriptor(),round:1}});assert.match(next.panel.innerHTML,/data-shareholder-value="0" aria-pressed="true"/);assert.match(next.panel.innerHTML,/尚未選文件/);next.cleanup();
 const rollback=controls({runId});assert.match(rollback.panel.innerHTML,/data-shareholder-value="0" aria-pressed="true"/);assert.match(rollback.panel.innerHTML,/尚未選文件/);rollback.cleanup();
 const other=controls({runId:'a-different-shareholder-life'});assert.match(other.panel.innerHTML,/data-shareholder-value="0" aria-pressed="true"/);assert.match(other.panel.innerHTML,/尚未選文件/);other.cleanup();
});

test('the local draft cache retains at most eight lives and discards a document no longer available',()=>{
 const source=controls({runId:'cache-eviction-source'});source.click('statement',2);source.click('evidence','file-4');source.cleanup();
 for(let i=0;i<8;i++){const later=controls({runId:`cache-eviction-later-${i}`});later.cleanup();}
 const evicted=controls({runId:'cache-eviction-source'});assert.match(evicted.panel.innerHTML,/data-shareholder-value="0" aria-pressed="true"/);assert.match(evicted.panel.innerHTML,/尚未選文件/);evicted.cleanup();
 const limited=controls({runId:'cache-limited-files'});limited.click('evidence','file-4');limited.cleanup();
 const view=descriptor();view.evidence=view.evidence.filter(file=>file.id!=='file-4');const refreshed=controls({runId:'cache-limited-files',view});assert.match(refreshed.panel.innerHTML,/尚未選文件/);refreshed.click('present');assert.equal(refreshed.commits.length,0);refreshed.cleanup();
});

test('dialogue and document text are escaped without exposing hidden engine fields',()=>{
 const view=descriptor();view.wing='<script>不可執行</script>';view.evidence[0].title='" onclick="bad()';view.evidence[0].body='<img src=x onerror=bad()>';view.correctEvidence='不要出現在畫面';
 const html=render({view});assert.ok(html.includes('&lt;script&gt;不可執行&lt;/script&gt;'));assert.ok(html.includes('&lt;img src=x onerror=bad()&gt;'));
 assert.doesNotMatch(html,/<script>|<img src=x|不要出現在畫面|correctEvidence/);
});

test('meeting styles include phone layouts, visible focus, readable documents and reduced-motion support',()=>{
 const css=readFileSync(new URL('../dist/shareholders-v58.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/@media\(max-width:360px\)/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.shareholder-file-body\{font-size:11px/);assert.match(css,/touch-action:manipulation/);
});
