const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),cp=require('child_process'),http=require('http');
const deps='C:/Users/bharadwaja.l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(deps+'/playwright'),JSZip=require(deps+'/jszip');
const root=path.resolve('work/release/WakeSuite'),results=[];
function ok(name){results.push(name);console.log('PASS '+name);}
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
(async()=>{
 for(const p of walk(root).filter(p=>p.endsWith('.js'))){const r=cp.spawnSync(process.execPath,['--check',p],{encoding:'utf8'});assert.equal(r.status,0,p+': '+r.stderr);}ok('All JavaScript syntax checks');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,url] of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g))assert(fs.existsSync(path.join(root,url)),url);ok('All local index asset links');
 for(const p of walk(path.join(root,'assets'))){const relative=path.relative(root,p);assert.equal(fs.readFileSync(p).compare(fs.readFileSync(path.join('work/base/wakesuite_v9311',relative))),0,relative);}assert.equal(fs.readFileSync(path.join(root,'js/wakesuite-v9.3.7.js')).compare(fs.readFileSync('work/base/wakesuite_v9311/js/wakesuite-v9.3.7.js')),0);ok('APT implementation and all bundled templates/assets preserved byte-for-byte');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage();await page.setContent('<div id="flipkartCategoryPocSettings"></div><input id="communicationsDate" value="2026-10-07"><table id="reportModuleTable"></table>');
 await page.addScriptTag({path:deps+'/jszip/dist/jszip.min.js'});
 await page.evaluate(()=>{
   window.escapeHtml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
   window.v7CommunicationsState=null;window.v7OperationalControls={amazonPoc:{name:'Amazon POC',email:'az@example.test'},flipkartPocByCategory:{Accessories:{name:'Accessories POC',to:'acc@example.test',cc:'acc-cc@example.test'},'Office Chairs':{name:'Chairs POC',to:'chairs@example.test'}},internalMarketplaceRecipients:'team@example.test'};
   window.todayIso=()=> '2026-10-07';window.v7HasAction=()=>true;window.v7Unique=a=>[...new Set(a.filter(Boolean))];window.v7SplitEmails=v=>String(v||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
   window.v7IssueKey=(m,t,id)=>`${m}|${t}|${id}`;window.snapshotCache=new Map();window.loadSnapshotCached=async d=>({reportDate:d});window.getSnapshotAmazonRows=s=>s?.amazonRows||[];
   window.renderHistoricalTable=()=>{};window.v4EmailIssueRows=r=>r.rows;window.loadEmailState=()=>({signature:'Regards,\nWakeSuite',templates:{}});window.currentHistoricalReport=null;
   window.reportFilename=(p,k,f,t)=>`${p}_${f}_to_${t}.xlsx`;window.v4FormatEmailDate=(f,t)=>`${f} to ${t}`;window.v4ReplaceEmailVars=v=>v;window.v4EmailVariableContext=()=>({});
   window.sendDailyCommunication=()=>{};window.renderDailyCommunications=()=>{};window.showWakeSuiteToast=(...x)=>window.toasts.push(x);window.toasts=[];
   window.XLSX={utils:{book_new:()=>({SheetNames:[],Sheets:{}}),book_append_sheet:(wb,ws,n)=>{wb.SheetNames.push(n);wb.Sheets[n]=ws;},json_to_sheet:(rows,opts)=>({rows,headers:opts?.header}),aoa_to_sheet:rows=>({rows}),encode_cell:({r,c})=>`${r}:${c}`,decode_range:()=>({s:{r:0,c:0},e:{r:0,c:0}})},write:wb=>new TextEncoder().encode(JSON.stringify(wb)),writeFile:(wb,name)=>{window.download={wb,name};}};
 });
 await page.addScriptTag({path:path.join(root,'js/wakesuite-v9.3.11.js')});await page.addScriptTag({path:path.join(root,'js/modules/communications/release-contract.js')});
 const first=await page.evaluate(()=>{
  const a=WakeSuiteV9311,r=WakeSuiteRelease;
  const row={category:'Accessories',asin:'A1',azSku:'SELLER',wfSku:'WF',wfPrice:500,finalLivePrice:700,liveDailyRevenueImpact:123.7,issueType:'Live Price Disparity'};
  v7CommunicationsState={amazon:{newRows:[row],follow:[{...row,asin:'A2'}]}};
  return {keys:a.amazonLiveWorkbook([row]).Sheets.Temp_Export_Values_Only.headers,resend:a.issueRows('poc','amazon').map(x=>x.asin),first:r.stampMessage({subject:'S',attachments:[{name:'x.xlsx'}]},1,'01:35 PM'),second:r.stampMessage({subject:'S'},2,'01:35 PM'),link:a.suppressionInlineTable([{asin:'A1',category:'Accessories',revenueImpactPerDay:23.8,poaDriveUrl:'https://example.test/poa'}]),buy:r.buyBoxRows([{asin:'A1',wfSku:'WF',listingPrice:900,revenueImpactPerDay:100}], [{amazonRows:[{asin:'A1',wfSku:'WF',wfPrice:500}]}])[0]};
 });assert.deepEqual(first.keys,['Category','Seller sku','ASIN','Price']);assert.deepEqual(first.resend,['A1','A2']);assert.equal(first.first.subject,'S | 01:35 PM');assert.equal(first.first.attachments[0].name,'x_01-35-PM.xlsx');assert.equal(first.second.subject,'S | Escalation - 2 | 01:35 PM');assert(first.link.includes('>A1</a>')&&!first.link.includes('A1.docx'));assert.equal(first.buy.wfPrice,500);ok('POC columns, resend rows, numbering, timestamps, ASIN link labels and WF Price mapping');
 const reportResult=await page.evaluate(async()=>{
  document.getElementById('reportModuleTable').innerHTML='<thead><tr><th>Category</th><th>ASIN</th><th>Rev Impact / Day</th><th>Action</th><th style="display:none">Hidden</th></tr></thead><tbody><tr><td>Accessories</td><td>A1</td><td>₹124</td><td><button>Override</button></td><td>secret</td></tr></tbody>';
  const report={def:{marketplace:'amazon',title:'ASIN Suppression'},rows:[{asin:'A1'}],fromDate:'2026-10-07',toDate:'2026-10-07'};
  const pkg=await WakeSuiteRelease.prepareReportPackage(report,'amazon_suppression');
  const fk=await WakeSuiteRelease.prepareReportPackage({...report,def:{marketplace:'flipkart',title:'Flipkart Live'},rows:[{fsn:'F1'}]},'flipkart_live');
  return {data:WakeSuiteRelease.visibleReportData(),html:pkg.html,attachments:pkg.attachments.length,fk:fk.attachments.length};
 });assert.deepEqual(reportResult.data,{headers:['Category','ASIN','Rev Impact / Day'],rows:[['Accessories','A1','₹124']]});assert(!reportResult.html.includes('POA Link')&&!reportResult.html.includes('Escalated On'));assert.equal(reportResult.fk,0);ok('Normal report exports/share mirror visible columns and values, exclude actions/hidden columns, FK inline without attachment');
 const daily=await page.evaluate(()=>{
   const state={snapshot:{amazonRows:[]},date:'2026-10-07',issues:{internal:{amazonLive:[{asin:'A',category:'Mattress',liveDailyRevenueImpact:10.5}],amazonSupp:[],amazonBuy:[],flipkartLive:[{fsn:'F',category:'Accessories',liveDailyRevenueImpact:null,revenueAvailable:false}]}}};
   const wb=WakeSuiteRelease.internalWorkbook(state);return {sheets:wb.SheetNames,html:WakeSuiteRelease.internalHtml(state)};
 });assert.deepEqual(daily.sheets,['Summary','AZ Live Price','AZ ASIN Suppression','AZ Buy Box Suppression','FK Live Price']);assert(daily.html.includes('Hi Team,')&&daily.html.includes('Total Marketplace Impact')&&daily.html.includes('Revenue Data Unavailable'));ok('Daily email/Excel summary, four detail tabs, unavailable FK revenue preserved');
 // Validate replacement against all actual DOCX masters using browser XML APIs.
 const configs=await page.evaluate(()=>WakeSuiteV9311.POA_CONFIG.templates);
 for(const [cat,cfg] of Object.entries(configs)){
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(root,cfg.asset)));
  let asinCount=0,titleCount=0;
  for(const name of Object.keys(zip.files).filter(n=>/^word\/.+\.xml$/i.test(n))){const xml=await zip.file(name).async('string');const replaced=await page.evaluate(({xml,cfg})=>WakeSuiteV9311.replaceWordText(xml,[[cfg.sampleAsin,'B0TEST1234'],[cfg.sampleTitle,'New Product & Title']]),{xml,cfg});asinCount+=replaced.counts[0];titleCount+=replaced.counts[1];assert(!replaced.xml.includes(cfg.sampleAsin));}
  assert(asinCount>0&&titleCount>0,`${cat}: replacements ${asinCount}/${titleCount}`);
 }ok('All four actual POA templates: global ASIN and split-run title replacement');
 // Mocked send integration: live APIs never receive messages.
 const sending=await page.evaluate(async()=>{
  window.logs=[];window.deliveries=[];window.records=[];
  const live={category:'Accessories',asin:'A1',productId:'A1',issueType:'Live Price Disparity',marketplace:'amazon',azSku:'SELLER',finalLivePrice:700,liveDailyRevenueImpact:124};
  const fk={category:'Accessories',fsn:'F1',productId:'F1',issueType:'Live Price Disparity',marketplace:'flipkart',wfSku:'WF1',wfPrice:500,finalLivePrice:700,livePriceDiff:200};
  window.currentRows=[live];window.loadDailyCommunications=async()=>{v7CommunicationsState={date:'2026-10-07',snapshot:{amazonRows:[]},issues:{internal:{}},amazon:{newRows:currentRows.filter(r=>r.asin==='A1'),follow:currentRows.filter(r=>r.asin!=='A1')},flipkart:{newRows:[fk,{...fk,category:'Office Chairs',fsn:'F2',productId:'F2'}],follow:[]},logs:logs};};
  WakeSuiteV9311.gmailDeliver=async message=>{deliveries.push(message);return {id:'mock-'+deliveries.length}};
  window.saveCommunicationLog=async l=>logs.push(l);window.recordPocEscalations=async r=>records.push(r);
  await WakeSuiteRelease.sendCommunication('poc','amazon','Live Price Disparity');
  currentRows=[{...live,asin:'A2',productId:'A2'}];
  await WakeSuiteRelease.sendCommunication('poc','amazon','Live Price Disparity');
  await WakeSuiteRelease.sendCommunication('poc','flipkart','Live Price Disparity');
  return {subjects:deliveries.map(x=>x.subject),to:deliveries.map(x=>x.to),cc:deliveries.map(x=>x.cc),logs,records:records.map(r=>r.map(x=>x.productId)),attachments:deliveries.slice(2).map(x=>x.attachments.length)};
 });assert.equal(sending.subjects.length,4);assert(!sending.subjects[0].includes('Escalation -'));assert(sending.subjects[1].includes('Escalation - 2'));assert.deepEqual(sending.records[1],['A2']);assert.deepEqual(sending.to[2],['acc@example.test']);assert.deepEqual(sending.to[3],['chairs@example.test']);assert.deepEqual(sending.cc[2],['acc-cc@example.test']);assert.deepEqual(sending.attachments,[1,1]);ok('Mocked sends refresh unresolved rows, log each escalation and split Flipkart category To/CC/attachments');
 const drive=await page.evaluate(async()=>{
   const calls=[];window.GOOGLE_SHEETS_CLIENT_ID='test';window.google={accounts:{oauth2:{initTokenClient:cfg=>({requestAccessToken:()=>cfg.callback({access_token:'test-token',expires_in:3600})})}}};
   window.fetch=async(url,options={})=>{calls.push({url:String(url),body:options.body});let data={};if(String(url).includes('/about?'))data={user:{permissionId:'authorized-account',emailAddress:'authorized@example.test'}};else if(options.method==='POST')data={id:'created-'+JSON.parse(options.body).name};else data={files:[]};return {ok:true,json:async()=>data};};
   const first=await WakeSuiteV9311.ensureDriveFolders('Accessories');const second=await WakeSuiteV9311.ensureDriveFolders('Accessories');
   window.loadSuppressionCases=async()=>[{id:'old',asin:'STALE',firstDetected:'2026-09-01',status:'Detected',poaDriveUrl:'https://example.test/old'},{id:'previous',asin:'CURRENT',firstDetected:'2026-09-01',resolvedOn:'2026-10-01',status:'Closed',poaDriveUrl:'https://example.test/previous'},{id:'new',asin:'CURRENT',firstDetected:'2026-10-07',status:'Detected',poaDriveUrl:'https://example.test/current'}];
   const rows=await WakeSuiteV9311.ensureSuppressionPoaLinks([{asin:'CURRENT',issueType:'ASIN Suppression'}],'2026-10-07');
   return {first,second,created:calls.filter(c=>c.body).map(c=>JSON.parse(c.body)),rows};
 });assert.equal(drive.first,drive.second);assert.deepEqual(drive.created.map(c=>c.name),['WakeSuite POA Library','Mattress','Furniture','Accessories','Office Chairs']);assert(drive.created.slice(1).every(c=>c.parents[0]==='created-WakeSuite POA Library'));assert.equal(drive.rows.length,1);assert.equal(drive.rows[0].caseId,'new');assert.equal(drive.rows[0].poaDriveUrl,'https://example.test/current');ok('Mocked Drive account-owned root/category discovery and reuse; stale/resolved suppression occurrences excluded');
 const failures=await page.evaluate(async()=>{
   const prior=deliveries.length;v7OperationalControls.flipkartPocByCategory.Accessories.to='';await WakeSuiteRelease.sendCommunication('poc','flipkart','Live Price Disparity');
   const routingBlocked=deliveries.length===prior;
   currentRows=[{asin:'BUY',productId:'BUY',category:'Accessories',issueType:'Buy Box Suppression',wfSku:'WF',wfPrice:500}];
   window.WakeSuiteBuyBoxApt={buildAptWorkbook:async()=>{throw new Error('APT failed')}};
   await WakeSuiteRelease.sendCommunication('poc','amazon','Buy Box Suppression');
   const aptBlocked=deliveries.length===prior;
   let invalid=false;try{await WakeSuiteRelease.prepareReportPackage({def:{marketplace:'amazon',title:'Live'},rows:[{category:'Accessories'}]},'amazon_live')}catch(e){invalid=true;}
   const oldSnapshot=loadSnapshotCached;let requests=0;window.snapshotCache.clear();
   return {routingBlocked,aptBlocked,invalid};
 });assert(failures.routingBlocked&&failures.aptBlocked&&failures.invalid);ok('Missing category route, failed mandatory APT and unresolved identifiers block sends');
 // Load the full app with Google/Firebase calls disabled, not an isolated contract alone.
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const full=await browser.newPage();const errors=[];full.on('pageerror',e=>errors.push(e.message));
 await full.addInitScript(()=>{window.XLSX={utils:{},write:()=>new ArrayBuffer(0),writeFile:()=>{}};});
 await full.route('**/*',async route=>{const url=route.request().url();if(url.includes('wakesuite-firebase.js'))return route.fulfill({contentType:'application/javascript',body:''});if(!url.startsWith('http://127.0.0.1:'))return route.fulfill({contentType:'application/javascript',body:''});return route.continue();});
 await full.goto(`http://127.0.0.1:${server.address().port}/index.html`);await full.waitForTimeout(250);
 const runtime=await full.evaluate(()=>({contract:!!window.WakeSuiteRelease,settings:typeof saveOperationalControls,share:typeof openShareEmailModal,send:typeof sendDailyCommunication,impact:formatRevenueImpact(123.7)}));
 assert(runtime.contract,'Release contract loaded: '+errors.join('; '));assert.equal(runtime.impact,'₹124');assert.deepEqual(errors,[]);ok('Full app startup smoke test with live integrations disabled');
 await full.close();await new Promise(r=>server.close(r));
 await browser.close();
 fs.writeFileSync('work/validation-results.json',JSON.stringify({passed:results,liveGoogleFirebaseTested:false},null,2));
})().catch(e=>{console.error(e.stack);process.exit(1);});
