import {isLifeSystemsV72} from './life-systems-v72.js';
import {deriveCharacterStats} from './character-stats.js';
import {COMPANY_FINALE_LABELS_V32} from './company-v32.js';
import {COMPANY_ENDING_IDS_V39,COMPANY_FINALE_LABELS_V39} from './company-v39.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const labels={...COMPANY_FINALE_LABELS_V32,...COMPANY_FINALE_LABELS_V39};
const paths=Object.freeze({
 nasdaq:{route:'market',speaker:'professor',name:'海外資本市場',title:'海外窗口回信，先問交付與揭露。',body:'海外顧問接上 NASDAQ 的籌備程序。翅膀已經在想敲鐘站哪一邊，對方卻先問營收、交付與風險揭露；你把這段時間留下的紀錄放回桌上。'},
 taiwan:{route:'market',speaker:'erich',name:'台灣資本市場',title:'本地送件窗口，要的是能核對的版本。',body:'本地輔導窗口接下台灣上櫃的準備。法師把缺件標出來，翅膀說應該很快，你看著清單，決定最後一輪怎麼整理。'},
 google:{route:'buyer',speaker:'spencer',name:'大型科技買方',title:'大買方在談公司，不只在看簡報。',body:'幻想中的 Google 提出收購意向。團隊的交付和技術被放進審查，翅膀的董事席次卻仍是另一張待談的紙；不是把招牌交出去，就能替每張椅子續約。'},
 buyer:{route:'buyer',speaker:'owen',name:'一般企業買方',title:'意向書到了，接手以後誰說了算？',body:'一路往來的企業買方提出收購意向。歐文把合作條件攤開，員工安排、交接範圍與管理權各有一欄；董事席次不會因為老闆把名片放得很正就自動保留。'},
 vietnam_core:{route:'vietnam',speaker:'kind',name:'越南原有事業',title:'跨境交付留下的紀錄，成了新的提案。',body:'越南團隊把產品、交付與在地合作整理成掛牌提案。這次不是只在報告裡算人力成本，工程與營運夥伴真的坐在同一張桌上，等公司把該承擔的部分說清楚。'},
 vietnam_afterdark:{route:'vietnam',speaker:'kind',name:'阿良的夜間新事業',title:'阿良這次沒有消失，還帶了營運表。',body:'阿良把私下累積的場館與合作窗口接成一份平行宇宙提案：娛樂、票務與夜間營運，準備在越南談掛牌。他肯介紹人，不代表那些人會替空白的帳目與交付簽名。'}
});
const ordinary=row=>row&&!row.verbalOutcome&&!row.patronageOutcome&&!['rage','rage-world','verbal','event-departure'].includes(row.kind)&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0;
const cooperative=row=>ordinary(row)&&row.chanceOutcome!=='setback'&&(row.choiceIndex===0||(row.delta?.trust||0)>0);
const text=row=>`${row.eventId} ${row.title||''} ${row.body||''} ${row.choiceText||''} ${row.result||''}`;

