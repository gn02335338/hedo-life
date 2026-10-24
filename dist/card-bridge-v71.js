// Career choices and card draws have separate state and random streams.
// Opening the card room never advances the current office scene.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const proofOf=run=>JSON.stringify([run?.runId,run?.roleId,run?.seed,run?.actions]);

export function cardInvitationHTMLV71(run,last){
 if(!run?.pending||!run.flags?.cards71_invited||last?.choiceIndex!==0||!['alice71-first-pull','alice71-game-invite'].includes(last?.eventId))return '';
 return `<aside class="card-invitation"><span aria-hidden="true">✦</span><div><b>愛麗絲把抽卡室傳給你了。</b><p>這一幕已經記下。另開分頁組牌、闖關，回來還能接著上班。</p><a href="/cards/" target="_blank" rel="noopener">去移動抽卡遊戲 ↗</a></div></aside>`;
}

export function createCardBridgeV71({cloud,getRun=()=>null,getScreen=()=>'',document:doc=globalThis.document}={}){
 const received=new Map(),pending=new Set();
 function endingHTML(run){
  if(!run?.completed||!run.runId)return '';
  const key=proofOf(run),result=received.get(key),busy=pending.has(key)&&!result;
  const message=result?(result.ticketsAwarded>0?`${result.duplicate?'這局先前已領取':'這局獲得'} ${result.ticketsAwarded} 張抽卡券。卡券已存進你的匿名收藏。`:'這局沒有新增卡券。至少完成 3 個工作回合，再依結算積分領券；同一局只能領一次。'):'至少完成 3 個工作回合，再依結算積分領取免費卡券。每局最多 12 張，同一局只領一次，不必留名上榜。';
  return `<section class="ending-card-room" aria-labelledby="ending-card-title"><img src="./assets/alice.png" alt="愛麗絲，移動手遊王" loading="lazy"><div><span class="eyebrow">NEXT CHAPTER / 移動抽卡遊戲</span><h2 id="ending-card-title">人生收尾，手氣接棒。</h2><p data-card-claim-status role="status">${escape(message)}</p><div class="card-room-actions"><button class="secondary" data-action="claim-cards" ${busy||result?'disabled':''}>${busy?'正在核對這局紀錄…':result?'本局已核對':'領取本局抽卡券'}</button><a class="primary" href="/cards/">進入抽卡室 <span aria-hidden="true">↗</span></a></div><small>人物、物品、事件卡都能收集；先用入門牌組闖關也可以。免費遊玩，沒有付費抽卡。</small></div></section>`;
 }
 async function claim(){
  const run=getRun();
  if(getScreen()!=='ending'||!run?.completed||!run.runId)return false;
  const key=proofOf(run);
  if(pending.has(key)||received.has(key))return false;
  const proof={completed:true,runId:run.runId,roleId:run.roleId,seed:run.seed,actions:structuredClone(run.actions)};
  pending.add(key);
  const button=doc?.querySelector('[data-action="claim-cards"]');
  if(button){button.disabled=true;button.textContent='正在核對這局紀錄…';}
  try{
   const result=await cloud.claimCards(proof);
   received.set(key,result);
   if(getScreen()==='ending'&&proofOf(getRun())===key){
    const panel=doc?.querySelector('.ending-card-room');
    if(panel)panel.outerHTML=endingHTML(getRun());
   }
   return result;
  }catch(error){
   if(getScreen()==='ending'&&proofOf(getRun())===key){
    const status=doc?.querySelector('[data-card-claim-status]');
    if(status)status.textContent=error?.status===400?error.message:error?.status===429?'手速比伺服器快了，稍等幾秒再領。這局紀錄仍保留著。':error?.status===409?'這份人生紀錄和已同步的版本不同，暫時無法領券。原有收藏不受影響。':'暫時無法核對紀錄，稍後可重新領取；同一局重試不會重複發券。';
    const retry=doc?.querySelector('[data-action="claim-cards"]');
    if(retry){retry.disabled=false;retry.textContent='重新領取本局抽卡券';}
   }
   return false;
  }finally{pending.delete(key);}
 }
 return{endingHTML,claim};
}
