// Fictional emotional consequences. This is an actual outburst, never a dream.
const choice=(text,result,delta,effect,flags=[])=>({text,detail:'',result,delta,effect,flags});
const scene=(id,title,body,choices)=>({id,title,body,choices,wing:'你先不用回答任何工作訊息。眼前這場失控，已經需要有人接住。',speaker:'self',kind:'crisis',era:'情緒警報',sourceIds:['characterFiction']});
export function getMoodCollapseV18(run){
 return scene('mood-collapse','理智歸零。這次連「我沒事」都沒演完。',
  `通知又響了，你站起來，把憋了幾天的話一次吼了出來。辦公室真的安靜了，同事也真的看見了；這次不是腦內劇場。${(run.flags.mood_crash_count||0)>1?'有人認出這個場面，默默把水杯往旁邊移了一點。':'你看著自己的手，才發現連拿著的紙都在抖。'}工作先停在這裡，接下來得處理自己的狀態與留下的後果。`,[
   {...choice('花 18 存款，離開現場，找人陪自己休整。','你叫車離開，找一個願意聽你說話的人，把今天先停下來。剛才的場面不會自動消失，至少你沒有再把自己送回下一場會議。',{cash:-18,mood:50,energy:22},'moodRecover',['spend_mood','spend_sabbatical','mood_emergency_care']),available:run.stats.cash>=18},
   choice('不花存款，請無薪假。這場爆炸得自己收拾。','你請同事幫忙交代現場，自己先離開辦公室。公司把這段缺勤折進後續薪資；收入少了，同事也需要一點時間，才知道怎麼再跟你一起工作。',{mood:20,energy:10,trust:-12},'moodUnpaidLeave',['mood_unpaid_leave']),
   choice('把離職信當成公司廣播，今天就唸完。','你把離職信唸了出來，沒有再替句子加上感謝栽培。場面很難看，交接還是要做；但你決定不再花下一筆錢，把自己修好送回同一張椅子。',{mood:12},'ragequit',['mood_departure'])
  ]);
}
export function getMoodWarningV18(run){
 return scene('crisis-mood','再一封訊息，你可能就演不下去了。','你開始對通知聲過敏。離真正失控還有一點距離，現在能做的事，是先照顧自己，或承認這份工作已經不值得繼續撐。',[
  choice('今天就離開，不再替這份工作撐場。','你寄出離職信，把沒做完的事項列給接手的人。這次先處理自己的去留，不等情緒替你公開宣布。',{mood:18},'ragequit'),
  {...choice('花 14 存款，找人吃飯，把今天先停下來。','你把通知關掉，和一個不用先看你績效表的人吃飯。事情還在，但這頓飯讓你有力氣再決定下一步。',{cash:-14,mood:32,energy:12},'resume',['spend_mood','spend_network']),available:run.stats.cash>=14},
  choice('替自己掛上「低電量勿擾」，先勉強撐過這段。','你把回覆縮到最低限度，暫時沒有花錢。心情只鬆了一點，身體仍在硬撐；同事少收到幾句完整的回答，也看得出你快到極限。',{mood:8,energy:-8,trust:-6},'resume',['mood_endure'])
 ]);
}
