const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../js/modules/upload/live-audit.js','utf8');
const headers=['ASIN','FSN','amazon_has_supersede_issue','amazon_selling_price','amazon_buy_now_present','amazon_edd','amazon_deliver_to','flipkart_selling_price','flipkart_buy_now_present','amazon_timestamp'];
let uploads=0,processed=0,allow=true;const date={value:'2026-10-19',disabled:false},button={disabled:false};
const ctx={console,Date,Map,Set,File,canonicalHeader:v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,''),document:{getElementById:id=>id==='reportDate'?date:id==='uploadButton'?button:null},v7HasAction:()=>allow,processingLock:false,currentSessionDate:'2026-10-19',uploadConfig:[{id:'marketplace_audit_report',menu:'Audit',folder:'Amazon + Flipkart Audit Report'}],restoreSessionForDate:async()=>{},maybeAutoProcessCurrentDate:async()=>{processed++},buildInputFingerprint:()=> 'fp',updateReadiness(){},window:{v8CanUploadType:()=>true,wakeSuiteSessionReports:{},uploadData:async opts=>{uploads++;assert.equal(opts.menu,'Audit');assert.equal(opts.deferProcessing,true);assert.equal(opts.file.type,'text/csv');return {uploadId:'receipt'}},getDailySnapshotMeta:async()=>({status:'completed',fingerprint:'fp'})}};
vm.createContext(ctx);vm.runInContext(code,ctx);const api=ctx.window.WakeSuiteLiveAudit;
const input=[headers,['A','F','False','100','True','','','','','2026-10-19 08:00:00'],['B','G','','','','','','200','True',''],['C','H']];
(async()=>{
 const p=api.prepare(input,'2026-10-19');assert.equal(p.amazon,1);assert.equal(p.flipkart,1);assert.equal(p.unfilled,1);assert.equal(p.rowCount,2);assert.equal(p.rows[0].FSN,'');assert.equal(p.rows[1].ASIN,'');
 assert.throws(()=>api.prepare([headers,['A','F','False','','False','','','','','2026-10-18 08:00:00']],'2026-10-19'),/timestamps/);
 assert.throws(()=>api.prepare([headers,['A','F']],'2026-10-19'),/No scraped/);
 assert.throws(()=>api.prepare([['ASIN'],['A']],'2026-10-19'),/missing/);
 await assert.rejects(api.save(p,false),/Confirm/);assert.equal(uploads,0);
 const result=await api.save(p,true);assert.match(result,/Firestore snapshot verified/);assert.equal(uploads,1);assert.equal(processed,1);assert.equal(date.disabled,false);assert.equal(button.disabled,false);
 allow=false;await assert.rejects(api.save(p,true),/cannot upload/);assert.equal(uploads,1);
 console.log('PASS source headers, current scrape date, input-only exclusion, unscripted marketplace isolation, confirmation, permissions, CSV upload, one processing pass and cloud receipt.');
})().catch(e=>{console.error(e);process.exitCode=1;});