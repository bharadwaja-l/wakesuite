const assert=require('node:assert/strict');
const {eligibleInputs,replacementRequests}=require('../js/modules/connections/input-plan.js');
const r=eligibleInputs({amazonRows:[{wfSku:'AZ',asin:'A',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:100}],flipkartRows:[{wfSku:'FK',fsn:'F',wfPrice:10,wfMrp:20,inventory:1}]});
assert.equal(r.rows[0][2],'Not available on FK');assert.equal(r.rows[1][1],'Not available on AZ');
const [op]=replacementRequests(r.rows,100,37,123);assert.equal(op.updateCells.range.startRowIndex,1);assert.equal(op.updateCells.range.endRowIndex,100);assert.equal(op.updateCells.range.endColumnIndex,37);assert.equal(op.updateCells.fields,'userEnteredValue');assert.equal(op.updateCells.rows.length,2);assert(op.updateCells.rows.every(row=>row.values.length===6));
assert.throws(()=>replacementRequests([],100,37,123),/No eligible/);
assert.throws(()=>replacementRequests(r.rows,2,37,123),/Invalid/);
console.log('PASS marketplace-specific labels, atomic full-body replacement excluding headers, six input fields, output/tail clearing and empty-input protection.');
