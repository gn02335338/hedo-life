import {LEGACY_ROLES} from './roles.js';
export const PERSONNEL_FAMILIES=[
 {id:'cold_storage',label:'三樓的下一站',type:'good',description:'工作被收走，自己的下一步沒有一起交出去。'},
 {id:'mediation_settled',label:'協商成文',type:'normal',description:'條件逐項寫下來，沒有靠一句好聚好散帶過。'},
 {id:'mediation_pending',label:'爭議仍在',type:'normal',description:'本次未成立，留下紀錄與自己的選擇。'}
];
const tools={system:'系統維護與交付紀錄',ai:'能實際執行的模型與實驗',project:'完整的時程與交接清單',product:'驗證過的需求與判斷',design:'作品集與修改依據',bd:'自己經營的合作關係',sales:'核對過的客戶與回款紀錄',mis:'測試過的備份與工作紀錄',executive:'親自做過的決策與交付'};
export const PERSONNEL_ENDINGS=PERSONNEL_FAMILIES.flatMap(family=>LEGACY_ROLES.map(role=>({
 id:`${family.id}-${role.id}`,family:family.id,roleId:role.id,type:family.type,
 title:family.id==='cold_storage'?`三樓沒有${role.name}的工作，外面還有。`:family.id==='mediation_settled'?`${role.name}的條件，這次寫清楚。`:`${role.name}的這一頁，先留未成立。`,
 subtitle:family.description,symbol:family.id==='cold_storage'?'樓':family.id==='mediation_settled'?'議':'記',
 body:family.id==='cold_storage'?`辦公室在五樓，你卻被派到三樓看門。名片沒有換，工作先被拿走；你把那幾天留給${tools[role.id]}，也記下每一次沒有得到回答的要求。後來離開時，你沒有感謝這場安排，只把能帶走的成果帶走。那部電梯不是唯一能往上走的路。`:family.id==='mediation_settled'?`你帶著${tools[role.id]}與人事往來，把雙方能接受的部分逐項確認。這段虛構故事裡的協商有了書面條件，不等於任何人靠一場會議拿回全部。你收好文件，接下來的生活不再每一天都等公司給一句結論。`:`這次的協商沒有成立。你把${tools[role.id]}、來回文件與本次紀錄收在一起，沒有為了讓會議好看就說自己沒事。這個結尾沒有替現實的程序預告結果，只把你的版本留下，下一步仍由你決定。`,
 hint:family.id==='cold_storage'?'PIP通過後被調三樓待命，完成三個待命工作回合後選擇自己的下一站。':'直接離場或三樓調動爭議中，選擇反映／協商並走完本次處理。'
})));
