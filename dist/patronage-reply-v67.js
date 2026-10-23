import {isPatronageBenefitsV67} from './patronage-benefits-v67.js';
import {isPrivateSceneV39} from './private-scenes-v39.js';
import {characterAffinity} from './character-stats.js';

// A reply is an interruption, not the answer to the still-open scene. These
// rewards represent help with the extra legwork caused by speaking up. The
// engine still commits one draw, restores the source and enforces its choices.
const REACTIONS=['obliged','retort','reported','welcomed'];
const RIVALS=new Set(['rick','princess']);
const WING_REPORTS=new Set(['rick','hope','erich','sonny','jenjen','meimei','helen','owen','cindy','princess','joyce']);
const clamp=value=>Math.max(0,Math.min(100,Number.isFinite(value)?value:50));

// Each pair is the grudging response and the genuinely cooperative response.
// The favour saves effort; it never signs a decision or finishes a work item.
const HELP=Object.freeze({
 erich:[
  '法師嘴上說程序沒有自己人，手上卻先替你把這輪要核對的地方圈好。你不用再逐頁找註腳，暫時靠回椅背；該由你確認的條件還在，他也沒替你簽名。那張不情願的臉，配上這份加急整理，倒很有特殊任用的實感。',
  '法師把冗長的說明縮成幾項，順手附上對應頁碼。你終於能坐著看重點，不必為一句但書再跑一趟；接下來同不同意，仍等你自己開口。這回自己人的名片省下的是腳程，沒有替任何人代簽。'
 ],
 sonny:[
  '阿福本來又要開理由伯記者會，看見你的名片後，先去查了缺的權限。你坐著等他把資料帶回來，少跑一輪窗口；他回來還是補了三個理由，尤其強調「原本就會處理」，好像這一趟全是自己臨時起意。',
  '阿福先把眼前能確認的一項查好，連下一個窗口也替你問了。你少跑兩趟，他少開半場記者會；你們都沒有因此替尚未選的方案點頭，只是難得在理由講完以前，先得到一點可以用的幫忙。'
 ],
 jenjen:[
  '真真看了你的名片，把這輪要補的資料整理好送過來。你不用再抱著一疊紙沿路問人，少站了一輪隊；她放下文件的聲音很整齊，特別交代這是這一次，沒有開放你從此每件事都插隊。',
  '真真把能代問的窗口先問完，連缺哪張資料都替你標好。你終於能坐著處理自己的那一項，不必一路當人肉轉接台；她也講清楚幫忙到哪裡。這次有了自己人的方便，原本該你決定的事仍在桌上。'
 ],
 kind:[
  '阿良本來想把下一趟跑腿塞給你，聽完便笑著自己接走。你難得不用跟著起身，先喝了幾口水；他還是那張「等一下」的臉，這回卻真的把眼前的小事帶去問了。至於原本那個邀約，你還沒答應。',
  '阿良替你把這輪聯絡問完，回來時本人、外套和消息居然都在。你坐著省下幾趟腳程，也恢復了一點精神；他說自己人當然要照顧。你決定先享受眼前這次，別急著替他以後的出席率背書。'
 ],
 hope:[
  '希望把原本要你自己追的這輪資料先整理好，連附件缺在哪裡都畫了記號。你少被叫來叫去，坐著緩了口氣；她的笑容卻比剛才薄了一點。自己人的方便拿到了，她顯然不想把這份方便寫成以後的慣例。',
  '希望先替你核對資料與窗口，把需要你回答的問題留在同一頁。你不用再一趟趟補問，可以坐下把話想清楚；這次的幫忙確實省力，並沒有替你答應任何人事條件。'
 ],
 jack:[
  '傑克把這輪散在各處的資料收成一份，直接傳給你。你不用再挨桌追前情，省下幾趟來回；檔案最後一行卻寫著「依特殊任用要求協助整理」。人家真的幫忙了，也很認真替史冊留下可考證的素材。',
  '傑克替你串好要找的窗口，把各人能回答的那一段列清楚。你坐著看重點，總算少當一輪跑腿；他笑著提醒，幫你整理不等於替你拍板。自己人的好處領到了，自己那句話還是得自己負責。'
 ],
 meimei:[
  '水蛇替你把這輪要問的人先找齊，回來把聯絡結果交到桌上。你省下來回打電話的力氣，她則特別把「誰要求加急」留在紀錄裡。事情有人幫著推，對你的好感卻沒有跟著加急。',
  '水蛇把散在幾個窗口的回覆問清楚，直接告訴你哪一項已確認、哪一項還要你選。你終於不用再追著每個人跑，精神也鬆了一點；她幫你把話帶回來，沒有替你向任何人開承諾。'
 ],
 helen:[
  '前女友替你把這輪需要的版本和窗口找好，省下你幾趟來回。你才剛靠回椅子，她便把檔案另存，註明這次是誰要求先處理。自己人確實少累一點，這份方便也確實被她記得很清楚。',
  '前女友把要對照的幾份資料排好，連改動在哪裡都先標出來。你不必再拿著檔名到處求證，終於能坐下看重點；她肯協助你把事情弄清楚，最後用哪一版仍由你回覆。'
 ],
 sophie:[
  '紅茶替你把缺件整理成一張表，這輪不用再跑三個窗口。你坐下時，她補一句自己不是綠茶，也不是你的專用服務台。少跑的路是真的，少掉的好臉色也是真的；該補的資料仍一項不少。',
  '紅茶先替你核對資料放在哪裡，把能代問的那幾項問完。你終於不用抱著表單到處重考，坐著就能看到缺口；她給的是一次清楚的協助，沒有替任何空白欄蓋通過章。'
 ],
 jonathan:[
  '強哥拿起助理工程師名片看了一眼，還是替你把這輪資料查好。你少跑一趟，他多說一句「這次是協助，不是接整包」。自己人的架子有了實際用處，只是他的職責邊界也畫得比剛才更粗。',
  '強哥把需要查的那一項接過去，查完便把結果傳回來。你坐著省下幾趟確認，他也沒有再拿名片當盾牌；兩人先把能幫的忙說清楚，原本的決定權和責任還在各自手上。'
 ],
 owen:[
  '歐文總算替你把這輪要聯絡的人問了一遍，讓你不用再挨個追。你靠回椅子休息，他隔著墨鏡說「這次我幫你跑」。他的確給了面子，往後約你聊聊的語氣卻明顯客氣了一層。',
  '歐文直接把缺的聯絡資訊和回覆帶回來，沒有再把整件事包成一句聊聊。你省了幾趟來回，精神也鬆了一點；他負責問清楚，你負責回應眼前的選擇，這次分工總算不是只存在願景裡。'
 ],
 sam:[
  '山姆先強調自己早就會了，接著真的把這輪要查的資料翻好。你坐著省下幾趟找人的力氣，他則把下一集暫停在一張很不情願的臉上。你終於享受了一次自己人的方便，也領到一段附贈的資歷簡介。',
  '山姆把畫面暫停，替你查完眼前那一項，連資料位置都一起傳過來。你不用再逐個追問，終於能坐下緩一口氣；他沒有替你決定怎麼回覆，但這回拿出來的不只是兩張學位。'
 ],
 cindy:[
  '辛蒂替你把這輪要確認的時段和窗口問好，省下幾趟來回。你坐回去時，她已在紀錄裡標上要求者的名字。這份特殊待遇有人照辦，也有人留底；原本要不要答應，還是等你自己說。',
  '辛蒂先問完各人的空檔，把能協助的部分排清楚。你少當一輪人肉行事曆，坐著就能看懂哪些事還得自己決定；她願意幫你省力，也明講這次沒有順便替任何主管點頭。'
 ],
 professor:[
  '林老師把這輪要查的資料位置列給你，讓你不用再繞著顧問時段找人。你坐著省了幾趟腳程，他則特別提醒半天就是半天。自己人的名片有了點方便，沒有順便買到隨叫隨到。',
  '林老師替你把問題拆開，先把能查的資料和聯絡方式整理好。你不必抱著模糊題目四處找答案，終於有空坐下來想；他幫你少走了一段冤枉路，原本要怎麼做仍等你自己選。'
 ],
 annie_yu:[
  '安妮余先替你問齊這輪缺的回覆，再把資料送過來。你少跑幾個窗口，她卻把你的要求一併抄給歐文。幫忙是真的，不想從此變成你私人助理也是真的；桌上原本那個選擇還在等你。',
  '安妮余把能代問的條件先追齊，沒有再丟回一句幫我。你終於能坐著看重點，不必又當一次轉接台；她協助你省下腳程，你也得親自決定接下來怎麼回覆。'
 ],
 joyce:[
  '914先替你問完這輪窗口，把回覆整理好帶過來。你坐著少跑了幾趟，她的笑容卻正式得像剛加了一層簽核。她配合了這次加急，沒有答應往後都替自己人開專線。',
  '914把要問的幾件事先釐清，直接交給你能核對的回覆。你終於不用一路追著窗口跑，精神也鬆了一點；她幫你把話問回來，對外要不要答應仍由你親自決定。'
 ],
 janet:[
  'Janet替你把這輪需要對照的資料找齊，讓你少跑幾趟財會窗口。你剛坐下，她就把協助範圍寫得清清楚楚。這次自己的力氣省下來了，對方的帳上顯然也多記了一筆人情。',
  'Janet把手邊能查的數字先核對好，直接告訴你資料在哪裡。你不用再抱著一疊表格來回問，總算坐下緩了口氣；她協助的是查資料，沒有替你核准預算或答應條件。'
 ],
 captain:[
  '船長替你把這輪要找的人問了一遍，回來把資料放好。你少跑幾趟，終於可以坐著喝水；她卻提醒這艘船沒有自己人專船服務。這回有人替你划了幾槳，下次要不要同船就難說了。',
  '船長把這輪能代問的安排先確認好，連該找誰都列在一起。你終於不用在幾個窗口之間漂流，坐著就能看清楚下一步；她幫你節省腳程，原本的選擇仍留給你自己掌舵。'
 ],
 zoe:[
  '201替你把這輪要問的人找好，連散在各處的回覆也收齊。你不用再沿路喊人，坐著恢復一點精神；福委會長給了方便，也補一句「這次而已」。自己人的待遇領到了，下一場活動的笑臉似乎先被扣了一張。',
  '201幫你把聯絡和資料整理好，讓你不用再充當流動服務台。你坐下喘口氣，她則把需要你自己回答的那幾項留清楚；這次真的有人幫忙，沒有拿一句自己人就把全場的人都算成你的助理。'
 ],
 action:[
  '順哥收起投資話題，先替你問了這輪缺的資源和窗口。你坐著少跑幾趟，他回來卻特別強調這次是看老闆的面子。自己人的名片終於能換到實際幫忙，沒有換到他真心喜歡這個口氣。',
  '順哥先把眼前要確認的人脈問了一圈，整理好回覆再交給你。你省下不少聯絡功夫，精神也鬆了一點；這次他真的幫忙牽線，沒有把你的原本選擇順便算成一筆投資承諾。'
 ],
 hester:[
  '海姐替你先聯絡這輪要問的窗口，讓你少跑幾趟。你終於能坐下看回覆，她則很客氣地提醒這次是協助。自己人的方便確實有拿到，只是她看你的表情，已經比看加急客戶更有距離。',
  '海姐把這輪能確認的條件問清楚，直接將回覆帶到你面前。你不用再各處追問，精神也回來一點；她願意分擔聯絡，沒有替你向任何人答應尚未決定的事。'
 ],
 simon:[
  '丁哥替你把這輪資料和聯絡先處理好，讓你不用再來回跑。你坐著喝水時，他小聲數了自己今天又兼了幾種工作。特殊任用確實省了你的力氣，也讓他對這張名片多了一點不想接話的表情。',
  '丁哥把能幫的那一段接過去，查好便把資料傳回來。你總算不用四處問同一句話，可以坐著緩口氣；這回他真的分攤了聯絡功夫，沒有替你選方向，也沒把自己變成你往後每件事的遙控器。'
 ],
 james:[
  '詹姆士說自己進出這麼多次，路早就熟了，還是替你跑完這輪確認。你坐著省了幾趟腳程，他回來把資料放下，笑說這次不是重新報到當你的跟班。有人照辦的好處很實在，話裡的距離也很實在。',
  '詹姆士幫你找對窗口，把這輪要問的事一次問回來。你不用再重走他七進七出的路線，終於能坐下緩一緩；原本要不要答應仍由你決定，這次回鍋資歷倒是真的替你省了點力氣。'
 ],
 johnny:[
  '強尼替你把這輪散在各案的資料收好，省下幾趟來回。你坐回椅子，他便把這次協助的時間補進紀錄。自己人的最高優先確實叫得動人，也讓他對你又多留一層像對待加急需求的客氣。',
  '強尼先替你把能確認的窗口問完，把還要你決定的部分留清楚。你少追一輪訊息，總算有空坐著喘氣；這次真的有人協作，沒有把尚未選的答案偷偷勾好，也沒有把全部責任轉給他。'
 ]
});

