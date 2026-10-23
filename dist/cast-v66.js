// These are original fictional scenes inspired by recurring office motifs.
// A row is one authored encounter, not a permutation of answers or meals.
const scenes={zoe:'office_day',action:'meeting',hester:'client_call',simon:'brand_studio',james:'office_day',johnny:'project_schedule'};
export function castSceneV66(speaker,row){
 const [slug,title,body,quote,practical,practicalResult,agree,agreeResult,wild,wildResult,verbal,afterVerbal,roles=[],scene]=row;
 return {id:`cast66-${speaker}-${slug}`,speaker,title,body,wing:quote,kind:'daily',...(speaker==='kind'&&slug==='coat-check'?{scope:'private'}:{}),scene:scene||scenes[speaker]||'office_day',minRules:39,minTurn:1,requiresCastV66:true,weight:1.15,era:'同事日常・另一件鳥事',sourceIds:['characterFiction'],...(roles.length?{roles}:{}),verbalLinesV66:[verbal,afterVerbal],choices:[
  {text:practical,detail:'',result:practicalResult,delta:{skill:4,trust:4,energy:-6,mood:-2},flags:['evidence']},
  {text:agree,detail:'',result:agreeResult,delta:{lick:4,trust:-2,energy:-7,mood:-4},flags:['loop']},
  {text:wild,detail:'',result:wildResult,delta:{slack:5,trust:1,energy:-4,mood:5},flags:['archive'],wild:true}
 ]};
}
