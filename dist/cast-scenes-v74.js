// Original fictional office encounters. Each row is one authored story.
const scenes={wine:'server_room',peter:'office_day',tony:'office_day',henry:'meeting',mia:'recruiting',alice:'office_day'};
const effects=[
 [{skill:4,trust:4,energy:-6,mood:-2},{lick:4,trust:-2,energy:-7,mood:-5},{slack:5,trust:1,energy:-4,mood:5}],
 [{skill:5,trust:3,energy:-5,mood:-3},{lick:3,trust:-3,energy:-6,mood:-4},{slack:4,trust:2,energy:-4,mood:4}],
 [{skill:3,trust:5,energy:-6,mood:1},{lick:4,trust:-1,energy:-8,mood:-6},{slack:5,trust:-1,energy:-3,mood:6}]
];
export function castSceneV74(speaker,row){
 const [slug,title,body,quote,practical,practicalResult,agree,agreeResult,wild,wildResult,verbal,afterVerbal,roles=[],scene,meta={}]=row;
 const effect=effects[(slug.length+speaker.length)%effects.length];
 const choices=[[practical,practicalResult],[agree,agreeResult],[wild,wildResult]].map(([text,result],index)=>({text,detail:'',result,delta:{...effect[index]},flags:[index===0?'evidence':index===1?'loop':'archive'],...(index===2?{wild:true}:{})}));
 return {id:`cast74-${speaker}-${slug}`,speaker,title,body,wing:quote,kind:'daily',scene:scene||scenes[speaker]||'office_day',minRules:39,minTurn:1,requiresCastV74:true,weight:1.15,era:'同事日常・又有新鳥事',sourceIds:['castFictionV74','characterFiction'],...(roles.length?{roles}:{}),...structuredClone(meta),...(meta.scope==='private'?{privateContext:true}:{}),verbalLinesV74:[verbal,afterVerbal],choices};
}
