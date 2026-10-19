const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {eligibleInputs,planInputUpdates,revenueSortRequests}=require('../js/modules/connections/input-plan.js');
const groups={amazonRows:[
 {wfSku:'W1',asin:'A1',category:'Mattress',wfPrice:100,wfMrp:200,inventory:2},
 {wfSku:'W1',asin:'A1',category:'Mattress',wfPrice:100,wfMrp:200,inventory:2},
 {wfSku:'W2',asin:'A2',wfPrice:0,wfMrp:200,inventory:2},
 {wfSku:'W3',asin:'A3',wfPrice:100,wfMrp:200,inventory:0},
 {wfSku:'W4',asin:'A4',wfPrice:100,wfMrp:200,inventory:2},
 {wfSku:'W4',asin:'A5',wfPrice:110,wfMrp:200,inventory:2}
],flipkartRows:[{wfSku:'W1',fsn:'F1',category:'Mattress',wfPrice:100,wfMrp:200,inventory:3},{wfSku:'W5',fsn:'F5',category:'Furniture',wfPrice:90,wfMrp:150,inventory:1}]};
const eligible=eligibleInputs(groups);
assert.deepEqual(eligible.rows,[['Mattress','A1','F1','W1',100,200],['Furniture','','F5','W5',90,150]]);
assert.equal(eligible.skipped.missingPrice,1);assert.equal(eligible.skipped.outOfStock,1);assert.equal(eligible.skipped.conflictingPrice,1);
const header=['Category','ASIN','FSN','WF Item SKU','WF Price','WF MRP'];
const existing=[header,['Mattress','A1','F1','W1',80,160,'EDD','existing scrape'],['Mattress','OLD','','OLD',80,160,'EDD','old scrape']];
const original=JSON.stringify(existing),plan=planInputUpdates(existing,eligible.rows);
assert.equal(plan.retained,1);assert.equal(plan.cleared,1);assert.equal(plan.appended,1);
assert.deepEqual(plan.updates.map(u=>u.row),[2,3,4]);
assert.equal(plan.updates.every(u=>u.values.length===6),true);
assert.equal(JSON.stringify(existing),original);
assert.throws(()=>planInputUpdates(existing,[]),/No eligible/);
assert.throws(()=>planInputUpdates([header,['=FORMULA','A1','F1','W1',100,200]],eligible.rows),/formulas/);
assert.throws(()=>planInputUpdates([['wrong']],eligible.rows),/contract/);
const packed=['Mattress','W6','market','A6',200,100,200,100,100,3];
assert.equal(eligibleInputs({amazonRows:[packed]}).rows[0][3],'W6');

// Revenue is deduplicated per ASIN within each WF SKU; missing revenue comes last.
const ranked=eligibleInputs({amazonRows:[
 {wfSku:'LOW',asin:'LOW-ASIN',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:100,revenueAvailable:true},
 {wfSku:'HIGH',asin:'HIGH-ASIN',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:1000,revenueAvailable:true},
 {wfSku:'HIGH',asin:'HIGH-ASIN',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:1000,revenueAvailable:true},
 {wfSku:'ZERO',asin:'ZERO-ASIN',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:0,revenueAvailable:true}
],flipkartRows:[{wfSku:'MISSING',fsn:'ONLY-FSN',wfPrice:10,wfMrp:20,inventory:1}]});
assert.deepEqual(ranked.rows.map(r=>r[3]),['HIGH','LOW','ZERO','MISSING']);
assert.deepEqual(ranked.revenues,[1000,100,0,null]);
const revenuePlan=planInputUpdates([header,['','LOW-ASIN','','LOW',10,20,'low-output'],['','HIGH-ASIN','','HIGH',10,20,'high-output']],ranked.rows);
const sortOps=revenueSortRequests(revenuePlan,ranked.rows,37,743318554);
assert.equal(sortOps[2].sortRange.range.endColumnIndex,38);
assert.equal(sortOps[2].sortRange.range.startRowIndex,1);
assert.equal(sortOps[3].deleteDimension.range.startIndex,37);
assert(sortOps[1].updateCells.rows[0].values[0].userEnteredValue.numberValue>sortOps[1].updateCells.rows[1].values[0].userEnteredValue.numberValue);
console.log('PASS descending Amazon revenue, deduplicated ASIN totals, missing revenue last and whole-row sort with temporary column cleanup.');

const code=fs.readFileSync(__dirname+'/../js/modules/connections/live-connections.js','utf8');new Function(code);
const job=fs.readFileSync(__dirname+'/../scripts/eod/sync-inputs.cjs','utf8');new Function(job);
assert(job.includes("billing.data.billingEnabled!==false"));
assert(job.indexOf('billing.data.billingEnabled')<job.indexOf('initializeApp({'));
assert(!job.includes('firebase-functions'));assert(!job.includes('collection(\'wakesuite_eod'));
console.log('PASS WF-SKU-first mapping, missing identifier blanks, SKU/price conflict handling, price/in-stock filtering, packed snapshot rows, stable row positions, output preservation, formula guard, zero-row guard, zero-cost backend gate and JS syntax.');

(async()=>{
 const code=fs.readFileSync(__dirname+'/../scripts/eod/sync-inputs.cjs','utf8');let firestoreStarted=false;
 const context={require:name=>{
  if(name==='google-auth-library')return {GoogleAuth:class{async getClient(){return {request:async()=>({data:{billingEnabled:true}})}}}};
  if(name==='firebase-admin/app')return {initializeApp:()=>{firestoreStarted=true},cert:v=>v};
  if(name==='firebase-admin/firestore')return {getFirestore:()=>{throw Error('must not read billed Firestore')},FieldPath:{}};
  if(name.includes('input-plan'))return {eligibleInputs,planInputUpdates};
  throw Error(name);
 },module:{exports:{}},process:{env:{GITHUB_REPOSITORY_VISIBILITY:'public',WAKESUITE_EOD_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'wakesuite-4daf9',client_email:'sync@example.invalid',private_key:'test-only'})}},console};
 vm.createContext(context);vm.runInContext(code,context);
 await assert.rejects(context.module.exports.main(),/Zero-cost policy/);assert.equal(firestoreStarted,false);
 context.process.env.GITHUB_REPOSITORY_VISIBILITY='private';await assert.rejects(context.module.exports.main(),/free public/);
 console.log('PASS billed-project and private-repository execution stopped before Firestore access or Sheet mutation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
