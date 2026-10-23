// This view draws only the public board or a committed round. Dice and points
// are supplied by the engine after submission; the view never rolls or scores.
import {CAMEL_NAMES_V65} from './camel-v65.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const names=CAMEL_NAMES_V65,colors=['#bb6441','#367582','#8b659d'];
const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const permutation=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isInteger)&&[...value].sort().join(',')==='0,1,2';
const boardValid=board=>Array.isArray(board)&&board.length>=1&&board.length<=3&&board.every(group=>group&&int(group.position,0,18)&&Array.isArray(group.stack)&&group.stack.length>0&&group.stack.every(id=>int(id,0,2)))&&permutation(board.flatMap(group=>group.stack));
const tag=(id,labels)=>`<span class="camel-name-tag" style="--camel-color:${colors[id]}"><i aria-hidden="true"></i>${esc(labels[id])}</span>`;
export function camelBoardHTMLV65(board,labels=names,round=0,steps=6){
 if(!boardValid(board)||!Array.isArray(labels)||labels.length!==3)return '';
 const positions=labels.map((_,id)=>board.find(group=>group.stack.includes(id)).position);
 return `<div class="camel-board"><div class="camel-board-heading"><div><span class="camel-kicker">PAPER CAMEL / 桌上賽道</span><h3>三張名牌，誰在前面？</h3></div><span class="camel-round-count">已揭曉 ${round} / ${steps} 輪</span></div><div class="camel-lanes" aria-label="目前三位的賽道位置">${labels.map((name,id)=>`<div class="camel-lane" style="--camel-color:${colors[id]}"><div class="camel-lane-title"><b>${esc(name)}</b><small>第 ${positions[id]} 格</small></div><div class="camel-lane-track" role="img" aria-label="${esc(name)}，目前在第 ${positions[id]} 格"><i class="camel-marker" style="--camel-position:${positions[id]/18*100}%" aria-hidden="true"><span>${id+1}</span></i></div></div>`).join('')}</div><div class="camel-track-scale" aria-hidden="true"><span>起點 0</span><span>6</span><span>12</span><span>18</span></div><div class="camel-stack-list" aria-label="同格疊堆順序">${[...board].sort((a,b)=>b.position-a.position).map(group=>`<div class="camel-stack"><small>第 ${group.position} 格${group.stack.length>1?'・由下往上':''}</small><div class="camel-stack-names">${group.stack.map((id,index)=>`${index?'<span aria-hidden="true">↑</span>':''}${tag(id,labels)}`).join('')}</div></div>`).join('')}</div><p class="camel-stack-order">同一格時，上層排在前面。畫面用紙名牌表示位置，不需要真人堆疊。</p></div>`;
}

export function camelBodyHTMLV65(state){
 const d=state.camelPresentation;if(!d||!boardValid(d.board))return '';
 const locked=Array.isArray(d.prediction),labels=d.names,prediction=state.prediction;
 return `<div class="camel-game-v65">${camelBoardHTMLV65(d.board,labels,d.round,d.steps)}<section class="camel-plan-v65" aria-label="整場名次預測"><div class="camel-plan-heading"><div><span class="camel-kicker">YOUR PICK / 整場預測</span><h3>${locked?'賽前那張紙，已經封存。':'先排好你心中的前三名。'}</h3><p>${locked?'名次預測已在第一輪送出，這一輪只選你支持誰。':'用上下箭頭調整。第一輪送出後，這份預測就不再修改。'}</p></div></div><ol class="camel-prediction">${prediction.map((id,index)=>`<li><span class="camel-prediction-rank">第 ${index+1} 名</span><b>${esc(labels[id])}</b>${locked?'':`<span class="camel-rank-buttons"><button type="button" data-play-command="camel-up" data-play-value="${index}" aria-label="把${esc(labels[id])}往前排一名"${index===0?' disabled':''}>↑</button><button type="button" data-play-command="camel-down" data-play-value="${index}" aria-label="把${esc(labels[id])}往後排一名"${index===2?' disabled':''}>↓</button></span>`}</li>`).join('')}</ol>${locked?'<p class="camel-locked-note"><span aria-hidden="true">▣</span>這是已提交的預測。新一輪的骰色與點數還沒揭曉。</p>':''}</section><fieldset class="camel-support"><legend>第 ${d.round+1} 輪，你猜誰會領先？</legend><div class="camel-support-grid">${labels.map((name,id)=>`<button type="button" data-play-command="camel-support" data-play-value="${id}" style="--camel-color:${colors[id]}" aria-pressed="${state.camelMove===id}"><span class="camel-support-symbol" aria-hidden="true">♞</span><b>${esc(name)}</b><small>${state.camelMove===id?'這輪支持他':'選擇本輪支持'}</small></button>`).join('')}</div></fieldset><details class="camel-rules"><summary>疊駱駝怎麼走？</summary><ol>${d.rules.map(rule=>`<li>${esc(rule)}</li>`).join('')}</ol></details></div>`;
}