// Evidence is derived from already committed scenes, never a client-supplied
// affinity number, company destination or fabricated choice probability.
export function companyEvidenceV72(run){
 const history=run.history||[],rows=history.filter(cooperative),f=run.flags||{},s=run.stats||{};
 const characterRows=new Map(deriveCharacterStats(run).map(row=>[row.id,row]));
 const affinity=id=>{const row=characterRows.get(id);return clamp(50+(row?.affinityGained||0)-(row?.affinityLost||0),0,100);};
 const encounters=id=>characterRows.get(id)?.encounters||0;
 const allies=['jack','professor','helen','meimei','owen','action','hester'].filter(id=>affinity(id)>=65&&encounters(id)>0);
 const delivery=rows.filter(row=>row.kind==='daily'&&/交付|驗收|測試|產品|上線|備份/.test(text(row))).length;
 const commercial=rows.filter(row=>row.kind==='daily'&&/客戶|合約|合作|營收|續約|商務/.test(text(row))).length;
 const crossBorder=rows.filter(row=>/越南|時差|跨國|跨境|海外|境外|遠端團隊/.test(text(row))).length;
 const vietnamDelivery=rows.filter(row=>/越南/.test(text(row))&&/交付|承接|窗口|產品|協作|團隊|營運/.test(text(row))).length;
 const accounting=rows.filter(row=>/帳目|對帳|收據|資金|現金|會計|稽核|憑證/.test(text(row))).length;
 const kind=affinity('kind'),kindContact=encounters('kind')>0;
 const kindMeal=history.some(row=>row.mealOutcome?.target==='kind'&&row.mealOutcome?.reaction==='warm'&&row.delta?.cash<0);
 const kindNetwork=Boolean(f.kind_relaxed||f.relationship72_kind_network||kindMeal);
 return {delivery,commercial,crossBorder,vietnamDelivery,accounting,evidence:Math.min(12,f.evidence||0),allies,affinity:Object.fromEntries(['kind','professor','spencer','helen','owen','action','hester','meimei','jack'].map(id=>[id,affinity(id)])),
  vietnamCoreEligible:Boolean(vietnamDelivery>0||f.relationship72_vietnam_delivery||kind>=60&&kindContact),
  vietnamDarkEligible:Boolean(kind>=68&&kindContact&&kindNetwork),kindNetwork,
  professorSupport:Boolean(f.relationship72_professor_support||affinity('professor')>=65&&encounters('professor')>0),
  businessSupport:Boolean(f.relationship72_business_network||['owen','action','hester','meimei'].some(id=>affinity(id)>=65&&encounters(id)>0)),
  shares:Math.min(3,f.shareholder58_owned||f.shareholder58_subscribed||f.shares_bought||0),cash:s.cash||0};
}

export function companyPathWeightsV72(run){
 const e=companyEvidenceV72(run),s=run.stats||{};
 return {taiwan:38+Math.min(16,e.accounting*2)+e.evidence*1.2,
  nasdaq:14+Math.min(22,e.delivery*2)+Math.min(12,e.crossBorder*3)+(e.professorSupport?18:0)+e.evidence*.7,
  buyer:24+Math.min(20,e.commercial*2)+(e.businessSupport?16:0)+(e.cash<30?10:0),
  google:8+Math.min(14,e.delivery*1.6)+(e.professorSupport?10:0)+(e.affinity.helen>=65?10:0)+(s.skill>=70?8:0),
  vietnam_core:e.vietnamCoreEligible?18+Math.min(24,e.vietnamDelivery*6)+Math.min(12,e.crossBorder*2):0,
  vietnam_afterdark:e.vietnamDarkEligible?22+(e.affinity.kind-68)*.55+Math.min(12,(run.flags?.kind_relaxed||0)*6):0};
}

function reasonsFor(run,path,e){
 const reasons=[];
 if(path==='vietnam_afterdark'){
  reasons.push('你和阿良已有實際往來，他才願意介紹私下的合作窗口。');
  reasons.push(run.flags?.kind_relaxed?'那次花錢紓壓留下的交情，這回被他接成了場館與營運提案。':'飯局與合作累積的信任，讓阿良把原本不會對每個人提的計畫帶上桌。');
 }else if(path==='vietnam_core')reasons.push(e.vietnamDelivery>0?'先前的越南交付與協作紀錄，讓在地團隊有了能接續談的方案。':'你與阿良及合作窗口已有交情，越南團隊的提案才進到這一輪討論。');
 else if(path==='nasdaq'){
  if(e.professorSupport)reasons.push('林老師願意協助整理對外技術說明，海外窗口因此繼續追問。');
  if(e.delivery>0)reasons.push('之前完成的產品與交付工作，成了海外程序能拿出來核對的材料。');
 }else if(path==='taiwan')reasons.push(e.accounting>0?'先前留下的帳目與稽核工作，讓本地輔導窗口先接下這份案子。':'公司現有客戶與營運規模，先接上了本地輔導窗口。');
 else if(path==='google')reasons.push(e.delivery>0?'買方看上這段時間累積的技術與產品交付。':'大型科技買方對產品與團隊提出了進一步接觸。');
 else reasons.push(e.businessSupport?'商務夥伴願意把人介紹到同一張桌上，收購意向才走到書面。':'原有客戶與合作企業接上了收購窗口，這次終於有人拿出意向書。');
 if(reasons.length<2&&e.evidence>0)reasons.push('你保留下來的文件讓事情有得核對，仍不能代替審查與買方的最後決定。');
 if(!reasons.length)reasons.push('外部窗口回覆了公司的案子，新的機會仍得面對真正的查核。');
 return reasons.slice(0,3);
}

