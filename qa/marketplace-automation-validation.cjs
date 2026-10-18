const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname+'/../';
const helper=fs.readFileSync(root+'userscripts/marketplace-reports-workflow-helper.user.js','utf8');
let source=helper.slice(0,helper.indexOf("  if (location.hostname === 'sellercentral.amazon.in' && location.pathname.startsWith('/business-reports'))"));
source+=`globalThis.api={rollingThirtyCalendarDays, listingSizeMb, runFlipkartListingWorkflow, downloadFlipkartListing, generateFreshFlipkartListing, runSqlExport,
set(stubs){if(stubs.openFlipkartHistory)openFlipkartHistory=stubs.openFlipkartHistory;if(stubs.flipkartListingRows)flipkartListingRows=stubs.flipkartListingRows;if(stubs.downloadFlipkartListing)downloadFlipkartListing=stubs.downloadFlipkartListing;if(stubs.generateFreshFlipkartListing)generateFreshFlipkartListing=stubs.generateFreshFlipkartListing;if(stubs.writeSqlQueryToEditor)writeSqlQueryToEditor=stubs.writeSqlQueryToEditor;if(stubs.armSqlSubmission)armSqlSubmission=stubs.armSqlSubmission;},
publishBridgeStatus};})();`;
let clock=Date.now();class Clock extends Date{static now(){return clock;}}
const stored=new Map(),events={},clicks=[];
const context={URLSearchParams,URL,Date:Clock,Intl,console,Event:class{},InputEvent:class{},
location:{hostname:'test.invalid',origin:'https://test.invalid',pathname:'/',search:''},
document:{querySelector:()=>null,querySelectorAll:()=>[],body:{innerText:''}},
window:{addEventListener:(type,fn)=>events[type]=fn,postMessage(){}},
sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
localStorage:{getItem:()=>null,setItem(){}},
setTimeout:fn=>{clock+=2000;fn();},setInterval(){},
GM_setValue(){},GM_getValue(){return null;},GM_listValues(){return [];},GM_deleteValue(){}};
vm.runInNewContext(source,context);const api=context.api;
async function test(){
 const range=api.rollingThirtyCalendarDays();assert.equal(Math.round((range.end-range.start)/86400000),29);assert.equal(range.end.getHours(),0);
 assert.equal(api.listingSizeMb({innerText:'Listing.xlsx 20 MB'}),20);assert.equal(api.listingSizeMb({innerText:'Listing.xls 21 MB'}),21);assert.equal(api.listingSizeMb({innerText:'Listing.xls'}),null);
 let rows=[{innerText:'listing.xls 21 MB'}],downloads=0,generations=0;
 api.set({openFlipkartHistory:async()=>{},flipkartListingRows:()=>rows,downloadFlipkartListing:async()=>downloads++,generateFreshFlipkartListing:async()=>generations++});
 await api.runFlipkartListingWorkflow();assert.equal(downloads,1);assert.equal(generations,0);
 rows=[{innerText:'listing.xls 20 MB'}];await api.runFlipkartListingWorkflow();assert.equal(generations,1);
 rows=[{innerText:'listing.xls'}];await assert.rejects(api.runFlipkartListingWorkflow(),/does not expose/);assert.equal(generations,1,'unknown size must not cause generation');
 rows=[];await api.runFlipkartListingWorkflow();assert.equal(generations,2);
 let written=0,armed=0,run=0;api.set({writeSqlQueryToEditor:()=>{written++;return {};},armSqlSubmission:()=>armed++});
 context.document.querySelector=selector=>selector==='#refresh_play_button'?{click(){run++;}}:null;
 await api.runSqlExport();assert.equal(written,1);assert.equal(armed,1);assert.equal(run,1);assert.ok(stored.has('mwf-sql-export-after-refresh-v4'));
 // Verify the actual fresh-listing loop excludes completed pre-existing rows.
 assert.match(helper,/rows = rows\.filter\(row => flipkartListingKey\(row\) && !before\.has/);
 assert.match(helper,/selectVisibleOption\(dateRange,.*custom/);
 assert.doesNotMatch(helper,/if \(sqlHasResults\(\) && sqlResultsMatchExpected\(\)\)/);
 assert.match(helper,/!sqlQueryMatchesExpected\(\) \|\| !sqlResultsMatchExpected/);
 console.log('PASS helper: rolling dates, strict >20 MB threshold, fallback-only generation, unknown-size pause, SQL always runs before export, fresh-row and query guards.');
}
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.textContent='';this.listeners={};this.classList={add(){}};this.disabled=false;}
 append(...els){this.children.push(...els);}setAttribute(){}addEventListener(type,fn){this.listeners[type]=fn;}
}
async function controller(){
 const panel=new Element('section'),listeners={},tabs=[],outgoing=[],data=new Map();let tick;
 const docEvents={};
 const ctx={document:{documentElement:{getAttribute(){return null;}},addEventListener:(type,fn)=>docEvents[type]=fn,dispatchEvent(){},getElementById:()=>panel,createElement:tag=>new Element(tag)},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},URL,Date,crypto:{randomUUID:()=>String(Math.random()).slice(2)},location:{origin:'https://bharadwaja-l.github.io'},sessionStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},setInterval:fn=>{tick=fn;}};
 ctx.window={addEventListener:(type,fn)=>listeners[type]=fn,postMessage:message=>outgoing.push(message),open:url=>{tabs.push(url);return {opener:{}};}};
 vm.runInNewContext(fs.readFileSync(root+'js/modules/upload/marketplace-automation.js','utf8'),ctx);
 const all=panel.children.find(el=>el.tagName==='button' && el.textContent==='Set up helper to run reports');assert.equal(all.disabled,false);
 all.listeners.click();assert.equal(tabs.length,0,'missing helper must explain setup without launching portals');
 assert.equal(panel.children.find(el=>el.tagName==='details').open,true);
 const respond=(origin=ctx.location.origin,source=ctx.window,statuses=[])=>listeners.message({origin,source,data:{channel:'wakesuite-marketplace-helper-v1',type:'status',version:'2.2.0',runId:outgoing.at(-1).runId,statuses}});
 respond('https://evil.invalid');assert.equal(all.textContent,'Set up helper to run reports');respond(ctx.location.origin,{});assert.equal(all.textContent,'Set up helper to run reports');
 // Exercise the fallback independently of window.postMessage.
 docEvents['mwf-helper-status']({detail:JSON.stringify({channel:'wakesuite-marketplace-helper-v1',type:'status',version:'2.2.1',runId:'connection-check',statuses:[]})});
 assert.equal(all.textContent,'Run all daily reports');assert.equal(all.disabled,false);all.listeners.click();assert.equal(tabs.length,6);assert.equal(all.disabled,true);
 all.listeners.click();assert.equal(tabs.length,6,'pending tasks must not open duplicate tabs');
 tick();const id=outgoing.at(-1).runId;assert.ok(tabs.every(url=>new URL(url).searchParams.get('mwfRunId')===id));
 respond(ctx.location.origin,ctx.window,['inventory','asin','amazonOrders','flipkart','fkOrders','sql'].map(kind=>({kind,runId:id,phase:'finished',message:'Download control clicked',updatedAt:Date.now()+100})));
 assert.equal(all.disabled,false);
 const savedId=JSON.parse(data.get('ws-marketplace-trial-v1')).id;
 const sqlRow=panel.children.find(el=>el.tagName==='div' && el.className==='table-wrap').children[0].children[1].children.at(-1);
 sqlRow.children[3].children[0].listeners.click();
 const rerun=JSON.parse(data.get('ws-marketplace-trial-v1'));
 assert.equal(rerun.id,savedId);assert.equal(Object.keys(rerun.tasks).length,6,'individual reruns must retain earlier report status');
 console.log('PASS Data Center: helper handshake, foreign-message rejection, six tab launches, duplicate-run guard, shared run identity, terminal cleanup and retained individual-report status.');
}
test().then(controller).catch(error=>{console.error(error);process.exitCode=1;});
