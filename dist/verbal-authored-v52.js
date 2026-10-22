// Read-only metadata for the explicitly written lines in verbal-scene-copy.js.
// General character voices and body-keyword fallbacks are not scene authorship.
// Keep the published engine and spoken evidence untouched; presentation uses this
// to retain real scene copy before applying its safer visible-scene fallback.
const SCENE_IDS=Object.freeze([
 "education-review",
 "education-scrutiny",
 "salary-cut",
 "salary-final",
 "pip-review",
 "pip-passed",
 "promotion-review",
 "career-review",
 "career-step-down",
 "watch-review",
 "watch-empty-corridor",
 "watch-invisible-invite",
 "watch-exam-room",
 "watch-future",
 "kind-break",
 "kind-workday",
 "banquet-draw",
 "video-pizza-overtime",
 "quiz26-arm-draw",
 "ai31-auto-increment",
 "rick-phone-wakeup",
 "rick-author-name",
 "rick-vacation-proxy",
 "rick-architecture-relic",
 "rick-two-voices",
 "rick-formula-owner",
 "rick-credit-heirloom",
 "rick-forwarded-owner",
 "rick-fault-friendship",
 "rick-assistant-stack",
 "rick29-executive-phone",
 "rick29-assistant-chair",
 "sales21-quote-footnotes",
 "sales21-demo-operator",
 "sales21-renewal-denominator",
 "sales21-roas-window",
 "sales21-commission-proof",
 "sales21-overdue-receivable",
 "sales21-forecast-zoo",
 "sales21-rfp-free-consultant",
 "sales21-credit-heirloom",
 "sales21-discount-signature",
 "sales21-handover-promise-version",
 "sales21-escalation-screenshot",
 "bd21-mou-annex",
 "bd21-resource-barter",
 "bd21-channel-map",
 "bd21-introduction-scope",
 "bd21-poc-finish-line",
 "bd21-conference-lunch-map",
 "bd21-press-release-tense",
 "bd21-partner-certification",
 "bd21-data-handshake",
 "bd21-crossborder-routing",
 "bd21-ecosystem-logo-wall",
 "bd21-partner-sunset",
 "design-v21-typeface-mood",
 "design-v21-handoff-inspector",
 "design-v21-png-source",
 "design-v21-component-throne",
 "design-v21-responsive-banner",
 "design-v21-brand-red",
 "design-v21-approval-checkmark",
 "design-v21-invisible-button",
 "design-v21-microanimation",
 "design-v21-stock-watermark",
 "design-v21-chairman-portrait",
 "design-v21-wireframe-switch",
 "hr28-coffee-jd",
 "admin28-coffee-round",
 "admin28-recruiting-hat",
 "hr28-admin-half-day",
 "hr28-candidate-chase",
 "hr28-trial-review-notice",
 "hr28-comp-leave",
 "finance28-cash-calendar",
 "finance28-budget-weather",
 "finance28-signature-runway",
 "finance28-resume-invoice",
 "finance28-scenario-bell",
 "accounting28-receipt-orphan",
 "accounting28-close-clock",
 "accounting28-inventory-ghost",
 "accounting28-audit-breadcrumb",
 "sam-pureblood-degree",
 "sam-streaming-pause",
 "jonathan-assistant-shield",
 "sonny-printer-language",
 "sophie-one-minute-exit",
 "sophie-source-file",
 "owen-calendar-chat",
 "owen-triple-followup",
 "owen-resignation-countdown",
 "cindy-favor-temperature",
 "cindy-launch-owner",
 "gender29-work-introduction",
 "gender29-coffee-detour",
 "gender29-mask-review",
 "gender29-demo-driver",
 "gender29-heavy-lift",
 "gender29-recruiting-alibi"
]);
const GROUP_TARGETS=Object.freeze({
 "crisis-boss":Object.freeze(["erich","jenjen","sonny"]),
 "paperwork":Object.freeze(["erich","jenjen","sonny"]),
 "dismissal-final":Object.freeze(["erich","jenjen","sonny"]),
 "floor-notice":Object.freeze(["hope","sonny"]),
 "patronage-application":Object.freeze(["wing","hope","rick"]),
 "banquet-welcome":Object.freeze(["rick","wing"]),
 "meimei-missing-ticket":Object.freeze(["meimei","jack"]),
 "sophie-printer-undead":Object.freeze(["sophie","sonny"]),
 "jonathan-spare-time-qa":Object.freeze(["jonathan","rick"]),
 "sam-chip-study":Object.freeze(["sam","jack"]),
 "accounting28-final-form":Object.freeze(["sophie","sonny"]),
 "hr28-coffee-jd":Object.freeze(["wing","hope"]),
 "hr28-onboarding-notice":Object.freeze(["wing","sonny"]),
 "admin28-extension-grandeur":Object.freeze(["wing","jenjen","erich","sonny"]),
 "rick29-protected-report":Object.freeze(["rick","owen"]),
 "rick29-pm-family-tree":Object.freeze(["rick","cindy"]),
 "q26-pip-mentor-paradox":Object.freeze(["hope","rick","jack"]),
 "q26-interview-privacy":Object.freeze(["hope","sonny"]),
 "q26-spring-dinner-seats":Object.freeze(["spencer","rick","sophie"]),
 "admin28-supply-minimum":Object.freeze(["wing","jenjen"]),
 "admin28-seat-key":Object.freeze(["sophie","sonny"]),
 "hr28-attendance-access":Object.freeze(["jack","meimei"]),
 "q26-diploma-undergraduate":Object.freeze(["wing","jack"]),
 "q26-cindy-unread-party":Object.freeze(["cindy","jack"]),
 "quiz26-toast-rule":Object.freeze(["meimei","jack"]),
 "quiz26-study-rivals":Object.freeze(["sam","jack"]),
 "dp-kpi-patch":Object.freeze(["jenjen","erich"]),
 "dp-retention-bonus":Object.freeze(["rick","hope"]),
});
const MEAL_TARGETS=Object.freeze(["wing","spencer","erich","sonny","jenjen","rick","kind","hope","jack","meimei","helen","sophie","jonathan","owen","sam","cindy"]);
const CONTEXT_IDS=Object.freeze(['onboarding','low-pay-tip','raise-request','raise-response','raise-confirmation','banquet-afterparty','self-care','meal-guests-a','meal-guests-b','mood-collapse','mood-self-destruct','crisis-mood','wealth-plan','wealth-startup','wealth-retire','exit-menu','rank-exit','career-exit','story-exit']);
const SELF_WATCH=Object.freeze(['watch-empty-corridor','watch-exam-room','watch-future']);
const GENERIC_VOICES=Object.freeze(['annie_yu','princess','joyce','janet','captain']);

