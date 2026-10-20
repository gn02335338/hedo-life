// Fictional cartoon slapstick: soft props, cutaways and office absurdity.
// The menu is built without drawing RNG. Only the committed target choice rolls.
export const RAGE_TARGETS=['wing','spencer','rick','hope','erich','jenjen','sonny','kind'];
const NAMES={wing:'Wing',spencer:'Spencer',rick:'Rick',hope:'Hope',erich:'Erich',jenjen:'JenJen',sonny:'Sonny',kind:'阿良（Kind）'};
const choice=(text,result,delta={},flags=[],effect='rageReturn')=>({text,detail:'',result,delta,flags,effect});
const outcome=(weight,label,result,delta,flag,effect='rageReturn')=>({weight,label,result,delta,flags:[flag],effect});
const absent={
 wing:'你抱著抱枕找到Wing的空椅子。人沒出現，桌上的願景簡報倒是站得很直；你把抱枕砸在椅背上，簡報仍然沒有交付日期。',
 spencer:'你找到董事長的座位，桌上只有一張「稍後回覆」。抱枕落下的瞬間，你替它補了一行：家境不允許出席。',
 rick:'Rick的位子沒人，手機卻亮起Wing來電。你還沒碰到抱枕，旁邊的椅子已經有人滑過來接電話；通完話，對方又消失了。',
 hope:'Hope不在位子上，桌上卻有一份已經開好的自評表。你把抱枕放進「待改善」文件匣，第一次看到文件匣超出負荷。',
 erich:'Erich不在，你對著那疊條文揮了抱枕。紙張一張也沒倒，彷彿早就替自己寫好免責聲明。',
 jenjen:'JenJen的椅子上貼著交接清單。你抱枕還沒落下，就先看見最底下一行：離開前請將抱枕歸位。',
 sonny:'Sonny不在，螢幕先跳出自動鎖定。你對著黑畫面比了一記卡通拳，畫面只倒映出還沒下班的自己。',
 kind:'阿良剛才還說「好啊，我等你」，你抱著抱枕過來，現場只剩一杯沒喝完的水。連被揪來接招，他都能先答應再消失。'
};
function reaction(run,target){
 const hot=run.stats.mood<=25,calm=run.stats.mood>=65,sour=run.stats.boss<=25;
 const present=run.rageContext?.speaker===target||(run.rageContext?.speaker==='exit-team'&&['erich','jenjen','sonny'].includes(target));
 if(!present)return [
  outcome(55,'空位承受了一切',absent[target],{mood:hot?10:5,energy:-4,boss:-3},'rage_absent'),
  outcome(25,'旁人看見了整套默劇',absent[target]+' 同事全看完了這場沒有對手的演出，有人默默替你把抱枕扶正。',{mood:8,energy:-5,trust:4,boss:-7},'rage_catharsis'),
  outcome(20,'氣還在，對方不在',absent[target]+' 你喘了口氣，發現自己累了一輪，對方連出席都省了。',{mood:2,energy:-8,boss:-5},'rage_backfire')
 ];
 const relief=hot?18:calm?7:12;
 const common=[
  outcome(calm?35:15,'臨時收拳，改扁荒謬',`你舉起抱枕，最後把${NAMES[target]}旁邊那張「其他交辦」壓扁。紙沒有受傷，字也沒少；至少你今天沒有替它再加一項。`,{mood:7,energy:-3,boss:-4},'rage_defused')
 ];
 switch(target){
 case 'wing':return [
  outcome(hot?50:35,'願景被打成抱枕形狀','你掄起抱枕，畫面瞬間切成誇張的漫畫煙霧。煙散了，Wing頭上的對話框還在罵你不讀書，只是「格局」兩個字被擠成了直式。你第一次覺得，這段話終於有壓縮空間。',{mood:relief,energy:-7,boss:-18,trust:4},'rage_catharsis'),
  outcome(sour?42:28,'抱枕也收到改善通知','Wing一手擋住抱枕，另一手指著會議室：「這就是你的工作態度？」Hope沒多久就傳來訊息，要你說明抱枕的績效指標。你有出到氣，也多了一份表要填。',{mood:hot?5:-4,energy:-9,boss:-23},'rage_backfire'),
  outcome(sour&&hot?18:3,'卡通散場，人事接手','漫畫煙霧還沒散完，Wing已經離開。Erich、JenJen與Sonny把離場流程帶進來，你把抱枕放回椅子，拒絕把這場鬧劇簽成自己的生涯規劃。',{mood:12,energy:-6,boss:-30},'rage_backfire','fired_refused'),...common];
 case 'spencer':return [
  outcome(45,'董事長級的經費不足','你把抱枕揮成漫畫殘影。Spencer看了一眼，問這是不是尾牙節目，接著很自然地說：「加碼？家境不允許。」你收回抱枕，覺得這句話倒是很適合拿來回覆加班。',{mood:relief,energy:-5,boss:-8,slack:2},'rage_catharsis'),
  outcome(30,'你被排進下次表演名單','Spencer笑著鼓掌，說這個很有精神。行政群組隨即問你，下次餐會能不能再演一次。你只是想發脾氣，最後又被抓去提供活動內容。',{mood:3,energy:-8,boss:-10,trust:-2},'rage_backfire'),...common];
 case 'rick':return [
  outcome(50,'接招省電模式','你用抱枕演了一整套漫畫連擊，Rick在椅子上晃了兩下，仍然沒有醒。你累到先停手，終於理解什麼叫技術資深經理級的省電。',{mood:relief,energy:-6,slack:4,boss:-5},'rage_unbothered'),
  outcome(sour?45:28,'老闆來電，瞬間滿血','抱枕剛到半途，Wing的電話響了。Rick立刻坐正，接起來就是「對，您說得對」。你的動作被迫暫停，因為對方已經切換到全公司最高效能的模式。',{mood:hot?6:-5,energy:-8,boss:-17,trust:2},'rage_backfire'),...common];
 case 'hope':return [
  outcome(hot?42:28,'抱枕進入改善期','你掄出卡通抱枕，Hope先把一張自評表夾在前面，問你這次預計改善幾分。抱枕沒有回答，你替它填了「不願配合沒有目標的評分」。',{mood:relief,energy:-6,boss:-13,trust:3},'rage_documented'),
  outcome(sour?45:30,'新增一欄情緒管理','Hope把抱枕接住，表示理解，接著在表上多加一欄。她說這是協助你成長，你看著突然變長的表，心情又被協助了一次。',{mood:2,energy:-9,boss:-18},'rage_backfire'),...common];
 case 'erich':return [
  outcome(48,'拳頭先等文字定義','你舉起抱枕，Erich開始釐清「扁」的定義與適用範圍。你聽到第三個但書，把抱枕壓在那張自願離職書上，表示簽名處目前禁止施工。',{mood:relief,energy:-6,boss:-12,trust:4},'rage_documented'),
  outcome(32,'先收到三頁說明','漫畫的星星還沒飄完，Erich已經整理好三頁說明。你問能不能一句話講完，他說事情沒有那麼簡單；你覺得抱枕才是這間房裡最簡單的東西。',{mood:3,energy:-8,boss:-16},'rage_backfire'),...common];
 case 'jenjen':return [
  outcome(46,'抱枕也要辦交接','你把抱枕揮出漫畫速度線，JenJen先問這是公司的還是自己的。你說是情緒的，她把清單轉過來，表示歸還時仍要確認數量。你差點被這套行政流程氣笑。',{mood:relief,energy:-5,boss:-10,slack:2},'rage_catharsis'),
  outcome(34,'歸還清單越打越長','你剛把抱枕放下，JenJen便開始核對桌椅、門卡、充電器。卡通煙霧散了，待辦沒有散，你還得替抱枕找一張歸還單。',{mood:2,energy:-8,boss:-15},'rage_backfire'),...common];
 case 'sonny':return [
  outcome(48,'權限比拳頭先下線','你把抱枕掄成一團漫畫旋風，Sonny看一眼螢幕，再看你一眼。下一秒畫面鎖住了；這場對決沒有血條，只有存取權限。你把卡通拳留在登出畫面前。',{mood:relief,energy:-5,boss:-12,slack:3},'rage_unbothered'),
  outcome(32,'重新登入後還是原本的工作','Sonny往旁邊一滑，抱枕只碰到空椅子。他提醒你先存檔，你照做，再重新登入。世界沒有重開，待辦也沒有少一件。',{mood:2,energy:-8,boss:-14},'rage_backfire'),...common];
 case 'kind':return [
  outcome(55,'答應接招，人卻不見','阿良拍拍胸口：「來啊，好啊，我在這裡。」你轉身拿抱枕，再回頭，椅子已經空了。訊息留著一個讚，人連已讀都不留。',{mood:relief,energy:-4,slack:3,boss:-4},'rage_absent'),
  outcome(25,'鋼琴臨時取消演出','你揮起抱枕，阿良先說等等，改成晚上一起紓壓比較好。你問時間地點，他說都可以，接著趁你看手機時不見了。這架鋼琴最熟的曲子，大概叫消失。',{mood:8,energy:-6,slack:2,boss:-5},'rage_unbothered'),...common];
 }
}
export function getRage(run){
 const used=run.flags.rage_last_turn===run.turn+1;
 return {id:'rage-menu',kind:'rage',speaker:'self',era:'辦公室卡通時間',sourceIds:['characterFiction'],
  title:used?'剛才那一套，已經夠上半天的班。':'受不了了，扁他。',
  body:used?'你摸摸手邊的抱枕，手臂還記得剛才那套動作。這個工作回合先喘口氣，等下一幕再說。':'你抓起一顆辦公室抱枕，腦中已經響起漫畫音效。今天想找誰算這筆荒謬帳？對方在不在、你的心情，以及Wing今天的臉色，都可能讓這場鬧劇走向別的地方。剛才說過的話已經收不回，你現在只想處理眼前這口氣。',
  wing:'畫面即將切成卡通。抱枕歸抱枕，後果還是算你的。',
  choices:used?[choice('把抱枕放回去，回到剛才那一幕。','你把抱枕放好，這回合先不加戲。')]:[
   ...RAGE_TARGETS.map(target=>({...choice(`拿起抱枕，找${NAMES[target]}算帳。`,''),rageTarget:target,wild:true,draw:{label:'辦公室卡通時間',outcomes:reaction(run,target)}})),
   choice('先收手。這段留在腦內上映就好。','你把抱枕放回去，什麼也沒花。原本那一幕還在等你。')
  ]};
}
