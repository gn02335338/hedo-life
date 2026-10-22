// Optional, replayable activity scenes. Recollections supply the motifs; all
// dialogue, scores, draws and later developments are original game fiction.
// No RNG, storage or engine mutation belongs in this presentation/resolver.
export const ACTIVITY_IDS_V44=Object.freeze(['arm','diet','roadshow','dinner','banquet','basketball','review']);
export const ACTIVITY_META_V44=Object.freeze({
 arm:{name:'腕力大賽',teaser:'十秒鐘的比賽，三輪以上的賽前聲明。',mechanic:'議定規則 → 十秒對決 → 賽後記者會',stages:3,scene:'arm_wrestling'},
 diet:{name:'減肥比賽',teaser:'比賽才剛開始，蛋塔已經抵達。',mechanic:'選定步調 → 午餐誘惑 → 結算習慣',stages:3,scene:'dinner'},
 roadshow:{name:'Roadshow',teaser:'台上展示產品，台下尋找真的能用的人。',mechanic:'配置展位 → 接待提問 → 整理有效名單',stages:3,scene:'public_stage'},
 dinner:{name:'公司聚餐',teaser:'第一盤是招待，第三盤開始討論家庭。',mechanic:'安排座位 → 共享預算 → 最後一盤',stages:3,scene:'dinner'},
 banquet:{name:'尾牙',teaser:'First Love 決鬥、抽獎，還有阿良的「等一下」。',mechanic:'搶麥決鬥 → 同桌插曲 → 抽獎 → 散場續攤',stages:4,scene:'banquet'},
 basketball:{name:'傑克約打球',teaser:'這次不看職稱，先看誰願意回防。',mechanic:'分隊暖身 → 傳球或出手 → 最後一波',stages:3,scene:'basketball'},
 review:{name:'政府專案審查',teaser:'水蛇帶資料，你帶簡報，雨傘也還在你手上。',mechanic:'準備佐證 → 追問應對 → 修正承諾',stages:3,scene:'meeting'}
});
const clamp=(n,min=0,max=12)=>Math.max(min,Math.min(max,n));
const ctx=run=>{
 const x=run?.activityContext;
 if(!x||x.version!==1||!ACTIVITY_IDS_V44.includes(x.id)||!Number.isInteger(x.stage)||x.stage<0||x.stage>=ACTIVITY_META_V44[x.id].stages)throw new Error('Invalid activity context');
 return x;
};
const c=(text,extra={})=>({text,...extra});
const balance=run=>Number.isFinite(run?.stats?.cash)?run.stats.cash:0;
const scoreOf=x=>Number.isFinite(x.score)?x.score:0;
const pressureOf=x=>Number.isFinite(x.pressure)?x.pressure:0;
const male=run=>run.characterGender==='male';
const sourceFor={arm:'videoOffice',diet:'verifiedQuiz',roadshow:'verifiedQuiz',dinner:'budget',banquet:'chronicleBanquet',basketball:'characterFiction',review:'verifiedQuiz'};
const reviewQuestion=run=>{
 const role=run.actualRoleId||run.roleId;
 if(['system','ai','mis'].includes(role))return '模型和演算法先放旁邊，委員要看資料授權、可重現的測試和驗收證據';
 if(['sales','bd','executive'].includes(role))return '委員先問客戶承諾、合作範圍與經費用途，不接受只說市場很大';
 if(['finance','accounting','hr','admin'].includes(role))return '委員先問費用對應的單據、工時與人員紀錄，每一筆都要能找到來源';
 if(role==='design')return '委員先問使用者測試、素材授權和設計驗收，漂亮的畫面不能代替紀錄';
 return '委員先問里程碑、成果交付與驗收依據，時程表裡每一格都得有人負責';
};
const scene=(run,title,body,speaker,wing,choices,extra={})=>{
 const x=ctx(run),meta=ACTIVITY_META_V44[x.id];
 return {id:`activity44-${x.id}-${x.stage}`,title,body,speaker,wing,choices,kind:'activity',
  scope:['roadshow','review'].includes(x.id)?'work':'private',era:`同事揪團・${meta.name}`,sourceIds:[...new Set([sourceFor[x.id],'characterFiction'])],scene:meta.scene,
  activity:{id:x.id,stage:x.stage,total:meta.stages,mechanic:meta.mechanic,scoreMax:12,pressureMax:12,scoreLabel:extra.scoreLabel||'累積進展',score:scoreOf(x),pressureLabel:extra.pressureLabel||'累積插曲',pressure:pressureOf(x)},...extra};
};

