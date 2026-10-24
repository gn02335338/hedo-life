const el = (tag, className, text) => {
  const node = document.createElement(tag); node.className = className || '';
  if (text != null) node.textContent = text;
  return node;
};
const button = (label, className, action) => {
  const node = el('button', className, label); node.type = 'button';
  node.addEventListener('click', action); return node;
};
export const raceTime = seconds => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.floor(value / 60).toString().padStart(2, '0') + ':' + (value % 60).toFixed(2).padStart(5, '0');
};
function routeArt(route = []) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 260 132'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('race-route-art');
  const shape = (tag, attrs) => { const n = document.createElementNS(svg.namespaceURI, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v)); svg.append(n); };
  const point = p => [18 + (p.x + 133) / 266 * 224, 10 + (p.z + 133) / 266 * 112];
  for (const line of [-120,-60,0,60,120]) {
    shape('path', {d:'M'+point({x:line,z:-133}).join(',')+' L'+point({x:line,z:133}).join(','),stroke:'#b7a1cf20','stroke-width':3});
    shape('path', {d:'M'+point({x:-133,z:line}).join(',')+' L'+point({x:133,z:line}).join(','),stroke:'#b7a1cf20','stroke-width':3});
  }
  if (route.length) {
    shape('polyline', {points:route.map(p=>point(p).join(',')).join(' '),fill:'none',stroke:'#f7bf9c','stroke-width':3.5,'stroke-linejoin':'round'});
    for (const [i,p] of route.entries()) {
      const [cx,cy]=point(p);shape('circle',{cx,cy,r:i?2.6:4,fill:i?'#f6eadf':'#d4f7ce'});
    }
    const [x,y]=point(route[route.length-1]);shape('rect',{x:x-3,y:y-3,width:6,height:6,fill:'#f7bf9c'});
  }
  return svg;
}
export function createRacingPanel({entries,race,car,money,message,onStart,onNavigate,onCollection,onGarage,onRetire,onResume}) {
  const wrap=el('div','race-panel');wrap.id='race-panel';
  const hero=el('div','race-hero');
  const identity=el('div');identity.append(el('span','garage-eyebrow','HEDO AFTERHOURS / STREET SERIES'),el('h3','', '改裝的下一步，是上場。'),el('p','',car?.owned?car.name+' · 引擎 '+(car.upgrades?.engine||0)+'/2 · 煞車 '+(car.upgrades?.brakes||0)+'/2 · 操控 '+(car.upgrades?.handling||0)+'/2':'開自己的愛車到發車區。原廠車也能參加。'));
  const wallet=el('div','garage-wallet');wallet.append(el('small','','可用基金'),el('strong','','$ '+money.toLocaleString('en-US')));hero.append(identity,wallet);wrap.append(hero);
  if(message){const note=el('p','garage-receipt',message);note.setAttribute('role','status');wrap.append(note);}
  if(['countdown','racing'].includes(race.phase)) {
    const current=entries.find(e=>e.id===race.raceId);
    const active=el('div','race-active-card');active.append(el('span','garage-eyebrow','RACE PAUSED / 賽事已暫停'),el('h3','',current?.title||'街頭競速'),el('p','',race.phase==='countdown'?'起跑倒數 '+Math.ceil(race.countdownRemaining):raceTime(race.elapsed)+' · 第 '+race.rank+' 名'),el('p','help-note','時間、對手與城市都會等你回來。退出本場不發獎金，車況與既有基金保留。'));
    const resume=button('回到賽道 ↗','primary',onResume);resume.id='race-resume';const retire=button('退出本場賽事','secondary',onRetire);retire.id='race-retire';active.append(resume,retire);wrap.append(active);return wrap;
  }
  wrap.append(el('p','race-instructions','免報名費。停穩、車頭朝東，倒數後依序通過發光檢查點。Shift 加速、S 煞車；發生碰撞仍可能引來警察。'));
  const grid=el('div','race-grid');
  for(const [index,entry] of entries.entries()) {
    const card=el('article','race-card');card.dataset.raceId=entry.id;
    const top=el('div','race-card-top');top.append(el('span','','0'+(index+1)),el('span','',entry.mode));card.append(top,routeArt(entry.route),el('h3','',entry.title),el('p','race-description',entry.description));
    const stats=el('div','race-card-stats');stats.append(el('span','',entry.length+' m · 限時 '+entry.limit+' 秒'),el('strong','',entry.rewardLabel));card.append(stats);
    card.append(el('small','race-best',entry.best?'個人最佳 '+raceTime(entry.best):'尚未留下完賽紀錄'));
    const start=button('報名 · 3 秒後起跑 ↗','primary',()=>onStart(entry.id));start.dataset.raceStart=entry.id;start.disabled=!entry.eligible.ok;start.title=entry.eligible.message||'使用目前愛車參賽';card.append(start);
    const reason=el('p','race-eligibility',entry.eligible.ok?'愛車已就緒。這場不收報名費。':entry.eligible.message);card.append(reason);
    const route=button('導航到發車區 ↗','text-btn',()=>onNavigate(entry.id));route.dataset.raceRoute=entry.id;card.append(route);grid.append(card);
  }
  wrap.append(grid);
  const footer=el('div','collection-footer');const garage=button('查看性能改裝','secondary',onGarage);garage.id='race-upgrades';footer.append(button('私人車庫／買車','secondary',onCollection),garage,button('回到街頭 ↗','text-btn',onResume));wrap.append(footer);
  wrap.append(el('p','garage-footnote','獎金結算後直接加入城市基金，可重賽賺取。每場只結算一次；離車、換車、報廢、死亡或被捕會中止賽事。暫停不耗比賽時間，重新整理不會保留進行中的比賽。'));
  return wrap;
}
