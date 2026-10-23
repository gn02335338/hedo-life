import { PERSONAS, displayChronicleHistory } from './persona.js';
import { displayOccupationTextV47 as displayText } from './occupation-copy-v47.js';
import { displayPrincessHistoryV47 } from './princess-english-v47.js';
import { polishVerbalHistoryV41 } from './verbal-presentation-v41.js';
import { displayPlayerHistoryV42 } from './job-titles-v42.js';
import { companyFinaleEmploymentV39 } from './company-v39.js';
import { displayArmVerbalHistoryV51 } from './arm-verbal-copy-v51.js';
import { displayContextVerbalHistoryV52 } from './verbal-context-v52.js';
import { isParticipationV63 } from './participation-profile-v63.js';
import {isOnboardingDeclineV66} from './release-clarity-v66.js';
const shownHistory=(row,run)=>displayPrincessHistoryV47(displayPlayerHistoryV42(displayContextVerbalHistoryV52(displayArmVerbalHistoryV51(polishVerbalHistoryV41(displayChronicleHistory(row))),{run,rawRow:row}),run),run);

// A read-only explanation of an already committed ending. Do not use this
// projection for probabilities, replay validation or employment decisions.
const status = (kind, label, explanation) => ({kind, label, explanation});
const STATUSES = Object.freeze({
 fired_signed:status('forced-signed','公司要求離場，你簽了自願離職書','這次是公司先要求你走。你簽下的文件寫成自願離職，不能把它和自己主動提出離職混為一談。'),
 fired_refused:status('company-exit','公司要求離場，你拒簽自願離職','你沒有接受「自己想走」的說法，仍依通知交接離場。'),
 layoff:status('company-exit','公司直接通知離場','這次沒有安排 PIP。公司要求你交接離開，不是你主動提出離職。'),
 merged_out:status('company-exit','組織調整，你的職位被移除','公司調整組織後不再留下你的職位；你依安排交接離場。'),
 pip_fail:status('pip-failed','PIP 未通過，公司通知離場','希望結束這輪改善評核，結果未通過；這次是公司要求離場。'),
 pip_exit:status('voluntary','PIP 通過後，你決定離職','通過評核沒有讓你決定繼續留下。這次離職由你提出。'),
 ragequit:status('voluntary','你主動提出離職','你已明確決定結束這份工作；這次不是公司把你資遣。'),
 rage_walkaway:status('voluntary','處理失控後續後，你選擇離開','你仍要面對已發生的事，也決定交接並離開這份工作。'),
 cold_storage:status('voluntary','被派到三樓待命後，你選擇離職','看門安排先拿走了你的工作；這段故事最後是你帶著紀錄離開。'),
 mediation_settled:status('labor-dispute','公司要求離場，協商條件已成文','離場爭議進入協商，這一輪談成了書面條件；不代表所有主張都獲得承認。'),
 mediation_pending:status('labor-dispute','公司要求離場，勞資爭議仍待處理','這一輪協商未成立。離場通知與你的異議都留在紀錄裡，沒有自動變成自願離職。'),
 burnout:status('work-stopped','體力耗盡，這段工作停下來','你已經無法繼續工作，故事因此收尾。這項結果沒有另外記下一次正式資遣或自願離職程序。'),
 broke:status('resources-exhausted','存款耗盡，你得另找出路','存款已無法支撐這段日子，故事在這裡轉向下一份生活；不是公司另發一張資遣通知。'),
 second_offer:status('voluntary','你離職，準備到下一份工作報到','你確認新工作的條件後，自己決定離開。'),
 handover_author:status('voluntary','你完成交接，按約定離職','交接範圍與日期確認完畢，這次離場由你決定。'),
 alumni_network:status('voluntary','你已離職，和前同事保持聯絡','故事接到離職後的生活，下一步由你自己安排。'),
 consultant:status('contract-change','你改以顧問合約合作','工作關係換成已確認範圍與時數的顧問安排，並非又收到一張資遣通知。'),
 venture_independent:status('startup','你已離職，創業站穩了第一步','你把存款與專業投入自己的事業；故事收在這一輪能交付、也收得到款的生意。'),
 venture_restart:status('startup','你已離職，這一輪創業決定先停','這次創業沒有撐起預期收入。你收好剩餘資金與經驗，停止這一輪嘗試。'),
 retired_free:status('retirement','你離職退休，時間留給自己','門禁卡已交回，不再接下一輪全職工作。'),
 retired_flexible:status('retirement','你離開全職，只接想做的工作','你不再綁著原本的全職安排，保留顧問接案與拒絕工作的空間。'),
 verbal_onboarding:status('offer-withdrawn','報到未完成，公司撤回任用','口角後，翅膀收回這次任用。你沒有完成報到，也沒有自己提出一封自願離職信。'),
 verbal_wing_concession:status('employed','你仍在職，工作條件寫下來了','翅膀收回部分要求，留下能核對的約定。這次沒有開除或離職，故事停在條件談清楚的那一天。'),
 verbal_boardroom:status('employed','你沒有被開除，異議進了會議紀錄','董事會接著討論你提出的問題，沒有把你升成董事長，也沒有在這段收尾通知你離職。'),
 verbal_rick_awake:status('employed','你仍在職，瑞克得親自回應工作','這次收尾是瑞克終於接手說明與交付，不是你遭資遣。'),
 verbal_hr_rewrite:status('employed','你仍在職，希望重寫評核條件','評核前提與公司提供的資源被重新列明，沒有因此判定你通過 PIP 或已經離職。'),
 verbal_legal_letter:status('dispute-open','書面爭議處理中，沒有新增離場通知','雙方改由正式窗口說明原話與經過。這段收尾沒有判定誰勝訴，也沒有另外記下一次開除或自願離職。'),
 verbal_sonny_statement:status('employed','你仍在職，阿福得留下具名答覆','這場理由記者會留下工作答覆；你沒有因此被請出去。'),
 verbal_kind_ghost:status('employed','你仍在職，阿良又放了鴿子','這次結束的是等阿良出現的晚上，沒有發生你的離職或資遣。'),
 verbal_colleague_solidarity:status('employed','你仍在職，同事一起接住爭點','大家補上各自能確認的經過。故事停在共同釐清工作的那一天，沒有新的離場通知。'),
 verbal_viral:status('new-chapter','你開始把經驗改寫成自己的作品','口角後的故事轉向虛構職場創作。這段沒有交代原工作的正式離職程序，也沒有新增資遣通知。'),
 verbal_mutual_mute:status('employed','你仍在職，改由固定窗口往來','薪水照領，工作改走書面與指定窗口。這次沒有人被請出去。'),
 verbal_apology:status('employed','你仍在職，收回失言並保留工作爭點','你為過頭的話道歉，原本的問題仍待正式回覆。這段收尾沒有發生離職或資遣。'),
 rage_legal:status('dispute-open','失控後續交給正式窗口，任職結果未明','出手與之前的工作爭議分開處理。這段沒有判定法律責任，也沒有交代另一項正式離職結果。'),
 rage_defeated:status('aftermath-open','現實出手吃了虧，仍須處理後續','你沒有照腦中的劇本獲勝，接著得花時間與存款收尾。這段未記載一次新的開除或自願離職程序。'),
 rage_coup:status('fantasy-appointment','荒謬宇宙裡，你被宣布接班','這是失控後的幻想接班線，不是你被開除；也不是現實中的升遷方式。'),
 rage_truce:status('employed','協調後你選擇留下，重新約定工作方式','雙方確認要處理的責任，你繼續上班，工作改走正式窗口。'),
 rage_meme:status('new-chapter','失控片段帶來另一段生活，任職結果未明','你先處理當天後果，故事再轉向流量與創作。這段沒有另外宣告開除或自願離職。')
});
const COMPANY_FAMILIES = new Set(['nasdaq','taiwan','acquired','nasdaq_failed','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark']);
const VOLUNTARY_FAMILIES = new Set(['assistant','promotion','slacker','sycophant','historian','career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief']);
const EXPLICIT_EXIT_SCENES = new Set(['exit-menu','career-exit','rank-exit','story-exit']);
const escape = value => String(value??'').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shown = value => escape(displayText(value??''));
const name = id => id==='self'?'自己':id==='exit-team'?'法師、真真與阿福':PERSONAS[id]?.name||'當時的對話者';

