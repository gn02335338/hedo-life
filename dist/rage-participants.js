// Only explicitly co-present characters belong here. A name mentioned in a
// story or a phone call does not put that person in the room.
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
});
const EXIT_TEAM = Object.freeze(['erich', 'jenjen', 'sonny']);

export function rageParticipantsFor(event, defaultTarget) {
  if (!defaultTarget) return [];
  if (event?.speaker === 'exit-team') return [...EXIT_TEAM];
  const group = GROUPS[event?.id];
  if (group?.includes(event?.speaker) && group.includes(defaultTarget)) return [...group];
  return [defaultTarget];
}
