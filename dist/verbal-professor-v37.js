// Original dialogue for the fictional consultant. No historical quotations or
// assumptions about a real person's conduct are represented by these lines.
const voice={
  name:'林澤教授',
  line:'林澤教授，這張白板可以做研究，不能拿來替翅膀的讀心術背書。問題都還沒定義，他就把你的名字當明天一定做得完的保證，這是哪門子的驗證？',
  ignored:'林澤教授停了一下，把話題帶回需要驗證的條件。他沒有替你那句話開課，也沒有替公司的交期保證背書；你真的嗆了，原本沒人說清楚的問題仍然還在。',
  relationship:'林澤教授把筆記收起來，說如果你認為他的說明都是裝飾，後續就改用書面確認。你原本想衝著混亂的要求開火，卻讓眼前這位也把距離拉遠了。',
  retort:'林澤教授反問，你反對的究竟是哪個假設，能不能指出他剛才哪一句說錯。你本來想一句話出氣，現在還得把情緒裡真正的工作問題一項項拆出來。',
  support:'旁邊的人補上原始需求，說教授的建議確實被轉成了另一種承諾。林澤教授確認後把兩件事分開，你的語氣仍不好聽，至少不再只有你一個人在找原本說過什麼。',
  personnel:'林澤教授停止討論，請公司窗口處理剛才的溝通。希望稍後找你確認經過；顧問沒有替公司宣布你要離職，接下來的通知也不能只靠一句轉述就當成最後結論。',
  legal:'林澤教授要求把原話與前後文一併留下，別讓批評工作和針對個人的話混在一起。這輪先進入正式說明，沒有誰已經勝訴，也沒有因為對方是教授就少掉你的回覆空間。'
};

export function professorVerbalLineV37({event,phase='event'}={}){
  const title=String(event?.title||'這項研究建議').replace(/[。！？!?]+$/u,'').slice(0,64);
  const response=phase==='result'?'剛才那個回答我聽到了。':'';
  if(event?.id==='meal-with-professor')return `${response}林澤教授，我約的是吃飯，不是把整間公司的研究動機配湯吞下去。白飯都還沒問，就先要替翅膀補驗證，這餐也太會長工作了吧？`;
  if(/professor.*(?:diploma|admission|application|degree)|(?:education|advisor-application)/.test(event?.id||''))return `${response}林澤教授，剛才談的「${title}」，先分清楚是我想讀，還是公司想要一個好聽的校名。不能一報你的名字，就好像欠公司一張明天交的台大畢業證書，進修怎麼變成替老闆辦售後服務？`;
  if(/professor.*(?:demo|deadline|poc|prototype|benchmark)/.test(event?.id||''))return `${response}林澤教授，剛才那件「${title}」，展示能跑跟正式能用，總不能只差老闆點一下頭。你這份建議要驗證哪些事，講清楚，別讓你的名字又被拿去替不存在的交期蓋章。`;
  return `${response}林澤教授，剛才談的「${title}」，哪些條件真的驗過，哪些還只是想法，先講清楚。公司把每句建議都聽成保證，我快連白板上的問號都得替它排工期了。`;
}

export function professorVerbalVoiceV37(origin,phase){
  return {...voice,line:professorVerbalLineV37({event:{id:origin,title:'這項研究建議'},phase})};
}

export function professorVerbalReactionsV37(){
  return Object.fromEntries(['ignored','relationship','retort','support','personnel','legal'].map(kind=>[kind,voice[kind]]));
}