const RIVAL_HELP=Object.freeze({
 rick:[
  '瑞克盯著你的名片，終於替你問了這輪資料，還順手把你原本要跑的那一趟接走。你坐著喘氣，他把老闆專線握得更緊：「幫你這次，電話還是我的。」力氣確實省了，家譜爭奪戰顯然也正式開打。',
  '瑞克勉強認領一輪聯絡，讓你不用再跟著跑。你坐下休息，他整段都沒低頭睡，反而反覆確認老闆有沒有打來；這次願意合作，對第二張自己人名片的戒心卻一點沒放下。'
 ],
 princess:[
  '公主看完你的名片，替你把這輪資料找好，省下你幾趟追問。你坐著休息，她把手機翻回自己那面：「One favour. Don’t confuse it with seniority.」幫忙是拿到了，誰先來這個家族，她顯然打算另外算。',
  '公主替你問完眼前那一項，把整理好的回覆傳過來：「I’ll handle this part. You still make your own call.」你少跑一輪，終於能靠回椅背；她願意合作，沒有打算承認你的名片比她的更有優先權。'
 ]
});

const UPWARD=Object.freeze({
 wing:[
  '翅膀笑著說自己人就是懂事，這輪零碎聯絡便交給原負責窗口。他讓你先坐著，把剛才要你跟跑的那一趟收回去。你捧出去的話終於換到一點照顧，沒有又領一包額外交辦；原本要怎麼回覆，仍等你自己開口。',
  '翅膀問你，既然這麼懂他的意思，怎麼還要他再講一遍。你本想靠名片省點事，先陪他坐完一小段訓話；這次沒多領整包工作，自己人那張椅子也不是每次坐上去都舒服。',
  '翅膀當眾說這輪聯絡不必再讓你跑，請原窗口把資料送來。你確實少費一點力，其他人卻全聽見了這份差別待遇；他越稱讚自己人，同桌的回話就越客氣。你得到了照顧，也得到了幾雙很難當沒看到的眼睛。',
  '翅膀把話聽得很舒服，叫你先坐下，這輪要確認的資料會有人送過來。你終於不用一邊表忠一邊跑腿，精神也鬆下來；這份任用第一次很像真的福利。資料到手後，原本的選擇仍由你回答。'
 ],
 spencer:[
  '屎潘蛇聽得很受用，請原窗口先把這輪資料帶過來，讓你坐著等。你原本怕又被安排一份不用錢的信任，這次倒是真的少跑幾趟；董事長給了照顧，沒有替你在原本那件事上點頭。',
  '屎潘蛇笑著請你先把眼前的話講清楚，說自己人也得自己決定。你沒拿到預期的方便，只多坐了一段格局課；這回沒有自動多一包待辦，馬屁卻也沒有每一句都能兌換成休息。',
  '屎潘蛇請窗口把這輪資料整理好送來，還說自己人不用事事親跑。你確實省了幾趟腳程，旁人則聽完一堂待遇差異的現場教學。董事長替你留了方便，原本那個問題卻還得你自己回答。',
  '屎潘蛇讓你坐著，把這輪零碎聯絡交回原窗口，還耐心聽完你的重點。你終於拿到一次不用追加表現的照顧，精神也回來不少；他替你省下腳程，原本條件接不接受仍等你親自說。'
 ]
});

