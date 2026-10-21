// Original post-resignation stories. Cash is the game's abstract resource.
export const WEALTH_EVENTS_V27 = Object.freeze(['wealth-plan','wealth-startup','wealth-retire']);

const c = (text,result,delta={},effect=null,extra={}) => ({text,detail:'',result,delta,effect,flags:[],...extra});
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const scene = (id,title,body,choices) => ({
 id,title,body,choices,kind:'career',speaker:'self',era:'離職之後',
 sourceIds:['characterFiction'],minRules:27,wing:'這次沒有誰替你安排下一站。'
});

export function wealthEligibilityV27(run){
 const history=Array.isArray(run?.history)?run.history:[];
 const completed=run?.pending?history.slice(0,-1):history;
 const workDays=completed.filter(row=>row.kind==='daily'||row.kind==='fantasy').length;
 const enabled=/^e(?:27|28)-/.test(run?.seed||'');
 const startup=enabled&&run.stats.cash>=75&&workDays>=6;
 const retirement=enabled&&run.stats.cash>=90&&workDays>=10;
 return {startup,retirement,eligible:startup||retirement,workDays};
}

export function withWealthEntryV27(event,run){
 if(!event||!['exit-menu','rank-exit','career-exit'].includes(event.id)||!wealthEligibilityV27(run).eligible)return event;
 return {...event,choices:[...event.choices,c(
  '存款有了。我想離職創業，或把日子還給自己。',
  '你把離職信和存款清單放在一起。這次先想門外的生活，還沒有投錢，也還沒有遞出離職信。',
  {},'wealthPlan'
 )]};
}

const studios={
 system:'接規模清楚的系統案，維護與新增功能分開報價',
 ai:'先做能驗證的小型 AI 工具，算過成本才接下一單',
 project:'替小團隊整理交付與排程，插單就一起改日期',
 product:'和真正會用的人做小產品，需求先試過再做',
 design:'成立小型設計工作室，修改輪數與交付檔案先寫清楚',
 bd:'替小公司牽合作，把分潤、責任與退出條件談明白',
 sales:'經營自己能交付的商品，報價不再附送無限承諾',
 mis:'接小公司的資訊維護，夜間待命另外約定',
 executive:'找幾個願意一起做事的人，從有收入的小生意開始',
 finance:'替小團隊整理資金與付款規劃，先確認資料和服務範圍',
 accounting:'整理小團隊的帳務流程，需要執業資格的部分找合格專業人士合作',
 hr:'接範圍清楚的招募與人事流程案，追加服務重新談',
 admin:'替小團隊整理採購與行政流程，把臨時交辦也算進工時'
};

