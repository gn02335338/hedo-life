// Pure scheduling for new lives. Only the engine supplies seeded draws; neither
// a menu nor a notification counts as a completed work scene.
export function selectWorkEventV21(run, pool, draw, allEvents) {
  if (!pool.length) throw new Error('No eligible work events');
  const exclusive = pool.filter(event => event.roles?.length === 1 && event.roles[0] === run.actualRoleId);
  const related = pool.filter(event => event.roles?.length > 1 && event.roles.includes(run.actualRoleId));
  const shared = pool.filter(event => !event.roles);
  const byId = new Map(allEvents.map(event => [event.id, event]));
  const recent = run.history.filter(row => row.kind === 'daily' && Number.isInteger(row.choiceIndex) && row.choiceIndex >= 0 && byId.has(row.eventId));
  const twoShared = recent.length >= 2 && recent.slice(-2).every(row => !byId.get(row.eventId).roles);
  let selected;
  if (!recent.length && exclusive.length) selected = exclusive;
  else if (twoShared && (exclusive.length || related.length)) selected = exclusive.length ? exclusive : related;
  else {
    const bucket = draw();
    selected = bucket < .5 ? exclusive : bucket < .7 ? related : shared;
  }
  if (!selected.length) selected = exclusive.length ? exclusive : related.length ? related : shared;
  let ticket = draw() * selected.reduce((sum, event) => sum + (event.weight || 1), 0);
  for (const event of selected) {
    ticket -= event.weight || 1;
    if (ticket <= 0) return event.id;
  }
  return selected.at(-1).id;
}