function formalScene(run,event){
 return run?.pip?.active||event?.kind==='crisis'||/^(?:pip-|salary-|low-pay-tip$|dismissal-|paperwork$|crisis-boss$|floor-|watch-|labor-)/.test(event?.id||'');
}

function formalHelp(target,reaction){
 const name={wing:'翅膀',spencer:'屎潘蛇',hope:'希望',erich:'法師',jenjen:'真真',sonny:'阿福',rick:'瑞克',princess:'公主'}[target]||'對方';
 const line=target==='princess'?'她補一句：「Paperwork first. The decision is still yours.」':target==='rick'?'他還補一句，老闆的電話仍然由他接。':'';
 return `${name}${reaction==='welcomed'?'把這輪要核對的資料先整理好，連缺件位置都標出來':'先把這輪要補問的資料帶來，讓你不用再來回跑'}。你坐下喘了口氣，少受一輪折騰。${line}眼前的考核、條件與文件仍要逐項回應；這份方便沒有撤掉程序，也沒有替你接受或拒絕任何一項。`;
}

export function withPatronageOutcomesV67(run,event,target,legacyRows){
 if(!isPatronageBenefitsV67(run)||!run?.patronage||typeof run.patronage!=='object'||Array.isArray(run.patronage)||isPrivateSceneV39(event)||!Array.isArray(legacyRows)||legacyRows.length!==4||!REACTIONS.every((reaction,index)=>legacyRows[index]?.reaction===reaction))return legacyRows;
 const flattery=target==='wing'||target==='spencer',rival=RIVALS.has(target),help=Object.hasOwn(RIVAL_HELP,target)?RIVAL_HELP[target]:Object.hasOwn(HELP,target)?HELP[target]:null;
 if(!flattery&&!help)return legacyRows;
 const affinity=clamp(characterAffinity(run,target).score),mood=clamp(run.stats?.mood);
 // Only committed relationship history affects the weights. Rendering the
 // options never rolls RNG or stores a temporary property on the run.
 const weights=flattery?[52,18,10,20]:rival?[30,29,21,20]:[62,14,8,16];
 if(mood<30){weights[0]-=4;weights[1]+=4;weights[2]+=2;weights[3]-=2;}
 if(affinity>=70){weights[0]+=4;weights[1]-=3;weights[2]-=2;weights[3]+=1;}
 else if(affinity<35){weights[0]-=8;weights[1]+=6;weights[2]+=4;weights[3]-=2;}
 if(target==='wing'){
  const boss=clamp(run.stats?.boss);
  if(boss>=70){weights[0]+=6;weights[1]-=6;weights[2]-=3;weights[3]+=3;}
  else if(boss<30){weights[0]-=10;weights[1]+=8;weights[2]+=6;weights[3]-=4;}
 }
 return legacyRows.map((row,index)=>{
  const reaction=REACTIONS[index],positive=reaction==='obliged'||reaction==='welcomed';
  const delta=flattery?[
   {mood:10,energy:6,trust:-2,lick:2},{mood:-7,energy:-3,trust:-1},{mood:3,energy:2,trust:-3,lick:1},{mood:16,energy:10,trust:1,lick:2}
  ][index]:[
   {mood:12,energy:8,trust:rival?-4:-3},{mood:-6,energy:-3,trust:-2},{mood:-7,energy:-3,trust:-3},{mood:16,energy:10,trust:rival?0:1}
  ][index];
  if(target==='wing')delta.boss=[8,-5,4,10][index];
  else if(reaction==='reported'&&WING_REPORTS.has(target))delta.boss=rival?-4:-2;
  const affinityDelta=(flattery?[8,-6,3,12]:rival?[-10,-18,-20,-3]:[-6,-12,-12,4])[index];
  let result=flattery?UPWARD[target][index]:positive?help[index===0?0:1]:row.result;
  if(target==='princess'&&!positive)result=reaction==='retort'
   ?'公主把你的名片推回來：「Your new title doesn’t put you above me.」她連誰先認識翅膀都懶得算，直接把原本的問題留在你面前。這次沒叫到幫忙，倒把家譜競爭的火添得很旺。'
   :'公主直接拿起手機：「Dad, did you approve this?」你想靠自己人的名片少跑一輪，她卻把另一張自己人專線打通了。翅膀嫌你們又為小事叫他，這回沒省下力氣，反而多了一個正在等你解釋的人。';
  if(formalScene(run,event)&&(positive||flattery&&reaction==='reported'))result=formalHelp(target,reaction);
  return {...row,weight:Math.max(2,weights[index]),label:flattery?['自己人優先照顧','好話也沒買到方便','當眾得到照顧','這回真的被照顧'][index]:['照辦，臉色另算','這次不吃名片這套','轉頭請示或告狀','真的有人分擔這一輪'][index],result,delta,affinityDelta};
 });
}