export function getActivityEventV44(run){
 const x=ctx(run),s=x.stage;
 if(x.id==='arm'){
  if(s===0)return scene(run,'手還沒上桌，規則先開三次會。','傑克把桌面清空，阿福先問有沒有錄影，再說今天吃太飽。披薩盒裡又少了一片。你們提議只比十秒，平手算阿福贏；他想了一下，說開始的那一秒也要先定義。','sonny','先說好，抽筋跟拉到是兩件事，不能混在一起。',[
   c('手機收起來，十秒、平手算阿福贏，請雙方點頭。'),
   c('先讓雙方各講一項顧慮，談妥了才把手放上桌。'),
   c('把披薩盒當規則白皮書，每個但書配一塊餅皮。',{wild:true})
  ],{scoreLabel:'賽事共識',pressureLabel:'追加但書'});
  if(s===1)return scene(run,'現在開始。這句話今天終於有用。',`阿福終於坐下，傑克伸出手。強哥問計時算不算助理工程師的工作；你把計時器轉給他看。${x.plan==='rules'?'剛才談妥的規則放在桌邊，所有人都看得到。':'桌邊的聲明比觀眾還多，開始前得再確認一次。'} 阿福說自己不是不比，只是狀況還沒調整到正式比賽。`,'jack','先確認大家都願意比。喊停就停，輸贏不用拿手去換。',[
   c('照規則計十秒，結束就喊停。'),
   c('讓阿福先確認姿勢，確認後就比，不再追加賽程。'),
   c('請披薩盒先頒世界冠軍，今天直接休兵。',{wild:true})
  ],{scoreLabel:'賽事共識',pressureLabel:'追加但書'});
  return scene(run,x.plan==='unplayed'?'腕力還沒比，理由伯已經開始加賽。':'腕力比完，理由伯開始加賽。',x.plan==='unplayed'?'今天沒有開比，阿福卻已經準備好三份聲明：椅子不對、剛才有點拉到、今天吃得太飽。傑克指著沒啟動的計時器，阿福說真正的強者不需要每次都證明。':'阿福先檢討椅子高度，再補充剛才那一下可能拉到，最後說有人弄傷他的手。傑克把手收回來，問他要不要先休息。阿福說要，然後繼續講這場為什麼不能照剛才的結果算。','sonny','我不是輸，是今天那個地方不太對。你們不要只剪結果。',[
   c(x.plan==='unplayed'?'記下今天沒有開比，理由歸理由，比賽改日再約。':'把約定、喊停時間和雙方說法記在同一張紙。'),
   c('用披薩盒開「理由伯記者會」，請他逐條發布聲明。',{wild:true}),
   c('頒一座「尚未出賽世界冠軍」紙獎盃，宣布下屆改日。',{wild:true})
  ],{scoreLabel:'賽事共識',pressureLabel:'追加但書'});
 }
 if(x.id==='diet'){
  if(s===0)return scene(run,'減肥比賽先從不要盯著別人的便當開始。','群組開了減肥比賽，安妮余幫忙整理名單。有人想比體重，有人只想每天下樓走一圈。紅茶提醒大家，餐盒不是稽核憑證，誰都沒有義務公開身體數字。你要先選自己的參賽方式。','annie_yu','先說好，我幫忙記進度，不幫忙沒收別人的午餐。',[
   c('選規律吃飯加散步，只交自己的習慣紀錄。'),
   c('找一位同事互相提醒，忙的時候也照常吃飯。'),
   c('成立反內耗減肥隊：先減掉每餐被旁人評論的重量。',{wild:true})
  ],{scoreLabel:'習慣持續',pressureLabel:'比較壓力'});
  if(s===1)return scene(run,'蛋塔沒有參賽，卻成了全場焦點。',`${x.plan==='buddy'?'你和同伴約好互相提醒，今天也準時出現在午餐桌旁。':x.plan==='no-policing'?'你們的隊名還貼在群組裡，午餐評論席今天先休息。':'你照自己的吃飯與散步步調，來到下一輪午餐。'}午餐後有人分蛋塔，安妮余看看點心，再看看比賽名單：「他有吃這個，怎麼紀錄還比我好？」紅茶把名單蓋起來，說先別替一顆蛋塔安排道德審判。你手上有一個空盤，這一輪要怎麼過？`,'sophie','別人的身體不是每天重新投票的辦公室提案。',[
   c('想吃就拿一份，照原本步調繼續，不評論別人。'),
   c('先去散個步，回來再決定自己想吃什麼。'),
   c('給蛋塔一張員工證：既然被檢討成這樣，至少讓它領薪。',{wild:true})
  ],{scoreLabel:'習慣持續',pressureLabel:'比較壓力'});
  return scene(run,'公布成績前，先決定這場到底在比什麼。','主辦人準備統計紀錄，群組卻開始追問誰昨天多吃一塊。安妮余說她只想知道自己哪裡可以做得更穩定，不想讓午餐變成現場答辯。你把這幾輪自己的紀錄拿出來，桌上終於有一份只屬於你的數字。','annie_yu','我可以輸一場比賽，不想從此連吃點心都要寫檢討。',[
   c('只核對自己的習慣，留下做得到的部分。'),
   c('把互相提醒改成一起散步，退出公開排名。'),
   c('宣布蛋塔榮獲年度最佳情緒負重訓練器材。',{wild:true})
  ],{scoreLabel:'習慣持續',pressureLabel:'比較壓力'});
 }
 if(x.id==='roadshow'){
  if(s===0)return scene(run,'展位還沒搭好，願景已經先到場。','真真拿來這次 Roadshow 的分工表。強哥看到搬設備那欄，提醒自己只是助理工程師；安妮余帶了甜點，他說太甜，手卻又伸過去。你記得有人抱怨完上次活動，下一次就從名單消失。這次上台前，先決定展位要靠什麼說話。','jenjen','名字在分工表上的，先確認自己究竟要帶什麼來。',[
   c('帶能重現的展示和離線備案，先測一輪。'),
   c('把客戶問題整理成一頁，展位先接真正的需求。'),
   c('請玩具鵝當展位董事長，真人只回答已經做出來的功能。',{wild:true})
  ],{scoreLabel:'有效接觸',pressureLabel:'待補承諾'});
  if(s===1)return scene(run,'觀眾問的，剛好不在那張最漂亮的投影片。',`${x.plan==='demo'?'剛才測過的展示已經開著，離線備案也放在桌邊。':x.plan==='needs'?'你先前整理的需求頁就放在手邊。':'玩具鵝坐在名牌後面，真人開始接手問題。'}有人問資料從哪裡來，有人直接問能不能在自己的設備上跑。翅膀看向你，意思是台上不要停太久。強哥在旁邊提醒：「這應該不是助理工程師能承諾的吧？」投影幕還亮著，等你決定先回答哪一件。`,'wing','先讓他知道我們可以做到什麼。不要每一題都講但是。',[
   c('拿可驗證的展示回答，未完成的需求另列確認。'),
   c('先問對方使用場景，約實際測試再談承諾。'),
   c('讓玩具鵝舉「這題不在簡報」牌，真人補上目前的限制。',{wild:true})
  ],{scoreLabel:'有效接觸',pressureLabel:'待補承諾'});
  return scene(run,'收攤前，先把名片和願望分開。','桌上有名片、試用要求和一句「之後可以聊聊」。有人想全部算成商機，真真問哪些人真的同意後續聯絡。安妮余把最後一盒甜點封起來；強哥忽然很願意負責協助搬運。你要交出這場活動的最後一份紀錄。','jenjen','不用把路過的人都寫成準客戶，明天還得有人聯絡。',[
   c('只交有需求、有聯絡同意的名單，附上下一步。'),
   c('先把台上新增的承諾找人確認，沒有答案就標待辦。'),
   c('替路過人潮頒感謝狀，但拒絕把感謝狀灌進營收預測。',{wild:true})
  ],{scoreLabel:'有效接觸',pressureLabel:'待補承諾'});
 }
 if(x.id==='dinner'){
  if(s===0)return scene(run,'公司請客，先看誰有座位。','船長核對名單，發現到場人數比椅子多。屎潘蛇說今天預算有限，下次再去更好的地方。歐文把墨鏡放上桌，問誰要一起點餐；你看看菜單，決定先安置人，還是先安置自己的胃。','captain','人有到，椅子還在協調。你先不要把包包當成一位。',[
   c('和同事併桌，先確認每個人都有一份能吃的。'),
   c('坐在歐文旁邊，合看菜單，把預算先留給共享菜。'),
   c('替空椅子列編制，請缺席主管先讓位給真的來吃飯的人。',{wild:true})
  ],{scoreLabel:'同桌默契',pressureLabel:'共享預算已用'});
  if(s===1)return scene(run,'炙燒比目魚上桌，全桌忽然願意合作。','前幾道便宜的菜轉了兩圈，炙燒比目魚才剛上桌就空了一半。歐文說好吃，再點一盤吧；屎潘蛇看看菜單，說大家不要客氣，手指卻停在價格旁邊。這一盤要怎麼分，會影響最後還有多少餘裕。','owen','第二盤可以吧？大家明明都還想吃。',[
   c('照人數分好，再點一盤共享，把其他加點先停下。'),
   c('問全桌還缺什麼，先補飯和能讓大家吃飽的菜。'),
   c('成立比目魚分配委員會，每個人的筷子只能投一票。',{wild:true})
  ],{scoreLabel:'同桌默契',pressureLabel:'共享預算已用'});
  return scene(run,'第三盤比目魚，忽然需要討論家庭。',`歐文又看了一次菜單。屎潘蛇這次說大家要早點回家陪家人，剛才的「別客氣」像是已經結帳。${pressureOf(x)>=5?'前面共享預算用得緊，服務生拿著點餐機等你們最後確認。':'前面留了些餘裕，但桌上不一定還需要另一份一樣的菜。'} 船長拿起外套，等一個能真的散場的答案。`,'spencer','吃飽最重要。家人應該也在等了吧。',[
   c(pressureOf(x)>=5?'核對大家有沒有吃飽，桌上剩的先分完再散場。':'核對大家有沒有吃飽，再問能否加一盤共享菜。'),
   c('我自己加點一份給同桌分享。（自付 4）',{available:balance(run)>=4}),
   c('替第三盤比目魚申請留職停薪，明年預算核准再回來。',{wild:true})
  ],{scoreLabel:'同桌默契',pressureLabel:'共享預算已用'});
 }
 if(x.id==='banquet'){
  if(s===0)return scene(run,'First Love 前奏一響，兩位選手同時起立。','水蛇點了 First Love，傑克聽見前奏就往麥克風靠。她說這首是自己點的，他已經準備進第一句。瑞克忙著替翅膀試另一支麥，上市說明會也在候場。你不是代打主唱，這一輪的工作是讓搶麥決鬥唱得下去。','meimei','那是我點的。你先把麥克風留下來。',[
   c('替傑克舉計分牌，水蛇的副歌也排進同一場。'),
   c('把第二支麥遞給水蛇，請兩人當場決鬥。'),
   c('用餐巾做 First Love 擂台旗，宣布願景演講不計入歌唱時間。',{wild:true})
  ],{scoreLabel:'尾牙參與',pressureLabel:'願景插播'});
  if(s===1)return scene(run,'台上搶歌，台下猜瑞克今晚穿什麼。','同桌拿紅茶當彩頭，猜瑞克會穿紅還是白。他還沒坐下，已經先問翅膀麥克風聲音好不好。屎潘蛇說今年大家辛苦了，主持人順勢問要不要加碼；瑞克替老闆鼓掌，菜又轉過你面前一次。','rick','大家先聽老闆講，菜不會跑掉。',[
   c('把熱菜轉到還沒吃到的人面前，自己也先吃兩口。'),
   c('跟同桌猜紅白穿搭，彩頭只用桌上那壺紅茶。'),
   c('敲一下空盤：今晚先讓這道雞肉上市，大家快申購。',{wild:true})
  ],{scoreLabel:'尾牙參與',pressureLabel:'願景插播'});
  if(s===2)return scene(run,'抽獎箱轉了一圈，房租也跟著想了一圈。','主持人開始念號碼。同桌有人先講好中獎請飲料，有人把券捏在手裡，說自己的房租比任何人都需要加碼。屎潘蛇拿著麥克風，提醒大家重點是團聚；全場的眼睛還是留在那個箱子上。','spencer','不要只有看到獎金。今天大家聚在一起也很難得。',[
   c('券拿好。中獎先留著，讓自己的生活有點餘裕。'),
   c('中了就請同桌飲料，沒中也不用誰補差額。'),
   c('把抽獎箱叫作正式環境，請主持人現在部署。',{wild:true})
  ],{scoreLabel:'尾牙參與',pressureLabel:'願景插播'});
  return scene(run,male(run)?'散場後，阿良的暗黑續攤還在口頭成團。':'散場後，阿良又說他知道一家甜點店。',male(run)?'水果只是尾牙最後一道菜，暗黑續攤是另一回事。阿良邊找外套邊說自己有私房行程，你問細節，他只笑著說等一下再講。要不要跟去，現在由你決定。':'桌上的水果還沒收，阿良這次提的是甜點續攤，說附近有間店還開著。你可以問他店在哪裡，也能安排自己的晚上。他答應得很快，外套倒是還沒拿起來。','kind',male(run)?'有啊，哪一種都可以，你先等我一下。':'吃甜點可以啊，你先等我一下。',[
   c(male(run)?'阿良，帶我去你的暗黑續攤，這次你先帶路。':'阿良，找一家還開著的甜點店，你先帶路。'),
   c(male(run)?'今晚你當鋼琴，我組四手聯彈團。團長先過門禁。':'組甜點董事會，阿良當必須本人出席的董事長。',{wild:true}),
   c('不等他。自己吃碗麵，再搭車回家。（花費 6）',{available:balance(run)>=6}),
   c('今天到這裡，我先回家。')
  ],{scoreLabel:'尾牙參與',pressureLabel:'願景插播'});
 }
 if(x.id==='basketball'){
  if(s===0)return scene(run,'傑克揪打球，這次不用先交進度。','傑克在群組貼球場時間，說打完各自回家。強哥問助理工程師能不能只當候補，傑克說來了再分隊，不會把命中率放進考績。你換好鞋，看到有人還在找護具，有人已經開始喊自己今天手感很好。','jack','先暖身，打半場就好。有人不舒服就休息，不用硬撐。',[
   c('暖身完按體力分隊，讓新手也能碰到球。'),
   c('我出場地與飲水費，大家輪流休息。（花費 4）',{available:balance(run)>=4}),
   c('把職稱貼紙貼在板凳上：主管先坐著，球員重新抽籤。',{wild:true})
  ],{scoreLabel:'球隊默契',pressureLabel:'體能負擔'});
  if(s===1)return scene(run,'球傳到你手上，這次真的能自己決定。',`${x.plan==='court'?'飲水和輪休都安排好了，這一波輪你上場。':x.plan==='rotate'?'前面照體力分隊，空檔還有人能接手。':'職稱貼紙還留在板凳，你們照抽好的隊伍開打。'}傑克往籃下跑，另一邊的同事也空了。你面前還有一點出手空間，強哥在場邊喊自己剛才那球只是協助，不負最終交付責任。這一波要把球送到哪裡？`,'jack','看到空檔就打，不用每一球都等我決定。',[
   c('傳給空檔的同事，自己跑下一個位置。'),
   c('有空檔就出手，投完立刻回防。'),
   c('假裝要開需求會議，等對手愣住就把球傳出去。',{wild:true})
  ],{scoreLabel:'球隊默契',pressureLabel:'體能負擔'});
  return scene(run,'最後一波，大家都說自己還可以。',`球場準備關燈，比分咬得很近。${pressureOf(x)>=4?'你跑了幾趟，呼吸已經明顯變重，板凳還有同事可以輪替。':'前面有輪休，場上還有一點力氣打完最後一波。'} 傑克把球撿起來，問誰要發動。今晚的最後一球不用再延長成明天的工作。`,'jack','打一波就收。贏了不加班，輸了也不用重開一場。',[
   c('照前面打順的配合，讓空檔的人完成最後一球。'),
   c('有點累了，換人上去，留在場邊幫忙喊位置。'),
   c('請強哥用助理工程師名義簽核最後一球，我們照常打。',{wild:true})
  ],{scoreLabel:'球隊默契',pressureLabel:'體能負擔'});
 }
 if(s===0)return scene(run,'審查還沒進場，你已經兼了三份工作。','下雨了，水蛇抱著資料，請你幫忙撐傘、提電腦，順便確認簡報。傑克說不知道怎麼回答就照準備的稿念，她卻說台上不能只顧著看稿。你原本準備算法細節，現在還得確認誰負責哪些承諾。','meimei','等一下不要一直低頭看稿，但數字要記得。傘往這邊一點。',[
  c('先把每項主張對到文件，未知的部分標待確認。'),
  c('和水蛇先分好回答範圍，把資料頁碼放在手邊。'),
  c('替雨傘列一張工作分解表：遮雨不等於承接全部專案。',{wild:true})
 ],{scoreLabel:'可核對佐證',pressureLabel:'待補說明'});
 if(s===1)return scene(run,'委員沒有問你練了一晚的那一題。','你準備了算法，委員先問驗收怎麼證明、資料授權在哪一頁。水蛇看著你，示意不要冷場。傑克那句「照稿念」忽然很有吸引力，可是稿子裡沒有眼前這個問題。','meimei','這題你來。先回答他剛才問的，不要從第一頁開始。',[
  c('翻到對應證據，沒有的部分說明補件時間。'),
  c('先重述問題確認意思，再請負責人補商務承諾。'),
  c('把簡報翻成問答目錄：今天委員點菜，我們不要硬上套餐。',{wild:true})
 ],{scoreLabel:'可核對佐證',pressureLabel:'待補說明'});
 return scene(run,'離開審查室前，還有一張待辦不能靠點頭完成。','委員要求把今天答應的內容整理清楚。水蛇說可以，筆卻已經交到你手上。走廊的雨傘還在滴水，你要把哪些話寫成確定的交付，哪些話只能先列待確認？','meimei','先把今天的結論收好。之後要補什麼，至少不要回去才互相猜。',[
  c('只列可證明的成果，補件、責任人和日期各有一欄。'),
  c('先請負責人確認新增範圍，再把補件計畫交出去。'),
  c('替「再研究看看」編一個待辦號碼，沒有負責人就不假裝結案。',{wild:true})
 ],{scoreLabel:'可核對佐證',pressureLabel:'待補說明'});
}

