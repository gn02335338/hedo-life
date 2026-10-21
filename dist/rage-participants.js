// Only explicitly co-present characters belong here. A name mentioned in a
// story or a phone call does not put that person in the room.
import {PERSONAS} from './persona.js';
const GROUPS = Object.freeze({
  'meimei-missing-ticket': Object.freeze(['meimei', 'jack']),
  'floor-notice': Object.freeze(['hope', 'sonny']),
  'banquet-welcome': Object.freeze(['rick', 'wing']),
  'dp-kpi-patch': Object.freeze(['jenjen', 'erich']),
  'dp-retention-bonus': Object.freeze(['rick', 'hope']),
  'sophie-printer-undead': Object.freeze(['sophie', 'sonny']),
  'jonathan-spare-time-qa': Object.freeze(['jonathan', 'rick']),
  'sam-chip-study': Object.freeze(['sam', 'jack']),
  'q26-interview-privacy': Object.freeze(['hope', 'sonny']),
  'q26-pip-mentor-paradox': Object.freeze(['hope', 'rick', 'jack']),
  'q26-diploma-undergraduate': Object.freeze(['wing', 'jack']),
  'q26-cindy-unread-party': Object.freeze(['cindy', 'jack']),
  'q26-spring-dinner-seats': Object.freeze(['spencer', 'rick', 'sophie']),
  'q26-chatgpt-replacement': Object.freeze(['wing', 'sophie']),
  'q26-private-errand-meeting': Object.freeze(['helen', 'wing']),
  'quiz26-study-rivals': Object.freeze(['sam', 'jack']),
  'quiz26-sticker-detective': Object.freeze(['meimei', 'helen']),
  'quiz26-table-tea': Object.freeze(['sophie', 'wing', 'spencer']),
  'quiz26-owen-brother': Object.freeze(['owen', 'jack']),
  'quiz26-toast-rule': Object.freeze(['meimei', 'jack']),
  'quiz26-mantis-memo': Object.freeze(['jonathan', 'wing']),
  'quiz26-api-points': Object.freeze(['jack', 'wing']),
  'q26-calendar-operator': Object.freeze(['jack', 'wing']),
  'accounting28-final-form': Object.freeze(['sophie', 'sonny']),
  'hr28-coffee-jd': Object.freeze(['wing', 'hope']),
  'hr28-onboarding-notice': Object.freeze(['wing', 'sonny']),
  'hr28-attendance-access': Object.freeze(['jack', 'meimei']),
  'admin28-extension-grandeur': Object.freeze(['wing', 'jenjen', 'erich', 'sonny']),
  'admin28-supply-minimum': Object.freeze(['wing', 'jenjen']),
  'admin28-seat-key': Object.freeze(['sophie', 'sonny']),
  'patronage-application': Object.freeze(['wing', 'hope', 'rick']),
  'rick29-protected-report': Object.freeze(['rick', 'owen']),
  'rick29-pm-family-tree': Object.freeze(['rick', 'cindy']),
});
const EXIT_TEAM = Object.freeze(['erich', 'jenjen', 'sonny']);

export function rageParticipantsFor(event, defaultTarget) {
  if (!defaultTarget) return [];
  if (event?.speaker === 'exit-team') return [...EXIT_TEAM];
  if(event?.minRules>=35&&Array.isArray(event.participants)){
    const present=[...new Set(event.participants.filter(id=>Object.hasOwn(PERSONAS,id)))];
    if(present.includes(event.speaker)&&present.includes(defaultTarget))return present;
  }
  const group = GROUPS[event?.id];
  if (group?.includes(event?.speaker) && group.includes(defaultTarget)) return [...group];
  return [defaultTarget];
}
