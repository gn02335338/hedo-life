import {displayText} from './persona.js';

// Only remove the player's own exact, already-rendered leading quotation.
// Canonical history/proof text stays unchanged; other people's quotes remain.
export function polishVerbalHistoryV41(row){
 if(!row?.verbalOutcome||typeof row.choiceText!=='string')return row;
 const line=displayText(row.choiceText);
 const prefixes=[`你說：「${line}」`,`你說：${line}`,`你對對方說：「${line}」`];
 let shown=row;
 for(const field of ['body','result']){
  if(typeof row[field]!=='string')continue;
  const text=displayText(row[field]),prefix=prefixes.find(value=>text.startsWith(value));
  if(prefix){if(shown===row)shown={...row};shown[field]=text.slice(prefix.length).trimStart();}
 }
 return shown;
}
