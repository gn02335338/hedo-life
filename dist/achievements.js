// Shared by the browser and replay verifier. No player-supplied achievement IDs
// are used as evidence; callers derive these goals from an actual engine run.
import { EXTRA_ACHIEVEMENTS, deriveExtraAchievements } from './achievements-v18.js';
import { resolvedRageAttempts } from './rage-achievements.js';
import { WEALTH_ACHIEVEMENTS, deriveWealthAchievements } from './wealth-achievements.js';
import { ACHIEVEMENTS_V32, deriveAchievementsV32, hasCompanyFinaleV32 } from './achievements-v32.js';
const badge=(id,title,description,group,options={})=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`,...options});
const realBadge=(person,title,description)=>badge(`real-hit-${person}`,title,description,'rage',{mode:'real',image:`./assets/achievements/rage-${person}.svg`});
const modeBadge=(id,title,description,mode,art)=>badge(id,title,description,'rage',{mode,image:`./assets/achievements/${art||id}.svg`});

// Old unlock rows store only an ID and timestamp, not the event that earned
// them. Keep those souvenirs without relabelling an imagined hit as a real one.
export const LEGACY_RAGE_ACHIEVEMENTS=Object.freeze([
 ['rage-wing','執行長，接招。'],['rage-spencer','董事長也有這一天。'],
 ['rage-rick','乾兒子的起床號'],['rage-hope','改善一下這個。'],
 ['rage-erich','法務長，請收件。'],['rage-jenjen','行政流程跑歪了。'],
 ['rage-sonny','門禁以外的請求'],['rage-kind','鋼琴先暫停。'],
 ['rage-catharsis','整間辦公室都聽見了。'],['rage-absent','人呢？拳頭也在等。'],
 ['rage-documented','此畫面已被存證。'],['rage-jack','史官，這筆也要記？'],
 ['rage-first-day','你好，我是今天來的。'],['rage-meimei','這筆不在報價裡。']
].map(([id,title])=>badge(id,title,'當時領到的舊版暴走獎章。舊規則可能把腦內想像、卡通演出與現實混算，這枚章保留作紀念，不當作真的動手的證明。','legacy-rage')));
export const LEGACY_RAGE_ACHIEVEMENT_MAP=Object.freeze(Object.fromEntries(LEGACY_RAGE_ACHIEVEMENTS.map(item=>[item.id,item])));
export const ACHIEVEMENTS=Object.freeze([
 badge('work-card','報到成功，內容另議。','在報到日做出第一個選擇，領到這段人生的工作證。','office'),
 badge('switch','JD 文學獎','報到後的實際工作與應徵職缺不同。你替「工作內容有彈性」補上了註解。','office'),
 badge('assistant','多兩個字，少一份薪。','報到時被改以助理任用。多出的是「助理」，縮水的是原本談好的待遇。','office'),
 badge('robot','AI 的 A 是 Anything。','應徵 AI 工程師，報到後卻去了另一個職缺。模型晚點再找，工作先做。','office'),
 badge('promotion','名片真的換了。','成功升遷，或從助理轉正。這次人事通知有改到你的職稱。','career'),
 badge('manager','輪到你簽表了。','靠升遷走到經理級，開始接住別人的工作與自己的鍋。','career'),
 badge('director','大餅分送處','靠升遷走到總監級。以前坐台下聽，現在輪到你替高層把話說完。','career'),
 badge('pip','改善計畫已送達。','正式進入一次 PIP。工作還沒變少，文件先變多了。','career'),
 badge('pip-pass','你過了，他沒放過。','通過 PIP 評核。至少這張表格，不能再寫你沒有交作業。','career'),
 badge('pay-cut','工作量維持原價。','接受一次降薪。薪資打了折，待辦清單沒有。','career'),
 badge('salary-save','薪水，先不要動。','談判成功，讓已提出的降薪撤回。你保住了數字，也留下了紀錄。','career'),
 badge('education','畢業後的臨時考試','回應過 Wing 在前期以學歷或科系挑起的薪資爭議。畢業證書沒有附這一題。','office'),
 badge('self-care','這筆預算留給我。','同一局花錢照顧自己三次。每一筆都有理由，收據不用交公司。','office'),
 badge('kind-decline','今晚不當鋼琴。','拒絕阿良的私房紓壓邀請。各人有各人的行程，你留住了自己的。','office'),
 realBadge('wing','執行長，接招。','真的對翅膀動手一次。這回手沒有留在膝上，接下來的事也得自己面對。'),
 realBadge('spencer','董事長也有這一天。','真的對屎潘蛇動手一次。現場的董事長停下了話頭，事情已經回不到剛才。'),
 realBadge('rick','乾兒子的起床號','真的對老闆乾兒子動手一次。這次叫醒他的不是老闆來電，現場也沒有夢醒鍵。'),
 realBadge('hope','改善一下這個。','真的對希望動手一次。散在桌邊的評核表，這回不是只在你腦內飛。'),
 realBadge('erich','法務長，請收件。','真的對法師動手一次。原本的文件暫停了，雙方都得處理眼前新發生的事。'),
 realBadge('jenjen','行政流程跑歪了。','真的對 Moon Dog 動手一次。交接清單掉在現場，這一頁沒有照原流程走。'),
 realBadge('sonny','門禁以外的請求','真的對阿福動手一次。螢幕還亮著，現場卻已經不是一張資訊工單能結案。'),
 realBadge('kind','鋼琴先暫停。','真的對阿良動手一次。他這回來不及消失，你也得面對這次出手的後續。'),
 modeBadge('dream-catharsis','腦內掌聲，現場靜音。','在腦內把那口氣演完。你自己看完了一整場，現場的人連開演都不知道。','imagined','rage-catharsis'),
 modeBadge('dream-absent','夢裡也追不到阿良。','在腦內追阿良追了個空。人沒找到，回過神來，手還放在原處。','imagined','rage-absent'),
 modeBadge('real-documented','此畫面已被存證。','真的出手後，完成正式處理的對話並留下紀錄。對方說過的話、自己做過的事，都留在同一份經過裡。','real','rage-documented'),
 badge('banquet','今年還在同一桌。','參加移動尾牙，做出你的宴會選擇。菜上桌了，意外也在路上。','banquet'),
 badge('banquet-prize','這次不是願景。','在尾牙抽到大獎。這一次的幸運，終於有實物可以領。','banquet'),
 badge('banquet-stage','麥克風來不及收回。','參與尾牙的上台橋段。你留下的表現，可能比簡報更有人記得。','banquet'),
 badge('banquet-shared','同桌的人才是主菜。','尾牙中獎後，照說好的請同桌喝一輪飲料。獎金有人分，甜度自己選。','banquet'),
 badge('kind-ghost','他說好，然後人就沒了。','約阿良去續攤，收到他的答應，也等到他的消失。','banquet'),
 badge('first-ending','第一張離場證明','完成一段人生。這個結尾已經收好，下一局可以換一種活法。','career'),
 realBadge('jack','史官，這筆也要記？','真的對傑克動手一次。他的筆記本這回得記下現場的事，也包括你的那一下。'),
 badge('nasdaq','願景真的敲得響。','走到納斯達克敲鐘的結局。這一次，鐘聲不是會議通知。','career'),
 modeBadge('rage-imagined','腦內有聲，現場靜音。','衝動在腦中演完，手還放在原處。對方不知道自己剛才經歷了什麼。','imagined'),
 modeBadge('rage-real','這次沒有醒過來。','一次暴走真的越過了想像，走進必須自己處理後果的世界線。','real'),
 modeBadge('real-first-day','你好，我是今天來的。','報到對話還沒結束，就真的對翅膀動手。工作證還沒暖，他已經不知道這場新人介紹該怎麼接。','real','rage-first-day'),
 modeBadge('rage-legal','附件裡也有自己。','真正出手後，走完正式處理的分支。對方的話和自己的動作，都不能跳過。','real'),
 modeBadge('rage-defeated','腦內片尾沒有這段。','真正出手後反而落入下風。原本想像的勝利畫面，現場一格都沒播。','real'),
 modeBadge('rage-coup','名牌怎麼換成我？','真正出手後，在失控的荒謬宇宙裡接班。董事會的邏輯比你的報到流程還離奇。','real'),
 ...EXTRA_ACHIEVEMENTS,
 realBadge('meimei','這筆不在報價裡。','真的對水蛇動手一次。客戶資料夾還在現場，今天發生的事已經超出原訂議程。'),
 modeBadge('dream-meimei','這一下要開需求單嗎？','在腦內對水蛇揮拳，聽完她的離譜報價才回過神。現場的客戶資料夾沒有動過。','imagined'),
 modeBadge('dream-first-day','人還沒報到，腦內先下班。','報到對話中，在腦內扁了翅膀。你回過神來，他還在介紹座位，工作證也還沒拿好。','imagined','rage-first-day'),
 badge('banquet-first-love','First Love 搶麥決鬥','替傑克和水蛇的 First Love 決鬥舉牌計分。就算翅膀拿願景插播，這場搶麥也已經開打。','banquet'),
 badge('sonny-press-conference','阿福的理由伯記者會','腕力賽後，用披薩盒替阿福開記者會。抽筋、拉到、吃太飽，聲明比比賽還長。','office'),
 badge('sonny-unplayed-champion','尚未出賽世界冠軍','先收桌不比，把披薩盒冠軍盃頒給阿福。人還沒上桌，勝利聲明已經講到第四點。','office'),
 ...WEALTH_ACHIEVEMENTS,
 badge('ai-auto-increment','原來公司的AI是Auto Increment','以 AI 工程師身分修好資料匯入，發現被叫作 AI 的東西，其實是主鍵的自動編號。','craft'),
 ...ACHIEVEMENTS_V32
]);
export const ACHIEVEMENT_MAP=Object.freeze(Object.fromEntries(ACHIEVEMENTS.map(item=>[item.id,item])));
export const ACHIEVEMENT_RECORD_MAP=Object.freeze({...LEGACY_RAGE_ACHIEVEMENT_MAP,...ACHIEVEMENT_MAP});
export const ACHIEVEMENT_GROUPS=Object.freeze({office:'上班日常',career:'職涯與離場',rage:'失控世界線',verbal:'口舌風波',banquet:'尾牙之夜',wallet:'存款的用處',craft:'本事與代價','legacy-rage':'舊版暴走紀念'});

export function deriveAchievements(run){
 if(!run||typeof run!=='object')return [];
 const flags=run.flags&&typeof run.flags==='object'?run.flags:{},history=Array.isArray(run.history)?run.history:[],ids=new Set();
 const add=(id,yes)=>{if(yes)ids.add(id);};
 const onboard=history.some(item=>item?.eventId==='onboarding');
 add('work-card',onboard);
 add('switch',onboard&&flags.bait_switch>0);
 add('assistant',onboard&&flags.assistant>0);
 add('robot',onboard&&run.roleId==='ai'&&run.actualRoleId!=='ai');
 add('promotion',flags.promotions>0);
 const promotedPeak=/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')?flags.career_promoted_peak:flags.career_peak_rank;
 add('manager',flags.promotions>0&&promotedPeak>=(/^e(?:17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')?5:2));
 add('director',flags.promotions>0&&promotedPeak>=(/^e(?:17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')?6:3));
 add('pip',run.pipCount>0);
 add('pip-pass',flags.pip_passed>0);
 add('pay-cut',flags.pay_cut>0);
 add('salary-save',run.salaryCut?.status==='rescinded');
 add('education',flags.education_outcome>0);
 add('self-care',history.filter(item=>/^e(?:25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')&&item?.eventId?.startsWith('meal-with-')?(item.delta?.cash||0)<0:item?.eventId==='self-care'&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0&&item.choiceIndex<(/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')?7:3)&&(!/^e(?:25|26|27|28|29|30|31|32|33|34|35)-/.test(run.seed||'')||item.choiceIndex!==4)).length>=3);
 add('kind-decline',flags.kind_declined>0);
 const attempts=resolvedRageAttempts(run),real=attempts.filter(item=>item.mode==='real'),imagined=attempts.filter(item=>item.mode==='imagined');
 for(const person of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack','meimei'])add(`real-hit-${person}`,real.some(item=>item.person===person));
 add('dream-catharsis',imagined.length>0);
 add('dream-meimei',imagined.some(item=>item.person==='meimei'));
 add('dream-absent',imagined.some(item=>item.person==='kind'));
 add('real-documented',real.some(attempt=>history.slice(attempt.historyIndex+1).some(item=>item?.eventId==='rage-legal'&&item.kind==='rage-world'&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0)));
 add('banquet',flags.banquet_attended>0);
 add('banquet-prize',flags.banquet_prize>0);
 add('banquet-stage',flags.banquet_stage>0);
 add('banquet-shared',flags.banquet_shared>0);
 add('kind-ghost',flags.kind_afterparty_ghost>0);
 add('first-ending',run.completed===true);
 add('nasdaq',/^e(?:32|33|34|35)-/.test(run.seed||'')?hasCompanyFinaleV32(run,'nasdaq'):run.completed===true&&typeof run.endingId==='string'&&run.endingId.startsWith('nasdaq-'));
 add('rage-imagined',imagined.length>0);
 add('rage-real',real.length>0);
 add('real-first-day',real.some(item=>item.person==='wing'&&item.origin==='onboarding'));
 add('dream-first-day',imagined.some(item=>item.person==='wing'&&item.origin==='onboarding'));
 // Read committed canonical choices, not the corrected display copy or broad
 // banquet/rage flags. Both resolved song draws participated in the duel.
 const resolved=history.filter(item=>Number.isInteger(item?.choiceIndex)&&item.choiceIndex>=0&&typeof item.result==='string'&&item.result.trim());
 add('ai-auto-increment',/^e(?:31|32|33|34|35)-/.test(run.seed||'')&&run.actualRoleId==='ai'&&resolved.some(item=>item.eventId==='ai31-auto-increment'&&item.kind==='daily'&&item.speaker==='rick'&&item.choiceIndex<=2));
 add('banquet-first-love',resolved.some(item=>item.eventId==='banquet-welcome'&&item.kind==='banquet'&&item.speaker==='rick'&&item.choiceIndex===1&&item.eventOutcome?.label==='尾牙點歌台'&&['成功搶麥','被夢想插播'].includes(item.eventOutcome.result)));
 const arm=resolved.filter(item=>item.eventId==='video-pizza-overtime'&&item.kind==='daily'&&item.speaker==='sonny');
 add('sonny-press-conference',arm.some(item=>item.choiceIndex===1));
 add('sonny-unplayed-champion',arm.some(item=>item.choiceIndex===2));
 for(const family of ['legal','defeated','coup'])add(`rage-${family}`,real.length>0&&run.completed===true&&typeof run.endingId==='string'&&run.endingId.startsWith(`rage_${family}-`));
 for(const id of deriveExtraAchievements(run))ids.add(id);
 for(const id of deriveWealthAchievements(run))ids.add(id);
 for(const id of deriveAchievementsV32(run))ids.add(id);
 return ACHIEVEMENTS.filter(item=>ids.has(item.id)).map(item=>item.id);
}