export function dietTeamHTMLV65(descriptor){
 if(!Array.isArray(descriptor?.teams)||descriptor.teams.length!==3)return '';
 const selected=typeof descriptor.team==='number'?descriptor.teams[descriptor.team]?.id:descriptor.team;
 return `<aside class="diet-teams-v65" aria-label="減肥比賽三隊"><span class="play-kicker">JACK'S CALENDAR CUP / 三隊出發</span><h3>傑克揪的比賽，行事曆先交出來。</h3><p>三隊一起參加，七天仍然照自己的步調安排。這裡不用填體重，也不拿別人的身材評分。</p><div class="diet-team-grid">${descriptor.teams.map(team=>`<div class="diet-team-card"${team.id===selected?' aria-current="true"':''}>${/^[a-z_]+$/.test(team.id)?`<img src="./assets/${esc(team.id)}.png" alt="" loading="lazy">`:''}<b>${esc(team.name)}</b><small>${team.id===selected?'你這次加入的隊伍':'同場參賽'}</small></div>`).join('')}</div><p class="diet-organizer-v65">主辦：傑克。計畫可以有點心，也可以有休息日。</p></aside>`;
}

export function renderCamelActivityResultV65(row,compact=false){
 const c=row?.activityOutcome?.camel;
 if(row?.kind!=='activity'||row.activityOutcome?.id!=='camel'||c?.version!==1||!int(c.round,1,6)||!int(c.move,0,2)||!int(c.color,0,2)||!int(c.die,1,3)||!boardValid(c.before)||!boardValid(c.after)||!permutation(c.ranking)||typeof c.hit!=='boolean'||!int(c.points,0,12)||!int(c.finalHits,0,3)||typeof c.done!=='boolean')return '';
 return `<section class="camel-result-v65 camel-game-v65${compact?' compact':''}" aria-label="第${c.round}輪已揭曉賽況"><div class="camel-result-heading"><div><span class="camel-kicker">ROUND ${c.round} / DICE REVEALED</span><h3>${esc(names[c.color])}這一骰，走 ${c.die} 格。</h3></div><span class="camel-result-die" style="--camel-color:${colors[c.color]}" aria-label="已揭曉骰點${c.die}">${c.die}<small>已揭曉</small></span></div><p>你這輪支持${esc(names[c.move])}，${c.hit?'猜中這輪領先者。':'這輪領先的是'+esc(names[c.ranking[0]])+'。'}</p><div class="camel-result-score"><span>目前活動點 ${c.points}</span>${c.done?`<span>整場名次預測命中 ${c.finalHits} / 3 位</span>`:''}<span>${c.done?'六輪完成':'下一輪還沒擲骰'}</span></div>${compact?'':camelBoardHTMLV65(c.after,names,c.round,6)}<p class="camel-result-ranking">${c.done?'最後':'本輪'}順序：${c.ranking.map(id=>esc(names[id])).join(' → ')}。</p></section>`;
}