export function getWealthEventV27(run){
 const eligibility=wealthEligibilityV27(run),s=run.stats;
 if(!/^e(?:27|28)-/.test(run.seed)||!WEALTH_EVENTS_V27.includes(run.eventId))throw new Error('Invalid wealth scene');
 if(run.eventId==='wealth-plan')return scene('wealth-plan','存款清單上，終於寫得到自己的名字。',
  `你把離職後的計畫攤開。目前存款 ${s.cash}，已完成 ${eligibility.workDays} 個工作回合。創業準備需存款至少 75、完成 6 個工作回合；退休安排需存款至少 90、完成 10 個工作回合。這些是這段人生的故事門檻。今天先選方向，後面還能回來想。`,[
   c('想做自己的生意，先看看要準備什麼。','你打開一張空白計畫表，第一欄寫的是自己想做什麼。還沒花錢，也還沒離職。',{},'wealthStart',{available:eligibility.startup}),
   c('想把時間留下來，看看離職後的日子。','你把下一季的行事曆清空。還沒有定案，先看看哪些日子想留給自己。',{},'wealthRetire',{available:eligibility.retirement}),
   c('把存款封成「不用再忍基金」，先回座位。','你把清單收好。錢還在，原本的工作也還在；至少這次回去，是自己暫時做的決定。',{},'wealthReturn',{wild:true})
  ]);
 if(run.eventId==='wealth-startup'){
  const professional=clamp(.12+s.skill*.005+s.trust*.002,.25,.85);
  const goose=clamp(.05+s.slack*.004+s.skill*.0015+s.trust*.0015,.20,.75);
  return scene('wealth-startup','名片這次自己印，鍋也得自己認。',
   `你想${studios[run.actualRoleId]||studios[run.roleId]}。桌上還有另一張很不正經的草圖：按一下就會說「請先確認需求」的玩具鵝。存款要留一部分過日子，投入的那筆也得先算清楚。此刻存款 ${s.cash}，還沒支出。`,[
    c('離職，投入 35 存款，開一間小型專業工作室。','',{},null,{
     available:eligibility.startup&&s.cash>=35,
     check:{chance:professional,
      success:{result:'你先把範圍、付款和休息日寫進報價，再接下第一批做得完的案子。開張沒有敲鐘，第一張真的付清的帳單倒很好聽。你交回門禁卡，開始用自己的方式接工作。',delta:{cash:-35,mood:18,energy:10},effect:'venture_independent',flags:['wealth_startup','wealth_studio']},
      failure:{result:'你離職後才發現，有人很會稱讚方案，卻總在付款前失聯。第一輪投入沒有養活工作室，你在還留有生活預備金時停下來，把案子、成本和下一次要改的地方記好。公司沒有等你回去，你也沒有替自己安排回頭路。',delta:{cash:-35,mood:4,energy:5},effect:'venture_restart',flags:['wealth_startup','wealth_studio','wealth_setback']}
     }
    }),
    c('投入 40 存款，離職量產「拒絕臨時加需求」玩具鵝。','',{},null,{
     wild:true,available:eligibility.startup&&s.cash>=40,
     check:{chance:goose,
      success:{result:'試賣那天，玩具鵝對每個想加功能的人大叫「請另開一張單」。排隊的人笑到自己掏錢，還有人直接訂一箱送給同事。你把門禁卡放進抽屜，第一任員工是一隻不加班的鵝。',delta:{cash:-40,mood:22,energy:8},effect:'venture_independent',flags:['wealth_startup','wealth_goose']},
      failure:{result:'鵝叫得很好，訂單卻沒有跟著叫。你付完這輪打樣與小批量製作，停止追加，留下的存款還能讓你喘口氣。離職是真的，生意沒起來也是真的；紙箱裡那群鵝先陪你想下一個版本，不必再陪誰演願景。',delta:{cash:-40,mood:6,energy:5},effect:'venture_restart',flags:['wealth_startup','wealth_goose','wealth_setback']}
     }
    }),
    c('把創業簡報折成紙飛機，先回計畫表。','紙飛機落在自己這一側。還沒投資，也沒離職，先把下一步想清楚。',{},'wealthBack',{wild:true})
   ]);
 }
 return scene('wealth-retire','明天早上，先不替任何人設鬧鐘。',
  `你把這段人生累積的存款與時間攤在一起，想像離職後不被群組叫醒的早晨。目前存款 ${s.cash}。門禁卡交回去之後，要完全休息、偶爾做喜歡的事，或乾脆替自己的沙發成立董事會，都由你安排。`,[
   c('離職退休。睡到自然醒，日子慢慢過。','你交回設備，移除工作鬧鐘。第一個不用趕報到的早晨，你連早餐都願意坐下來慢慢吃。',{mood:24,energy:24},'retired_free',{available:eligibility.retirement}),
   c('離職，只接自己想接的小型顧問工作。','你把能接的範圍與時間寫清楚。想做才答應，不接也不用交改善計畫。',{mood:18,energy:18},'retired_flexible',{available:eligibility.retirement}),
   c('讓玩具鵝當董事長，通過本人永久休假案。','玩具鵝全票通過。你鄭重交回門禁卡，回家替沙發蓋上一個不用續約的休假章。',{mood:26,energy:20},'retired_free',{wild:true,available:eligibility.retirement}),
   c('還想再想想，先回計畫表。','你收起鬧鐘與玩具鵝。這一刻還沒離職，存款也沒有變動。',{},'wealthBack')
  ]);
}