export function selectCompanyDossierV72(run,draw){
 if(!isLifeSystemsV72(run))throw Error('Company dossier requires current life rules');
 if(run.companyDossierV72)return structuredClone(run.companyDossierV72);
 const weights=companyPathWeightsV72(run),e=companyEvidenceV72(run);
 let ticket=draw()*Object.values(weights).reduce((a,b)=>a+b,0),path='taiwan';
 for(const [id,weight]of Object.entries(weights))if(weight>0&&(ticket-=weight)<0){path=id;break;}
 return {version:72,path,route:paths[path].route,reasons:reasonsFor(run,path,e),historyLength:run.history.length};
}

const c=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});
// Apply after the published legacy copy passes. This changes presentation only;
// the existing choice effects, flags and seeded draws remain intact.
export function withCompanyPreparationCopyV72(event,run){
 if(!isLifeSystemsV72(run)||event?.id!=='road')return event;
 const copy=[
  {text:'請玩具鵝穿西裝擔任願景長，真人連夜把產品簡報補齊。',detail:'先搶進度與聲量，承諾也跟著加碼。',result:'你把下一輪的時程排得很滿，翅膀很滿意那張看起來已經成功的封面。玩具鵝只負責站台，真正的加班與缺口仍然落在團隊身上。'},
  {text:'先把產品與營運數字核對清楚，缺什麼就寫什麼。',detail:'把能做到的事和待補的部分分開。',result:'你把口號拆成清單，讓同事逐項確認。附件終於能對上簡報，翅膀卻嫌那些限制寫得太清楚。'},
  {text:'先談人員安排與工作條件，再替下一輪排時程。',detail:'先確認團隊需要什麼，讓承諾有能承接的人。',result:'大家開始寫下分工、待遇與後續安排。翅膀看了一眼清單，先問自己的頭銜能多幾個字。'}
 ];
 return {...event,title:'簡報翻到最後，先問事情怎麼做。',era:'幻想主線・準備下一輪',body:'你撐到公司開始談下一輪的那天。翅膀把產品、營運數字與團隊安排都塞進同一頁，還沒決定怎麼做就想先拍成功合照。你要選的是這一輪如何準備；最後能接上什麼機會，還得看先前的成果、交情與對方的回覆。',wing:'報告要漂亮，數字要成長，人最好不要再增加。你們先把它做好，我再看看。',choices:event.choices.map((choice,index)=>copy[index]?{...choice,...copy[index]}:choice)};
}

