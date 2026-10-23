import {CAST_EVENTS_V66} from './events-cast-v66.js';
import {isExpansionV66} from './expansion-profile-v66.js';
import {isDeclinedArmSceneV66} from './scene-continuity-v66.js';
const byId=new Map(CAST_EVENTS_V66.map(event=>[event.id,event]));
export function castVerbalLineV66(run,event,target,phase='event'){
 if(!isExpansionV66(run))return null;
 if(target==='sonny'&&isDeclinedArmSceneV66(run,event))return phase==='result'?'靠北，我回的是影片裡那場平手。別把留言區再開成現場，理由多一段也不會讓過去那隻手突然多贏一分。':'幹，我都沒去比賽了，回座位還要聽平手申覆？影片裡雙方同意什麼就算什麼，別每次事後再補一段你其實比較強。';
 const authored=byId.get(event?.id);
 if(!authored||authored.speaker!==target)return null;
 return authored.verbalLinesV66[phase==='result'?1:0];
}
