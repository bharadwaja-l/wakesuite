const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const core=fs.readFileSync(__dirname+'/../js/wakesuite-app.js','utf8');
const definitions=core.slice(core.indexOf('const REPORT_DEFINITIONS ='),core.indexOf('/* ======================================================\n   FIRESTORE UPLOAD CONFIG'));
const receipts=new Map(),calls=[],dateControl={value:'2026-10-18',disabled:false};let processing=0,deny=false,fail=false,meta={status:'completed',fingerprint:'current'};
const context={console,setTimeout,crypto:webcrypto,TextEncoder,Uint8Array,Date,Map,Set,JSON,
 document:{getElementById:id=>id==='reportDate'?dateControl:null},
 localStorage:{getItem:key=>receipts.get(key),setItem:(key,value)=>receipts.set(key,value)},
 currentSessionDate:'2026-10-18',restoreSessionForDate:async date=>{context.currentSessionDate=date;},updateReadiness(){},
 canonicalHeader:value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,''),
 v7HasAction:()=>!deny,
 validateSelectedReport:()=>({valid:true}),
 readWakeSuiteFile:async file=>file.parsed,
 v936OrderCoverageFromRows:()=>({from:'2026-09-19',to:'2026-10-18'}),
 maybeAutoProcessCurrentDate:async()=>{processing++;},buildInputFingerprint:()=> 'current',
 window:{v8CanUploadType:()=>!deny,wakeSuiteFirebase:{auth:{currentUser:{uid:'trial-user'}}},wakeSuiteSessionReports:{},getDailySnapshotMeta:async()=>meta,
 uploadData:async request=>{calls.push(request);if(fail)throw Error('write failed');return {uploadId:'upload-'+calls.length,rowCount:request.parsedFile.rowCount};}}};
