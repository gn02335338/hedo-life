import {PERSONAS} from './persona.js';

export const VERBAL_OUTCOME_EVENTS_V32=Object.freeze(['verbal-v32-aftermath']);
export const VERBAL_ENDING_IDS_V32=Object.freeze(['verbal_onboarding','verbal_wing_concession','verbal_boardroom','verbal_rick_awake','verbal_hr_rewrite','verbal_legal_letter','verbal_sonny_statement','verbal_kind_ghost','verbal_colleague_solidarity','verbal_viral','verbal_mutual_mute','verbal_apology']);
export function verbalSeverityV32(run){
 const context=run.verbalContext;if(!context)return 1;
 return ['legal','personnel'].includes(context.outcome)||run.flags.post_pip_tolerance?3:['retort','relationship'].includes(context.outcome)||context.phase==='result'?2:1;
}
const names=target=>target==='self'?'自己':PERSONAS[target]?.name||'對方';
const targetFamily={wing:'verbal_wing_concession',spencer:'verbal_boardroom',rick:'verbal_rick_awake',hope:'verbal_hr_rewrite',erich:'verbal_legal_letter',sonny:'verbal_sonny_statement',kind:'verbal_kind_ghost'};
export const VERBAL_FINALE_LABELS_V32=Object.freeze({
 verbal_onboarding:'報到尚未完成，口角先替這次任用畫下句點。',
 verbal_wing_concession:'翅膀把原本的要求收回一截。',
 verbal_boardroom:'董事會把這段衝突寫進正式會議紀錄。',
 verbal_rick_awake:'瑞克終於放下電話，得自己回答問題。',
 verbal_hr_rewrite:'希望收回原稿，重新寫下可核對的條件。',
 verbal_legal_letter:'口角變成書信往來，雙方停止私下放話。',
 verbal_sonny_statement:'阿福開了一場只有理由的記者會。',
 verbal_kind_ghost:'阿良答應當面說清楚，自己卻消失了。',
 verbal_colleague_solidarity:'幾個同事把話接住，開始共同確認工作範圍。',
 verbal_viral:'這段口角被改編成一場虛構的職場演出。',
 verbal_mutual_mute:'雙方決定停止交鋒，只讓書面條件說話。',
 verbal_apology:'你為傷人的說法道歉，也結束這場爭吵。'
});
const finish=(family,weight,severity)=>({weight,label:VERBAL_FINALE_LABELS_V32[family],result:VERBAL_FINALE_LABELS_V32[family],delta:{},effect:family,flags:[`verbal32_finish_${family}`,`verbal32_severity_${severity}`]});
export function getVerbalAftermathV32(run){
 const ctx=run.verbalContext;if(ctx?.version!==2||ctx.stage!=='aftermath')throw new Error('Missing verbal aftermath');
 const severity=verbalSeverityV32(run),who=names(ctx.target),onboarding=ctx.eventId==='onboarding'&&ctx.phase==='event';
 const family=onboarding?'verbal_onboarding':targetFamily[ctx.target]||(ctx.target==='self'?'verbal_mutual_mute':'verbal_colleague_solidarity');
 const opening=onboarding?'報到流程停了下來，門禁卡還沒交到你手上。':ctx.phase==='result'?'剛才做過的決定不會被收回，但這場口角還沒落幕。':ctx.eventId.startsWith('pip-')||run.flags.post_pip_tolerance?'改善期的紀錄被翻到最新一頁，這次每一句都有人記。':`原本的討論停住，${who}還在等你接下來那句。`;
 const c=(text,outcomes)=>({text,detail:'',result:'',delta:{},effect:'verbalV32Continue',flags:[],draw:{label:'這場口角接著怎麼收尾',outcomes:onboarding?outcomes.map(outcome=>({...outcome,effect:'verbal_onboarding',label:VERBAL_FINALE_LABELS_V32.verbal_onboarding,result:VERBAL_FINALE_LABELS_V32.verbal_onboarding,flags:outcome.flags.map(flag=>flag.startsWith('verbal32_finish_')?'verbal32_finish_verbal_onboarding':flag)})):outcomes}});
 return {id:'verbal-v32-aftermath',title:'話已出口，這場風波還沒散。',body:`${opening} 對方剛才的反應已經發生，現在由你決定怎麼接。`,wing:'',speaker:ctx.target,kind:'verbal',era:'口舌風波・另一條人生',sourceIds:['characterFiction'],choices:[
  c('把難聽的那句停在這裡，逐條說清楚我在爭什麼。',[finish(family,severity===3?40:70,severity),finish('verbal_apology',severity===3?30:15,severity),finish('verbal_mutual_mute',severity===3?30:15,severity)]),
  c(`再補一句：「${ctx.target==='self'?'連自己都在騙，這份班到底還演給誰看？':`${who}，你要的是把事做完，還是大家一起裝沒看到？`}」`,[finish(family,severity===1?42:20,3),finish(ctx.target==='erich'?'verbal_legal_letter':'verbal_mutual_mute',severity===3?55:35,3),finish('verbal_apology',severity===3?25:23,3)]),
  c('把保溫杯當麥克風：「請各位評審替這段職場荒謬劇打分數。」',[finish('verbal_viral',severity===3?45:65,2),finish(family,20,2),finish('verbal_apology',severity===3?35:15,2)]),
  {text:'先停口角，回到眼前仍需我親自決定的事。',detail:'',result:'你停下追罵，回頭處理原本的安排；已經說出口的話仍留在紀錄裡。',delta:{},effect:'verbalV32Continue',flags:[]}
 ]};
}
// Keep the original reaction and replay evidence, but let this cohort decide
// the follow-up instead of collapsing every serious outburst into dismissal.
export function withVerbalAftermathV32(event){
 return {...event,choices:event.choices.map(choice=>({...choice,draw:choice.draw?{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({...outcome,effect:'verbalV32Aftermath'}))}:choice.draw}))};
}
