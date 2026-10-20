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
});
const EXIT_TEAM = Object.freeze(['erich', 'jenjen', 'sonny']);

export function rageParticipantsFor(event, defaultTarget) {
  if (!defaultTarget) return [];
  if (event?.speaker === 'exit-team') return [...EXIT_TEAM];
  const group = GROUPS[event?.id];
  if (group?.includes(event?.speaker) && group.includes(defaultTarget)) return [...group];
  return [defaultTarget];
}
