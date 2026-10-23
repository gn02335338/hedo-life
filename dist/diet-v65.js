import {isExpansionV65} from './expansion-profile-v65.js';
export const DIET_TEAMS_V65=Object.freeze([{id:'johnny',name:'強尼隊'},{id:'annie_yu',name:'安妮余隊'},{id:'sonny',name:'阿福隊'}]);
export const isDietV65=run=>isExpansionV65(run)&&run.activityContext?.id==='diet';
export const dietTeamV65=run=>DIET_TEAMS_V65.find(team=>run.activityContext?.plan===`team-${team.id}`)||null;
export function withDietSceneV65(event,run){
 if(!isDietV65(run))return event;const s=run.activityContext.stage,team=dietTeamV65(run),participants=['jack','johnny','annie_yu','sonny'];
 if(s===0)return {...event,speaker:'jack',participants,title:'減肥比賽開始｜傑克開團，三隊先報名。',body:'傑克在群組主揪減肥比賽，分成 強尼、安妮余、阿福三隊。強尼拿出自己的行事曆，安妮余想先問蛋塔算哪一格，阿福則已經有三個今天不方便開始的理由。這場遊戲比七天安排與紀錄，不替真人的體型打分。你先選一隊。',wing:'自己排正常吃飯、活動和休息，不用替別人的便當做稽核。',choices:[{text:'加入 強尼隊，先把七天吃飯與活動排進日曆。'},{text:'加入安妮余隊，點心也要有自己的位置。'},{text:'加入阿福隊，把請假理由排成伸展行事曆。',wild:true}]};
 if(s===1)return {...event,speaker:team?.id||'jack',participants,title:`七天行事曆｜${team?.name||'你的隊伍'}這次怎麼排？`,body:`你已加入${team?.name||'自己的隊伍'}。傑克把七天空表傳進群組，要每個人自己填飲食和活動。強尼記得留休息日，安妮余把蛋塔放進點心欄，阿福問「打字說我要運動」算不算運動。你把自己的安排填好，不替任何人沒收午餐。`,wing:team?.id==='sonny'?'我不是不運動，是今天這個時段跟我的狀態不太對。':team?.id==='annie_yu'?'蛋塔可以有位置，還是我們要先替它報名？':'計畫排得下去，才有下一天。'};
 return {...event,speaker:'jack',participants,title:'減肥比賽結束｜三隊交表，理由不替紀錄加分。',body:`傑克收回三隊的行事曆。${team?.name||'你的隊伍'}交的是七天安排，另外兩隊也各有自己的完成紀錄。安妮余問第一名有沒有吃蛋塔，阿福想替「本來就有打算」申請補登，強尼請大家先核對真正填過的格子。名次是這場遊戲的結果，正常吃飯不會因為落榜被取消。`,wing:'先看自己的紀錄，再決定想留哪個習慣。'};
}
export function dietChoiceV65(run,index,resolved){
 if(!isDietV65(run))return resolved;
 const s=run.activityContext.stage;
 if(s===0){const team=DIET_TEAMS_V65[index];return {...resolved,plan:`team-${team.id}`,label:`加入${team.name}`,result:`你加入${team.name}，傑克把名字填進三隊名單。${index===0?'強尼先傳來一張留有正常吃飯和休息的空表。':index===1?'安妮余提醒點心也能填，不用把蛋塔偽裝成文件。':'阿福先說自己狀態未定，你請他把理由留到行事曆填完再發表。'}接下來只填自己的七天，不替隊友決定午餐。`};}
 if(s===2)return {...resolved,result:`傑克核對${dietTeamV65(run)?.name||'本隊'}與其他兩隊的紀錄，按事前約定的完成情況結算。${resolved.result}`};
 return resolved;
}
export function dietPlayCopyV65(run,played,result){
 if(!isDietV65(run))return result;
 return `${played.summary} ${dietTeamV65(run)?.name||'你的隊伍'}把這張表交給傑克；強尼先看安排能不能持續，安妮余確認點心沒被刪，阿福的「本來要運動」則不能代替已填好的格子。${played.grade===2?'吃飯、活動和休息都有位置，這份紀錄可以照著做。':'傑克請你保留正常吃飯，做不到的格子再調整，不拿少吃一餐補進度。'}`;
}
