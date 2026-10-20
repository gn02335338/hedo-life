// Original banquet scenes inspired by workplace recollections. Dialogue, prizes,
// odds and consequences are fiction; private source records stay private.
const c=(text,result,delta={},flags=[],effect=null,extra={})=>({text,detail:'',result,delta,flags,effect,...extra});
const draw=(text,label,outcomes,flags,effect,extra={})=>c(text,'',{},flags,effect,{
 ...extra,draw:{label,outcomes:outcomes.map(outcome=>({...outcome,flags:[...flags,...(outcome.flags||[])]}))}
});
const scene=(id,title,speaker,body,wing,choices)=>({id,title,speaker,body,wing,choices,kind:'banquet',era:'年度大戲・尾牙現場',sourceIds:['chronicleBanquet']});

export function getBanquet(run){
 switch(run.eventId){
 case 'banquet-welcome':return scene('banquet-welcome','今年尾牙，先別急著說辛苦了。','rick',
  '抽獎箱放在門口，大家進場先看座位，再看離出口多遠。同事正在猜Rick到底會穿紅還是白，他本人還沒坐好，已經替Wing測完麥克風。主持人問誰要唱歌，Wing接過麥克風，先講起NASDAQ。菜剛上，今晚的節目就開始撞期。',
  'Wing今天心情不錯。等一下他說什麼，你們記得接一下。',[
   draw('跟同事猜Rick的dress code，拿杯紅茶當彩頭。','紅白服裝盃',[
    {weight:4,label:'紅色應援團',result:'Rick穿紅色出現，先問Wing這件會不會太顯眼。Wing說不錯，他立刻說自己也是這樣想。你把紅茶交給猜中的同事，這場賭局最難猜的，原來只有衣服。',delta:{mood:8,trust:7,slack:4}},
    {weight:4,label:'白色安全牌',result:'Rick穿了白色，同事說他終於選了清淡一點的。下一秒Wing走近，他的音量和笑容一起調到最高，整桌都知道今晚的配色不影響輸出。',delta:{mood:6,trust:8,slack:5}},
    {weight:2,label:'粉紅色取消賽事',result:'Rick穿粉紅色進場。紅隊和白隊一起抗議，他說顏色只是形式，重要的是有沒有跟上公司。你們把紅茶喝掉，決定下一屆新增「看Wing穿什麼」選項。',delta:{mood:9,trust:6,boss:-3}}
   ],['banquet_attended','banquet_dress'],'banquetDraw'),
   draw('先點First Love。麥克風到了再說。','尾牙點歌台',[
    {weight:6,label:'成功搶麥',result:'前奏剛響，你已經站到台前。原本要唱的人看著字幕，你看著台下同事，比白天任何一次報告都順。Rick想幫你接一句，你把副歌留給全桌，成功避開他的個人表現。',delta:{mood:16,trust:10,energy:-5},flags:['banquet_stage']},
    {weight:4,label:'被夢想插播',result:'歌名排上去了，Wing卻說先補充兩句上市規劃。你握著麥克風聽了半首歌的時間，主持人最後替你重放前奏。今晚First Love最難的部分，是等到自己能開始唱。',delta:{mood:-5,trust:7,energy:-6},flags:['banquet_stage','banquet_speech']}
   ],['banquet_attended'],'banquetDraw'),
   draw('把菜轉到同事面前，邊吃邊聽NASDAQ進度。','餐桌全球布局',[
    {weight:5,label:'成功夾到熱菜',result:'Wing講美國，你負責把雞肉轉到還沒吃到的人面前。Rick忙著點頭，暫時沒空追問工作。幾個同事終於吃到熱的，這一桌今晚第一項完成的交付，是大家的晚餐。',delta:{mood:9,trust:10,energy:7}},
    {weight:5,label:'餐桌臨時開會',result:'Wing忽然問你以前公司做不做客製化。你還沒吞完，他已經接著解釋為什麼移動的做法比較好。旁邊同事替你留了一塊肉；這場會議至少有人記得你剛才還在吃飯。',delta:{mood:-8,trust:8,energy:-5,boss:-4},flags:['banquet_speech']}
   ],['banquet_attended'],'banquetDraw'),
   draw('把空餐盤當鐘敲：美國太遠，今晚先在這桌上市。','空盤敲鐘儀式',[
    {weight:6,label:'全桌掛牌成功',result:'你輕敲餐盤，全桌拿筷子鼓掌，主持人順勢宣布下一道菜上市。Wing以為你在呼應願景，Rick忙著錄影。影片裡每個人都在笑，只有那個盤子真的已經清空。',delta:{mood:15,trust:9,boss:5,slack:5}},
    {weight:4,label:'被要求補做簡報',result:'Wing說這個點子不錯，叫你下週做一份敲鐘活動規劃。你收起筷子，旁邊同事小聲提醒：別寫交付日期。尾牙還沒抽獎，你先抽到一份工作。',delta:{mood:-7,trust:6,energy:-8,boss:4},flags:['banquet_speech']}
   ],['banquet_attended','banquet_stage'],'banquetDraw',{wild:true})
  ]);
 case 'banquet-draw':return scene('banquet-draw','獎金還在箱子裡，大家已經幫你想好怎麼花。','spencer',
  '主持人開始抽獎，隔壁同事先跟你約定：誰中大獎就請飲料。Spencer拿著麥克風，說今年大家都很辛苦。台下立刻有人喊加碼，他笑著把手放在口袋裡，主持人則繼續搖那個箱子。',
  '不要只看獎金。我們最重要的是大家聚在一起。',[
   draw('拿好抽獎券。真的中獎，就請同事喝一輪。','尾牙抽獎',[
    {weight:12,label:'大獎到手',result:'主持人念出你的號碼，同事比你先跳起來。你領完獎就把飲料單傳下去，請完這一輪，獎金還有剩。Wing說要繼續努力，你看著同事研究甜度，決定今晚先慶祝真的拿到的這筆。',delta:{cash:18,mood:24,trust:15},flags:['banquet_prize','banquet_shared']},
    {weight:58,label:'小獎也算',result:'你抽到小獎，剛好夠請同桌喝飲料，喝完還留下一點零用錢。大家說你很大方，你請他們明天有空幫忙看一下工單。這份回禮至少不用等公司上市。',delta:{cash:4,mood:12,trust:11},flags:['banquet_gift','banquet_shared']},
    {weight:30,label:'號碼一直擦邊',result:'前一號中了，後一號也中了，你的號碼負責把兩份好運隔開。同事把飲料單收回去，遞給你一杯免費的熱茶。今晚沒有請客，也沒有被扣錢。',delta:{mood:-4,trust:5}}
   ],[],'banquetAfterparty'),
   draw('券先收好，中了就留著。我的房租也很需要加碼。','尾牙抽獎',[
    {weight:12,label:'大獎自己留',result:'號碼真的中了，一筆獎金實實在在入袋。有人起鬨要你請飲料，你把獎金收好，說這筆先拿來過生活。笑聲小了一點，回家路上看著餘額，你倒是一直有在笑。',delta:{cash:26,mood:23,trust:-3},flags:['banquet_prize']},
    {weight:58,label:'帶走小獎',result:'小獎入袋，這筆錢終於不用等到上市。Rick提醒你要記得感謝公司，你謝了主持人和幫忙辦活動的同事，然後把獎金放進自己的口袋。',delta:{cash:8,mood:11,boss:-3},flags:['banquet_gift']},
    {weight:30,label:'謝謝參加',result:'最後一個號碼念完，沒有你。主持人說人人都有收穫，你把桌上還沒開的濕紙巾收進包裡，暫時想不到別的。',delta:{mood:-5,slack:4}}
   ],[],'banquetAfterparty'),
   c('不等抽獎，去幫忙發菜，先讓工作人員吃到飯。','你把留下來的菜分給還在忙的人。有人問工作人員能不能也加碼，Spencer笑說家境不允許。大家一起笑完，你先把熱飯遞出去；這筆福利不用再送主管簽核。',{trust:12,mood:7,energy:-3},['banquet_staff'],'banquetAfterparty'),
   draw('把抽獎箱叫作生產環境，請大家一起見證上線。','年度生產抽籤',[
    {weight:12,label:'正式環境出大獎',result:'你一喊上線，主持人就念中你的號碼。你領到了實實在在的獎金，同事要求把這套口訣寫進部署文件。Rick說早就知道你可以，你請他先不要把抽獎排進下週KPI。',delta:{cash:26,mood:23,trust:7,skill:3},flags:['banquet_prize']},
    {weight:58,label:'收到小額回應',result:'主持人抽出一份小獎，獎金進了自己的口袋。你宣布正式環境有正常回應，同事替你鼓掌；Rick問能不能把系統都弄得這麼簡單，你決定先去洗手間。',delta:{cash:8,mood:12,trust:5,slack:5},flags:['banquet_gift']},
    {weight:30,label:'查無中獎資料',result:'獎抽完了，你查無資料。同事問要不要重試，你看一眼空箱子，宣布本次沒有備份可以回滾。主持人笑到差點忘了宣布散場，今晚總算有人因為你的事故笑得很開心。',delta:{mood:5,trust:7,slack:4}}
   ],[],'banquetAfterparty',{wild:true})
  ]);
 case 'banquet-afterparty':return scene('banquet-afterparty','散場了。阿良說他還有一攤。','kind',
  '桌上只剩水果和折過的抽獎券，大家開始找外套。阿良一邊收手機，一邊說尾牙結束得有點早。你想起他平常那些只講一半的私房行程，問他今晚有沒有安排，他笑著把椅子轉向你。',
  '有啊。你想去哪一種？',[
   c('阿良，帶我去你的暗黑續攤。這次真的要揪。','阿良一口答應：「好啊，你等我一下。」你穿好外套，他說去洗手間。門口等過一批同事，又等過一批計程車，手機最後只跳出他的訊息：「我先走了，下次一定。」行程沒開始，錢一塊也沒花；你對他的「等一下」倒是有了完整的認識。',{mood:-6,slack:5,trust:3},['kind_afterparty_ghost'],'banquetFinish'),
   c('今晚你當鋼琴，我組四手聯彈巡迴團。先帶路。','阿良笑得很大聲，連說可以，還答應替你安排首演。你去拿外套，回來只剩一張推回桌下的椅子。群組裡他留了一句「馬上回」，本人卻連謝幕都省了。巡迴團沒有出發，你也沒有付任何費用，只有這個團名留了下來。',{mood:-3,trust:6,slack:8},['kind_afterparty_ghost'],'banquetFinish',{wild:true}),
   c('不等續攤。自己吃碗麵，再搭車回家。','你找了間還開著的麵店，吃完直接叫車。這次行程只有地址、價格和到家時間，每一項都照說好的發生。遊戲存款花掉6格，今晚沒有再等誰回訊息。',{cash:-6,mood:15,energy:9},['banquet_selfcare'],'banquetFinish',{available:run.stats.cash>=6}),
   c('今天到這裡，我先回家。明天的工作明天再說。','你跟還在門口的同事道別，手機切成勿擾。沒有續攤，也沒有回公司補工時；今晚留下來的力氣，終於可以全拿去休息。',{mood:9,energy:12},['banquet_home'],'banquetFinish')
  ]);
 default:throw new Error('Unknown banquet event');
 }
}
