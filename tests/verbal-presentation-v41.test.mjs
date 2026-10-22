import test from 'node:test';
import assert from 'node:assert/strict';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {displayText} from '../dist/persona.js';

test('a committed outburst appears once while response text, personal consequences and canonical evidence remain intact',()=>{
 const line='幹，下一階做什麼、加多少錢，一次講清楚。';
 const row={eventId:'career-review',choiceText:line,body:`你說：「${line}」這次真的說出口了。`,result:`你說：「${line}」翅膀把話交給人事。接著你自己決定離職。`,verbalOutcome:{version:2,target:'wing'}};
 const before=JSON.stringify(row),shown=polishVerbalHistoryV41(row);
 assert.equal(shown.result,'翅膀把話交給人事。接著你自己決定離職。');assert.equal(shown.choiceText,line);assert.equal(JSON.stringify(row),before);
 assert.equal(shown.body,'這次真的說出口了。');
 assert.equal([shown.body,shown.choiceText,shown.result].join('').split(line).length-1,1,'body, quotation and outcome together contain one spoken line');
 assert.deepEqual(polishVerbalHistoryV41(shown),shown,'rendering twice does not eat another quotation');
 const saved={...row,choiceText:'Wing，幹，別再改口。',result:'你說：「Wing，幹，別再改口。」Wing回你：「條件另談。」'};
 assert.equal(displayText(polishVerbalHistoryV41(saved).result),'翅膀回你：「條件另談。」');
});

test('ordinary choices, mismatched wording and another speaker quotation are not rewritten',()=>{
 const rows=[null,{choiceText:'不要改',result:'你說：「不要改」但不是惡言'},
 {choiceText:'幹，這是我說的。',result:'翅膀說：「幹，這是我說的。」',verbalOutcome:{}},
 {choiceText:'幹，這是我說的。',result:'你說：「幹，這不是原話。」反應仍在。',verbalOutcome:{}}];
 for(const row of rows)assert.equal(polishVerbalHistoryV41(row),row);
});
