// These goals are projections of committed e32 history. Catalogue IDs and
// client-supplied flags never substitute for the conversation that earned one.
import {PERSONAS} from './persona.js';
import {VERBAL_FINALE_LABELS_V32} from './verbal-outcomes-v32.js';
import {COMPANY_FINALE_LABELS_V32} from './company-v32.js';
const badge=(id,title,description,group)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`});

export const VERBAL_ACHIEVEMENTS_V32=Object.freeze([
 badge('verbal-onboarding','報到證變成發言證。','在報到對話開嗆，接著把錄取爭議說到一個專屬收尾。工作證還沒掛上，這場新人介紹已經有了結案紀錄。','verbal'),
 badge('verbal-wing-concession','這次換翅膀吞回去。','對翅膀開嗆後，讓這場爭議以他退讓收尾。你沒有接到新名片，卻拿回了他原本不肯講清楚的條件。','verbal'),
 badge('verbal-boardroom','董事會今天有逐字稿。','當面對屎潘蛇開嗆，把原本的願景談話送進董事會紀錄。會議終於留下一份不能只靠口頭補充的版本。','verbal'),
 badge('verbal-rick-awake','電話掛了，瑞克醒了。','對瑞克開嗆後，走到他的專屬收尾。乾兒子掛掉老闆的來電，這次沒有再把工作轉給別人。','verbal'),
 badge('verbal-hr-rewrite','改善計畫，先改善主詞。','對希望開嗆後，讓人事文件真的換了寫法。不是你又多填一張表，是原本的表格終於也被要求解釋。','verbal'),
 badge('verbal-legal-letter','嘴巴下班，附件加班。','對法師開嗆後，走完這輪口角的正式書面收尾。信裡有原話、有前後文，也有你自己的回覆。','verbal'),
 badge('verbal-sonny-statement','阿福追加第四十點聲明。','對阿福開嗆後，走到他的理由伯專屬收尾。回覆還沒讀完，比賽、工單與你的問題都已經先暫停。','verbal'),
 badge('verbal-kind-ghost','話留在這裡，人留不住。','對阿良開嗆後，走到只剩承諾留在現場的收尾。他答得很快，消失得比回覆還快。','verbal'),
 badge('verbal-colleague-solidarity','這次附議有人的名字。','對同事開嗆後，讓這場衝突走成共同表態的收尾。不是群組裡一排貼圖，有人真的把名字留了下來。','verbal'),
 badge('verbal-viral','上市沒上，這句先上了。','把一場口角說到意外爆紅。公司想要的聲量終於來了，只是熱門截圖沒有採用公關核准的標題。','verbal'),
 badge('verbal-mutual-mute','雙向靜音，準時下班。','把爭執談成雙方不再互相追殺的收尾。沒有誰說服誰，通知列倒是第一次安靜得很公平。','verbal'),
 badge('verbal-apology','道歉有句點，條件有底線。','在口角後正式道歉，也把不願吞下的條件寫清楚。你收回失言，沒有順便撤回自己整個人。','verbal'),
 badge('verbal-first-word','這句真的有說出口。','親口完成一次惡言相向。現場的人聽到了，你也得接住接下來的回覆；這枚章不計為夢裡或真的扁人。','verbal'),
 badge('verbal-many-ears','三位收件人，三份原話。','同一段人生對三位不同角色開嗆。每一筆都記實際選中的對象，不把同場旁聽的人順手算進去。','verbal'),
 badge('verbal-late-reply','結果出了，嘴還沒收。','已經選完原本的回覆，仍把一句嗆話說出口。先前的決定留在紀錄裡，這句也另外記帳。','verbal'),
 badge('verbal-pip-microphone','PIP 多了一欄原話。','在正式 PIP 對話中開嗆。評核表沒有這個欄位，希望還是得把你剛才說過的話記下來。','verbal'),
 badge('verbal-exit-team','三件套，逐一點名。','在三件套共同談話時，親自選定其中一人開嗆。三個人在場，這句只寄給你點名的那一位。','verbal')
]);

export const COMPANY_ACHIEVEMENTS_V32=Object.freeze([
 badge('company-nasdaq-failed','鐘有借到，交易沒有。','走到 NASDAQ 敲鐘失敗的幻想結局。彩排照拍、合照照存，願景這次卡在真正要成交的地方。','career'),
 badge('company-taiwan-listed','這次公告有股票代號。','走到台灣上櫃成功的幻想結局。簡報上的那一天終於到了，員工開始研究的也終於不是另一張時程表。','career'),
 badge('company-taiwan-failed','興櫃的心，補件的命。','走到台灣上櫃失敗的幻想結局。上市櫃夢沒有進入敲鐘現場，先進入了一輪又一輪補充說明。','career'),
 badge('company-google-board','大公司的小張椅子','在被 Google 收購的幻想裡，看著翅膀換上董事會名牌。公司名字變了，他要大家讀書的口氣還在。','career'),
 badge('company-google-ousted','交割完成，翅膀除名。','在被 Google 收購的幻想裡，看著翅膀被請離公司。整合清單這次真的刪了一項，而且不是工程師的工具預算。','career'),
 badge('company-buyer-board','換招牌，留翅膀。','在被一般公司收購的幻想裡，翅膀留在董事會。門口換了名字，會議室仍有一張很熟悉的椅子。','career'),
 badge('company-buyer-ousted','收購附贈安靜會議室。','在被一般公司收購的幻想裡，看著翅膀交出門禁卡。新東家的第一個整合成果，是大家終於能把一場會議講完。','career'),
 badge('company-vietnam-core','跨海交付，原業敲鐘。','走到越南原有事業上市成功的幻想結局。遠端工程團隊的交付終於寫進主角欄，沒有再被縮成簡報角落的一行。','career'),
 badge('company-vietnam-afterdark','阿良這次真的有到場。','走到越南暗黑事業上市的荒謬幻想結局。阿良成了大功臣，這一次有他的名字、有他的椅子，人也真的出現了。','career')
]);

export const ACHIEVEMENTS_V32=Object.freeze([...VERBAL_ACHIEVEMENTS_V32,...COMPANY_ACHIEVEMENTS_V32]);

const verbalFamilies=Object.freeze({
 verbal_onboarding:'verbal-onboarding',verbal_wing_concession:'verbal-wing-concession',
 verbal_boardroom:'verbal-boardroom',verbal_rick_awake:'verbal-rick-awake',
 verbal_hr_rewrite:'verbal-hr-rewrite',verbal_legal_letter:'verbal-legal-letter',
 verbal_sonny_statement:'verbal-sonny-statement',verbal_kind_ghost:'verbal-kind-ghost',
 verbal_colleague_solidarity:'verbal-colleague-solidarity',verbal_viral:'verbal-viral',
 verbal_mutual_mute:'verbal-mutual-mute',verbal_apology:'verbal-apology'
});
const targetByFamily=Object.freeze({verbal_onboarding:'wing',verbal_wing_concession:'wing',verbal_boardroom:'spencer',verbal_rick_awake:'rick',verbal_hr_rewrite:'hope',verbal_legal_letter:'erich',verbal_sonny_statement:'sonny',verbal_kind_ghost:'kind'});
const colleagues=new Set(['jack','meimei','helen','sophie','jonathan','owen','sam','cindy','jenjen']);
const companyFamilies=Object.freeze({nasdaq_failed:'company-nasdaq-failed',taiwan:'company-taiwan-listed',taiwan_failed:'company-taiwan-failed',google_board:'company-google-board',google_ousted:'company-google-ousted',buyer_board:'company-buyer-board',buyer_ousted:'company-buyer-ousted',vietnam_core:'company-vietnam-core',vietnam_afterdark:'company-vietnam-afterdark'});
const companyScenes=Object.freeze({nasdaq:'company-v32-market',nasdaq_failed:'company-v32-market',taiwan:'company-v32-market',taiwan_failed:'company-v32-market',google_board:'company-v32-buyer',google_ousted:'company-v32-buyer',buyer_board:'company-v32-buyer',buyer_ousted:'company-v32-buyer',vietnam_core:'company-v32-vietnam',vietnam_afterdark:'company-v32-vietnam'});
const verbalReactions=Object.freeze({ignored:'對方沒有接招',relationship:'關係當場冷掉',retort:'原話反嗆回來',support:'有人補上前情',personnel:'人事接手',legal:'進入正式說明'});
const resolved=row=>row&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&Number.isInteger(row.turn)&&row.turn>=0&&typeof row.result==='string'&&Boolean(row.result.trim())&&Array.isArray(row.breakdown);
const isTarget=target=>target==='self'||Object.hasOwn(PERSONAS,target||'');
const sameOutcome=(row,label,drawLabel)=>row.eventOutcome?.label===drawLabel&&row.eventOutcome.result===label;
function spokenProof(history,index){
 const row=history[index],proof=row?.verbalOutcome;
 if(!resolved(row)||proof?.version!==2||!isTarget(proof.target)||proof.target!==row.speaker||proof.origin!==row.eventId||!Object.hasOwn(verbalReactions,proof.kind)||!Number.isInteger(proof.affinityDelta)||proof.affinityDelta< -60||proof.affinityDelta>12||!['event','result'].includes(proof.phase)||!['daily','fantasy','onboarding','verbal'].includes(row.kind)||row.choiceIndex<1||typeof row.choiceText!=='string'||!row.choiceText.trim()||row.eventOutcome?.label!=='這句話說出口之後'||row.eventOutcome.result!==verbalReactions[proof.kind])return null;
 if(proof.target==='self'&&proof.affinityDelta!==0)return null;
 if(proof.phase==='result'&&(row.kind!=='verbal'||!resolved(history[index-1])||history[index-1].eventId!==proof.origin))return null;
 return proof;
}

export function hasCompanyFinaleV32(run,family){
 if(!/^e(?:32|33|34|35|36|37)-/.test(run?.seed||'')||run.completed!==true||typeof run.roleId!=='string'||!run.roleId||run.endingId!==`${family}-${run.roleId}`||!Object.hasOwn(companyScenes,family))return false;
 const row=Array.isArray(run.history)?run.history.at(-1):null;
 return Boolean(resolved(row)&&row.choiceIndex<=2&&row.kind==='company'&&row.eventId===companyScenes[family]&&sameOutcome(row,COMPANY_FINALE_LABELS_V32[family],'計畫落地之後')&&row.speaker===({'company-v32-market':'wing','company-v32-buyer':'spencer','company-v32-vietnam':'kind'}[row.eventId]));
}

// A completed ending must still have its own resolved final conversation. The
// nearest spoken response binds target and timing to that same attempt; a
// different person's earlier speech cannot lend its proof to this finale.
export function deriveAchievementsV32(run){
 if(!/^e(?:32|33|34|35|36|37)-/.test(run?.seed||''))return [];
 const history=Array.isArray(run.history)?run.history:[],ids=new Set(),targets=new Set();
 const speechActions=(Array.isArray(run.actions)?run.actions:[]).filter(action=>action?.type==='verbal');
 let lastSpeech=-1,speechCount=0;
 for(const [index,row] of history.entries()){
  if(row?.verbalOutcome!==undefined){
   lastSpeech=index;
   const action=speechActions[speechCount++];
   const proof=spokenProof(history,index);
   if(!proof)continue;
   ids.add('verbal-first-word');
   if(proof.target!=='self')targets.add(proof.target);
   if(proof.phase==='result')ids.add('verbal-late-reply');
   if(/^pip-(?:review|passed|pressure)$/.test(proof.origin))ids.add('verbal-pip-microphone');
   if(['crisis-boss','paperwork','dismissal-final'].includes(proof.origin)&&['erich','jenjen','sonny'].includes(proof.target)&&action?.version===2&&action.eventId===proof.origin&&action.phase===proof.phase&&Object.hasOwn(action,'target')&&action.target===proof.target)ids.add('verbal-exit-team');
  }
  if(run.completed!==true||typeof run.endingId!=='string'||typeof run.roleId!=='string'||!run.roleId||!resolved(row)||row.choiceIndex>2||index!==history.length-1)continue;
  const family=run.endingId.endsWith(`-${run.roleId}`)?run.endingId.slice(0,-run.roleId.length-1):'';
  if(row.eventId==='verbal-v32-aftermath'&&row.kind==='verbal'&&Object.hasOwn(verbalFamilies,family)&&sameOutcome(row,VERBAL_FINALE_LABELS_V32[family],'這場口角接著怎麼收尾')){
   const proof=spokenProof(history,lastSpeech);
   if(!proof||row.speaker!==proof.target||lastSpeech<0||lastSpeech>=index)continue;
   if(targetByFamily[family]&&targetByFamily[family]!==proof.target)continue;
   if(family==='verbal_onboarding'&&(proof.origin!=='onboarding'||proof.phase!=='event'))continue;
   if(family==='verbal_wing_concession'&&proof.origin==='onboarding'&&proof.phase==='event')continue;
   if(family==='verbal_colleague_solidarity'&&!colleagues.has(proof.target))continue;
   ids.add(verbalFamilies[family]);
  }
  if(Object.hasOwn(companyFamilies,family)&&hasCompanyFinaleV32(run,family))ids.add(companyFamilies[family]);
 }
 if(targets.size>=3)ids.add('verbal-many-ears');
 return ACHIEVEMENTS_V32.filter(item=>ids.has(item.id)).map(item=>item.id);
}
