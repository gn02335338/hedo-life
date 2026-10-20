// Shared by the browser and replay verifier. No player-supplied achievement IDs
// are used as evidence; callers derive these goals from an actual engine run.
const badge=(id,title,description,group)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`});
export const ACHIEVEMENTS=Object.freeze([
 badge('work-card','報到成功，內容另議。','在報到日做出第一個選擇，領到這段人生的工作證。','office'),
 badge('switch','JD 文學獎','報到後的實際工作與應徵職缺不同。你替「工作內容有彈性」補上了註解。','office'),
 badge('assistant','少兩個字，少一份薪。','拿到助理職稱，並在報到日看清楚自己的新工作。','office'),
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
 badge('rage-wing','執行長，接招。','對 Wing 暴走一次，親眼看完這場衝動究竟演到哪裡。','rage'),
 badge('rage-spencer','董事長也有這一天。','對 Spencer 暴走一次。董事長這回沒有站在合照中央。','rage'),
 badge('rage-rick','乾兒子的起床號','對 Rick 暴走一次。這次叫醒他的不是老闆來電。','rage'),
 badge('rage-hope','改善一下這個。','對 Hope 暴走一次。評核表突然多出一欄她沒準備的。','rage'),
 badge('rage-erich','法務長，請收件。','對 Erich 暴走一次，讓法務有了新的辦公室案例。','rage'),
 badge('rage-jenjen','行政流程跑歪了。','對 JenJen 暴走一次。這張申請單沒有現成範本。','rage'),
 badge('rage-sonny','門禁以外的請求','對 Sonny 暴走一次。工單分類一時找不到這一項。','rage'),
 badge('rage-kind','鋼琴先暫停。','對阿良暴走一次。今晚的節奏，跟他安排的不一樣。','rage'),
 badge('rage-catharsis','整間辦公室都聽見了。','在卡通暴走中得到一次痛快的情緒出口。這回沒有把話吞回去。','rage'),
 badge('rage-absent','人呢？拳頭也在等。','卡通暴走時撲了個空。人沒找到，心裡那齣戲已經演完。','rage'),
 badge('rage-documented','此畫面已被存證。','一次卡通暴走被留下紀錄。你終於也成了附件裡的人。','rage'),
 badge('banquet','今年還在同一桌。','參加移動尾牙，做出你的宴會選擇。菜上桌了，意外也在路上。','banquet'),
 badge('banquet-prize','這次不是願景。','在尾牙抽到大獎。這一次的幸運，終於有實物可以領。','banquet'),
 badge('banquet-stage','麥克風來不及收回。','參與尾牙的上台橋段。你留下的表現，可能比簡報更有人記得。','banquet'),
 badge('banquet-shared','同桌的人才是主菜。','尾牙中獎後，照說好的請同桌喝一輪飲料。獎金有人分，甜度自己選。','banquet'),
 badge('kind-ghost','他說好，然後人就沒了。','約阿良去暗黑續攤，收到他的答應，也等到他的消失。','banquet'),
 badge('first-ending','第一張離場證明','完成一段人生。這個結尾已經收好，下一局可以換一種活法。','career'),
 badge('rage-jack','史官，這筆也要記？','對傑克暴走一次。他拿起筆記本，發現自己也變成了今天的素材。','rage'),
 badge('nasdaq','願景真的敲得響。','走到納斯達克敲鐘的結局。這一次，鐘聲不是會議通知。','career'),
 badge('rage-imagined','腦內有聲，現場靜音。','衝動在腦中演完，手還放在原處。對方不知道自己剛才經歷了什麼。','rage'),
 badge('rage-real','這次沒有醒過來。','一次暴走真的越過了想像，走進必須自己處理後果的世界線。','rage'),
 badge('rage-first-day','你好，我是今天來的。','報到時就對 Wing 暴走。工作證還沒暖，他已經不知道這場新人介紹該怎麼接。','rage'),
 badge('rage-legal','附件裡也有自己。','真正出手後，走完正式處理的分支。對方的話和自己的動作，都不能跳過。','rage'),
 badge('rage-defeated','腦內片尾沒有這段。','真正出手後反而落入下風。原本想像的勝利畫面，現場一格都沒播。','rage'),
 badge('rage-coup','名牌怎麼換成我？','在失控後的荒謬宇宙裡接班。董事會的邏輯比你的報到流程還離奇。','rage')
]);
export const ACHIEVEMENT_MAP=Object.freeze(Object.fromEntries(ACHIEVEMENTS.map(item=>[item.id,item])));
export const ACHIEVEMENT_GROUPS=Object.freeze({office:'上班日常',career:'職涯與離場',rage:'失控世界線',banquet:'尾牙之夜'});

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
 add('manager',flags.promotions>0&&flags.career_peak_rank>=2);
 add('director',flags.promotions>0&&flags.career_peak_rank>=3);
 add('pip',run.pipCount>0);
 add('pip-pass',flags.pip_passed>0);
 add('pay-cut',flags.pay_cut>0);
 add('salary-save',run.salaryCut?.status==='rescinded');
 add('education',flags.education_outcome>0);
 add('self-care',history.filter(item=>item?.eventId==='self-care'&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0&&item.choiceIndex<3).length>=3);
 add('kind-decline',flags.kind_declined>0);
 for(const person of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack'])add(`rage-${person}`,flags[`rage_target_${person}`]>0);
 add('rage-catharsis',flags.rage_catharsis>0);
 add('rage-absent',flags.rage_absent>0);
 add('rage-documented',flags.rage_documented>0);
 add('banquet',flags.banquet_attended>0);
 add('banquet-prize',flags.banquet_prize>0);
 add('banquet-stage',flags.banquet_stage>0);
 add('banquet-shared',flags.banquet_shared>0);
 add('kind-ghost',flags.kind_afterparty_ghost>0);
 add('first-ending',run.completed===true);
 add('nasdaq',run.completed===true&&typeof run.endingId==='string'&&run.endingId.startsWith('nasdaq-'));
 add('rage-imagined',flags.rage_imagined>0);
 add('rage-real',flags.rage_real>0);
 add('rage-first-day',flags.rage_first_day>0&&flags.rage_target_wing>0);
 for(const family of ['legal','defeated','coup'])add(`rage-${family}`,run.completed===true&&typeof run.endingId==='string'&&run.endingId.startsWith(`rage_${family}-`));
 return ACHIEVEMENTS.filter(item=>ids.has(item.id)).map(item=>item.id);
}