export function withCompanyEntryV72(event,run,finaleId){
 if(!isLifeSystemsV72(run)||event?.id!==finaleId)return event;
 const previous=run.companyDossierV72;
 return {...event,title:'會議桌上的，是這一路留下的案子。',body:previous?'先前聯絡的窗口仍在等回覆。你可以補強資料，也可以先退出；把簡報收起來重開一次，已經談到的人不會因此換一批。':'公司的客戶、交付、帳目與合作窗口，各自留下了一條線。翅膀終於把它們放上同一張桌子；這次能接到什麼機會，得看真的做成過什麼，以及誰還願意一起談。',choices:[
  c(previous?'回到先前那份提案，確認接下來怎麼處理。':'把這段時間的工作與往來資料整理上桌。','company72Open',{result:'你把已經做過、答應過與留下紀錄的部分放進資料夾，等公司把外部窗口的回覆攤開。',flags:['company72_opened']}),
  c('替願景先印登機證，再請每個案子拿出自己的護照。','company72Open',{result:'翅膀嫌你的資料夾太像海關，大家卻終於開始找能核對的附件。登機證沒有替公司決定目的地，能接到哪個窗口仍得看真正的案子。',flags:['company72_opened'],wild:true}),
  c('公司的方案留在桌上，我先決定自己的人生。','careerExit',{result:'你把公司資料推回桌中央，先處理自己的去留，沒有替尚未落地的計畫宣告成功。'})
 ]};
}

const badText={
 company_closed:'資金與交付沒有撐過最後一輪，公司決定停止營運，你收到交接與離場通知。這是公司結束用人，不是你突然自願離職。',
 company_stagnation:'外部程序沒有落地，公司繼續靠原有案子營運。你仍在職，原約定月薪照常，掛牌與成長的日期又被往後移。',
 company_taiwan_exit:'公司沒有照提案擴張，反而通知裁撤台灣團隊，你也在資遣名單。工作交給越南遠端夥伴，這是高層的人力決策，不是任何國籍員工的過錯。',
 company_wage_arrears:'計畫停在資金缺口，月薪沒有按期入帳。你仍在職，保留工時與薪資紀錄、要求正式處理；這個收尾沒有替任何法律程序宣告勝負。',
 company_shell_brand:'買方只留下品牌與服務，原團隊收到資遣與交接安排。你的原任職結束，網站上的歡迎加入沒有替人留下座位。',
 company_restructured:'公司選擇縮編後繼續營運，你留任，原約定月薪仍在，人力與工具卻縮水。這次是公司的長期收尾，沒有替你虛構一封離職信。'
};
const goodText={nasdaq:'文件與交付通過最後核對，NASDAQ 的鐘真的響了。這段人生收在公司的重大里程碑，你仍隨團隊見證這次掛牌。',nasdaq_failed:'海外程序沒有完成，敲鐘行程取消。公司仍在運作，你還在職，這個公司篇章收在掛牌失敗，而不是一封不存在的自願離職信。',taiwan:'本地送件與查核走完，公司的代號真的出現在台灣上櫃看板。你仍在團隊裡，這段人生收在公司完成掛牌的那一天。',taiwan_failed:'本地程序沒有過完，背板先被收回倉庫。公司仍在運作，你還在職；這次收尾是上櫃計畫停下，並非你已離職。',google_board:'幻想中的 Google 完成收購，翅膀取得董事席次。你的後續任用依交易與書面安排處理，這段人生收在公司的重大交易。',google_ousted:'幻想中的 Google 完成收購並另換營運管理，翅膀沒有保住原本的管理位置。你的後續任用依書面安排處理，公司故事在這場交易收尾。',buyer_board:'一般企業完成收購，治理條件讓翅膀保留董事席次。你的任用與交接另依書面安排處理，這段人生收在正式交易完成。',buyer_ousted:'一般企業完成收購，買方決定交給新的管理團隊，翅膀沒有保留原管理位置。你的後續任用依書面安排處理，這段人生收在公司的重大交易。',vietnam_core:'越南團隊用原有產品與工程事業完成當地掛牌。你仍在團隊裡見證這次重大里程碑，之前的跨境協作終於被放在舞台中央。',vietnam_afterdark:'阿良介紹的夜間事業完成越南掛牌，場館、票務與營運都有正式承接。你仍見證這段平行宇宙的公司里程碑；這次阿良真的沒有在合照前消失。'};
const badShares={market:[18,29,15,20,7,11],buyer:[11,14,21,9,29,16],vietnam:[10,15,28,16,10,21]};