vm.createContext(context);vm.runInContext(definitions,context);
vm.runInContext(`globalThis.reportMatchesHeaders=(headers,def)=>({matches:def.requiredHeaders.every(key=>headers.map(canonicalHeader).includes(canonicalHeader(key)))});globalThis.uploadConfig=Object.values(REPORT_DEFINITIONS).map(def=>({id:def.id,menu:def.id==='wakefit_daily_pricing'?'Wakefit':'Amazon',folder:def.label}));globalThis.defs=REPORT_DEFINITIONS;`,context);
vm.runInContext(fs.readFileSync(__dirname+'/../js/modules/upload/download-import.js','utf8'),context);
const api=context.window.WakeSuiteDownloadImport;
function file(def,name='report.csv'){const parsed={headers:[...def.requiredHeaders],rowCount:3,rows:[{}],fileName:name};if(def.id==='amazon_order_report')parsed.headers.push('amazon-order-id','purchase-date');const bytes=new TextEncoder().encode(def.id+name);return {name,size:bytes.length,lastModified:123,arrayBuffer:async()=>bytes.buffer,parsed};}
(async()=>{
 assert.equal(api.identify(context.defs.flipkartListingFile.requiredHeaders).id,'flipkart_listing_file');
 assert.equal(api.identify(context.defs.flipkartOrderReport.requiredHeaders).id,'flipkart_order_report');
 assert.equal(api.identify(context.defs.marketplaceAuditReport.requiredHeaders),null);
 assert.equal(api.identify(['sku','price']),null,'sku alone must not classify an unrelated file as Orders');
 const files=[file(context.defs.amazonAllListings,'listings.txt'),file(context.defs.wakefitDailyPricing,'pricing.csv')];
 const items=await api.inspect(files);assert.equal(items.length,2);assert.equal(items.every(item=>item.selected),true);assert.match(items[0].digest,/^[a-f0-9]{64}$/);
 let result=await api.importItems(items,{reportDate:'2026-10-18'});assert.equal(result.results.length,2);assert.equal(calls[0].folder,context.defs.wakefitDailyPricing.label,'SQL pricing imports first');assert.equal(calls.every(call=>call.silent && call.deferProcessing),true);assert.equal(result.snapshot.saved,true);assert.equal(processing,1);assert.equal(dateControl.disabled,false);
 await api.importItems(items,{reportDate:'2026-10-18'});assert.equal(calls.length,2,'identical source/date/content must not register again');
 await api.importItems(items,{reportDate:'2026-10-19'});assert.equal(calls.length,4,'same source content on a different explicit report date remains importable');
 await assert.rejects(api.importItems([items[0],items[0]],{reportDate:'2026-10-18'}),/one file/);
 const business=await api.inspect([file(context.defs.amazonBusinessReports,'sales.csv')]);const before=calls.length;
 await assert.rejects(api.importItems(business,{reportDate:'2026-10-18',businessCoverage:{from:'2026-09-18',to:'2026-10-17'}}),/Confirm/);assert.equal(calls.length,before,'missing coverage confirmation must prevent all writes');
 await api.importItems(business,{reportDate:'2026-10-18',businessCoverage:{from:'2026-09-18',to:'2026-10-17'},confirmBusinessCoverage:true});assert.equal(calls.at(-1).coverage.from,'2026-09-18');
 deny=true;await assert.rejects(api.importItems(items,{reportDate:'2026-10-20'}),/does not allow/);deny=false;
 fail=true;meta=null;result=await api.importItems(items,{reportDate:'2026-10-20'});assert.equal(result.results.every(entry=>entry.error),true);assert.equal(dateControl.disabled,false);assert.equal(api.busy,false);
 fail=false;result=await api.importItems(items,{reportDate:'2026-10-20'});assert.equal(result.results.every(entry=>entry.result),true,'failed writes must remain retryable');assert.equal(result.snapshot.saved,false,'metadata import must not claim cloud snapshot success');
 const fkFiles=await api.inspect([file(context.defs.flipkartListingFile,'listing.xlsx'),file(context.defs.flipkartOrderReport,'orders.xlsx')]);
 assert.equal(fkFiles.every(item=>item.selected),true);assert.equal(fkFiles[1].coverage.from,'2026-09-19');
 const fkStart=calls.length,fkResult=await api.importItems(fkFiles,{reportDate:'2026-10-21'});
 assert.equal(fkResult.results.every(entry=>entry.result),true);assert.equal(calls.length,fkStart+2);assert.equal(calls.at(-1).coverage.from,'','order coverage must be derived from the file rather than ASIN sales controls');
 await api.importItems(fkFiles,{reportDate:'2026-10-21'});assert.equal(calls.length,fkStart+2,'Flipkart duplicates must be skipped');
 console.log('PASS batch import: Amazon/Flipkart/SQL detection, audit exclusion, SHA dedupe, date isolation, coverage confirmation, source ordering, one processing pass, permissions, retry and honest cloud status.');
 // Exercise the real core upload function with no selected manual file.
 const start=core.indexOf('async function uploadData(importRequest');const end=core.indexOf('/* ======================================================\n   SHARED WAKEFIT PRICING',start);
 const base=core.slice(start,end);let writes=0,valid=true;
 const elements={uploadButton:{disabled:false},reportDate:{value:''},menu:{value:''},folder:{value:''},file:{files:[]}};
 const ctx={console:{error(){}},document:{getElementById:id=>elements[id]||null},hideBusinessReportSummary(){},v7HasAction:()=>true,getSelectedConfig:()=>({id:'wakefit_daily_pricing'}),REPORT_DEFINITIONS:context.defs,
 readWakeSuiteFile:async()=>{throw Error('preparsed file should be reused');},validateSelectedReport:()=>({valid,detectedLabel:'SQL',detectedId:'wakefit_daily_pricing',missingHeaders:[],message:'invalid schema'}),showParsedFileInfo(){},v936ResolveUploadCoverage:async()=>null,
 setUploadStatus(){},updateReadiness(){},formatNumber:String,alert:()=>{throw Error('batch import should not display modal alerts');},window:{v8CanUploadType:()=>true,wakeSuiteSessionReports:{},saveUploadMetadata:async()=>{writes++;return 'receipt';}}};
 vm.createContext(ctx);vm.runInContext(base,ctx);
 const request={silent:true,reportDate:'2026-10-18',menu:'Wakefit',folder:'Pricing',file:{name:'pricing.csv',size:1,lastModified:1},parsedFile:{headers:context.defs.wakefitDailyPricing.requiredHeaders,rowCount:1,rows:[{}]}};
 const saved=await ctx.uploadData(request);assert.equal(saved.uploadId,'receipt');assert.equal(writes,1);assert.equal(elements.uploadButton.disabled,false);
 valid=false;await assert.rejects(ctx.uploadData(request),/invalid schema/);assert.equal(writes,1,'failed validation must not save metadata');
 valid=true;let notices=0;ctx.alert=()=>{notices++;};ctx.readWakeSuiteFile=async()=>request.parsedFile;
 elements.reportDate.value=request.reportDate;elements.menu.value=request.menu;elements.folder.value=request.folder;elements.file.files=[request.file];
 await ctx.uploadData();assert.equal(notices,1,'manual imports retain their success alert');assert.equal(writes,2);
 console.log('PASS existing uploader integration: explicit file/date config, parser reuse, upload receipt return, modal-free batch and zero writes on schema failure.');
 const processStart=core.lastIndexOf('async function maybeAutoProcessCurrentDate(){');
 const processEnd=core.indexOf('/* ======================================================\n   DASHBOARD VISUALIZATION',processStart);
 let snapshots=0;
 const processCtx={console,Date,performance:{now:()=>0},processingLock:false,FINAL_REQUIRED_REPORTS:[],snapshotCache:new Map(),
 getSelectedReportDate:()=> '2026-10-18',v4SourceAvailability:()=>({wakefit:true,amazonListings:true,flipkartListing:false}),buildInputFingerprint:()=> 'amazon-only',
 setProcessingState(){},setUploadStatus(){},v4WouldDowngradeSnapshot:()=>false,
 buildAmazonModularResult:()=>({summary:{}}),buildFlipkartModularResult:()=>{throw Error('Flipkart must not run');},v4ReportForDate:()=>null,
 makePersistedSnapshot:(date,fingerprint,amazon,flipkart)=>{assert.ok(amazon);assert.equal(flipkart,null);return {reportDate:date,fingerprint};},hydrateSnapshot(){},v4SourceCount:()=>2,finalSetText(){},refreshRevenueFreshnessUi(){},updateReadiness(){},
 window:{currentWakeSuiteAccess:{permissions:{upload:true}},masterPricingAmazon:{},masterPricingFlipkart:null,getDailySnapshotMeta:async()=>null,saveDailySnapshot:async()=>{snapshots++;return {revision:1};}}};
 vm.createContext(processCtx);vm.runInContext(core.slice(processStart,processEnd),processCtx);await processCtx.maybeAutoProcessCurrentDate();assert.equal(snapshots,1,'Amazon snapshot must not require Flipkart mapping or reports');assert.equal(processCtx.processingLock,false);
 console.log('PASS independent Amazon processing: Amazon snapshot saves with no Flipkart mapping/report; Flipkart processor is not invoked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