// A ticket is provided by the canonical engine. Scores describe this activity,
// never promotion credentials, medical outcomes or an official review decision.
export function resolveActivityChoiceV44(run,index,ticket){
 const x=ctx(run),event=getActivityEventV44(run);
 if(!Number.isInteger(index)||index<0||index>=event.choices.length||event.choices[index].available===false)throw new Error('Unavailable activity choice');
 if(!Number.isFinite(ticket)||ticket<0||ticket>1)throw new Error('Invalid activity ticket');
 const s=run.stats||{},a=scoreOf(x),p=pressureOf(x),stage=x.stage;
 let plan=x.plan||'',gain=0,load=0,result='',label='',delta={},flags=[];
 const win=chance=>ticket<Math.max(.12,Math.min(.88,chance));
 const practical=.40+(s.skill||0)*.0025+a*.025-p*.025;
 const social=.43+(s.trust||0)*.002+a*.02-p*.025;
 const outcome=(name,text,change={},points=0,stress=0)=>{label=name;result=text;delta=change;gain=points;load=stress;};
 if(x.id==='arm'){
  if(stage===0){
   plan=['rules','consent','pizza'][index];
   if(index===0)outcome('十秒規則寫定','雙方確認十秒和平手條款，手機留在口袋。阿福又問一次不能錄影吧，你把這一條也指給他看。開始以前，至少不用再猜彼此答應了什麼。',{energy:-3,trust:3},3,0);
   else if(index===1)outcome('先把顧慮講完','阿福從抽筋講到早餐，傑克等他講完才伸手。你把真的需要停下的狀況和輸贏條款分開，觀眾終於能安心看一場不必硬撐的比賽。',{energy:-4,mood:-2,trust:4},2,1);
   else outcome('披薩白皮書','你每寫一條，阿福就想再補一條。盒蓋差點寫滿，傑克指著最後一片披薩說，這塊吃完就開始。全桌第一次同意不用再開會。',{mood:5,slack:2,energy:-3},win(.6)?3:1,2);
  }else if(stage===1){
   const played=win(.46+a*.045-p*.035+(plan==='rules'?.10:plan==='consent'?.05:-.02)+(index===0?.05:0));
   if(index===2){plan='unplayed';outcome('比賽先休兵','阿福還沒把手放上桌，你就請披薩盒先宣布今天休兵。阿福立刻補充自己不是不敢比，只是正式實力要留到狀況正常時再展示。傑克把計時器收起來，這場沒有開始，更沒有任何人的手需要替輸贏作證。',{energy:-2,mood:4,trust:2},0,2);flags.push('activity44_arm_unplayed');}
   else
   if(played)outcome('比賽真的打完','雙方點頭後開比，十秒一到你就喊停。傑克這回拿下對決，阿福先問起算點，接著說手好像不太對。大家讓他先休息，結果和他的補充說明分開記。',{energy:-5,mood:6,trust:4},3,1);
   else outcome('平手後的加註','十秒內沒分出勝負，你照事前約定宣布阿福這場贏。阿福收下結果，又強調自己今天其實不在最佳狀態。傑克笑著收手；至少這次條款真的被照做，沒有誰被逼著加賽。',{energy:-5,mood:3,trust:3},1,2);
   if(index!==2)flags.push(played?'activity44_arm_played':'activity44_arm_draw');
  }else if(index===0)outcome('結果和聲明都有位置',plan==='unplayed'?'你記下今天沒有開比，理由和下次確認事項各有一欄。阿福想直接把冠軍也填進去，傑克把那欄留白；沒有開始的比賽，不必假裝已經有結果。':'你記下實際開比、喊停和雙方說法。阿福想把補充理由放在最前面，傑克說可以，輸贏那欄也請留下。這份紀錄沒有替任何人診斷，只有把比過的事講清楚。',{trust:5,mood:3,energy:-2},2,0);
  else if(index===1){outcome('理由伯記者會','披薩盒上插滿紙麥克風。阿福依序發布抽筋、拉到、吃太飽三份聲明，問到第三片披薩又改成補充能量。你問還有沒有補充，他說有：剛才那一題要從頭回答。',{mood:9,slack:3,trust:3,energy:-4},2,2);flags.push('activity44_arm_press','activity44_sonny_press');}
  else{outcome(plan==='unplayed'?'尚未出賽世界冠軍':'比完仍想當世界冠軍',plan==='unplayed'?'你把紙獎盃遞過去，阿福立刻要求冠軍頭銜不要加「尚未」。傑克提醒今天根本沒開比，阿福說實力本來就不用每次展示。人還沒上桌，勝利聲明已經講到第四點。':'你把紙獎盃遞過去，阿福立刻要求冠軍頭銜不要加「尚未」。傑克提醒剛才其實已經比過一場，阿福說那只能算狀況測試。獎盃歸他，大家的下班時間終於歸自己。',{mood:8,slack:3,trust:2,energy:-3},1,1);flags.push('activity44_arm_crown');if(plan==='unplayed')flags.push('activity44_sonny_unplayed');}
 }else if(x.id==='diet'){
  if(stage===0){plan=['steady','buddy','no-policing'][index];outcome(['自訂步調','互相提醒','不稽核午餐'][index],['你把散步和正常吃飯排進自己的節奏，沒有填別人的體重。安妮余說這份表至少不會讓午餐多一個主管。','你和同事約好忙的時候互相提醒吃飯，沒做到就下次再來。這一隊不開公審，只有真的會收到的一句「先吃飯」。','你替隊名畫了一個沒有嘴巴的便當，意思是旁人不用替它發言。紅茶先笑了，再把公開排名那欄收起來。'][index],{energy:-3,mood:3,trust:3},2,index===2?0:1);}
  else if(stage===1){const steady=win(.52+a*.035+(plan==='steady'?.08:0));outcome(steady?'照自己的步調':'今天有點亂',steady?'你照自己的意願吃東西，也留下活動紀錄。別人吃蛋塔還有進展，沒有抵銷你自己的努力；安妮余把那句比較收回來，問要不要一起下樓走走。':'臨時工作打亂了原本的安排，你沒有把一顆蛋塔當成全部的原因。安妮余也承認今天心情有點急；你們把這一餐吃完，明天再照做得到的步調。',{energy:index===1?-6:-3,mood:steady?5:-4,trust:index===2?4:2},steady?3:1,steady?0:2);}
  else{
   if(index===0){const won=win(.32+a*.065-p*.04);outcome(won?'紀錄組獲獎':'本屆榜上未勝',won?'這局按各自事前選定的目標與紀錄完成度計分，你的紀錄拿到了紀錄組獎。安妮余看著結果，笑說至少這一組不用沒收蛋塔。主辦把名字貼上榜，你領到的是一場遊戲比賽的獎，不是任何人的身體評分。':'你的紀錄有完成，但這屆排名沒贏。安妮余先問第一名是不是也吃蛋塔，紅茶請她看看人家實際交的表。你核對完自己的分數，留下一個下次做得到的目標；落榜沒有附帶禁止吃點心的條款。',{energy:-3,mood:won?11:-4,trust:3},won?2:1,0);flags.push(won?'activity44_diet_prize':'activity44_diet_no_prize');}
   else if(index===1){outcome('自願退出公開排名','你在公布前明確退出公開排名，分數不再參加這屆輸贏。你和同伴仍照約散步，紅茶把名字從排行榜移到自願活動名單；這次退的是一場比賽，不是午餐，也不是工作。',{mood:6,energy:-2,trust:6},1,-2);flags.push('activity44_diet_withdraw');}
   else{const won=win(.45+(s.slack||0)*.003);outcome(won?'蛋塔觀察特別獎':'特別獎提案未通過',won?'你宣布蛋塔榮獲年度最佳情緒負重器材，全桌笑到主辦真的替你畫了一張蛋塔觀察特別獎。正賽冠軍另有其人，你這一項有名牌、有掌聲，沒有任何身體指標。':'你把蛋塔提名為年度最佳情緒負重器材，主辦忍著笑說這一屆沒有這個獎。正賽名單照常公布，你沒拿到冠軍，也沒拿到特別獎；那顆蛋塔倒是終於不用繼續受審。',{mood:won?9:-3,energy:-3,trust:won?4:2,slack:3},won?2:0,-1);flags.push(won?'activity44_diet_special':'activity44_diet_no_special');}
   flags.push('activity44_diet_finished');
  }
 }else if(x.id==='roadshow'){
  if(stage===0){plan=['demo','needs','goose'][index];outcome(['備案測過一輪','先問實際需求','玩具鵝值班'][index],['你測完現場展示，也準備能交代清楚的離線版本。強哥想把全部測試留給助理，你請他先認領自己確認過的項目。','你把訪客想解決的事放在第一頁，沒有先堆滿公司形容詞。真真看完，終於知道展位要帶哪幾張資料。','玩具鵝坐鎮，安妮余替牠放了名牌。有人走來拍照，你說拍照免費，功能請看真的跑得動的那一頁。'][index],{energy:-5,skill:2,mood:index===2?4:0},index===0?3:2,index===2?1:0);}
  else if(stage===1){
   if(index===0){const ok=win(practical+(plan==='demo'?.10:0));outcome(ok?'展示回答了問題':'展示留下待測項目',ok?'你用能重現的展示回答限制，對方願意約實測。翅膀想多補一句保證，你把現有功能和待評估需求分成兩欄。':'對方問到目前尚未驗證的設備，你停在現有證據，留下待測項目。現場沒有把話說滿，後續卻還得花時間真的測一次。',{energy:-7,skill:2,mood:ok?4:-5,trust:ok?4:1,boss:ok?1:-2},ok?3:1,ok?0:2);}
   else if(index===1){const ok=win(social+(plan==='needs'?.10:0));outcome(ok?'問出真正的場景':'交換資料，需求待補',ok?'你先問對方現在怎麼做，才知道他缺的是小範圍整合，不是整套願景。對方同意留下聯絡資料，你刪掉一項其實不需要的承諾。':'對方願意收資料，卻還沒講清楚誰使用、誰決定。你沒有把這句客氣寫成成交，先留下下一次該問的問題。',{energy:-5,trust:ok?6:2,mood:ok?3:-2},ok?2:1,ok?-1:1);}
   else{const ok=win(.32+(s.slack||0)*.003+a*.025-p*.015);outcome(ok?'玩具鵝換到真問題':'玩笑沒擋住追問',ok?'玩具鵝的「這題不在簡報」牌讓訪客笑了，對方接著說出真的卡住的地方。你當場補上限制，沒有讓笑聲替代答案。':'訪客沒有笑，繼續追問剛才那個功能。你收好玩具鵝，承認需要回去確認；翅膀在旁邊的笑容也跟著下班。',{energy:-4,slack:3,mood:ok?7:-5,trust:ok?3:-1,boss:ok?0:-3},ok?3:0,ok?1:3);}
  }else{
   const points=index===0?2:index===1?1:win(.40+(s.skill||0)*.002+(s.slack||0)*.001)?3:0;
   const stress=index===1?-2:index===2?(points?1:2):0;
   const good=clamp(a+points)>=5&&clamp(p+stress)<=4;
   const texts=index===0?[good?'你只交有需求且同意聯絡的名單，替每一筆補上下一步。數量變少，真真卻能真的分派跟進；這場帶回的是找得到人的商機。':'你剔除只路過的人，再補上已知需求。名單還缺測試確認，暫時只能列追蹤，沒有把空白硬寫成成交。']:
    index===1?[good?'你先找負責人核對台上承諾，刪掉沒有估過的交期，讓真正有需求的客戶重新確認範圍。少承諾一點，後續反而終於有人能接。':'你找到了待補承諾，還沒找到能認領全部範圍的人。真真把它列成待辦，不把這場當成已完成的商機交付。']:
    [good?'你替路過人潮頒感謝狀，再把真正的商務問題寫進背面。訪客願意留下正式聯絡同意，玩笑最後接上了能驗證的下一步。':'感謝狀讓大家笑了一輪，卻沒讓模糊需求自動變完整。你拒絕把合照灌進營收預測，留下回去還得確認的問題。'];
   outcome(good?'帶回可追的商機':'先把承諾補完整',texts[0],{energy:index===1?-7:-4,trust:index===1?6:4,mood:good?7:-2,...(index===2?{slack:2}:{skill:2})},points,stress);
   flags.push(good?'activity44_roadshow_leads':'activity44_roadshow_followup');
  }
 }else if(x.id==='dinner'){
  if(stage===0){plan=['seats','shared','chairs'][index];outcome(['先讓人坐好','共享菜先談妥','空椅子讓位'][index],['你和幾位同事換了位置，把真的來的人安置好。船長劃掉重複算的人頭，桌上終於不必有人端著碗站著。','你和歐文先對好想吃的菜，幾份主食加共享菜，讓第一輪不只剩盤子中央的裝飾。','你把空椅子名牌寫成「待補主管」，請它先去門邊開會。同事坐下來了，船長忍著笑說這次編制調整很快。'][index],{energy:-2,mood:3,trust:4},2,index===1?2:1);}
  else if(stage===1){const smooth=win(social);outcome(smooth?'第二盤有大家的份':'筷子比流程快',smooth?'第二盤上桌，你先分給剛才沒吃到的人。歐文終於不用再叫一次每個人的名字，這輪是真的全桌都吃到。':'第二盤才轉半圈就快空了。你把剩下的分好，再補主食；沒人願意為一片魚開會，至少不要讓慢拿筷子的人餓著。',{energy:4,mood:smooth?6:-3,trust:3},smooth?3:1,index===0?4:index===1?2:3);}
  else if(index===1)outcome('自付那一盤','你先問同桌還有沒有想吃，再用自己的錢加點。這一盤沒有寫成公司加碼，也沒有要別人分攤；歐文舉杯謝你，屎潘蛇終於把菜單闔上。',{cash:-4,mood:8,trust:6,energy:3},3,0);
  else if(index===2)outcome('第三盤留職停薪','你把第三盤排進明年度預算，請它先回家陪魚家人。同桌笑到終於放下菜單，船長確認沒有人漏拿外套；今晚沒有多一張由你代墊的帳單。',{mood:7,trust:4,energy:2},1,0);
  else if(p>=5)outcome('第三盤沒有核准','你問能不能再補一盤，屎潘蛇這次直接把菜單推回去，說今天預算到這裡。你們把桌上剩的分好，還沒吃飽的人先拿主食；沒有新增帳單，也沒有逼誰自行買單。',{mood:-3,trust:3,energy:2},1,0);
  else outcome('留的預算派上用場','你確認大家還想吃，前面留的共享預算剛好夠補一盤。屎潘蛇看完帳單點頭，歐文終於等到最後一輪比目魚；這次不是靠你墊錢，也不用留到明年再說。',{mood:8,trust:5,energy:4},2,3);
 }else if(x.id==='banquet'){
  if(stage===0){plan=['jack','duet','ring'][index];const clear=win(.64);outcome(clear?'First Love 搶麥決鬥':'決鬥被願景暫停',clear?(index===1?'你把第二支麥交給水蛇，她追著傑克的第一句直接唱進副歌。兩位隔桌對唱，大家舉餐巾評分；這首歌到底誰點的，直到唱完也還在辯。':'傑克先搶進第一句，水蛇拿著另一支麥要求還歌。你替兩人舉牌計分，副歌成了全桌合唱，瑞克暫時找不到插話的位置。'):'傑克先搶到開場，水蛇正要反擊，翅膀拿起第三支麥開始補充上市規劃。你替擂台牌加上「願景暫停」，兩位選手握著麥等前奏重播。',{energy:-4,mood:clear?9:-3,trust:5},clear?3:1,clear?0:2);flags.push('activity44_first_love','banquet_attended','banquet_stage');}
  else if(stage===1){
   if(index===0){const clear=win(.72);outcome(clear?'同桌終於吃到熱菜':'菜在等願景講完',clear?'你把菜轉到還沒吃到的人面前，自己也吃了幾口熱的。瑞克忙著替翅膀鼓掌，這桌先把晚餐完成，沒有等簡報講完才動筷。':'你才夾到一口熱菜，翅膀又問起以前公司怎麼做。旁邊同事替你留了一塊雞肉；這桌至少有人記得你今晚是來吃飯的。',{energy:clear?5:-2,mood:clear?4:-3,trust:5},clear?2:1,clear?0:1);}
   else if(index===1){const red=ticket<.44,white=ticket<.88;outcome(red?'紅色應援團':white?'白色安全牌':'粉紅取消賽事',red?'瑞克穿紅色出現，先問翅膀這樣會不會太顯眼。全桌喝著紅茶，宣布本次猜衣服不必猜政治立場。':white?'瑞克穿白色進場，看到翅膀立刻把音量開到最大。大家把紅茶喝掉，發現配色根本不影響他的輸出。':'瑞克穿粉紅色，紅白兩隊一起抗議。你宣布茶照喝、彩頭歸零，下一屆先看看翅膀穿什麼。',{energy:-2,mood:7,trust:4,slack:2},2,0);}
   else{const clear=win(.42+(s.slack||0)*.003);outcome(clear?'雞肉成功上市':'上市多了一份作業',clear?'你輕敲空盤，同桌拿筷子鼓掌，主持人宣布下一道菜上市。翅膀以為你在呼應願景，瑞克忙著錄影；真正被大家申購完的是那盤雞肉。':'翅膀說這個點子不錯，請你下週補一份活動規劃。你把筷子收好，同事提醒交付日期不要寫太快；尾牙還沒抽獎，你先抽到一份工作。',{energy:clear?-3:-7,mood:clear?10:-5,trust:4,slack:3},clear?3:0,clear?1:3);}
  }
  else if(stage===2){const big=ticket<.10,small=ticket<.62,share=index===1,cash=big?(share?18:24):small?(share?4:7):0;outcome(big?'大獎入袋':small?'小獎也是真的':'前後號都中了',big?'主持人真的念到你的號碼。同桌比你先站起來，你領到一筆不用等上市的獎金。'+(share?'你照約請了飲料，請完還有剩。':'你把獎金收好，這筆先拿來過自己的生活。'):small?'你抽到小獎。數字沒有讓全場起立，卻真的能進自己的口袋。'+(share?'飲料請完還留下一點，這桌的感謝比公文快。':'瑞克提醒感謝公司，你先謝幫忙辦活動的同事。'):'你的前後號都中了，自己負責把兩份好運隔開。同事遞來一杯免費熱茶，今晚沒有中獎，也沒有被要求補別人的飲料錢。',{cash,mood:big?17:small?8:-4,trust:share&&small?6:2},small?2:0,0);flags.push(big?'activity44_banquet_big_prize':small?'activity44_banquet_small_prize':'activity44_banquet_no_prize');if(big)flags.push('banquet_prize');else if(small)flags.push('banquet_gift');if(small&&share)flags.push('banquet_shared');}
  else if(index<2){outcome('阿良答應，人卻消失',male(run)?'阿良連說好啊，還答應自己先帶路。你拿好外套，他說去一下洗手間，門口等過兩批同事，只收到一句「我先走了，下次一定」。暗黑續攤沒有成行，鋼琴也沒到場；你沒有付任何行程費，只有把他的「等一下」重新估了工時。':'阿良一口答應甜點續攤，連店名都講好了。你拿好包包回來，他卻只剩群組裡一句「馬上回」，接著又說自己先走。甜點沒有點，錢也沒有花；這次董事長的出席率比會議通知還低。',{mood:-5,energy:-3,slack:3,trust:1},0,1);flags.push('kind_afterparty_ghost','activity44_kind_ghost');}
  else if(index===2){outcome('自己的行程準時成團','你不再等阿良，找一間還開著的麵店，吃完叫車回家。地址、價格和到家時間都有答案，這筆錢花在真的有發生的晚上。',{cash:-6,mood:11,energy:7},2,0);flags.push('activity44_banquet_selfcare');}
  else outcome('今晚準時散場','你跟還在門口的人道別，把手機切成勿擾。沒有被阿良晾在路邊，也沒有回公司補工時；剩下的晚上終於不必再等誰點頭。',{mood:6,energy:6},1,0);
 }else if(x.id==='basketball'){
  if(stage===0){plan=['rotate','court','titles'][index];outcome(['先輪替再開打','場地和飲水備好','職稱暫停上場'][index],['你們暖身後分隊，讓新手也有位置。傑克把手機收好，這一場沒有誰需要接老闆電話才能上場。','你付了場地和飲水費，大家把休息時間排好。沒有誰因為月薪比較高，就能要求別人多跑兩趟。','職稱貼在板凳，真人重新抽籤。強哥問助理工程師可不可以先發，傑克說可以，但一樣要回防。'][index],{cash:index===1?-4:0,energy:-4,mood:4,trust:3},index===1?3:2,index===1?0:1);}
  else if(stage===1){const good=win(.38+(s.energy||0)*.003+a*.03+(index===0?.12:0));outcome(good?'這波打成了':'球沒進，先回防',good?(index===1?'你在空檔出手，球擦板進框。傑克拍一下你的手，你已經轉身回防；這次成果不用靠瑞克轉述給老闆。':'你把球傳到空檔，同事接到後順利完成這波。場邊喊得比會議熱鬧，強哥終於承認助理工程師也有一個助攻。'):'球沒進，你們沒有停下來檢討誰配不上薪水，先把下一波守住。傑克叫大家換人喝水，失誤留在這場球，不帶回明天的工單。',{energy:index===1?-9:-6,mood:good?7:-3,trust:good?5:2},good?3:1,index===1?4:2);}
  else if(index===1)outcome('換人也算完成這場','你說自己需要休息，傑克立刻讓候補上去。你在場邊幫忙喊出空檔，最後一球不一定由你投，卻也有你守住的位置。收隊時沒有人拿喘氣速度開考績會。',{energy:-1,mood:6,trust:5},2,-2);
  else{const good=win(.40+a*.055-p*.035);outcome(good?'最後一波打成':'比分留在球場',good?'你們照前面打順的配合跑位，最後一球完成。傑克說好球，大家收包去買水；沒有續局，也沒有忽然多一場由老闆指定的友誼賽。':'最後一球沒進，傑克先把球收起來，說約好打一波就收。你們互相擊掌，明天的同事還是同事，不必替這個比分加班。',{energy:p>=4?-7:-4,mood:good?9:3,trust:5},good?3:1,1);flags.push('activity44_basketball_finished');}
 }else{
  if(stage===0){plan=['evidence','roles','umbrella'][index];outcome(['佐證先對過','回答範圍分好','雨傘不兼專案負責人'][index],['你把每個主張對到文件頁碼，缺的部分明寫待確認。傑克提醒的稿子留在手邊，但你至少知道哪幾句有東西可以翻出來。','你請水蛇先分好商務與技術問題，自己把證據頁碼標出來。她還是請你拿電腦，不過台上的承諾終於不是全靠一個眼神。','你把雨傘交回門邊，再把技術範圍列在資料夾首頁。水蛇看了一眼，說梗留到回程再講；你至少成功空出一隻手翻文件。'][index],{energy:-5,skill:2,mood:index===2?2:0},index===0?3:2,index===2?1:0);}
  else if(stage===1){
   if(index===0){const good=win(practical+(plan==='evidence'?.10:0));outcome(good?'證據答到問題':'缺件當場列出',good?'你先回答委員剛才問的那一件，再翻到證據頁。原本練過的內容沒有硬塞進答案；這一輪終於不是靠互看眼色補完。':'資料夾裡沒有那份佐證，你明說目前還缺，請負責人確認補件時間。委員把它記進待辦，台上的點頭沒有冒充交付。',{energy:-7,mood:good?5:-5,trust:good?4:1,skill:2},good?3:1,good?0:2);}
   else if(index===1){const good=win(social+(plan==='roles'?.10:0));outcome(good?'責任人接回問題':'回答範圍仍待確認',good?'你先確認委員要核對的範圍，再請水蛇補上商務承諾。她接回自己認領的段落，你少背一項不該代答的責任，證據頁也能對回問題。':'你確認了問題，水蛇卻還在找新增承諾的依據。委員同意先列待補，你沒有替一句眼神補出一份不存在的文件。',{energy:-5,mood:good?3:-3,trust:good?6:2},good?2:1,good?-1:1);}
   else{const good=win(.36+(s.slack||0)*.002+(s.skill||0)*.001+a*.02-p*.02);outcome(good?'換了問法，對到答案':'笑完還是得補證據',good?'你把「點菜」玩笑收在一句，隨即把簡報拆成委員真正問的幾項。對方願意逐條核對，你終於找到原本藏在附件裡的證據。':'委員笑了一下，接著請你回答原題。問答目錄有了，證據仍然缺一頁；你把那一項明列待補，沒有讓笑話代簽驗收。',{energy:-4,slack:3,mood:good?6:-4,trust:good?3:-1},good?3:0,good?1:3);}
  }else{
   const points=index===0?2:index===1?1:win(.40+(s.skill||0)*.002+(s.slack||0)*.001)?3:0;
   const stress=index===1?-2:index===2?(points?-1:2):0;
   const good=clamp(a+points)>=5&&clamp(p+stress)<=4;
   const text=index===0?(good?'你把成果逐項對到證據，補件、責任人和日期各有一欄。委員留下後續確認事項，正式結果仍待通知；至少這份清單能讓下一個人接著查。':'你整理了現有證據，仍有缺件不能靠空白表格補齊。這次先按清單修正，不把尚待確認的內容寫成已核准。'):
    index===1?(good?'你請負責人重新確認新增範圍，刪去沒人承接的保證，再提交能做到的補件計畫。這次不是直接過關，但原本打結的承諾終於能照表完成。':'你縮回了超出範圍的承諾，資料缺口仍要補。委員先留修正要求；正式結果未知，至少這次沒有全部壓到你的名下。'):
    (good?'你真的替「再研究看看」編號，逐項找到願意簽名的責任人。水蛇確認範圍，你附上能查的資料；這個玩笑最後變成一張可追的補件表。':'你給「再研究看看」編了號碼，負責人那欄卻仍然空著。你沒有假裝結案，帶著修正清單離開，雨傘也不必兼任專案負責人。');
   outcome(good?'帶著明確待辦離場':'先修正，再等結果',text,{energy:index===1?-7:-4,mood:good?7:-2,trust:index===1?6:4,...(index===2?{slack:2}:{skill:2})},points,stress);
   flags.push(good?'activity44_review_evidence':'activity44_review_revision');
  }
 }
 const score=clamp(a+gain),pressure=clamp(p+load),done=stage===ACTIVITY_META_V44[x.id].stages-1;
 if(done)flags.push(`activity44_${x.id}_completed`);
 return {result,label,delta,flags,score,pressure,plan,done};
}
