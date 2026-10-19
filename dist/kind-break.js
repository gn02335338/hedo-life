// A fictional office character and an ambiguous after-hours comedy scene.
// These lines describe the game world, not a real person's finances or activities.
export const KIND_BREAK_CHANCE=.28;
export const KIND_BREAK_COST=36;

export function getKindBreak(run){
 const canAfford=run.stats.cash>=KIND_BREAK_COST;
 return {
  id:'kind-break',kind:'self-care',speaker:'kind',era:'臨時邀約・阿良的私房行程',sourceIds:['characterFiction'],
  title:'他說四手聯彈，你問誰彈琴。',
  body:'技術經理阿良（Kind）平常把薪水叫作「帳單轉運站」，對下班後的安排倒是從不馬虎。今天他看你又在對著通知嘆氣，忽然湊過來：「晚上要不要一起去紓壓？四手聯彈那種。」你問誰彈琴，他指著自己：「我就是鋼琴。」價錢聽起來很有份量，行程內容還是只有這句話。',
  wing:'上班已經夠累了，下班就不要再當那個負責出力的人。',
  choices:[
   {text:'跟去。今天先讓腦袋下班，帳單明天再看。',detail:'',result:'這趟到底算不算音樂課，你們回程都沒有再討論。你只知道今晚沒有人追進度，心情鬆得很徹底，帳單也厚得很徹底。阿良順便教你幾招上班省電的心得；隔天坐回工位，你終於不會把每一則通知都當火警。',delta:{cash:-KIND_BREAK_COST,mood:55,slack:16,energy:10},flags:['kind_relaxed'],effect:'finishBreak',available:canAfford},
   {text:'不了，光聽就覺得髒。你自己去。',detail:'',result:'阿良把行程表收回去，笑著說你想太多。你沒有接著問，也沒有花這筆錢。各人有各人的休息方式，你回頭挑一種自己舒服的。',delta:{},flags:['kind_declined'],effect:'kindDecline'},
   {text:canAfford?'我只想吃宵夜，不想參加你的音樂班。':'先不要，我的錢包比心情更需要休息。',detail:'',result:canAfford?'阿良說那下次再揪。你把「私房」兩個字留給他，今晚的預算拿來吃飯、找朋友，或單純睡個好覺。':'你看一眼餘額，決定先別替帳單加戲。阿良沒有替你墊，也沒有勸你借；你還是可以選一種負擔得起的休息方式。',delta:{},flags:['kind_declined'],effect:'kindDecline'}
  ]
 };
}
