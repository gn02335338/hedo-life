import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {isPatronageProgressV69,patronageProgressEffectV69} from '../dist/patronage-progress-v69.js';
import {appointmentPayV67,patronageAllowanceDueV67} from '../dist/patronage-benefits-v67.js';
import {validateCompletion} from '../worker/http.js';

// Fixed, naturally played witnesses. Every life uses its seed-derived role,
// real reporting/introduction choices and the mandatory calendar action.
// No RNG, stats, appointment, personnel flag or scene is injected.
const witnesses={
 "daily-son":{"seed":"e39-r69-s-9123bc552f2f4d0c8e83fe","eventId":"sales21-demo-operator","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0]]},
 "patronage67-education":{"seed":"e39-r69-s-9123bc552f2f4d0c8e83fe","eventId":"patronage67-education","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["sales21-demo-operator",2]]},
 "daily-daughter":{"seed":"e39-r69-d-9123bc552f2f4d0c8e83fe","eventId":"cast39-janet-month-end-freeze","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0]]},
 "kind-workday":{"seed":"e39-r69-s-d0ceb5fa1e33f437c8d2bf","eventId":"kind-workday","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-annie_yu-proposal-guarantee",2],["cast65-hester-classmate-scope",2],["patronage67-education",0],["shareholder58-offer",0],["cast65-james-exit-rumor",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-owen-partner-owner",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["bd21-mou-annex",2],["shareholder58-gate",0],["q26-video-allowlist",1],["wealth-plan",2],["cast35-cindy-resource-loan",2]]},
 "patronage67-smalltalk":{"seed":"e39-r69-s-d0ceb5fa1e33f437c8d2bf","eventId":"patronage67-smalltalk","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-annie_yu-proposal-guarantee",2],["cast65-hester-classmate-scope",2],["patronage67-education",0],["shareholder58-offer",0],["cast65-james-exit-rumor",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-owen-partner-owner",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["bd21-mou-annex",2],["shareholder58-gate",0],["q26-video-allowlist",1],["wealth-plan",2],["cast35-cindy-resource-loan",2],["kind-workday",2],["video-last-handshake",0],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["bd21-introduction-scope",2]]},
 "road":{"seed":"e39-r69-s-d0ceb5fa1e33f437c8d2bf","eventId":"road","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-annie_yu-proposal-guarantee",2],["cast65-hester-classmate-scope",2],["patronage67-education",0],["shareholder58-offer",0],["cast65-james-exit-rumor",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-owen-partner-owner",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["bd21-mou-annex",2],["shareholder58-gate",0],["q26-video-allowlist",1],["wealth-plan",2],["cast35-cindy-resource-loan",2],["kind-workday",2],["video-last-handshake",0],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["bd21-introduction-scope",2],["patronage67-smalltalk",2],["professor37-partner-data-question",2],["kind-workday",2],["cast39-joyce-secret-proposal",2],["wealth-plan",2],["bd-assistant",1],["bd21-channel-map",2],["bd21-poc-finish-line",2],["video-rick-commentary",2],["cast35-sam-roas-credit",2],["kind-workday",2],["cast39-janet-three-day-plan",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-jonathan-ga-identity",2],["bd21-data-handshake",2]]},
 "dismissal-final":{"seed":"e39-r69-s-d0ceb5fa1e33f437c8d2bf","eventId":"dismissal-final","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-annie_yu-proposal-guarantee",2],["cast65-hester-classmate-scope",2],["patronage67-education",0],["shareholder58-offer",0],["cast65-james-exit-rumor",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-owen-partner-owner",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["bd21-mou-annex",2],["shareholder58-gate",0],["q26-video-allowlist",1],["wealth-plan",2],["cast35-cindy-resource-loan",2],["kind-workday",2],["video-last-handshake",0],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["bd21-introduction-scope",2],["patronage67-smalltalk",2],["professor37-partner-data-question",2],["kind-workday",2],["cast39-joyce-secret-proposal",2],["wealth-plan",2],["bd-assistant",1],["bd21-channel-map",2],["bd21-poc-finish-line",2],["video-rick-commentary",2],["cast35-sam-roas-credit",2],["kind-workday",2],["cast39-janet-three-day-plan",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-jonathan-ga-identity",2],["bd21-data-handshake",2],["road",2]]},
 "patronage67-pay-review":{"seed":"e39-r69-s-9e442bd1c7b78b84d72e81","eventId":"patronage67-pay-review","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-janet-duplicate-request",2],["professor37-industry-accounting-docs",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["boss-weather",2],["cast66-action-future-revenue",2],["shareholder58-offer",0],["cast65-james-return-boundary",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["cast35-meimei-bonus-ledger",2],["cast35-erich-legal-bonus-return",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-sophie-formula-copy",2],["wealth-plan",2],["shareholder58-gate",0],["accounting28-inventory-ghost",2],["kind-workday",2],["cast65-simon-authority-stamp",2],["patronage67-smalltalk",2],["cast35-helen-farewell-playlist",2],["wealth-plan",2],["accounting28-receipt-orphan",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-sam-comment-author",2],["cast39-janet-month-end-freeze",2],["dp-breakfast-news",0]]},
 "crisis-boss":{"seed":"e39-r69-s-9e442bd1c7b78b84d72e81","eventId":"crisis-boss","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-janet-duplicate-request",2],["professor37-industry-accounting-docs",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["boss-weather",2],["cast66-action-future-revenue",2],["shareholder58-offer",0],["cast65-james-return-boundary",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["cast35-meimei-bonus-ledger",2],["cast35-erich-legal-bonus-return",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-sophie-formula-copy",2],["wealth-plan",2],["shareholder58-gate",0],["accounting28-inventory-ghost",2],["kind-workday",2],["cast65-simon-authority-stamp",2],["patronage67-smalltalk",2],["cast35-helen-farewell-playlist",2],["wealth-plan",2],["accounting28-receipt-orphan",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-sam-comment-author",2],["cast39-janet-month-end-freeze",2],["dp-breakfast-news",0],["patronage67-pay-review",2],["cast35-owen-audit-evidence-boundary",2],["kind-workday",2],["cast66-joyce-classmate-handoff",2],["cast39-captain-room-capacity",2],["accounting28-audit-breadcrumb",2],["road",2]]},
 "paperwork":{"seed":"e39-r69-s-9e442bd1c7b78b84d72e81","eventId":"paperwork","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-janet-duplicate-request",2],["professor37-industry-accounting-docs",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["boss-weather",2],["cast66-action-future-revenue",2],["shareholder58-offer",0],["cast65-james-return-boundary",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["cast35-meimei-bonus-ledger",2],["cast35-erich-legal-bonus-return",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-sophie-formula-copy",2],["wealth-plan",2],["shareholder58-gate",0],["accounting28-inventory-ghost",2],["kind-workday",2],["cast65-simon-authority-stamp",2],["patronage67-smalltalk",2],["cast35-helen-farewell-playlist",2],["wealth-plan",2],["accounting28-receipt-orphan",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-sam-comment-author",2],["cast39-janet-month-end-freeze",2],["dp-breakfast-news",0],["patronage67-pay-review",2],["cast35-owen-audit-evidence-boundary",2],["kind-workday",2],["cast66-joyce-classmate-handoff",2],["cast39-captain-room-capacity",2],["accounting28-audit-breadcrumb",2],["road",2],["crisis-boss",1]]},
 "runway":{"seed":"e39-r69-s-8a0e62c61ab1986d4f0cd3","eventId":"runway","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast39-princess-schema-promise",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["mis-access-approval",2],["kind-workday",2],["cast35-sophie-print-page-trace",2],["patronage67-education",0],["professor37-guest-network-window",2],["shareholder58-offer",0],["cast35-erich-legal-extension",2],["mis-account-handover",2],["job-mis-door-is-not-account",2],["shareholder58-gate",0],["cast35-meimei-sticker-permission",2],["wealth-plan",2],["job-mis-restore-drill",2],["job-mis-asset-ghost",2],["wealth-plan",2],["jack-api-budget",2],["kind-workday",2],["cast39-annie_yu-cc-chorus",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["job-mis-permission-clock",2],["cast35-kind-release-window",2],["kind-workday",2],["cast65-action-friendly-pitch",2],["patronage67-smalltalk",2],["cast35-helen-promise-footnote",2],["mis-printer-is-ai",1],["cast35-jonathan-mantis-mouse",2],["professor37-shared-link-expiry",2],["road",2]]},
 "pip-daily":{"seed":"e39-r69-s-17bd9c742648d2cd491a25","eventId":"job-system-phone-monitor","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast35-jonathan-cdp-ticket-king",2],["kind-workday",2],["cast35-kind-attendance-deposit",2],["cast66-spencer-cutlery-budget",2],["patronage67-education",0],["shareholder58-offer",0],["job-system-rollback",2],["patronage67-pay-review",2],["system-weekend",2],["cast39-princess-release-check",2],["wealth-plan",2],["shareholder58-gate",0],["professor37-notebook-server",2],["quiz26-archive-permission",2],["kind-workday",2],["cast39-captain-reservation-name",2],["professor37-research-service-shift",2],["wealth-plan",2],["cast35-jonathan-js-timeline",2],["kind-workday",2],["cast65-hester-handoff-pm",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["meimei-screen-patrol",2],["professor37-data-contract-shape",2],["patronage67-smalltalk",2],["cast39-princess-local-path",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast39-annie_yu-name-check",2],["job-system-schema",2],["crisis-boss",2]]},
 "pip-review":{"seed":"e39-r69-s-17bd9c742648d2cd491a25","eventId":"pip-review","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast35-jonathan-cdp-ticket-king",2],["kind-workday",2],["cast35-kind-attendance-deposit",2],["cast66-spencer-cutlery-budget",2],["patronage67-education",0],["shareholder58-offer",0],["job-system-rollback",2],["patronage67-pay-review",2],["system-weekend",2],["cast39-princess-release-check",2],["wealth-plan",2],["shareholder58-gate",0],["professor37-notebook-server",2],["quiz26-archive-permission",2],["kind-workday",2],["cast39-captain-reservation-name",2],["professor37-research-service-shift",2],["wealth-plan",2],["cast35-jonathan-js-timeline",2],["kind-workday",2],["cast65-hester-handoff-pm",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["meimei-screen-patrol",2],["professor37-data-contract-shape",2],["patronage67-smalltalk",2],["cast39-princess-local-path",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast39-annie_yu-name-check",2],["job-system-schema",2],["crisis-boss",2],["job-system-phone-monitor",2],["video-referee-committee",2],["road",2]]},
 "kind-break":{"seed":"e39-r69-s-47817e51db47857243b1e3","eventId":"kind-break","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["ai31-auto-increment",2],["kind-workday",2],["cast65-zoe-thaw-request",2],["patronage67-education",0],["cast66-princess-english-parenthesis",2],["shareholder58-offer",0],["cast35-kind-keyword-quarantine",2],["cast66-professor-half-day-clock",2],["shareholder58-gate",0],["cast35-cindy-lunch-last-seat",2],["kind-workday",2],["cast66-james-historical-demo",2],["wealth-plan",2],["cast39-joyce-data-answer",2],["patronage67-pay-review",2],["cast39-janet-helpdesk-priority",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-erich-legal-successor-check",2],["wealth-plan",2],["cast39-annie_yu-post-it-shift",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["cast66-hester-egg-tart",2],["patronage67-smalltalk",2],["job-ai-label-convention",2],["job-ai-eval-answer",2],["dp-one-year-lecture",1],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-sam-sql-master",2],["advisor-office-wifi",2],["kind-workday",2],["cast39-princess-medical-label",2],["job-ai-token-budget",2],"break"]},
 "self-care":{"seed":"e39-r69-s-47817e51db47857243b1e3","eventId":"self-care","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["ai31-auto-increment",2],["kind-workday",2],["cast65-zoe-thaw-request",2],["patronage67-education",0],["cast66-princess-english-parenthesis",2],["shareholder58-offer",0],["cast35-kind-keyword-quarantine",2],["cast66-professor-half-day-clock",2],["shareholder58-gate",0],["cast35-cindy-lunch-last-seat",2],["kind-workday",2],["cast66-james-historical-demo",2],["wealth-plan",2],["cast39-joyce-data-answer",2],["patronage67-pay-review",2],["cast39-janet-helpdesk-priority",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["cast35-erich-legal-successor-check",2],["wealth-plan",2],["cast39-annie_yu-post-it-shift",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["cast66-hester-egg-tart",2],["patronage67-smalltalk",2],["job-ai-label-convention",2],["job-ai-eval-answer",2],["dp-one-year-lecture",1],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast35-sam-sql-master",2],["advisor-office-wifi",2],["kind-workday",2],["cast39-princess-medical-label",2],["job-ai-token-budget",2],"break",["kind-break",2]]},
 "audit":{"seed":"e39-r69-s-cc85a5a48c5a147b036cd9","eventId":"audit","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["cast66-simon-button-verb",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["design-v21-handoff-inspector",2],["kind-workday",2],["cast35-spencer-founder-proof",2],["treats61-company-tea-0",2],["treats61-company-tea-1",2],["treats61-company-tea-2",0],["professor37-university-brand-frame",2],["shareholder58-offer",0],["sam-farewell-not-served",2],["cast65-hester-handoff-pm",2],["design-v21-component-throne",2],["patronage67-smalltalk",2],["shareholder58-gate",0],["cast66-zoe-speaker-clock",2],["wealth-plan",2],["cast39-annie_yu-logo-permission",2],["kind-workday",2],["design-v21-responsive-banner",2],["wealth-plan",2],["cast39-captain-lunch-route",2],["design-logo-bigger",1],["cast39-princess-answer-equality",2],["design-v21-stock-watermark",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["cast35-cindy-lunch-last-seat",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["professor37-paper-figure-ui",2],["sonny-printer-language",2],["quiz26-owen-brother",2],["design-v21-chairman-portrait",2],["road",2],["runway",0]]},
 "finale":{"seed":"e39-r69-s-9e5bd48b7b65b0ffad6a50","eventId":"finale","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["design-v21-responsive-banner",2],["cast39-joyce-schoolmate-logo",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["cast66-johnny-scope-sneak",2],["patronage67-education",0],["shareholder58-offer",0],["cast35-jenjen-desk-tape",2],["kind-workday",2],["professor37-university-brand-frame",2],["shareholder58-gate",0],["owen-tesla-run",1],["patronage67-smalltalk",2],["cast35-spencer-founder-proof",2],["patronage67-pay-review",2],["design-v21-invisible-button",2],["wealth-plan",2],["cast65-action-chain-whiteboard",2],["cast66-zoe-holiday-poster",2],["wealth-plan",2],["design-v21-handoff-inspector",2],["design-ai-prompt",1],["kind-workday",2],["cast35-cindy-punctuation-priority",2],["cast35-kind-piano-calendar",2],["dp-production-file",2],["treats61-birthday-cake-0",2],["treats61-birthday-cake-1",2],["treats61-birthday-cake-2",0],["cast66-simon-button-verb",2],["design-v21-component-throne",2],["design-v21-stock-watermark",2],["cast39-annie_yu-out-of-office",2],["road",2],["runway",0],["audit",2]]},
 "pip-passed":{"seed":"e39-r69-s-f4098e74b0df83751fab4e","eventId":"pip-passed","steps":[["onboarding",0],["recruitment60-rick",0],["recruitment60-princess",0],["mis-access-approval",2],["cast66-action-existing-server",2],["patronage67-education",0],["quiz-jack-roll-call",2],["professor37-guest-network-window",2],["patronage67-pay-review",2],["shareholder58-offer",0],["cast35-kind-release-window",2],["treats61-jack-drinks-0",2],["treats61-jack-drinks-1",1],["treats61-jack-drinks-2",2],["cast35-sophie-print-page-trace",2],["blockchain65-0",0],["blockchain65-1",0],["blockchain65-2",0],["blockchain65-3",0],["mis-printer-is-ai",1],["cast39-princess-schema-promise",2],["wealth-plan",2],["shareholder58-gate",0],["job-mis-door-is-not-account",2],["job-mis-asset-ghost",2],["wealth-plan",2],["mis-account-handover",2],["cast39-captain-camera-permission",2],["kind-workday",2],["cast39-janet-laptop-receipt",2],["rick-four-am-delivery",2],["professor37-shared-link-expiry",2],["patronage67-smalltalk",2],["job-mis-restore-drill",2],["crisis-boss",2],["cast35-erich-legal-extension",2],["job-mis-permission-clock",2],["kind-workday",2],["cast35-meimei-sticker-permission",2],["pip-review",0]]}
};
const clone=value=>structuredClone(value);
const entry=(seed)=>{
 const professional=directEntryV60(seed);assert.ok(professional);
 return E.enableActivitySchedule(E.createRun(professional.roleId,seed));
};
const enact=(run,step)=>{
 if(step==='break'){assert.equal(E.canRequestBreak(run),true);return E.requestBreak(run);}
 assert.equal(E.getEvent(run).id,step[0]);return E.advance(E.applyChoice(run,step[1]));
};
const source=id=>{
 const route=witnesses[id];let run=entry(route.seed);
 for(const step of route.steps)run=enact(run,step);
 assert.equal(run.eventId,route.eventId,id);
 assert.equal(E.validRun(run),true,id);
 return run;
};
const canonical=run=>{
 assert.equal(E.validRun(clone(run)),true,run.seed+'/'+run.eventId);
 assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run.pending?E.advance(run):run);
};
const target=run=>E.getPatronageReplyTargets(run)[0];
const cashPart=(row,label)=>(row.breakdown||[]).filter(part=>part.source===label).reduce((sum,part)=>sum+(part.delta.cash||0),0);
const workParts=row=>(row.breakdown||[]).filter(part=>['income','workday','patronage-perk','patronage-allowance','pip-pressure'].includes(part.source));

test('strict r69 and r70 profiles enable complete replies, while malformed and historical profile strings do not',()=>{
 for(const profile of [69,70])for(const marker of ['n','s','d'])assert.equal(isPatronageProgressV69('e39-r'+profile+'-'+marker+'-'+'ab'.repeat(11)),true);
 for(const seed of ['e39-r68-s-'+'a'.repeat(22),'e39-r71-s-'+'a'.repeat(22),'e39-r69-s-'+'a'.repeat(21),'e39-r69-s-'+'a'.repeat(23),'e39-r69-x-'+'a'.repeat(22),'e39-r69-s-'+'A'.repeat(22),'e39-r69-s-'+'g'.repeat(22),'e39-r69-s-'+'a'.repeat(22)+'-extra'])assert.equal(isPatronageProgressV69(seed),false);
});

test('both rolled family appointments retain their real salary and subsidy before answering a work scene directly',()=>{
 for(const id of ['daily-son','daily-daughter']){
  const run=source(id),initial=entry(run.seed),appointed=E.applyChoice(initial,0);
  assert.equal(run.actualRoleId,initial.actualRoleId);assert.equal(run.characterGender,id==='daily-son'?'male':'female');
  assert.equal(run.patronage.title,id==='daily-son'?'乾兒子':'乾女兒');
  assert.equal(run.pay,appointmentPayV67(initial,initial.pay));assert.ok(run.pay>=180&&run.pay<=500);
  assert.equal(cashPart(appointed.history.at(-1),'patronage-appointment'),Math.min(24,100-initial.stats.cash));
  assert.equal(run.history.filter(row=>cashPart(row,'patronage-appointment')>0).length,1);
  canonical(appointed);canonical(run);
 }
});

test('target previews are pure; a committed reply is one virtual source answer and advances the work exactly once',()=>{
 for(const id of ['daily-son','daily-daughter','road','runway','audit']){
  const run=source(id),event=clone(E.getEvent(run)),before=clone(run),people=E.getPatronageReplyTargets(run);
  assert.ok(people.length,id);
  for(const person of people){
   const line=E.getPatronageReplyLine(run,person);assert.ok(line.length>12);assert.doesNotMatch(line,/成功率|機率|[%％]/);
   for(let repeat=0;repeat<3;repeat++){
    assert.equal(E.getPatronageReplyLine(run,person),line);
    assert.deepEqual(E.getPatronageReplyTargets(run),people);assert.deepEqual(E.getEvent(run),event);
   }
   assert.deepEqual(run,before);
   const pending=E.requestPatronageReply(run,person),row=pending.history.at(-1),after=E.advance(pending);
   assert.equal(pending.pending,true);assert.equal(pending.eventId,event.id);assert.equal(pending.patronageReplyContext,undefined);
   assert.equal(pending.history.length,run.history.length+1);assert.deepEqual(pending.history.slice(0,-1),run.history);
   assert.equal(row.eventId,event.id);assert.equal(row.kind,event.kind);assert.equal(row.speaker,person);
   assert.equal(row.title,event.title);assert.equal(row.body,event.body);assert.equal(row.choiceText,line);assert.equal(row.choiceIndex,event.choices.length);
   assert.equal(row.patronageOutcome.version,2);assert.equal(row.patronageOutcome.origin,event.id);assert.equal(row.patronageOutcome.target,person);
   assert.deepEqual(pending.actions.at(-1),{type:'patronage-reply',version:2,eventId:event.id,target:person});
   assert.equal(pending.actions.length,run.actions.length+1);assert.ok(workParts(row).some(part=>part.source==='workday'));
   assert.equal(after.turn,run.turn+1);assert.notEqual(after.eventId,event.id);assert.ok(after.seen.includes(event.id));
   assert.equal(after.history.length,pending.history.length);
   assert.equal(E.requestPatronageReply(pending,person),pending);assert.equal(E.applyChoice(pending,0),pending);
   assert.equal(E.advance(after),after);assert.deepEqual(E.requestPatronageReply(run,person),pending);
   assert.throws(()=>E.applyChoice(run,event.choices.length),/Unavailable choice/);
   assert.deepEqual(run,before);canonical(pending);canonical(after);
  }
 }
});

test('income, one work-pair allowance and a PIP countdown use the same single settled work pipeline',()=>{
 const turnTwo=enact(source('patronage67-education'),['patronage67-education',0]);
 assert.equal(turnTwo.turn,2);assert.equal(E.getEvent(turnTwo).kind,'daily');
 const allowed=patronageAllowanceDueV67(turnTwo,{kind:'daily',eventId:turnTwo.eventId,turn:turnTwo.turn,choiceIndex:E.getEvent(turnTwo).choices.length});
 assert.equal(allowed,6);
 const paid=E.requestPatronageReply(turnTwo,target(turnTwo)),payRow=paid.history.at(-1);
 assert.equal(cashPart(payRow,'patronage-allowance'),Math.min(6,100-turnTwo.stats.cash));
 assert.equal(cashPart(payRow,'income'),0);canonical(paid);
 // A real fourth workday with money already spent on employee shares.
 let fourth=entry(witnesses['kind-workday'].seed);
 for(const step of witnesses['kind-workday'].steps){
  if(fourth.turn===4&&E.getEvent(fourth).kind==='daily'&&E.canRequestPatronageReply(fourth))break;
  fourth=enact(fourth,step);
 }
 assert.equal(fourth.turn,4);assert.ok(fourth.stats.cash<75);
 const salary=E.requestPatronageReply(fourth,target(fourth)),salaryRow=salary.history.at(-1),finished=E.advance(salary);
 assert.equal(cashPart(salaryRow,'income'),Math.round(fourth.pay/10));
 assert.equal(cashPart(salaryRow,'patronage-allowance'),6);
 assert.equal(salaryRow.breakdown.filter(part=>part.source==='income').length,1);
 assert.equal(salaryRow.breakdown.filter(part=>part.source==='patronage-allowance').length,1);
 assert.equal(finished.stats.cash,salary.stats.cash);assert.equal(finished.turn,fourth.turn+1);canonical(salary);canonical(finished);
 const pip=source('pip-daily'),progress=E.requestPatronageReply(pip,target(pip)),resolved=E.advance(progress);
 assert.equal(pip.pip.active,true);assert.equal(progress.pip.remaining,pip.pip.remaining-1);assert.deepEqual(resolved.pip,progress.pip);
 assert.equal(progress.pipCount,pip.pipCount);assert.ok(workParts(progress.history.at(-1)).some(part=>part.source==='pip-pressure'));
 assert.equal(resolved.turn,pip.turn+1);canonical(progress);canonical(resolved);
});

test('special-treatment conversations and private invitations finish without an extra workday, purchase or original decision',()=>{
 for(const id of ['patronage67-education','patronage67-pay-review','patronage67-smalltalk','kind-workday','kind-break']){
  const run=source(id),event=E.getEvent(run),returnId=run.resumeEventId||run.breakReturnEventId;
  assert.ok(returnId,id);const before=clone(run),pending=E.requestPatronageReply(run,target(run)),row=pending.history.at(-1),after=E.advance(pending);
  assert.equal(row.eventId,id);assert.equal(row.kind,event.kind);assert.equal(row.patronageOutcome.version,2);
  assert.equal(after.eventId,returnId);assert.equal(after.turn,run.turn);assert.equal(pending.stats.cash,run.stats.cash);
  assert.equal(after.stats.cash,pending.stats.cash);assert.equal(after.pay,run.pay);assert.deepEqual(after.pip,run.pip);
  assert.equal(after.resumeEventId,null);assert.equal(after.breakReturnEventId,null);assert.deepEqual(workParts(row),[]);
  assert.equal(cashPart(row,'patronage-appointment'),0);assert.equal(cashPart(row,'patronage-allowance'),0);
  if(id.startsWith('kind-'))assert.match(row.result,/沒有答應付費行程/);
  assert.deepEqual(run,before);canonical(pending);canonical(after);
 }
});

test('mandatory PIP, dismissal, signatures, finale and rest cannot be bypassed using a family reply',()=>{
 for(const id of ['crisis-boss','pip-review','pip-passed','dismissal-final','paperwork','finale','self-care']){
  const run=source(id),before=clone(run);
  assert.ok(run.patronage);assert.equal(E.canRequestPatronageReply(run),false,id);assert.deepEqual(E.getPatronageReplyTargets(run),[]);
  assert.equal(E.getPatronageReplyLine(run,'wing'),'');assert.equal(E.requestPatronageReply(run,'wing'),run);assert.deepEqual(run,before);canonical(run);
 }
 // The old banquet conversation is not reached by r69's required calendar,
 // but a suspended private conversation must still require its return anchor.
 const run=source('daily-son'),event={id:'banquet-afterparty',kind:'banquet'};
 assert.equal(patronageProgressEffectV69(run,event),null);
 const anchored={...run,banquetReturnEventId:run.eventId};
 assert.equal(patronageProgressEffectV69(anchored,event).effect,'banquetFinish');
 assert.deepEqual(anchored.banquetReturnEventId,run.eventId);
 for(const id of ['patronage67-education','kind-workday','kind-break'])assert.equal(patronageProgressEffectV69(run,{id,kind:id.startsWith('patronage')?'career':'self-care'}),null);
});

test('published r68 replies retain their interruption and return semantics rather than silently completing the work',()=>{
 for(const marker of ['s','d']){
  let run=entry('e39-r68-'+marker+'-9123bc552f2f4d0c8e83fe');
  for(let i=0;i<3;i++)run=E.advance(E.applyChoice(run,0));
  const event=E.getEvent(run),pending=E.requestPatronageReply(run,target(run)),after=E.advance(pending),row=pending.history.at(-1);
  assert.equal(row.patronageOutcome.version,1);assert.equal(row.eventId,'patronage-reply');assert.equal(row.kind,'patronage');
  assert.equal(pending.actions.at(-1).version,1);assert.equal(after.eventId,event.id);assert.equal(after.turn,run.turn);
  assert.deepEqual(after.stats,pending.stats);assert.deepEqual(workParts(row),[]);canonical(pending);canonical(after);
 }
});

test('replay and API reject wrong versions, fabricated source choices, extra authority rewards and repeated actions',()=>{
 const run=source('daily-son'),event=E.getEvent(run),pending=E.requestPatronageReply(run,target(run)),after=E.advance(pending),action=pending.actions.at(-1);
 const body=actions=>({runId:'356a2b5e-11fc-43c8-b177-079ad154f2e8',roleId:run.roleId,seed:run.seed,actions});
 assert.deepEqual(validateCompletion(body(pending.actions),ROLE_MAP).actions,pending.actions);
 const invalid=[{...action,version:1},{...action,version:undefined},{...action,eventId:'onboarding'},{...action,target:'missing-person'},{...action,delta:{cash:100}},{...action,index:0}];
 for(const forged of invalid)assert.throws(()=>E.replayRun(run.roleId,run.seed,[...run.actions,forged]));
 for(const forged of [invalid[0],invalid[1],invalid[3],invalid[4],invalid[5]])assert.throws(()=>validateCompletion(body([...run.actions,forged]),ROLE_MAP),error=>error.code==='invalid_actions');
 assert.throws(()=>E.replayRun(run.roleId,run.seed,[...pending.actions,action]));
 assert.throws(()=>E.replayRun(run.roleId,run.seed,[...run.actions,{type:'choice',eventId:event.id,index:event.choices.length}]));
 for(const original of [pending,after])for(const mutate of [
  value=>value.rng=(value.rng+1)>>>0,
  value=>value.stats.cash=(value.stats.cash+1)%101,
  value=>value.history.at(-1).patronageOutcome.version=1,
  value=>value.history.at(-1).patronageOutcome.affinityDelta++,
  value=>value.history.at(-1).choiceIndex=0,
  value=>value.history.at(-1).result+=' forged',
  value=>value.actions.at(-1).version=1,
 ]){
  const forged=clone(original);mutate(forged);assert.equal(E.validRun(forged),false);
 }
 let legacy=entry('e39-r68-s-9123bc552f2f4d0c8e83fe');for(let i=0;i<3;i++)legacy=E.advance(E.applyChoice(legacy,0));
 const old=E.requestPatronageReply(legacy,target(legacy));
 assert.doesNotThrow(()=>validateCompletion({...body(old.actions),roleId:legacy.roleId,seed:legacy.seed},ROLE_MAP));
 const wrong=[...old.actions.slice(0,-1),{...old.actions.at(-1),version:2}];
 assert.throws(()=>validateCompletion({...body(wrong),roleId:legacy.roleId,seed:legacy.seed},ROLE_MAP),error=>error.code==='invalid_actions');
 assert.throws(()=>E.replayRun(legacy.roleId,legacy.seed,wrong));
});
