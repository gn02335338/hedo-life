// Read-only framing for single-scene recollections. A scene plate does not mean
// the player accepted an invitation or entered a multi-stage activity.
const ARM_SCENES=Object.freeze({
 'video-last-handshake':Object.freeze({title:'離場前的腕力加賽',body:'同事交接到一半，桌邊多了一場腕力加賽。你在旁邊看，這一幕結束後再回去處理自己的事。'}),
 'video-seven-clock':Object.freeze({title:'腕力賽還在等人',body:'原本排好的比賽卡在會議裡，這一幕先處理等人和留披薩的事，還沒有開賽。'}),
 'video-pizza-overtime':Object.freeze({title:'腕力賽前・先談規則',body:'你碰上同事準備比腕力，阿福的參賽條件還沒講完。這一幕先在桌邊聽大家怎麼說。'}),
 'video-no-strength':Object.freeze({title:'腕力賽場邊插曲',body:'桌邊的比賽正在僵持，你在旁邊幫忙看。這一幕回應完，再回去處理自己的事。'}),
 'video-referee-committee':Object.freeze({title:'腕力賽場邊插曲',body:'你路過休息區，剛好碰上同事比腕力。這一幕先在旁邊看，回應後再回去工作。'}),
 'video-designer-benchmark':Object.freeze({title:'腕力賽場邊插曲',body:'工程和產品設計坐到桌子兩邊，你在場邊看這場跨部門對決。這一幕回應完，再回去處理自己的事。'}),
 'video-rick-commentary':Object.freeze({title:'腕力賽場邊插曲',body:'同事正在比腕力，瑞克也坐在觀眾席。你在場邊碰上他，先回應這段插曲。'}),
 'video-message-workout':Object.freeze({title:'腕力賽場邊插曲',body:'你在旁邊看比賽，場上的手還僵著，場邊已經開始聊手機通知。這一幕先留在觀眾席。'}),
 'video-wing-replay':Object.freeze({title:'腕力賽影片回放',body:'比賽已經結束，現在看的是同事剪好的影片。這一幕沒有重新開賽，眼前要回應的是翅膀。'})
});
const REFEREE_TITLE='裁判人數，超過參賽人數';
const REFEREE_BODY='你路過休息區，桌邊兩位同事正準備比腕力。旁邊卻同時有人數秒、有人喊開始、有人說還不算。選手還沒分出輸贏，裁判先有三種版本。你停在場邊，看著兩隻手等十二張嘴決定哪一秒才算開始。';
const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const interrupted=run=>Boolean(run?.verbalContext||run?.rageContext||run?.activityContext||run?.activityInvitationContext||run?.patronageReplyContext||run?.hiddenEncounterContext);

export function armSceneContextHTMLV51(run,event){
 if(event?.kind!=='daily'||interrupted(run)||!Object.hasOwn(ARM_SCENES,event.id))return'';
 const copy=ARM_SCENES[event.id];
 return `<aside class="arm-scene-context" aria-label="腕力賽情境"><span class="arm-scene-mark" aria-hidden="true">✦</span><div><b>${escape(copy.title)}</b><p>${escape(copy.body)}</p></div></aside>`;
}

// Only the original narration gets this entrance. A verbal release can retain
// the source ID, but has its own title/body and must not turn back into a scene.
export function displayArmSceneEventV51(event){
 if(event?.id!=='video-referee-committee'||event.kind!=='daily'||event.title!==REFEREE_TITLE)return event;
 return {...event,body:REFEREE_BODY};
}

export function displayArmSceneHistoryV51(row){
 if(row?.eventId!=='video-referee-committee'||row.kind!=='daily'||row.verbalOutcome||row.title!==REFEREE_TITLE)return row;
 return {...row,body:REFEREE_BODY};
}
