import {isExpansionV66} from './expansion-profile-v66.js';
export const isDeclinedArmSceneV66=(run,event)=>isExpansionV66(run)&&event?.id==='quiz26-arm-draw'&&(run.history||[]).some(row=>row.kind==='activity-invitation'&&row.activityInvitationOutcome?.id==='arm'&&row.activityInvitationOutcome.accepted===false);
export function withSceneContinuityV66(event,run){
 if(!isDeclinedArmSceneV66(run,event))return event;
 const copy=[
  ['在影片下回覆：照雙方確認的平手記錄，讓手先休息。','你把回覆留在影片下，提醒當時同意平手就照那個結果。阿福又回一句手不舒服，你沒有替影片多剪一場隱藏勝利。'],
  ['順著回：雖然平手，但阿福看起來其實比較強。','另一位同事在群組問這是哪門算法。你沒有到現場，仍成功替影片留言區補出一場賽後爭議。'],
  ['在群組頒雙手和平獎，禁止理由單方面突破停戰線。','你傳了一張紙獎狀的圖，阿福回了笑臉。影片仍是那場平手，你留在座位，沒有又被算成參加了一場正式比賽。']
 ];
 return {...event,title:'回到座位，平手影片又收到一段理由。',era:'腕力賽後・同事傳來的影片',body:'你剛才已婉拒腕力活動，回到座位處理原本的事。群組傳來一段阿福和同事的比賽影片，雙方最後同意平手；阿福又補訊息，說自己當時手不舒服。你沒有到場記分，現在只是看影片、決定怎麼回覆。',wing:'影片你看了吧？平手可以啦，只是我那時候手真的不舒服。',choices:event.choices.map((choice,index)=>({...choice,text:copy[index][0],result:copy[index][1]}))};
}
