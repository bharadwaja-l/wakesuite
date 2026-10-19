const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=fs.readFileSync(__dirname+'/../js/wakesuite-app.js','utf8');
const start=core.indexOf('async function uploadData(importRequest'),end=core.indexOf('/* ======================================================\n   SHARED WAKEFIT PRICING',start);
const prior={reportDate:'2026-10-19',uploadId:'old',parsedFile:{rows:[{old:true}]}};
let rejectWrite=true,notices=0,persisted=0;
const controls={uploadButton:{disabled:false},reportDate:{value:'2026-10-19'},menu:{value:'Wakefit'},folder:{value:'Pricing'},file:{files:[{name:'new.csv',size:10,lastModified:1}]}};
const ctx={console:{error(){}},document:{getElementById:id=>controls[id]},hideBusinessReportSummary(){},v7HasAction:()=>true,getSelectedConfig:()=>({id:'wakefit_daily_pricing'}),REPORT_DEFINITIONS:{},readWakeSuiteFile:async()=>({headers:['sku'],rows:[{new:true}],rowCount:1}),
 validateSelectedReport:()=>({valid:true,detectedLabel:'SQL',detectedId:'wakefit_daily_pricing'}),showParsedFileInfo(){},v936ResolveUploadCoverage:async()=>null,setUploadStatus(){},updateReadiness(){},formatNumber:String,alert:()=>notices++,
 window:{v8CanUploadType:()=>true,wakeSuiteSessionReports:{wakefit_daily_pricing:prior},saveUploadMetadata:async()=>{if(rejectWrite)throw Error('Mock registration failure');return 'new';}}};
vm.createContext(ctx);vm.runInContext(core.slice(start,end),ctx);
(async()=>{
 await ctx.uploadData();assert.equal(ctx.window.wakeSuiteSessionReports.wakefit_daily_pricing,prior,'failed registration must not replace existing source');
 const batch={silent:true,reportDate:'2026-10-19',menu:'Wakefit',folder:'Pricing',file:controls.file.files[0],parsedFile:{headers:['sku'],rows:[{}],rowCount:1}};
 await assert.rejects(ctx.uploadData(batch),/Mock registration failure/);assert.equal(ctx.window.wakeSuiteSessionReports.wakefit_daily_pricing,prior);
 rejectWrite=false;const result=await ctx.uploadData(batch);assert.equal(result.uploadId,'new');assert.equal(ctx.window.wakeSuiteSessionReports.wakefit_daily_pricing.uploadId,'new');
 // Both real wrappers must require a successful receipt before caching a file.
 const wrapperStart=core.indexOf('const coreUploadData = uploadData;'),wrapperEnd=core.indexOf('\n};',wrapperStart)+4;
 const outerStart=core.indexOf('const v8BaseUploadData=uploadData;'),outerEnd=core.indexOf('\n\n',outerStart);
 const wrap={...ctx,currentSessionDate:'2026-10-19',uploadData:async()=>undefined,persistCurrentUploadedReport:async()=>persisted++,maybeAutoProcessCurrentDate:async()=>{},v8PersistUploadVersion:async()=>{persisted++;return 'version';},showWakeSuiteToast(){}};
 vm.createContext(wrap);vm.runInContext(core.slice(wrapperStart,wrapperEnd)+'\n'+core.slice(outerStart,outerEnd),wrap);await wrap.uploadData();assert.equal(persisted,0,'failed upload must not cache new bytes under old source metadata');
 console.log('PASS failed/manual/batch registration preserves prior source; success commits session; both cache wrappers require a successful receipt.');
})().catch(e=>{console.error(e);process.exitCode=1;});
