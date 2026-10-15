const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},document:{getElementById:()=>null}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../js/modules/upload/data-calendar.js','utf8'),context);
const s=context.window.WakeSuiteDataCalendar.status;
const date='2026-10-01',today='2026-10-15';
assert.equal(s(null,date,today),'Missing');
assert.equal(s(null,'2026-10-16',today),'Future');
assert.equal(s({status:'processing'},date,today),'Processing');
assert.equal(s({status:'failed'},date,today),'Incomplete');
assert.equal(s({status:'completed',dataStatus:'complete'},date,today),'Stored');
assert.equal(s({status:'completed',dataStatus:'partial'},date,today),'Partial');
assert.equal(s({status:'completed'},date,today),'Unknown');
assert.equal(s({status:'completed',sourceAvailability:{audit:false}},date,today,'audit'),'Missing');
assert.equal(s({status:'completed',sourceAvailability:{audit:true}},date,today,'audit'),'Stored');
assert.equal(s({status:'completed'},date,today,'audit'),'Unknown');
console.log('Passed 10 calendar coverage cases.');

