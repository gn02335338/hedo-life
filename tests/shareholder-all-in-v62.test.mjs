import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {getShareholderEventV58,resolveShareholderChoiceV58,createShareholderContextV58,shareholderAllInTermsV62,shareholderLoanPaymentV62,shareholderWorkCountV62} from '../dist/shareholders-v58.js';
const profile=version=>`e39-r${version}-n-${'a'.repeat(22)}`;
const offer=version=>({seed:profile(version),stats:{cash:70,boss:20},flags:{},history:[],shareholderContext:createShareholderContextV58('offer','source')});
test('the leveraged choice appends only to r62, keeps original choices and discloses the full cash and debt terms',()=>{
 const old=offer(61),fresh=offer(62),oldChoices=getShareholderEventV58(old).choices,newChoices=getShareholderEventV58(fresh).choices;
 assert.equal(oldChoices.length,4);assert.equal(newChoices.length,5);assert.deepEqual(newChoices.slice(0,4),oldChoices);
 assert.match(newChoices[4].text,/我 all in，存款全押，再辦信貸加碼/);assert.match(newChoices[4].text,/30.*借款認股/);assert.match(newChoices[4].text,/10.*借款留生活費/);assert.match(newChoices[4].text,/負債 48.*4 期/);
 assert.throws(()=>resolveShareholderChoiceV58(old,4));
 const resolved=resolveShareholderChoiceV58(fresh,4);
 assert.equal(resolved.cost,70);assert.equal(resolved.stockTotal,100);assert.equal(resolved.cashGrant,10);assert.equal(resolved.bossTarget,100);assert.equal(resolved.loan.remaining,48);assert.match(resolved.result,/翅膀當場笑開/);
});
test('all-in funding separates the player’s equity from borrowed shares and borrowed living cash without mutating a preview',()=>{
 const run=offer(62),before=structuredClone(run),terms=shareholderAllInTermsV62(run);
 assert.equal(terms.stockTotal,terms.ownCash+terms.financedShares);assert.equal(terms.financedShares+terms.cashGrant,terms.loan.principal);
 assert.equal(terms.loan.principal+terms.loan.financeCost,terms.loan.total);assert.equal(terms.loan.total,48);assert.deepEqual(run,before);
});
test('only unique real work turns count toward four repayments, while menus, PIP and interlude rows cannot accelerate a bill',()=>{
 const history=[{kind:'onboarding',turn:0,choiceIndex:0},{kind:'daily',turn:1,choiceIndex:0},{kind:'daily',turn:1,choiceIndex:3},{kind:'office-treat',turn:2,choiceIndex:0},{kind:'career',turn:3,choiceIndex:0},{kind:'shareholder',turn:4,choiceIndex:0},{kind:'fantasy',turn:20,choiceIndex:0}];
 assert.equal(shareholderWorkCountV62({history}),2);
 const run=offer(62);let loan=shareholderAllInTermsV62(run).loan,totalPaid=0;
 for(let work=1;work<=16;work++){
  const bill=shareholderLoanPaymentV62(run,{loan,work,cash:100});
  assert.equal(bill.amount,work%4===0?12:0);totalPaid+=bill.amount;loan=bill.loan;
  const duplicate=shareholderLoanPaymentV62(run,{loan,work,cash:100});assert.equal(duplicate.amount,0);assert.deepEqual(duplicate.loan,loan);
 }
 assert.equal(totalPaid,48);assert.equal(loan.remaining,0);assert.equal(loan.paid,48);
});
test('an insufficient payment remains owed and cannot be forgiven by a replay, a menu visit or invented loan fields',()=>{
 const run=offer(62),initial=shareholderAllInTermsV62(run).loan;
 const partial=shareholderLoanPaymentV62(run,{loan:initial,work:4,cash:5});assert.equal(partial.due,12);assert.equal(partial.amount,5);assert.equal(partial.insufficient,true);assert.equal(partial.loan.remaining,43);
 const later=shareholderLoanPaymentV62(run,{loan:partial.loan,work:5,cash:10});assert.equal(later.amount,7);assert.equal(later.loan.remaining,36);
 assert.throws(()=>shareholderLoanPaymentV62(run,{loan:{...initial,remaining:0},work:4,cash:100}));
 assert.throws(()=>shareholderLoanPaymentV62(run,{loan:{...initial,hiddenGift:100},work:4,cash:100}));
});
const fixtureURL=new URL('./fixtures/shareholder-all-in-v62.json',import.meta.url);
test('natural leveraged lives still attend the shareholder meeting and make real repayments with server-replayable raw choices',()=>{
 assert.ok(existsSync(fixtureURL),'run node scripts/find-shareholder-all-in-v62.mjs after the engine integration');
 const {routes}=JSON.parse(readFileSync(fixtureURL,'utf8'));
 for(const id of ['offer','purchased','meeting-door','meeting-hearing','meeting-finished','first-payment','paid-off','completed-with-loan'])assert.ok(routes.some(route=>route.id===id),id);
 const replay=id=>{const route=routes.find(row=>row.id===id),run=E.replayRun(route.roleId,route.seed,route.actions);assert.ok(E.validRun(run),id);return run;};
 const source=replay('offer'),chosen=E.applyChoice(source,4);
 assert.equal(chosen.stats.cash,10);assert.equal(chosen.stats.boss,100);assert.equal(chosen.flags.shareholder58_owned,source.stats.cash+30);assert.equal(chosen.shareholderLoan.remaining,48);assert.equal(chosen.pendingFamily,null);assert.equal(chosen.completed,false);
 const saved=JSON.parse(JSON.stringify(chosen));assert.ok(E.validRun(saved));
 assert.equal(replay('meeting-hearing').flags.shareholder58_attended,1);
 const paid=replay('first-payment');assert.ok(paid.shareholderLoan.paid>=12);assert.ok(paid.history.some(row=>row.breakdown?.some(part=>part.source==='shareholder-loan')));
 assert.equal(replay('paid-off').shareholderLoan.remaining,0);
 const forged=JSON.parse(JSON.stringify(paid));forged.shareholderLoan.remaining=0;assert.equal(E.validRun(forged),false);
 const ending=replay('completed-with-loan');assert.equal(ending.completed,true);assert.ok(ending.shareholderLoan.remaining>=0);
});

test('the committed all-in and each repayment remain valid before Continue, and saved loan balances cannot be altered',()=>{
 const {routes}=JSON.parse(readFileSync(fixtureURL,'utf8'));
 const route=routes.find(row=>row.id==='paid-off');
 let found=0;
 for(let length=1;length<=route.actions.length;length++){
  const action=route.actions[length-1];if(action.type!=='choice')continue;
  const before=E.replayRun(route.roleId,route.seed,route.actions.slice(0,length-1)),pending=E.applyChoice(before,action.index);
  if(!pending.shareholderLoan||!pending.pending)continue;
  const isPurchase=action.eventId==='shareholder58-offer'&&action.index===4,isPayment=pending.history.at(-1)?.breakdown?.some(part=>part.source==='shareholder-loan');
  if(!isPurchase&&!isPayment)continue;
  found++;assert.ok(E.validRun(JSON.parse(JSON.stringify(pending))),`${action.eventId} pending`);
  const forged=JSON.parse(JSON.stringify(pending));forged.shareholderLoan.remaining=forged.shareholderLoan.remaining===0?1:forged.shareholderLoan.remaining-1;assert.equal(E.validRun(forged),false);
 }
 assert.equal(found,5,'one purchase and exactly four repayment results');
});
