import { WILD_BASE } from './wild-base.js';
import { WILD_EXPANDED } from './wild-expanded.js';

// Authored alternatives change the way a choice is performed, not its rules.
// In particular, signing, leaving, paying and staying keep their actual meaning.
export const WILD_SYSTEM={
 'onboarding':{index:0,text:'把錄取通知折成護身符，掛在工位上開工。',result:'你向護身符報上房租金額，然後坐下處理第一份交辦。紙張沒有發光，工作倒是立刻來了。'},
 'education-review':{index:2,text:'把他推薦的書做成御守，宣布開會只帶這本經。',result:'你翻到書名那頁，表情比讀完全文還虔誠。Wing滿意地點頭，這次先驗收封面，內容留待下次顯靈。'},
 'education-scrutiny':{index:1,text:'用紙箱搭一座台大校門，宣布讀書會就地開學。',result:'校門小到只有訂書機進得去，Wing仍先指導你把校名寫端正。你替他的讀書觀念搭了舞台，他沒有因此忘記剛才嫌你的價格。'},
 'salary-cut':{index:2,text:'把錄取信和新薪資單裝框，請Hope辦「同工不同酬」回顧展。',result:'你把兩份條件並排，請她逐項說明差異。',check:{success:{result:'Hope看著兩張薪資單，打電話請示後通知這次不降了。展覽沒有開成，原本的薪水保住了，工作量倒是一件也沒撤展。'},failure:{result:'Hope說Wing看過了，還是維持降薪。你問作品說明要寫哪一條交付不符，她說不用寫那麼多，先回答接不接受。'}}},
 'salary-final':{index:1,text:'替這份薪水辦告別式，鞠躬三次後離場。',result:'你把新薪資單蓋上，向這段合作致意。Hope問是不是太突然，你說降薪通知的開場也沒有比較長。今天就到這裡。'},
 'crisis-boss':{index:1,text:'替自願離職書掛號，主訴填「本人毫無自願」。',result:'你把紙推回去，請三件套先釐清這個症狀。Erich開始解釋文字，JenJen翻出另一份表，Sonny繼續等帳號；你把每一句都記下來。'},
 'paperwork':{index:0,text:'把空白簽名欄當考古現場，拉封鎖線，拒絕動筆。',result:'你用兩支筆圍住空白處，說這裡還沒有發現任何自願的證據。三件套把表格收走，書面往來由你留著；離開的原因沒有被那格簽名改寫。'},
 'crisis-mood':{index:2,text:'把靈魂設成離線，由滑鼠游標代理出勤。',result:'游標很忙，你的投入先調低。Wing經過時，只看見畫面上還有東西在動；願景先交給他，你把力氣留給自己。'},
 'pip-review':{index:0,text:'把交付紀錄排成召喚陣，請Hope逐條唸完再評核。',result:'日期、要求和成果圍成一圈，會議桌中央沒有地方再放空泛評語。',check:{success:{result:'Hope一張張核對完，接了一通電話，通知PIP通過。召來的不是Wing，至少是那句原本一直等不到的結論。'},failure:{result:'Hope走完整圈，最後仍填上未達改善目標。你問哪張紀錄有問題，她說是整體評估；原來這個陣缺的，是能召喚具體答案的符。'}}},
 'pip-passed':{index:2,text:'在螢幕養一座電子木魚，讓它替我顯示忙碌。',result:'每聲木魚都像一次進度回覆。真正的工作仍由你處理，Wing經過時你也更會挑一個看起來很忙的畫面；修行的重點是省電。'},
 'promotion-review':{index:1,text:'用Wing的金句寫國歌，報告前先全體起立。',result:'你的升遷報告多了一張歌詞，所有副歌都在歌頌他的遠見。',check:{success:{result:'Wing聽完還替副歌補了兩句，接著點頭調整職稱。你換到新名片，同事從此很少在你面前點歌。'},failure:{result:'Wing說你只會唱漂亮話，升遷先不談。上週他才要大家多認同願景，今天又嫌你的拍子太刻意。'}}},
 'kind-break':{index:1,text:'太髒了。我只幫你叫鋼琴搬家公司，不參加演奏。',result:'阿良說他是鋼琴，不是貨運。你替這場音樂比喻畫下休止符，沒有花錢，也不再追問，回頭挑一種自己舒服的休息。'},
 'kind-workday':{index:1,text:'太髒了。我只幫你叫鋼琴搬家公司，不參加演奏。',result:'阿良說他是鋼琴，不是貨運。你請他另找演奏廳，沒有花這筆錢，轉回螢幕處理原本那件工作。'},
 'self-care':{index:3,text:'購物車放進一整座海島，最後按取消訂單。',result:'你沒有買島，也沒有花錢。海景停在結帳頁，待辦仍在公司；想休息的念頭先留著，你關掉購物車回去。'},
 'exit-menu':{index:0,text:'把離職信折成紙飛機，宣布目的地是公司以外。',result:'紙飛機的航程不遠，你的決定已經很清楚。正式通知照樣寄出，交接照樣確認，這次不用再為Wing的未來預言留在登機口。'},
 'career-exit':{index:5,text:'把名片送去紙類回收，申請轉生成不加班的傳單。',result:'回收桶沒有承諾下輩子的工時，你先結束這一份工作。名片留下，自己的時間帶走，今天就是最後一天。'},
 'final-shortfall':{index:0,text:'拿一口鍋代替交易所銅鐘，先敲下班鐘。',result:'鍋聲比上市日期還確定。你把簡報關掉，開始整理自己已經走過的職涯；要用哪一段收尾，這次自己挑。'},
 'career-review':{index:2,text:'把辦公椅排成商學院，請同事當教授、會議紀錄當作業。',result:'交付、合作和帶人的課輪流開。你交完一疊大家看得懂的作業，沒有立刻拿到新名片，倒是少了幾個只會在會議裡猜的地方。'},
 'career-duty-1':{index:0,text:'在排程表養一隻哥吉拉，專門吃掉超出工時的需求。',result:'怪獸每吃一項，你就註明少多少人、延多少天。Wing嫌這張表很有意見，小組第一次知道這週不用跟電影一樣演到凌晨。'},
 'career-duty-2':{index:0,text:'提名影印機進PIP，附上它真正卡紙的紀錄。',result:'Hope說機器不能算人頭，你就請她拿出人的實際交付再談。表格退回去補件，至少沒有同事因為一個空格被你填進去。'},
 'career-duty-3':{index:0,text:'把許願清單印成鈔票，請預算表現場兌現。',result:'預算表不收願望鈔票。你改刪閒置訂閱、重複工作和做不到的承諾；團隊今天沒有被當成找零。'},
 'career-duty-4':{index:0,text:'把未確認的承諾列成碎紙機試吃菜單，先請決策者點餐。',result:'試吃的只有影本，原始資料全留在未確認清單。你請每個點餐的人寫下名字，還沒核對的內容先不替誰簽；Wing嫌這頓飯規矩很多。'},
 'rank-exit':{index:4,text:'辦公椅列為留置行李，我自己登上離職班機。',result:'你沒有替椅子買票，也沒有繼續等別人宣布下一站。職稱留在交接清單，自己帶著時間離開。'},
 'career-step-down':{index:2,text:'先把主管光環放冷凍庫，職稱明天再解凍。',result:'冰箱不收管理責任。你把這個念頭記下，暫時保留目前的職級，回清單想想究竟要交回哪一部分。'},
 'story-exit':{index:5,text:'請前同事組陪審團，暫緩宣判我是哪種離職人。',result:'群組很快開始討論要吃哪一家，沒有人願意先替你下結論。你翻回職涯頁，決定自己再選一次。'},
 'deputy-late-shift':{index:2,text:'頒發「影分身之術」研習證書，請小組照原期限開工。',result:'證書印好了，分身一個也沒來。Wing對你的動員很滿意，小組則確認了副理的專長是把同一句話換個格式。'},
 'manager-pip-signature':{index:0,text:'把PIP表送去驗DNA，先查結論是哪份工作生的。',result:'你把目標、交付和缺少的紀錄逐項附上。Hope得先補齊這份表的身世，不能只用一句態度不佳就請你簽名。'},
 'director-budget-room':{index:1,text:'用一鍋滷味召開部門拍賣會，交換能救火的人力。',result:'你花了一點預算把人約齊，白板列的都是可核對的交換條件。海帶沒辦法寫程式，其他部門倒是願意借一個真的會的人。'},
 'chief-title-proofread':{index:2,text:'把職稱做成五公尺長的登基詔書，請行政沿走廊宣讀。',result:'稱呼終於完整了，缺的人力仍在等核准。Wing說形象到位，大家聽完長長的職稱，把原本想說的話縮回私訊。'}
};

export const WILD_OPTIONS={...WILD_BASE,...WILD_EXPANDED,...WILD_SYSTEM};
export function applyWildOptions(event,run){
 if(!event||!/^e(?:12|13|14|15|16)-/.test(run?.seed||''))return event;
 const patch=WILD_OPTIONS[event.id];
 if(!patch)return event;
 const choice=event.choices[patch.index];
 if(!choice||choice.available===false)return event;
 const next={...choice,text:patch.text,result:patch.result,wild:true};
 if(choice.check){
  next.check={...choice.check};
  for(const outcome of ['success','failure'])if(choice.check[outcome])next.check[outcome]={...choice.check[outcome],result:patch.check?.[outcome]?.result||patch.result};
 }
 if(choice.draw)next.draw={...choice.draw,outcomes:choice.draw.outcomes.map((outcome,index)=>({...outcome,result:patch.draw?.outcomes?.[index]?.result||patch.result}))};
 return {...event,choices:event.choices.map((original,index)=>index===patch.index?next:original)};
}
