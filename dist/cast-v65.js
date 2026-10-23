// Public fictional character cards; historical proofs never draw this cohort.
import {isExpansionV65} from './expansion-profile-v65.js';
export const isCastV65=isExpansionV65;
export const CAST_PROFILES_V65=Object.freeze({
 zoe:Object.freeze({name:'201',title:'教育訓練專家主管／福委會會長',department:'people',seniority:'manager',cost:13,sensitivity:.04,
  about:'柔伊，也叫 Zoe、201，負責教育訓練與員工活動。工作中常需要在主管期待、活動安排與同事意見之間協調。',era:'201・培訓與福委現場'}),
 action:Object.freeze({name:'順哥',title:'商務長',department:'business',seniority:'director',cost:20,sensitivity:.04,
  about:'Action，商務長，常談合作方向與新事業構想。辦公室裡的高粱收藏，以及對區塊鏈的興趣，都是同事熟悉的話題。',era:'順哥・新事業提案'}),
 hester:Object.freeze({name:'海姐',title:'業務總監',department:'sales',seniority:'director',cost:18,sensitivity:.03,
  about:'海斯特，也叫 Hester，負責業務開發與客戶協調。與順哥有進修同學的交情，常參與跨部門的商務討論。',era:'海姐・業務與合作窗口'}),
 simon:Object.freeze({name:'丁哥',title:'產品設計專員',department:'product',seniority:'colleague',cost:12,sensitivity:.03,
  about:'Simon，也叫賽門、丁丁或全才副理，從事產品設計。曾參與主管職務考核，也會主持員工活動。',era:'丁哥・設計與職責邊界'}),
 james:Object.freeze({name:'詹姆士',title:'回鍋同事',department:'engineering',seniority:'colleague',cost:11,sensitivity:.01,
  about:'James，也有人寫作詹姆斯，曾多次離職後回到公司。熟悉不同時期的工作方式，同事以「移動趙子龍」打趣他的回鍋經歷。',era:'詹姆士・回鍋與版本沿革'}),
 johnny:Object.freeze({name:'強尼',title:'專案管理師',department:'project',seniority:'colleague',cost:11,sensitivity:.02,
  about:'Johnny，也叫小強哥，長期協助專案排程與跨部門協調。常需要把主管的臨時交辦整理成團隊能執行的工作。',era:'強尼・專案與臨時交辦'})
});
export const CAST_IDS_V65=Object.freeze(Object.keys(CAST_PROFILES_V65));

// Each row contains its own three replies and consequences. The fixed effects
// model work, appeasement and improvisation without previewing a reward.
export function castSceneV65(id,row){
 const [slug,title,body,wing,practical,practicalResult,soft,softResult,wild,wildResult,roles=[],participants=[]]=row;
 const p=CAST_PROFILES_V65[id];
 const choice=(text,result,delta,flags,extra={})=>({text,detail:'',result,delta,flags,...extra});
 const scene=id==='zoe'?(['orientation','training-hours'].includes(slug)?'recruiting':'office_day'):id==='action'?(['collection-inventory','friendly-pitch'].includes(slug)?'finance_budget':'meeting'):id==='hester'?(['classmate-scope','new-chain'].includes(slug)?'bd_partner':'client_call'):id==='simon'?'brand_studio':id==='johnny'?'project_schedule':'office_day';
 return {id:`cast65-${id}-${slug}`,speaker:id,title,body,wing,scene,kind:'daily',minRules:39,minTurn:1,weight:1.4,requiresCastV65:true,era:p.era,sourceIds:['castFictionV65','characterFiction'],...(roles.length?{roles}:{}),...(participants.length?{participants}:{}),choices:[
  choice(practical,practicalResult,{skill:5,trust:5,energy:-6,mood:-2},['evidence']),
  choice(soft,softResult,{lick:5,trust:-3,energy:-7,mood:-4},['loop']),
  choice(wild,wildResult,{slack:6,trust:2,energy:-4,mood:5},['archive'],{wild:true})
 ]};
}
