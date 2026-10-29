// A user-supplied comic premise, adapted as original workplace fiction. This
// scene establishes an awkward encounter, never a real person's relationship.
export const isLifeV75=value=>/^e39-r75-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');

export const TYPHOON_STORY_V75=Object.freeze({
 title:'颱風假，好市多的冷凍櫃先輸給你們的眼神。',
 body:'颱風假的採買途中，你陪家人推著滿車衛生紙轉進好市多冷凍區，迎面竟是翅膀和魚酥姐。兩人的手剛才都搭在同一側推車把手上，看見你便各自鬆開，現場安靜得只剩冷凍櫃運轉。上週部門聚餐，你才向翅膀夫人敬過酒；現在連一句「家人也來了」都卡在喉嚨。你只看見他們同行，不知道私人關係，腦中卻已經把年終考績和履歷更新排成平行工作。',
 participants:Object.freeze(['hidden-visitor','wing']),
 verbal:'幹，放假買衛生紙還得兼任表情管理？你們買你們的，別把我的考績放進這台推車；我不是來替誰保密，也不是來替誰編故事。',
 choices:Object.freeze([
  Object.freeze({text:'照常打招呼，推車讓路；私事不猜，考績照工作紀錄。',result:'你說聲「採買辛苦了」，把推車讓到旁邊，沒有追問也沒有承諾什麼。翅膀點頭，魚酥姐接著去找清單上的東西。回公司後你照常交付並收好紀錄，這次擦肩沒有自動決定年終。最冷的那三秒，最後只有冷凍水餃替你作證。'}),
  Object.freeze({text:'先離開冷凍區，回家更新履歷，也整理自己的交付紀錄。',result:'你把原本就想做的履歷更新完，順手備份能公開的作品與自己的交付紀錄，沒有替賣場偶遇下結論。下次談考績時，你拿得出做過什麼，也多了一條可以自己選的路。求職網站問你是否積極找工作，你第一次覺得這題比主管的眼神好回答。'}),
  Object.freeze({text:'把衛生紙舉成記者會背板：「本席只說明今日採買，考績請走正式議程。」',result:'你對著十二捲衛生紙一本正經地宣布，家人先推你離開走道，魚酥姐忍不住笑出聲。翅膀說買東西不用開會，你回答那太好了，今天也不用附會議紀錄。推車各走各的，沒有成立封口協議，衛生紙卻成了你履歷裡不能寫的危機處理經驗。'})
 ])
});

export function resolveTyphoonChoiceV75(run,index,draw){
 const context=run.hiddenEncounterContext;
 if(context.stage===1){
  if(index<0||index>2)throw Error('Unavailable typhoon aftermath');
  return {mode:'aftermath',label:['先確認現場安全','留下各自的說明','讓走道恢復通行'][index],result:[
   '你把推車停到不擋路的位置，請賣場人員協助確認狀況；需要看傷就先安排，不再隔著家人和整車日用品放話。偶遇和剛才的衝突分開處理，沒有人替私人關係下結論。',
   '你請現場的人記下實際看見的動作與原話，需要後續說明再各自聯繫。同行採買不等於任何關係證明，考績也沒有因此被你簽成交換條件。',
   '你先扶正衛生紙，把推車退到一旁，請家人帶著採買清單往前走。現場的人確認彼此狀況，讓走道恢復通行；記者會散場，該面對的衝突仍照實留下。'
  ][index],delta:{mood:draw<.35?3:-2,energy:-3},done:true};
 }
 if(index>=0&&index<=2)return {mode:'normal',label:['冷凍區的禮貌距離','替自己多留一條路','衛生紙記者會散場'][index],result:TYPHOON_STORY_V75.choices[index].result,delta:[{mood:5,trust:2,energy:-2,skill:3},{mood:7,energy:-3,skill:4},{mood:10,trust:-1,energy:-2,slack:4}][index],done:true};
 if(index===3){
  const serious=draw>.87;
  return {mode:'verbal',label:serious?'賣場插曲需要留下說明':draw<.25?'冷凍櫃接住了全場沉默':'魚酥姐請你別替她編劇',result:serious?'翅膀反問你到底在暗示什麼，魚酥姐請賣場人員協助，先把雙方分開。你說過的話需要照實交代，沒有因為叫得大聲就變成私人關係的證據。':draw<.25?'翅膀沒有接話，魚酥姐把採買清單折好，推車從你身邊過去。家人小聲問你是不是在開工作會議，你看著滿車衛生紙，第一次希望它真的能擦掉空氣。':'魚酥姐說：「你有工作問題可以講，別看見同行就替我寫故事。」翅膀也請你把音量放低。你們各自退開，賣場沒有替任何人公布年終，這段關係卻得另外修補。',delta:{mood:draw<.25?5:-8,trust:-5,energy:-3},done:!serious,incident:serious?'verbal':null};
 }
 if(index===4){
  const real=draw<(run.stats.mood<=30?.5:.22);
  return real?{mode:'real',label:'推車旁真的失控了',result:'你真的揮了手，推車撞出聲響，一包衛生紙滑到地上。賣場人員立刻把你和魚酥姐隔開，翅膀退到旁邊協助騰出走道。這不是腦內電影，也不是揭發什麼，你得先面對剛才實際發生的動作。',delta:{mood:-5,energy:-8,trust:-5},done:false,incident:'real'}:{mode:'imagined',label:'衛生紙慢動作，只在腦中上映',result:'腦中十二捲衛生紙像煙幕一樣炸開，你還替自己配了下班英雄的音樂。眨眼後，推車一動沒動，你的手仍放在把手上。剛才只是想像；你帶著家人走向結帳區，沒有把一場尷尬偶遇變成出手的理由。',delta:{mood:8,energy:-2},done:true};
 }
 throw Error('Unavailable typhoon choice');
}
