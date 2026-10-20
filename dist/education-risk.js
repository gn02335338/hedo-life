import { ROLE_MAP } from './roles.js';
import { careerLevels, fullCareer } from './career-api.js';
import { educationLabel } from './education.js';

// These are the fictional boss's prejudices, not school rankings or hiring advice.
// Information management remains relevant to systems/MIS despite its résumé field.
const ENGINEERING_ROLES=['system','ai','mis'];
const TECHNICAL_SUBJECTS=['資訊工程','電機工程','應用數學','資訊管理','機械工程','統計'];
export function educationRisk(run){
 const ed=run.education,role=ROLE_MAP[run.actualRoleId];
 const schoolDisliked=ed.sector==='private';
 const subjectDisliked=ed.degree==='EMBA'||['humanities','business'].includes(ed.field);
 const mismatch=ENGINEERING_ROLES.includes(run.actualRoleId)&&!TECHNICAL_SUBJECTS.includes(ed.department);
 const favorite=ed.schoolId==='ntu'&&ed.degree!=='EMBA';
 const levels=careerLevels(run),rankFactor=levels[run.rank].payMultiplier/(run.actualRoleId==='executive'?levels[fullCareer(run)?5:2].payMultiplier:1);
 const assignmentFactor=run.assignment==='assistant'?.78/(fullCareer(run)?levels[0].payMultiplier:1):1;
 const [low,high]=role.payRange.map(pay=>pay*rankFactor*assignmentFactor);
 const payPosition=(run.pay-low)/(high-low),highPay=payPosition>=.7;
 const eligible=schoolDisliked||subjectDisliked||mismatch;
 let chance=mismatch?.88:schoolDisliked?.8:subjectDisliked?.78:0;
 if(schoolDisliked&&(subjectDisliked||mismatch))chance=.94;
 if(favorite&&!mismatch)chance*=.55;
 if(eligible&&highPay)chance=Math.min(.98,chance+.04);
 return {schoolDisliked,subjectDisliked,mismatch,favorite,highPay,payPosition,eligible,chance,
  reasons:(schoolDisliked?1:0)|(subjectDisliked?2:0)|(mismatch?4:0)|(highPay?8:0)};
}

export function educationReason(run){
 const reasons=run.flags.education_dispute||0;
 if(reasons&4)return `「${run.education.department}也來做工程？你本科不是這個，怎麼拿這個薪水？」`;
 if(reasons&1)return '「這個學校的喔？當初薪水怎麼會開到這個數字？」';
 if(run.education.degree==='EMBA')return '「我說的讀書不是EMBA。薪水倒是很敢開。」';
 return '「你這個科系，平常到底有沒有在讀書？薪水又不是照畢業證書發。」';
}

export function getEducationScrutiny(run,title){
 const reasons=run.flags.education_dispute,question=reasons&4?'做得出來，還得念對科系。':'校名聽完，薪水忽然太高。';
 const addendum=reasons&8?`他接著問：「你知道公司一個月花${run.pay}K請你嗎？」這個數字是公司自己開的，現在卻像你私自填上去的。`:'你才剛交完一件工作，對話已經變成你為什麼配領這份薪水。';
 return {id:'education-scrutiny',title:question,body:`工作聊到一半，Wing笑著問：「你哪裡畢業的？」你回答：「${educationLabel(run.education)}。」他聽完接了一句：${educationReason(run)}${addendum}你現在的職稱是${title}，他問的卻不是剛才做了什麼。`,wing:'「不要以為面試過了就不用讀書。公司還在觀察你。」',speaker:'wing',kind:'career',era:'前期插曲・學歷與身價',sourceIds:[],choices:[
  {text:'把最近的交付紀錄拿出來，請他看工作。',detail:'',result:'你把能交付什麼寫得很具體。他看完，還是先看了校名。',delta:{skill:2,mood:-5},effect:'educationResponse',flags:['evidence']},
  {text:'先接他的話，問他最近推薦哪本書。',detail:'',result:'你把話接回他愛講的讀書。他很樂意推薦，卻沒有忘記剛才嫌你的價格。',delta:{lick:4,mood:-7},effect:'educationResponse',flags:[]},
  {text:'面試和薪水都談過了，現在要改哪一項？',detail:'',result:'Wing說你太計較，還不夠有彈性。你把問題再問一次，這次順手打開筆記。',delta:{boss:-6,mood:4},effect:'educationResponse',flags:['evidence']}
 ]};
}
