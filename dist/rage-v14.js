// Original fictional branches. The target comes from the conversation, never
// from a client-supplied character ID. Opening the result does not draw RNG.
export const RAGE_WORLD_EVENTS = ['rage-release','rage-aftermath','rage-legal','rage-showdown','rage-public'];
export const RAGE_NAMES = {wing:'Wing',spencer:'Spencer',rick:'Rick',hope:'Hope',erich:'Erich',jenjen:'JenJen',sonny:'Sonny',kind:'阿良（Kind）'};
const c=(text,result,delta={},effect='rageReturn',flags=[])=>({text,detail:'',result,delta,effect,flags});
const outcome=(weight,label,result,delta,effect,flags=[])=>({weight,label,result,delta,effect,flags});
const end=(family,text,result,delta={})=>c(text,result,delta,family,[family]);
const scene=(id,title,body,speaker,choices)=>({id,title,body,wing:id==='rage-release'?'辦公室安靜了一秒。你在等自己回過神。':'這一頁，已經回不到剛才那句話了。',speaker,choices,kind:id==='rage-release'?'rage':'rage-world',era:id==='rage-release'?'當場暴走・原創分支':'失控後的世界・原創分支',sourceIds:['characterFiction']});

export function rageTargetFor(event){
 if(!event)return null;
 if(event.speaker==='exit-team')return event.id==='paperwork'?'jenjen':'erich';
 return Object.hasOwn(RAGE_NAMES,event.speaker)?event.speaker:null;
}
export function rageTiming(eventId){
 if(eventId==='onboarding')return 'onboarding';
 if(/pip|hope-care/.test(eventId))return 'pip';
 if(/salary/.test(eventId))return 'salary';
 if(/education|degree|reading|icml/.test(eventId))return 'education';
 if(eventId.startsWith('banquet-'))return 'banquet';
 if(['crisis-boss','paperwork'].includes(eventId))return 'exit';
 if(eventId.startsWith('kind-'))return 'kind';
 return 'workday';
}
function timingLine(context,real){
 switch(rageTiming(context.eventId)){
 case 'onboarding':return real?'報到流程才走到介紹座位，事情已經跳過試用期，直接進入公司從沒寫過的緊急應變。':'你連公司Wi-Fi都還沒連上，腦內已經替報到流程加了一場壓軸。';
 case 'pip':return real?'自評表還攤在桌上，這次大家終於同意：今天確實有一件不能用「待改善」帶過的事。':'你在腦內把整份自評表折成拳套。現實裡，對方還在等你替自己打分。';
 case 'salary':return real?'薪資方案沒談完，會議先多了一份現場紀錄。你嫌公司把價值算得太便宜，現在雙方都開始算別的帳。':'腦內那一下很解氣，現實裡的新薪資數字卻一位也沒動。';
 case 'education':return real?'Wing才問到你哪裡畢業，接下來的事已經超出任何一張畢業證書能解釋的範圍。他這回沒有再叫你多讀書，先叫旁邊的人過來。':'你的學校還停在對話裡，腦內的Wing已經被你送去重修「怎麼跟人講話」。現實裡，他仍等著你回應那句讀書論。';
 case 'banquet':return real?'尾牙音樂還在放，主持人以為這是加演，差點接一句「大家掌聲鼓勵」。沒有人敢先鼓掌。':'尾牙燈光一閃，你已在腦內演完年度最佳動作片。舞台上還在抽一個不含你的號碼。';
 case 'exit':return real?'文件還沒簽，會議室先換了一種安靜。這次三件套不再催你快一點，大家各自找了一個能坐遠一點的位置。':'你在腦內把那張自願離職書打成雪花。現實的紙還是平的，簽名欄也還是空的。';
 case 'kind':return real?'阿良這回來不及消失。你第一次覺得，這個人答應留下的時機實在選得很差。':'你還沒在腦內追完，阿良已經開始說晚上再約。現實和幻想，只有他消失的速度一致。';
 default:return real?'本來只是另一場上班對話，下一句話卻沒有人照原本的劇本接。':'你在腦內快轉了整場動作戲，現實只過了對方換氣的那一秒。';
 }
}
const imagined={
 wing:'漫畫裡，你把Wing的「格局」對話框打成了直式。他張嘴還想叫你讀書，字幕卻先跳出「本書未附交付日期」。',
 spencer:'你想像自己一拳把「家境不允許」打成「本日加碼」。Spencer伸手摸口袋，口袋裡居然又掉出一個預算不足的對話框。',
 rick:'腦內的Rick被打得轉了半圈，仍然沒醒。Wing的來電一響，他立刻站直說「您說得對」，連漫畫都得先讓他接完。',
 hope:'你想像自己揮出一拳，Hope當場抽出自評表接招，問這次情緒輸出有沒有可衡量的目標。你替她在腦內填了「已超標」。',
 erich:'漫畫裡，Erich還在解釋「扁」的定義，對話框已被你壓成一條細線。最後一個但書仍不肯結束。',
 jenjen:'你想像一拳把交接清單打成紙花。JenJen伸出手，請你離場前逐片清點、黏回原狀。',
 sonny:'腦內的你剛擺好姿勢，Sonny先把畫面切成登入頁。你對著密碼錯誤提示框打了三回合，沒有人替你重設。',
 kind:'你在腦內追著阿良跑遍整棟樓。他每次都說「好啊，等你」，每次轉角都只剩一架沒有人的鋼琴。'
};
const actual={
 wing:'鏡頭猛地一晃，杯子倒了。Wing捂著臉愣住，第一句居然是：「現在是什麼狀況？」這回你也沒有現成答案。',
 spencer:'鏡頭跳了一格，Spencer的椅子往後滑。董事長沒有接著談預算，先問旁邊的人剛才有沒有錄到。',
 rick:'一陣椅輪亂響，Rick終於完全清醒。手機恰好亮起Wing來電，他接通後第一句是：「我這邊真的出事了。」這次聽起來不像轉達。',
 hope:'桌上的自評表散了一地。Hope沒有再問你打幾分，先把會議停下來。你看著自己的手，發現這次沒有漫畫替你收尾。',
 erich:'鏡頭切到落地的資料夾。Erich把椅子往後移，開始要求把現場經過記下來。原本那份文件暫停了，另一份紀錄開始了。',
 jenjen:'交接清單掉在地上，JenJen的語氣第一次離開制式流程。她讓其他人先拉開距離，沒再問你充電器在哪裡。',
 sonny:'螢幕還亮著，Sonny已經退到門邊。你原本想說的話沒說出來，現場只剩門禁提示音，還在很不識相地叫。',
 kind:'椅子碰了一聲，阿良踉蹌站穩，這次真的沒有消失。他看著你，慢慢把原本想說的「晚上再約」吞了回去。'
};

