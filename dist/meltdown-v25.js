// Original office outbursts. Repeated crashes cost more and recover less;
// the self-destruct branch concerns work and reputation, never bodily harm.
const choice=(text,result,delta,effect,flags=[])=>({text,detail:'',result,delta,effect,flags});
const PROFILES=Object.freeze([
 {cost:18,mood:50,energy:22,unpaidMood:20,unpaidEnergy:10,unpaidTrust:12,cut:10},
 {cost:26,mood:38,energy:18,unpaidMood:14,unpaidEnergy:8,unpaidTrust:16,cut:15},
 {cost:36,mood:28,energy:14,unpaidMood:10,unpaidEnergy:6,unpaidTrust:20,cut:20},
 {cost:48,mood:18,energy:10,unpaidMood:6,unpaidEnergy:4,unpaidTrust:24,cut:25}
]);
export function moodCollapseStageV25(run){return Math.max(1,Math.min(4,run.flags.mood_crash_count||1));}
export function moodCollapseProfileV25(run){return PROFILES[moodCollapseStageV25(run)-1];}
const scene=(id,title,body,run,choices)=>({id,title,body,choices,speaker:'self',kind:'crisis',era:`情緒失控・第 ${moodCollapseStageV25(run)} 階段`,wing:'工作先停下來。這次要處理的，是你已經撐不下去的狀態。',sourceIds:['characterFiction'],meltdownStage:moodCollapseStageV25(run),meltdownMode:id==='mood-self-destruct'?'self-destruct':'collapse'});
export function getMoodCollapseV25(run){
 const stage=moodCollapseStageV25(run),p=moodCollapseProfileV25(run);
 const titles=['理智歸零。這次連「我沒事」都沒演完。','第二次歸零。同事還記得上次，你也記得。','第三次歸零。休息回來，通知聲仍然讓你發抖。','又一次歸零。連安慰自己的台詞都用完了。'];
 const bodies=[
  '你把憋了幾天的話一次吼出來，辦公室真的安靜了。水杯還握在手裡，紙卻已經抖得看不清。工作先停在這裡，接下來要決定怎麼收拾自己的狀態。',
  '你又在辦公室失控了。上次說「休息一下就好」的人，這次先問你今晚有人陪嗎。原本能把心情補回來的安排，現在只夠讓你緩一口氣；再回到同一張椅子，代價也更高。',
  '第三次，連你都認得這個開場。你不是不知道要休息，只是每次剛緩過來，群組又把你叫回原處。同事把會議延後，卻沒有人能替你把這份工作變成另一份。這次得花更多力氣，才換得到一點平靜。',
  '你又吼了出來，聲音卻比上次更累。腦中盤點著休假、飯局、關機，卻想起回來仍是同一串通知。接下來的休整很貴，也只能救回一小段心情。你開始認真想，自己還要不要再回來。'
 ];
 return scene('mood-collapse',titles[stage-1],bodies[stage-1],run,[
  {...choice(`花 ${p.cost} 存款，離開現場，找人陪自己休整。`,stage===1?'你先離開辦公室，找願意聽你說話的人坐了一會。問題沒有全解決，至少今天不用再獨自把每句話吞回去。':`你重新安排陪伴、交通與休息，付掉這次的 ${p.cost} 存款。熟悉的安慰只能幫上一部分；你稍微穩住了，也知道這次沒有恢復到以前那樣。`,{cash:-p.cost,mood:p.mood,energy:p.energy},'moodRecover',['spend_mood','spend_sabbatical','mood_emergency_care']),available:run.stats.cash>=p.cost},
  choice('先請無薪假。錢留著，後面的爛攤子慢慢收。',stage===1?'你請同事幫忙交代現場，自己先離開。缺勤被折進後續薪資；收入少了，你也只恢復到勉強能回來的程度。':'你再次請假離開。公司把這段缺勤折進更低的後續薪資，同事也得重新分配手上的工作。你暫時不用接訊息，心情卻只回來一點。',{mood:p.unpaidMood,energy:p.unpaidEnergy,trust:-p.unpaidTrust},'moodUnpaidLeave',['mood_unpaid_leave']),
  {...choice('把離職信當成公司廣播，今天就唸完。','你唸完離職信，沒有再補感謝栽培。場面不好看，交接還是得做；但你不想再付下一筆錢，把自己修好送回同一張椅子。',{mood:12},'ragequit',['mood_departure']),wild:true},
  {...choice('受不了了，自爆','你把原本只敢打在備忘錄裡的話，貼進公司群組。送出鍵已經按了，現在每個人都看得見。',{},'moodSelfDestruct',['mood_self_destruct']),special:'self-destruct'}
 ]);
}
export function getMoodSelfDestructV25(run){
 const stage=moodCollapseStageV25(run),p=moodCollapseProfileV25(run),cost=p.cost+6;
 const titles=['你的備忘錄，現在成了全公司的置頂訊息。','第二次歸零，你把話貼進公司群組。','第三次歸零，你決定開一場自己的記者會。','公司群組安靜了。這次你也不想再圓場。'];
 return scene('mood-self-destruct',titles[stage-1],`你把改口的交辦、消失的休息時間，以及那句「再忍一下」全部寫了出來。${run.flags.mood_self_destruct>1?'有人翻到你先前的訊息，發現事情一件也沒少。這次的場面更難收回去了。':'有人正在輸入，又停了；你的主管開始打電話。'}沒有誰被你打到，工作關係卻已經被搬上檯面。現在要決定怎麼收尾。`,run,[
  {...choice(`花 ${cost} 存款，承認自己撐不住，先退出工作群組休整。`,'你不替那串訊息編一個「帳號被盜」的理由。你說自己需要離開現場，請人陪著把接下來幾天安排好；同事接手了部分工作，信任也得慢慢重建。',{cash:-cost,mood:Math.max(10,p.mood-8),energy:Math.max(6,p.energy-4),trust:-(6+stage*4)},'moodRecover',['spend_mood','spend_sabbatical','mood_emergency_care']),available:run.stats.cash>=cost},
  {...choice('開共享簡報替績效表辦告別式，再寄無薪假申請。','你替每次改口各做一頁投影片，最後一頁只有「我先請假」。簡報沒有替你爭取到掌聲，薪資還得再折；至少你終於把不能繼續上班說清楚。',{mood:Math.max(4,p.unpaidMood-4),energy:p.unpaidEnergy,trust:-(p.unpaidTrust+4)},'moodUnpaidLeave',['mood_unpaid_leave','mood_self_destruct_slides']),wild:true},
  choice('把最後一封群組公告寫成離職信，正式離開。','你沒有再等誰替這串訊息下結論。離職信寄出，交接另約時間；這次你決定先結束這段工作關係。',{mood:12},'ragequit',['mood_departure','mood_self_destruct_exit'])
 ]);
}
