import { buildEndingReport } from './ending-report.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value)?Math.round(value):'—';
const position=(value,max=100)=>Number.isFinite(value)?Math.max(0,Math.min(max,value))/max*100:0;
const fixed=value=>Number(value.toFixed(2));
const deltaText=row=>row.delta===null?'起點未記錄':row.delta===0?'持平':`${row.delta>0?'增加':'減少'} ${Math.abs(row.delta)}`;
const deltaHTML=row=>`<span class="report-change ${row.delta===null?'unknown':row.delta>0?'rise':row.delta<0?'fall':'flat'}">${row.delta===null?'—':row.delta>0?'↗':row.delta<0?'↘':'→'} ${escape(deltaText(row))}</span>`;
function statRow(row){
 const final=number(row.end),start=number(row.start);
 return `<div class="report-stat-row" data-report-stat="${escape(row.key)}"><div class="report-stat-head"><span>${escape(row.label)}</span><span class="report-stat-values"><small>${start}</small><span aria-hidden="true">→</span><b>${final}</b></span></div><div class="report-compare-track" role="img" aria-label="${escape(row.label)}，${row.start===null?'起點未記錄':`起點 ${start}`}，離場 ${final}，滿刻度 100"><span class="report-end-bar" style="width:${position(row.end)}%"></span>${row.start!==null?`<i class="report-start-marker" style="left:${position(row.start)}%" aria-hidden="true"></i>`:''}</div>${deltaHTML(row)}</div>`;
}
function abilityChart(rows){
 const center={x:160,y:137},radius=88,angles=[-90,30,150];
 const point=(index,value)=>{const radians=angles[index]*Math.PI/180;return `${fixed(center.x+Math.cos(radians)*radius*value/100)},${fixed(center.y+Math.sin(radians)*radius*value/100)}`;};
 const polygon=values=>values.map((value,index)=>point(index,value)).join(' ');
 const startKnown=rows.every(row=>row.start!==null),endKnown=rows.every(row=>row.end!==null);
 const summary=rows.map(row=>`${row.label}：${row.start===null?'起點未記錄':`起點 ${row.start}`}，離場 ${number(row.end)}`).join('；');
 return `<figure class="report-ability-figure"><svg class="report-ability-chart" viewBox="0 0 320 242" role="img" aria-label="三項能力輪廓。${escape(summary)}"><g class="report-radar-grid">${[25,50,75,100].map(value=>`<polygon points="${polygon([value,value,value])}"/>`).join('')}${angles.map((_,index)=>`<line x1="160" y1="137" x2="${point(index,100).split(',')[0]}" y2="${point(index,100).split(',')[1]}"/>`).join('')}</g>${startKnown?`<polygon class="report-radar-start" points="${polygon(rows.map(row=>row.start))}"/>`:''}${endKnown?`<polygon class="report-radar-end" points="${polygon(rows.map(row=>row.end))}"/>${rows.map((row,index)=>{const [cx,cy]=point(index,row.end).split(',');return `<circle class="report-radar-dot" cx="${cx}" cy="${cy}" r="3.5"/>`;}).join('')}`:''}<g class="report-radar-labels"><text x="160" y="24" text-anchor="middle">工作能力</text><text x="265" y="208" text-anchor="middle">偷懶能力</text><text x="53" y="208" text-anchor="middle">舔老闆能力</text><text class="report-axis-value" x="166" y="48">100</text><text class="report-axis-value" x="166" y="94">50</text></g></svg><figcaption class="report-chart-key">${startKnown?'<span><i class="key-start"></i>起點</span>':''}<span><i class="key-end"></i>離場</span><span class="report-key-note">各項刻度 0–100</span></figcaption></figure>`;
}
const COLORS={mood:'#c81e60',energy:'#237b87',cash:'#936313'};
function trendChart(report){
 const trends=report.trends.filter(row=>row.available&&row.points.length>1),width=420,left=52,right=405,top=16,bottom=190;
 const lastIndex=Math.max(1,report.metadata.decisionCount);
 const x=index=>fixed(left+(right-left)*index/lastIndex),y=value=>fixed(bottom-(bottom-top)*value/100);
 if(!trends.length)return '<div class="report-chart-empty"><span aria-hidden="true">∿</span><p>這份紀錄沒有完整的變化過程，先看離場時的數值。</p></div>';
 return `<figure class="report-trend-figure"><svg class="report-trend-chart" viewBox="0 0 ${width} 225" role="img" aria-label="心情、體力與存款指數的選擇進程折線圖，縱軸 0 到 100；每一點代表一次已結算選擇，同一天可能有多點"><g class="report-trend-grid">${[0,25,50,75,100].map(value=>`<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text x="40" y="${y(value)+3}" text-anchor="end">${value}</text>`).join('')}</g>${trends.map(row=>`<polyline class="report-trend-line trend-${row.key}" stroke="${COLORS[row.key]}" points="${row.points.map(p=>`${x(p.decisionIndex)},${y(p.value)}`).join(' ')}"/>${row.points.map((p,index)=>index===0||index===row.points.length-1?`<circle cx="${x(p.decisionIndex)}" cy="${y(p.value)}" r="3.5" fill="${COLORS[row.key]}" stroke="#fff" stroke-width="1.5"/>`:'').join('')}`).join('')}<g class="report-trend-axis"><text x="${left}" y="210">起點</text><text x="${right}" y="210" text-anchor="end">離場</text><text x="220" y="210" text-anchor="middle">選擇進程 →</text></g></svg><figcaption>每個轉折是一次選擇；休息、人事與飯局也會留下記錄。</figcaption></figure>`;
}
function trendSummary(report){
 return `<div class="report-trend-summary">${report.trends.map(trend=>{
  const row=report.stats.find(row=>row.key===trend.key);
  return `<div class="report-trend-item" data-trend-key="${escape(row.key)}"><div class="report-trend-name"><i class="trend-swatch trend-${row.key}" style="--series-color:${COLORS[row.key]}" aria-hidden="true"></i><span>${row.key==='cash'?'存款指數':escape(row.label)}</span></div><span class="report-trend-values"><small>${number(row.start)}</small><span aria-hidden="true">→</span><b>${number(row.end)}</b></span>${deltaHTML(row)}</div>`;
 }).join('')}</div>`;
}