export function getCompanyEventV72(run){
 const dossier=run.companyDossierV72,ctx=run.companyContext,p=dossier&&paths[dossier.path];
 if(!isLifeSystemsV72(run)||!dossier||dossier.version!==72||!p||ctx?.version!==72||ctx.route!==p.route||run.eventId!==`company-v32-${p.route}`)throw Error('Missing current company proposal');
 const s=run.stats,e=companyEvidenceV72(run),risk=clamp(37+(s.cash<25?12:0)+(s.trust<35?8:0)+(s.dream>s.skill+20?5:0)-Math.min(10,e.allies.length*2)-Math.min(5,e.accounting),23,61);
 const base=clamp(21+s.skill*.28+s.trust*.16+e.evidence*1.3+Math.min(8,e.delivery)+(e.professorSupport?5:0),24,84);
 const board=clamp(38+s.boss*.32+(e.affinity.spencer-50)*.22-(e.affinity.professor-50)*.12,18,78);
 const pairs=dossier.path==='nasdaq'?['nasdaq','nasdaq_failed']:dossier.path==='taiwan'?['taiwan','taiwan_failed']:dossier.path==='google'?['google_board','google_ousted']:dossier.path==='buyer'?['buyer_board','buyer_ousted']:[dossier.path];
 const make=(text,mode,delta,extra={})=>{
  const localRisk=clamp(risk+(mode==='rush'?10:mode==='careful'?-7:3),18,68),success=clamp(base+(mode==='careful'?8:mode==='rush'?-8:0),18,90),seat=clamp(board+(mode==='careful'?-8:mode==='rush'?6:-4),10,85);
  const outcomes=pairs.map((family,index)=>({weight:(100-localRisk)*(pairs.length===1?100:p.route==='buyer'?(index===0?seat:100-seat):(index===0?success:100-success)),label:labels[family],result:`${dossier.reasons.join(' ')} ${goodText[family]}`,delta:{},effect:family,flags:[`company32_finish_${family}`,'company72_resolved'],companyOutcomeV72:{version:72,path:dossier.path,preparation:mode,family,reasons:[...dossier.reasons]}}));
  COMPANY_ENDING_IDS_V39.forEach((family,index)=>outcomes.push({weight:localRisk*badShares[p.route][index],label:labels[family],result:`${dossier.reasons.join(' ')} ${badText[family]}`,delta:{},effect:family,flags:[`company39_finish_${family}`,'company72_resolved'],companyOutcomeV72:{version:72,path:dossier.path,preparation:mode,family,reasons:[...dossier.reasons]}}));
  return c(text,null,{delta,draw:{label:'外部查核與公司最後決定',outcomes},...extra});
 };
 return {id:run.eventId,title:p.title,body:`${dossier.reasons.join(' ')} ${p.body}`,speaker:p.speaker,wing:'先看這份案子真的做到了哪裡，別替尚未完成的程序先拍成功合照。',kind:'company',era:'公司動向・這一路留下的結果',sourceIds:['companyFiction'],choices:[
  make('把交付、帳目與人員安排核對完，再送最後一版。','careful',{energy:-2,cash:-2},{available:s.energy>3&&s.cash>3}),
  make('先照現有版本往前送，缺口留到窗口追問時再補。','rush',{}),
  make('請玩具鵝主持最後核對，真人必須替每一欄簽名。','goose',{energy:-1,mood:4},{available:s.energy>2,wild:true}),
  c('先退出這輪討論，回去想自己的去留。','companyBack',{result:'你先把公司方案留在會場，沒有替它點頭，也沒有因此離職。先前已聯絡的窗口仍是同一批，不會因為重開簡報就換一條路。'})
 ]};
}