function release(run){
 const context=run.rageContext,target=context.target,hot=run.stats.mood<=25,calm=run.stats.mood>=65;
 const realWeight=Math.max(18,Math.min(64,31+(hot?23:calm?-12:0)+(target==='wing'&&run.stats.boss<=25?8:0)));
 const first=context.eventId==='onboarding';
 const phaseLine=context.phase==='result'?'你剛才已經回答了，這口氣卻在聽完回話後才湧上來。':'對方話都還沒講完，你就已經聽不下去了。';
 const late=run.turn>=20?' 敲鐘日期已經改了幾輪，現在大家終於為另一件事同時停下手。':'';
 const imaginary=imagined[target]+(first&&target==='wing'?' 腦內的Wing還在找員工名單：你連名字都沒報完，他就先被列進劇情了。':'')+' 你眨了一下眼，手還放在自己膝上。剛才整段只有你看見。 '+phaseLine+' '+timingLine(context,false)+(run.turn>=20?' 上市簡報還開著，腦內的你已經先替它敲了散場鐘。':'');
 const real=actual[target]+(first&&target==='wing'?' 他低頭看了看你的空白報到表，又看了看你：「你今天不是第一天？」連震怒都還找不到前情提要。':'')+' '+phaseLine+' '+timingLine(context,true)+late;
 return scene('rage-release','受不了了，扁他。',`眼前正在說話的是${RAGE_NAMES[target]}。你沒有找別人，這口氣就在這一刻斷了線。`,target,[{
  ...c('受不了了，扁他。',''),rageTarget:target,draw:{label:'剛才發生了什麼',outcomes:[
   outcome(100-realWeight,'腦內劇場',imaginary,{mood:hot?17:9,energy:-3,boss:-2},'rageReturn',['rage_imagined','rage_catharsis',...(first?['rage_first_day']:[])]),
   outcome(realWeight,'真的失控了',real,{mood:hot?10:-8,energy:-11,boss:-32,trust:-4},'rageAftermath',['rage_real',...(first?['rage_first_day']:[])])
  ]}
 }]);
}
export function getRageV14(run){
 const context=run.rageContext,name=RAGE_NAMES[context?.target];
 if(!name)throw new Error('Invalid rage target');
 switch(run.eventId){
 case 'rage-release':return release(run);
 case 'rage-aftermath':return scene('rage-aftermath','這次，沒有醒來。',`${timingLine(context,true)} ${name}就在現場，事情也真的發生了。有人拿手機、有人找主管，Wing的名字依然比本人更快出現在每句話裡。你得決定，接下來要怎麼面對這場失控。`,'erich',[
  c('先停下來，把剛才發生的事完整說清楚。','你坐遠了一點，請大家把看到的經過分開記。你那一下沒有被刪掉，之前那段對話也沒有。這場會議終於開始記錄完整的句子。',{mood:-4,energy:-3},'rageLegal',['evidence']),
  c('我都走到這裡了。你們到底想怎樣？','你沒再靠近，場面卻還繃著。有人搬開椅子，有人說要找人來，Rick的手機在最不需要配樂的時候又響了。',{energy:-4,boss:-6},'rageShowdown'),
  {...c('先等一下。我想替這場事故寫一份上市新聞稿。','你拿起散在桌上的簡報，把封面改成「組織轉型重大進展」。現場最荒謬的事，突然多了一件。',{dream:8,trust:-3},'ragePublic'),wild:true},
  end('rage_walkaway','我不替剛才找藉口。先把事情處理完，再離開。','你留下經過，面對該處理的後續，也停止跟這間公司爭最後一句話。離場比想像中麻煩，但你不再把下一段人生押在他們的回覆上。',{mood:8,cash:-12})
 ]);
 case 'rage-legal':return scene('rage-legal','表格終於裝不下全部。',`Erich把文件一張張攤開，Hope又拿來一份說明表。${name}的說法、你的說法、旁人的紀錄，彼此對不上。有件事倒是很清楚：上班的爛事不會讓剛才那一下自動消失，剛才那一下也不會讓前面的事變得合理。`,'erich',[
  end('rage_legal','各自的責任各自釐清，該面對的我會面對。','事情往正式程序走了。你為動手付出代價，也把公司的處理方式留在同一份紀錄中。沒有誰靠一拳改寫所有前情；至少，這次輪不到一張自願離職書包辦結論。',{cash:-20,mood:3,trust:6}),
  end('rage_truce','可以談後續，但別把整件事改寫成我自願沒事。','幾輪協調後，雙方在這條故事裡談妥後續安排。你把不同意的地方留在文件上，對方也不再要求你演出「謝謝公司的照顧」。會議結束得很難看，卻終於結束了。',{cash:-10,mood:11}),
  {...c('讓AI寫吧。提示詞就叫：所有人都覺得自己完全沒錯。',''),wild:true,draw:{label:'AI先替誰說話',outcomes:[
   outcome(50,'附件長出附件','AI生出二十頁互相矛盾的說明，最後要求各方回到正式程序確認。你付出了時間和存款，倒是第一次看到這間公司承認文字需要核對。',{cash:-24,mood:-3},'rage_legal',['rage_legal']),
   outcome(30,'錯字比聲明先紅','新聞稿把職稱寫成「首席情緒長」，截圖比正式說明先傳出去。你本來想交代清楚，網路只記住了那五個字。',{cash:-12,mood:4,slack:5},'rage_meme',['rage_meme']),
   outcome(20,'機器也不想加班','AI回覆「請補充完整前情」。你看著一整年的聊天紀錄，決定自己收拾後續，然後離開。連這個月費都不想再替公司付。',{cash:-8,mood:9},'rage_walkaway',['rage_walkaway'])
  ]}}
 ]);
 case 'rage-showdown':return scene('rage-showdown','氣勢很滿，體力是另一回事。',`${name}沒有照你腦內的分鏡倒下。旁人都退開了，現場卻不會因為你最生氣，就照你的意思往下演。你喘了一口氣，發現自己只是個平常會被會議耗光體力的上班族。`,context.target,[
  {...c('我今天就站在這裡，把話講完。',''),draw:{label:'場面最後倒向哪邊',outcomes:[
   outcome(run.stats.energy<=35?75:55,'氣勢先倒下',`${name}沒有退，你卻先被自己的虛張聲勢耗到腿軟。鏡頭切過一陣混亂，再回來時你坐在地上，旁邊有人遞來冰袋。最難接受的是，Rick這次連醒著看完都做到了。`,{energy:-18,mood:-16,cash:-12},'rage_defeated',['rage_defeated']),
   outcome(context.target==='wing'?16:6,'組織圖突然改版','Wing拍桌要大家選邊，卻沒有人接話。Spencer看著一整桌沉默，竟說「那你來管看看」。畫面當場裂成一個荒謬平行宇宙：你拿到辦公室，原本的老闆拿到你昨天的待辦。',{energy:-10,mood:13,dream:18},'rage_coup',['rage_coup']),
   outcome(29,'有人把會議叫停','同事終於叫大家坐開。沒有掌聲，也沒有贏家；後續慢慢談，該承擔的照樣留下。你第一次覺得，停在這裡比再搶一句話難。',{energy:-9,mood:7,cash:-10},'rage_truce',['rage_truce'])
  ]}},
  {...c('宣布臨時股東會。第一個議案：老闆可不可以換人？',''),wild:true,draw:{label:'臨時股東會的奇怪決議',outcomes:[
   outcome(12,'居然有人附議','你只想講句瘋話，會議室卻接連有人舉手。畫面不講道理地切進平行宇宙：Spencer把組織圖轉向你，Wing被請去填自評表。這不是正常的升遷，連遊戲的人資系統都拒絕替它命名。',{dream:23,mood:18,boss:-20},'rage_coup',['rage_coup']),
   outcome(53,'提案沒有股權，只有流量','沒有人把這句話當成真的股東會提案，錄到的片段卻成了辦公室群組的新貼圖。你沒有接班，倒是在各種爛會議裡永遠都有一席之地。',{mood:5,trust:6,slack:5},'rage_meme',['rage_meme']),
   outcome(35,'連表決器都沒拿到','你話還沒講完，現場就被請來的人隔開。混亂結束時，你坐得比剛才更遠，氣也只剩夠痛自己的那一點。這場失控，連你幻想的勝利姿勢都沒留下。',{energy:-16,mood:-13,cash:-15},'rage_defeated',['rage_defeated'])
  ]}},
  end('rage_truce','夠了。先不要再讓事情往下壞。','你先把手放下，退開。對方沒有突然變好，你也沒有因此變成輸家；雙方把後續交給協調，至少沒有再多一段需要收拾的現場。',{mood:5,energy:-3,cash:-8})
 ]);
 case 'rage-public':return scene('rage-public','出事了，簡報還是先做。','你剛替事故取好名字，旁邊就有人問能不能改成英文。有人想把它當危機、有人想把它當轉型，Rick問作者欄可不可以放他。你看著那張封面，覺得這個世界最難消失的東西果然是工作。','spencer',[
  {...c('把前因後果說完整，連我失控的那段也留下。',''),draw:{label:'完整版本傳出去之後',outcomes:[
   outcome(50,'大家只記得最短那句','你寫了很長的說明，傳最遠的卻是「報到還沒好，人生先登出」。事情的後續照樣要處理，網路另外給你一個離譜的頭銜。',{mood:6,trust:5,cash:-14},'rage_meme',['rage_meme']),
   outcome(35,'笑話之外，事情照樣算','熱度沒有替任何人省下責任。你帶著完整紀錄面對後續，這條故事最後留在正式程序裡，沒有被剪成只有一方清白的短片。',{mood:-3,cash:-20},'rage_legal',['rage_legal']),
   outcome(15,'看完的人，比轉傳的人重要','幾位同事把你留住，先把該處理的事情談完。你後來離開了，沒有繼續追每一則留言；有些人知道完整版本，你決定先過自己的日子。',{mood:10,cash:-10},'rage_walkaway',['rage_walkaway'])
  ]}},
  {...c('新聞標題就寫：本公司完成管理層物理更新。',''),wild:true,draw:{label:'新聞稿的平行宇宙',outcomes:[
   outcome(8,'宇宙居然照稿辦事','原本只是胡寫，螢幕卻跳出「組織圖更新完成」。平行宇宙裡，你坐上原本的老闆椅，Wing站在門口等你核假。你還沒笑完，三百封待簽核已經先來報到。',{dream:25,mood:15},'rage_coup',['rage_coup']),
   outcome(62,'標題成為新一代請假理由','沒有人接受這份新聞稿，但每逢爛會議，就有人貼「管理層需要更新」。你沒有取代誰，倒是替前員工群組提供了夠用一整年的表情包。',{mood:10,slack:8,trust:3,cash:-12},'rage_meme',['rage_meme']),
   outcome(30,'梗圖不能代收後續','正式來函不覺得標題好笑。你把新聞稿收起來，回頭面對該說明、該承擔的部分。荒謬可以寫進故事，後續仍得一件件做完。',{mood:-7,cash:-22},'rage_legal',['rage_legal'])
  ]}},
  end('rage_walkaway','算了。我不想再免費替這間公司產內容。','你把封面關掉，留下完整經過，把該面對的事處理完。後來群組仍有人轉傳，你不再每次點開。離開那天，終於有一項工作沒有交接：替他們找台階。',{mood:12,cash:-10})
 ]);
 default:throw new Error('Unknown rage world scene');
 }
}