function employmentStatus(run, family, last) {
 if(isOnboardingDeclineV66(run))return status('offer-declined','你沒有接受這份任用','你在報到時拒絕這份尚未生效的任用。這次沒有開始受僱，不是公司資遣，也不是做了一陣子才提出離職。');
 if(isParticipationV63(run)&&run.flags?.departure63_onboarding_declined&&family==='ragequit'&&['onboarding','verbal'].includes(last?.departureOutcome?.category))return status('offer-declined','你沒有接受這份任用','你在報到時明確拒絕這份工作，今天的任用到此為止。這次不是公司資遣，也沒有補簽自願離職。');
 const finalSpeech=run.history?.findLast(row=>row.verbalOutcome);
 if(isParticipationV63(run)&&family==='layoff'&&run.pipCount>0)return status('company-exit','公司直接通知離場','公司通知你交接離場；先前的 PIP 紀錄仍保留，這次不另開改善期，也不是你主動離職。');
 if(family==='layoff'&&finalSpeech?.verbalOutcome?.origin==='onboarding'&&finalSpeech.verbalOutcome.phase==='event'&&finalSpeech.verbalOutcome.kind==='personnel'&&!run.history.some(row=>row.eventId==='onboarding'&&!row.verbalOutcome))return STATUSES.verbal_onboarding;
 if(/^e(?:38|39)-/.test(run.seed||'')&&run.flags?.departure38_voluntary)return status('voluntary','你已明確提出離職，結束這份工作','先前的成果與風波仍留在紀錄裡。這次離開是你親自確認的決定，不是公司另外要求你走。');
 const company=companyFinaleEmploymentV39(family);if(company)return company;
 if(STATUSES[family])return STATUSES[family];
 if(COMPANY_FAMILIES.has(family))return status('company-chapter','公司走向已定，沒有你的離場通知','這次結算的是公司的平行未來；翅膀是否留任不等於你被開除，這段沒有另外記下你的離職或資遣。');
 if(VOLUNTARY_FAMILIES.has(family)&&EXPLICIT_EXIT_SCENES.has(last?.eventId))return status('voluntary','你選好這段職涯的收尾，主動離職','你從離場清單確認這個選擇，工作在這裡結束；不是公司另發一張資遣通知。');
 return status('unspecified','職涯在此收尾，任職結果未另外記載','這段紀錄沒有明確的開除或自願離職程序，因此不替它補上一種離場方式。');
}