export function renderEndingReport(run){
 if(!run?.completed)return '';
 const report=buildEndingReport(run),context=report.stats.filter(row=>['boss','trust','dream'].includes(row.key));
 return `<section class="ending-report" aria-labelledby="ending-report-title"><div class="report-heading"><div><span class="eyebrow">THIS LIFE / REPORT</span><h2 id="ending-report-title">這次上班，留下什麼？</h2></div><p>起點與離場放在一起，看看這一路怎麼變。</p></div>${!report.metadata.complete?'<p class="report-data-note">部分起點未記錄，以「—」表示；離場數值照常保留。</p>':''}<div class="report-main-grid"><article class="report-panel report-abilities"><div class="report-panel-heading"><span>01 / 能力輪廓</span><h3>最後，練成了哪種本事？</h3></div>${abilityChart(report.abilities)}<div class="report-ability-rows">${report.abilities.map(statRow).join('')}</div></article><article class="report-panel report-resources"><div class="report-panel-heading"><span>02 / 上班的代價</span><h3>心情、體力，還有荷包。</h3></div>${trendChart(report)}${trendSummary(report)}<p class="report-footnote">存款以遊戲指數 0–100 顯示，不是金額。曲線不代表每天的收入或消費。</p></article></div><article class="report-panel report-context"><div class="report-panel-heading"><span>03 / 留在公司的那些事</span><h3>翅膀的心情，你的人情與大餅。</h3></div><div class="report-context-rows">${context.map(statRow).join('')}</div><p class="report-footnote">虛線標記是起點，色條是離場；升降只表示數值變化。</p></article></section>`;
}
