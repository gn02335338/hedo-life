import test from 'node:test';
import assert from 'node:assert/strict';
import {strongVerbalLineV39} from '../dist/verbal-lines-v39.js';
import {getVerbalLine,createRun,requestVerbal} from '../dist/engine.js';

test('visible coarse dialogue is deterministic, specific to work/private context and never consults unchosen results',()=>{
 const run={seed:'e39-lines',actualRoleId:'design'},body={title:'報價單又刪了一行',id:'quotation',speaker:'wing',body:'報價 客戶 交付'};
 Object.defineProperty(body,'choices',{get(){throw Error('future choice was read')}});
 const line=strongVerbalLineV39({event:body,target:'wing',run,phase:'event',base:'請確認這件工作。'});
 assert.match(line,/幹/);assert.match(line,/報價|業績|交付/);assert.equal(line,strongVerbalLineV39({event:body,target:'wing',run,base:'請確認這件工作。'}));
 const night=strongVerbalLineV39({event:{id:'banquet-afterparty',speaker:'kind'},target:'kind',run,base:''});assert.match(night,/放鳥|主揪|空椅子/);assert.notEqual(night,line);
 for(const target of ['annie_yu','princess','joyce','janet','captain'])for(const phase of ['event','result']){
  const text=strongVerbalLineV39({event:{id:'meal-with-'+target,title:'一起吃飯'},target,run,phase});assert.match(text,/幹[，。！？]|他媽|靠北|媽的|狗屁/);assert.ok(text.length<260);
 }
});

test('new-life preview exactly matches the committed outburst while published older spoken lines remain unchanged',()=>{
 const fresh=createRun('sales','e39-lines-preview'),preview=getVerbalLine(fresh),spoken=requestVerbal(fresh,undefined,2);
 assert.ok(preview);assert.equal(spoken.verbalContext.line,preview);assert.equal(spoken.history.at(-1).choiceText,preview);
 const old=createRun('sales','e38-lines-preview');const previous=getVerbalLine(old);assert.ok(previous);assert.notEqual(previous,preview);
 assert.equal(requestVerbal(old,undefined,2).verbalContext.line,previous);
});