export function buildEndingTransition(run, ending) {
 if(!run?.completed||!ending||run.endingId!==ending.id)return null;
 const history=Array.isArray(run.history)?run.history:[],last=history.at(-1),family=ending.family;
 const relatedSpeech=family.startsWith('verbal_')||last?.verbalOutcome||/^verbal-/.test(last?.eventId||'');
 const speech=relatedSpeech?history.findLast(row=>row?.verbalOutcome):null;
 const current=last?shownHistory(last,run):null,spoken=speech?shownHistory(speech,run):null;
 const milestoneIndex=run.flags?.[`chapter38_${family}`]-1;
 const milestone=last?.eventId==='chapter-resolution'&&Number.isInteger(milestoneIndex)&&milestoneIndex>=0&&milestoneIndex<history.length-1?shownHistory(history[milestoneIndex],run):null;
 return {
  family,employment:employmentStatus(run,family,last),legacyChapter:!/^e(?:38|39)-/.test(run.seed||'')&&['employed','dispute-open','aftermath-open','new-chapter'].includes(employmentStatus(run,family,last).kind),
  final:current?{title:current.title,choice:current.choiceText,result:current.result,target:last.speaker,targetName:name(last.speaker),turn:last.turn}:null,
  speech:spoken?{line:spoken.choiceText,result:spoken.result,target:speech.verbalOutcome.target,targetName:name(speech.verbalOutcome.target),origin:speech.verbalOutcome.origin,phase:speech.verbalOutcome.phase,turn:speech.turn}:null,
  milestone:milestone?{title:milestone.title,choice:milestone.choiceText,result:milestone.result}:null
 };
}

export function renderEndingTransition(run, ending, {compact=false}={}) {
 const model=buildEndingTransition(run,ending);if(!model)return '';
 const employment=model.employment;
 const steps=`${model.speech?`<li class="ending-cause-spoken"><span>你對${shown(model.speech.targetName)}說</span><blockquote>「${shown(model.speech.line)}」</blockquote><p>${shown(model.speech.result)}</p></li>`:''}${model.milestone?`<li class="ending-cause-milestone"><span>那場風波先有了這個收尾</span><p>${shown(model.milestone.result)}</p><small>這件事結束時，你還沒有離職。</small></li>`:''}${model.final?`<li><span>${model.speech||model.milestone?'後來，你的最後決定':'你最後選擇了'}</span><p class="ending-final-choice">${shown(model.final.choice)}</p></li><li><span>實際發生的結果</span><p>${shown(model.final.result)}</p></li>`:'<li><span>這份舊紀錄沒有留下最後一段對話。</span></li>'}`;
 return `<section class="ending-transition-context${compact?' compact':''}" aria-labelledby="ending-cause-heading" data-employment-outcome="${escape(employment.kind)}"><div class="ending-status"><span class="eyebrow">${compact?'THIS LIFE / 收尾狀態':'WHAT JUST HAPPENED / 剛才發生了什麼'}</span>${model.legacyChapter?`<span class="ending-legacy-chapter">舊版篇章收尾${employment.kind==='employed'?' · 當時仍在職':' · 未另記載正式離職'}</span>`:''}<h2 id="ending-cause-heading">${shown(employment.label)}</h2><p>${shown(employment.explanation)}</p></div>${compact?`<details class="ending-cause-details"><summary>回看最後一幕的前因後果</summary><ol class="ending-cause-steps">${steps}</ol></details>`:`<ol class="ending-cause-steps">${steps}</ol><p class="ending-transition-note">這一局已在這裡收尾。查看結局不會再抽一次結果，也不會多算一天。</p>`}</section>`;
}
