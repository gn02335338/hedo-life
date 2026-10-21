export const COMPANY_EVENTS_V32=Object.freeze(['company-v32-market','company-v32-buyer','company-v32-vietnam']);
export const COMPANY_ENDING_IDS_V32=Object.freeze(['nasdaq','nasdaq_failed','taiwan','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark']);
export const COMPANY_FINALE_LABELS_V32=Object.freeze({nasdaq:'敲鐘程序完成',nasdaq_failed:'程序未能完成',taiwan:'上櫃程序完成',taiwan_failed:'上櫃計畫停下',google_board:'收購與董事席次確認',google_ousted:'交易完成，營運另行接手',buyer_board:'一般企業完成收購',buyer_ousted:'一般企業另換管理團隊',vietnam_core:'原有事業掛牌完成',vietnam_afterdark:'夜間新事業完成掛牌'});
export function companyEligibleV32(run){return run.stats.energy>8&&run.stats.cash>8&&(run.stats.skill>=35||run.stats.trust>=35);}
const c=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},effect,flags:[],...extra});
export function withCompanyEntryV32(event,run,finaleId){
 if(event?.id!==finaleId)return event;
 return {...event,title:'願景簡報翻到最後，這次想走哪一條？',body:'紐約、台灣、收購案，還有越南團隊：四份簡報在桌上排開。這些都是公司走向的平行宇宙，最後還得面對審查、買方與真正交得出的東西。',choices:[
  {...c('把掛牌計畫拿出來，先談要往哪個市場走。','companyMarket'),result:'你把掛牌計畫攤開，先看市場與送件安排，尚未替任何審查結果慶祝。'},
  {...c('翻開買方名單，談公司被收購以後怎麼辦。','companyBuyer'),result:'你翻到買方清單，把團隊安排與董事席次分開來談，沒有替任何人先保證位子。'},
  {...c('接上越南團隊的視訊，問問另一條路。','companyVietnam'),result:'你接上越南團隊的視訊。阿良也說他有提案；這次先確認本人有沒有在線。'},
  {...c('公司的願景留給公司，我先決定自己的人生。','careerExit'),result:'你把那幾份簡報推回桌中央，翻開自己的下一頁。'}
 ]};
}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const outcomes=(pairs)=>pairs.map(([family,weight,label,result])=>({weight,label:COMPANY_FINALE_LABELS_V32[family],result:COMPANY_FINALE_LABELS_V32[family],delta:{},effect:family,flags:[`company32_finish_${family}`]}));
const draw=(text,pairs,allowed=true)=>c(text,null,{available:allowed,draw:{label:'計畫落地之後',outcomes:outcomes(pairs)}});
export function getCompanyEventV32(run){
 const ctx=run.companyContext;if(!ctx||!COMPANY_EVENTS_V32.includes(run.eventId))throw new Error('Missing company plan');
 const s=run.stats,allowed=companyEligibleV32(run),back={...c('先回簡報桌，換一個方向想。','companyBack'),result:'你沒有簽下任何交易，先把這份方案放回桌上。'};
 const scene=(title,body,speaker,choices)=>({id:run.eventId,title,body,speaker,wing:'',kind:'company',era:'公司幻想線・平行宇宙',sourceIds:['companyFiction'],choices:[...choices,back]});
 if(ctx.route==='market'){
  const global=clamp(Math.round(15+s.skill*.3+s.trust*.2+s.dream*.2),20,82),taiwan=clamp(Math.round(22+s.skill*.25+s.trust*.25+s.dream*.1),25,88);
  return scene('交易所的鐘，不會只認簡報上的字。','翅膀把兩份時程攤開：一份通往 NASDAQ，一份通往台灣上櫃。工作成果、團隊默契和現場變數，都會跟著這份文件一起送出去。','wing',[
   draw('走 NASDAQ 的程序，把交付與揭露資料一起送上桌。',[['nasdaq',global,'敲鐘程序完成','燈牆真的亮起，團隊一起站上敲鐘台。'],['nasdaq_failed',100-global,'程序未能完成','預備好的敲鐘行程取消，訂好的機票變成最昂貴的願景紀念品。']],allowed),
   draw('走台灣上櫃的程序，先把每一份資料對齊。',[['taiwan',taiwan,'上櫃程序完成','代號真的出現在看板上，舊群組的通知同時爆炸。'],['taiwan_failed',100-taiwan,'上櫃計畫停下','文件退回修訂，慶祝背板先轉去倉庫等待下一版時程。']],allowed),
   draw('把小鴨放在桌中央當獨立董事，仍照程序補齊上櫃文件。',[['taiwan',Math.max(20,taiwan-12),'文件完成審查','小鴨沒有投票，團隊倒是把該補的資料都補齊了。'],['taiwan_failed',Math.min(80,112-taiwan),'小鴨無法簽名','會議記錄漏了一個簽名欄，玩具董事救不了真實文件。']],allowed)
  ]);
 }
 if(ctx.route==='buyer'){
  const board=clamp(Math.round(30+s.boss*.45-s.trust*.12),20,75);
  return scene('對方願意買公司，還沒答應買老闆的位子。','兩份收購意向書擺在桌上：幻想中的 Google 與另一間一般企業。價格之外，董事席次和營運權還沒談攏；買走招牌，不保證原本的話事人一起留下。','spencer',[
   draw('跟 Google 談，把團隊安排與治理條件一起列入。',[['google_board',board,'收購與董事席次確認','幻想中的交易完成，翅膀成為董事會成員。'],['google_ousted',100-board,'交易完成，營運另行接手','幻想中的 Google 接手公司，翅膀的門禁沒有跟著移轉。']],allowed),
   draw('跟一般企業談，先看清楚員工與管理層的安排。',[['buyer_board',board,'一般企業完成收購','買方留下翅膀的董事席次，新的公司標誌先換上大門。'],['buyer_ousted',100-board,'一般企業另換管理團隊','收購照常完成，翅膀的辦公室交給新的營運團隊。']],allowed),
   draw('請買方先試開三場會，再決定董事席次要不要附贈。',[['buyer_board',Math.max(10,board-15),'試開會後仍確認董事席次','買方整理出一份發言規則，翅膀拿到席次，也拿到發言計時器。'],['buyer_ousted',Math.min(90,115-board),'買方改採專業經理團隊','三場會開完，買方決定只買公司，不承接原本的會議主持人。']],allowed)
  ]);
 }
 return scene('越南團隊已經在線，這次談的不只是時差。','越南的工程夥伴把產品、交付與在地營運一項項列出來。阿良也擠進視訊，說自己另有一份「只適合平行宇宙」的夜間商業計畫。這條幻想支線由團隊與新事業的安排決定。','kind',[
  draw('讓越南團隊以原有產品與工程事業在當地掛牌。',[['vietnam_core',100,'原有事業掛牌完成','越南團隊站上掛牌現場，原本藏在交付清單裡的人終於有了自己的舞台。']],allowed),
  draw('跟著阿良的暗黑提案，籌備一間越開越晚的娛樂公司。',[['vietnam_afterdark',100,'夜間新事業完成掛牌','阿良靠訂位與場館營運成了大功臣；幻想裡的交易所第一次等他到齊才開場。']],allowed),
  draw('讓阿良用鋼琴示範商業模式，再請團隊決定投哪一案。',[['vietnam_core',60,'團隊選擇原有產品','鋼琴演完，工程團隊把產品數據接回投影幕，原有事業在越南完成掛牌。'],['vietnam_afterdark',40,'夜間事業獲得支持','阿良終於沒有在續攤前消失，場館票務與營運成了新事業，越南掛牌背板上也有他的名字。']],allowed)
 ]);
}