// Supplying an event is preferred. The optional three-string form exists for
// callers which already have a visible source speaker; unknown speakers fail
// closed so a principal's speech cannot be put into another person's mouth.
export function hasAuthoredVerbalV52(eventOrId,target,sourceSpeaker){
 const event=typeof eventOrId==='string'?{id:eventOrId,speaker:sourceSpeaker}:eventOrId;
 const id=event?.id,speaker=event?.speaker;
 if(typeof id!=='string'||typeof target!=='string')return false;
 if(GENERIC_VOICES.includes(target))return false;
 if(target==='professor')return id==='meal-with-professor';
 if(id==='meal-guests-c')return target==='self';
 if(Object.hasOwn(GROUP_TARGETS,id)&&GROUP_TARGETS[id].includes(target))return true;
 if(id.startsWith('meal-with-'))return MEAL_TARGETS.includes(target)&&id==='meal-with-'+target;
 if(CONTEXT_IDS.includes(id))return typeof speaker==='string'&&speaker===target;
 if(SELF_WATCH.includes(id)&&target==='self')return true;
 return SCENE_IDS.includes(id)&&target!=='self'&&typeof speaker==='string'&&speaker===target;
}

export const AUTHORED_VERBAL_METADATA_V52=Object.freeze({sceneIds:SCENE_IDS,groupTargets:GROUP_TARGETS,mealTargets:MEAL_TARGETS,contextIds:CONTEXT_IDS});
