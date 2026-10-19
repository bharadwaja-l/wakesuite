/* Live Sheet status and on-demand input updates. No paid backend is called. */
(() => {
 'use strict';
 const spreadsheetId='1KeVVOLASOsHO5Efgf4IVsNWDLD3X1SqsivExGbJ1Bms',tab='master_final_with_flipkart',tabId=743318554;
 const host=document.getElementById('liveConnectionsPanel');if(!host)return;
 if(typeof FINAL_VIEW_TITLES!=='undefined')FINAL_VIEW_TITLES.masterPricingSection='Live Data Connections';
 let busy=false,writeToken='',expires=0,live=null,eligible=null,page=0;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const status=el('p','Connect Google Sheets using the Master Pricing button, then Refresh status.');status.setAttribute('role','status');
 host.append(el('h2','URL scraping sheet'));
 const link=el('a','Open live URL scraping sheet');link.href='https://docs.google.com/spreadsheets/d/'+spreadsheetId+'/edit#gid='+tabId;link.target='_blank';link.rel='noopener';host.append(link);
 const controls=el('div');controls.className='connections-controls';
 const refresh=el('button','Refresh status'),preview=el('button','Preview latest inputs'),manual=el('button','Manual Update');for(const b of [refresh,preview,manual]){b.type='button';b.className='secondary-btn';controls.append(b);}
 host.append(controls,status);
 const stats=el('p'),sync=el('p','Background 6:30 PM sync is not configured. Manual Update works while this page is open; no paid service is activated.');
 host.append(stats,sync);
 const source=el('p');host.append(source);
 const inputTable=el('table');inputTable.className='result-table';host.append(inputTable);
 const title=el('h3','Live sheet data');host.append(title);
 const pager=el('div'),prev=el('button','Previous'),next=el('button','Next'),pageLabel=el('span');prev.type=next.type='button';pager.append(prev,pageLabel,next);host.append(pager);
 const scroll=el('div');scroll.style.overflowX='auto';const table=el('table');table.className='result-table';scroll.append(table);host.append(scroll);
 function token(){return Date.now()<expires?writeToken:(typeof sheetsAccessToken==='undefined'?'':sheetsAccessToken);}
 function authorization(){
  if(Date.now()<expires)return Promise.resolve(writeToken);
  if(!window.google?.accounts?.oauth2)throw Error('Google authorization is still loading.');
  return new Promise((resolve,reject)=>{
   const client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_SHEETS_CLIENT_ID,scope:'https://www.googleapis.com/auth/spreadsheets',include_granted_scopes:true,
    callback:r=>{if(r.error||!r.access_token){reject(Error(r.error_description||r.error||'No Google token returned.'));return;}writeToken=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in||3600)-60)*1000;resolve(writeToken);},
    error_callback:r=>reject(Error(r.message||'Google authorization was closed or blocked.'))});
   client.requestAccessToken({prompt:''});
  });
 }
 async function api(path,options={}){
  const accessToken=token();if(!accessToken)throw Error('Connect Master Pricing / Google Sheets first with the work account that can access the URL sheet.');
  const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+spreadsheetId+path,{...options,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',...options.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401){writeToken='';expires=0;}throw Error(body.error?.message||'Google Sheets request failed. Reconnect the correct Google account.');}
  return body;
 }
 async function readLive(formulas=false){
  const meta=await api('?fields=sheets(properties(sheetId,title,gridProperties)),developerMetadata');
  const sheet=meta.sheets?.find(s=>s.properties.sheetId===tabId)?.properties;
  if(!sheet||sheet.title!==tab)throw Error('The configured audit tab changed.');
  const count=sheet.gridProperties.rowCount;if(count>50000)throw Error('The live sheet exceeds this connector’s 50,000-row limit.');
  const result=await api('/values/'+encodeURIComponent("'"+tab+"'!A1:AK"+count)+'?valueRenderOption='+(formulas?'FORMULA':'UNFORMATTED_VALUE'));
  return {sheet,meta,values:result.values||[],checkedAt:new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})};
 }
 function showLive(){
  const values=live.values,headers=values[0]||[],index=k=>headers.indexOf(k),val=(r,k)=>String(r[index(k)]??'').trim();
  const rows=values.slice(1).filter(r=>val(r,'WF Item SKU')||val(r,'ASIN')||val(r,'FSN'));
  const unique=k=>new Set(rows.map(r=>val(r,k)).filter(Boolean)).size;
  const az=rows.filter(r=>val(r,'amazon_timestamp')).length,fk=rows.filter(r=>val(r,'flipkart_selling_price')||val(r,'flipkart_buy_now_present')).length;
  const missing=rows.filter(r=>!(Number(r[index('WF Price')])>0)).length;
  const times=rows.map(r=>val(r,'amazon_timestamp')).filter(Boolean).sort();
  stats.textContent=rows.length+' input rows · '+unique('WF Item SKU')+' WF SKUs · '+unique('ASIN')+' ASINs · '+unique('FSN')+' FSNs · '+missing+' rows missing WF Price · '+az+' timestamped scrape rows · '+fk+' Flipkart result rows · latest shared scrape timestamp: '+(times.at(-1)||'Not available')+' · checked '+live.checkedAt+' IST.';
  const receipt=(live.meta.developerMetadata||[]).find(m=>m.metadataKey==='wakesuite_eod_sync');
  if(receipt){try{const r=JSON.parse(receipt.metadataValue);sync.textContent='Last input sync: '+r.completedAt+' · '+r.rows+' rows · Wakesuite source '+r.sourceReportDate+'. Schedule status is only verified by the background workflow, not by a prior success receipt.';}catch{sync.textContent='Input sync receipt could not be read.';}}
  table.replaceChildren();const head=el('tr');headers.forEach(h=>head.append(el('th',String(h))));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
  const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(page,pages-1);
  rows.slice(page*50,(page+1)*50).forEach(r=>{const tr=el('tr');headers.forEach((h,i)=>tr.append(el('td',r[i]===undefined||r[i]===''?'Not available':String(r[i]))));body.append(tr);});table.append(body);
  pageLabel.textContent=' Page '+(page+1)+' / '+pages+' ';prev.disabled=page===0;next.disabled=page>=pages-1;
 }
 function assertWriter(){
  if(typeof v7HasAction!=='function'||!v7HasAction('upload'))throw Error('Upload permission is required to update scraper inputs.');
  const scopes=v7CurrentScopes();if(!scopes.allData||!scopes.categories.includes('*')||!['amazon','flipkart'].every(m=>scopes.marketplaces.includes(m)))throw Error('Full marketplace/category access is required to replace shared scraper inputs.');
 }
 async function latestInputs(){
  assertWriter();
  const metas=await window.listDailySnapshotMetas(),today=todayIso();
  const meta=metas.filter(m=>m.status==='completed'&&(m.reportDate||m.id)<=today).sort((a,b)=>String(b.reportDate||b.id).localeCompare(String(a.reportDate||a.id)))[0];
  if(!meta)throw Error('No completed Wakesuite data is available.');
  if(!meta.sourceAvailability?.wakefit)throw Error('Latest saved data has no Wakefit pricing source. Inputs were not changed.');
  const date=meta.reportDate||meta.id,snapshot=await window.loadDailySnapshot(date);if(!snapshot)throw Error('Latest saved data could not be loaded.');
  return {...window.WakeSuiteInputPlan.eligibleInputs(snapshot),sourceReportDate:date,fingerprint:meta.fingerprint,revision:meta.revision};
 }
 function showInputs(){
  inputTable.replaceChildren();if(!eligible)return;
  const s=eligible.skipped;source.textContent='Latest saved Wakesuite data: '+eligible.sourceReportDate+' · '+eligible.rows.length+' eligible inputs · skipped '+s.missingPrice+' missing price/MRP, '+s.outOfStock+' out-of-stock/inactive, '+s.conflictingPrice+' conflicting-price SKUs. Missing ASIN/FSN displays as Not available and is written as a blank for the scraper.';
  const head=el('tr');['WF SKU','ASIN','FSN','WF Price','WF MRP','Category','Amazon revenue (WF SKU)'].forEach(h=>head.append(el('th',h)));inputTable.append(head);
  eligible.rows.slice(0,100).forEach((r,i)=>{const tr=el('tr');[r[3],r[1]||'Not available',r[2]||'Not available',r[4],r[5],r[0],eligible.revenues[i]===null?'Not available':eligible.revenues[i]].forEach(v=>tr.append(el('td',String(v))));inputTable.append(tr);});
  source.textContent+=' Sorted by unique-ASIN Amazon revenue per WF SKU, highest first; missing revenue last. First '+Math.min(100,eligible.rows.length)+' eligible inputs shown; Manual Update writes all '+eligible.rows.length+'.';
 }
 async function backupInputs(values){
  if(typeof v8PersistUploadVersion!=='function')throw Error('Local input backup is not available; no Sheet update started.');
  const file=new File([JSON.stringify({spreadsheetId,tab,readAt:new Date().toISOString(),values})],'URL_Inputs_Backup_'+todayIso()+'.json',{type:'application/json'});
  const id=await v8PersistUploadVersion(todayIso(),'url_scraping_input_backup',file,{parsedFile:{rowCount:Math.max(0,values.length-1)}});
  if(!id)throw Error('Local backup could not be verified; no Sheet update started.');
 }
 async function update(){
  assertWriter();
  // Start OAuth during the button click, before any awaited network read.
  await authorization();
  eligible=await latestInputs();showInputs();
  const current=await readLive(true),plan=window.WakeSuiteInputPlan.planInputUpdates(current.values,eligible.rows);
  if(plan.requiredRows>50000)throw Error('Input sheet needs cleanup before appending more SKUs.');
  await backupInputs(current.values);
  const latest=await window.getDailySnapshotMeta(eligible.sourceReportDate);
  if(latest?.fingerprint!==eligible.fingerprint||latest?.revision!==eligible.revision||latest?.status!=='completed')throw Error('Wakesuite source changed during preparation. Retry Manual Update.');
  if(plan.requiredRows>current.sheet.gridProperties.rowCount)await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendDimension:{sheetId:tabId,dimension:'ROWS',length:plan.requiredRows-current.sheet.gridProperties.rowCount}}]})});
  for(let i=0;i<plan.updates.length;i+=400)await api('/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:plan.updates.slice(i,i+400).map(u=>({range:"'"+tab+"'!A"+u.row+':F'+u.row,values:[u.values]}))})});
  await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:window.WakeSuiteInputPlan.revenueSortRequests(plan,eligible.rows,current.sheet.gridProperties.columnCount,tabId)})});
  live=await readLive();
  for(let i=0;i<eligible.rows.length;i++)if(eligible.rows[i].some((v,j)=>String(live.values[i+1]?.[j]??'')!==String(v)))throw Error('Sorted input verification failed. Check the sheet before retrying; a local input backup is available.');
  const receipt={completedAt:new Date().toISOString(),sourceReportDate:eligible.sourceReportDate,rows:eligible.rows.length,mode:'manual'};
  const requests=(current.meta.developerMetadata||[]).filter(m=>m.metadataKey==='wakesuite_eod_sync').map(m=>({deleteDeveloperMetadata:{dataFilter:{developerMetadataLookup:{metadataId:m.metadataId}}}}));
  requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'wakesuite_eod_sync',metadataValue:JSON.stringify(receipt),visibility:'DOCUMENT',location:{spreadsheet:true}}}});
  try{await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests})});}catch(e){status.textContent='Inputs verified, but sync receipt could not be saved: '+e.message;showLive();return;}
  showLive();sync.textContent='Manual Update verified at '+receipt.completedAt+' · source '+receipt.sourceReportDate+'. Background schedule not yet configured.';
  status.textContent='Manual Update complete: '+eligible.rows.length+' eligible rows; '+plan.retained+' retained in place, '+plan.appended+' appended, '+plan.cleared+' ineligible input rows cleared. Rows are sorted by Amazon revenue; all source columns moved together so scrape results remain matched. Input backup is stored in this browser.';
 }
 async function run(fn){if(busy)return;busy=true;for(const b of [refresh,preview,manual])b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;for(const b of [refresh,preview,manual])b.disabled=false;}}
 refresh.addEventListener('click',()=>run(async()=>{status.textContent='Checking live data connections…';let masterError='';if(typeof sheetsAccessToken!=='undefined'&&sheetsAccessToken&&typeof loadAllMasterPricing==='function'){try{await loadAllMasterPricing();}catch(e){masterError=e.message;}}else masterError='Master Pricing is not connected.';live=await readLive();showLive();status.textContent=masterError?'URL sheet connected. Master Pricing: '+masterError:'Both sheet reads finished. Master Pricing status is shown above; URL sheet status is below.';}));
 preview.addEventListener('click',()=>run(async()=>{eligible=await latestInputs();showInputs();status.textContent='Preview loaded; no Sheet values changed.';}));
 manual.addEventListener('click',()=>run(update));prev.addEventListener('click',()=>{page--;showLive();});next.addEventListener('click',()=>{page++;showLive();});
 const audit=document.getElementById('liveAuditPanel');if(audit)host.parentElement.append(audit);
 window.WakeSuiteLiveConnections={readLive,latestInputs};
})();
