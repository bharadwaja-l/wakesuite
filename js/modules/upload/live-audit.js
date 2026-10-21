/* Read-only live audit Sheet -> existing Wakesuite source upload pipeline. */
(() => {
 'use strict';
 const spreadsheetId='1KeVVOLASOsHO5Efgf4IVsNWDLD3X1SqsivExGbJ1Bms',tab='master_final_with_flipkart',sheetId=743318554;
 const required=['ASIN','FSN','amazon_has_supersede_issue','amazon_selling_price','amazon_buy_now_present','amazon_edd','amazon_deliver_to','flipkart_selling_price','flipkart_buy_now_present'];
 let busy=false,preview=null;
 function assertAccess(){
  if(typeof v7HasAction!=='function'||!v7HasAction('upload')||!window.v8CanUploadType?.('marketplace_audit_report'))throw Error('Your account cannot upload the shared Audit Report.');
 }
 async function readJson(url){
  if(!sheetsAccessToken)throw Error('Use Connect Master Pricing first to authorize read-only Google Sheets access with your work account.');
  const response=await fetch(url,{headers:{Authorization:'Bearer '+sheetsAccessToken}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(response.status===401?'Google access expired. Reconnect Master Pricing, then read the audit sheet again.':response.status===403?'The connected Google account cannot read this audit sheet. Connect the work account that has access.':body.error?.message||'Could not read the audit sheet.');
  return body;
 }
 function prepare(values,date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Select the audit Report Date.');
  const headers=(values[0]||[]).map(v=>String(v).trim()),index=new Map(headers.map((v,i)=>[canonicalHeader(v),i]));
  for(const header of required)if(!index.has(canonicalHeader(header)))throw Error('Audit sheet is missing '+header+'. Nothing imported.');
  const value=(row,key)=>String(row[index.get(canonicalHeader(key))]??'').trim();
  const rows=[];let amazon=0,flipkart=0,unfilled=0;
  for(const cells of values.slice(1)){
   if(!value(cells,'ASIN')&&!value(cells,'FSN'))continue;
   const azFields=['amazon_has_supersede_issue','amazon_selling_price','amazon_buy_now_present'];
   const az=azFields.some(k=>value(cells,k)!=='');
   const fk=['flipkart_selling_price','flipkart_buy_now_present'].some(k=>value(cells,k)!=='');
   if(!az&&!fk){unfilled++;continue;}
   if(az||fk){
    const timestamp=value(cells,'amazon_timestamp');
    if(!timestamp||timestamp.slice(0,10)!==date)throw Error('Shared Amazon / Flipkart scrape timestamps are missing or do not all match '+date+'. Finish or refresh the scrape for this date before importing.');
   }
   const row=Object.fromEntries(headers.map((key,i)=>[key,cells[i]??'']));
   // Unscraped identifiers must not be classified as negative audit findings.
   if(!az)row[headers[index.get(canonicalHeader('ASIN'))]]='';
   if(!fk)row[headers[index.get(canonicalHeader('FSN'))]]='';
   rows.push(row);if(az)amazon++;if(fk)flipkart++;
  }
  if(!rows.length)throw Error('No scraped results are ready. URL input rows alone cannot be imported.');
  return {headers,rows,rowCount:rows.length,amazon,flipkart,unfilled,date,readAt:new Date().toISOString()};
 }
 async function read(date){
  assertAccess();
  const meta=await readJson('https://sheets.googleapis.com/v4/spreadsheets/'+spreadsheetId+'?fields=sheets(properties(sheetId,title,gridProperties))');
  const sheet=meta.sheets?.find(s=>s.properties?.sheetId===sheetId)?.properties;
  if(!sheet||sheet.title!==tab)throw Error('The configured live audit tab changed. Nothing imported.');
  const count=sheet.gridProperties?.rowCount;
  if(!Number.isInteger(count)||count<2||count>50000)throw Error('Unexpected audit sheet row count. Nothing imported.');
  const range="'"+tab+"'!A1:AK"+count;
  const result=await readJson('https://sheets.googleapis.com/v4/spreadsheets/'+spreadsheetId+'/values/'+encodeURIComponent(range)+'?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE');
  return prepare(result.values||[],date);
 }
 async function save(data,confirmed){
  assertAccess();
  if(!confirmed)throw Error('Confirm that the scrape is complete and its results belong to this Report Date.');
  if(Date.now()-Date.parse(data.readAt)>10*60*1000)throw Error('Preview expired. Read the live sheet again before importing.');
  if(processingLock)throw Error('Wait for current processing to finish.');
  const dateControl=document.getElementById('reportDate'),upload=document.getElementById('uploadButton');
  const config=uploadConfig.find(c=>c.id==='marketplace_audit_report');
  if(!dateControl||!config)throw Error('Audit upload configuration is not ready.');
  const dateDisabled=dateControl.disabled,uploadDisabled=upload?.disabled;
  dateControl.disabled=true;if(upload)upload.disabled=true;
  let prior;
  let uploadStarted=false;
  let imported=false;
  try{
   dateControl.value=data.date;
   if(currentSessionDate!==data.date)await restoreSessionForDate(data.date);
   prior=window.wakeSuiteSessionReports?.marketplace_audit_report;
   uploadStarted=true;
   const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
   const csv=[data.headers,...data.rows.map(row=>data.headers.map(h=>row[h]))].map(row=>row.map(quote).join(',')).join('\r\n');
   const file=new File([csv],'URL_Scraping_Audit_'+data.date+'.csv',{type:'text/csv'});
   const receipt=await window.uploadData({reportDate:data.date,menu:config.menu,folder:config.folder,file,parsedFile:{headers:data.headers,rows:data.rows,rowCount:data.rowCount,sheetName:tab,headerRowNumber:1},silent:true,deferProcessing:true});
   if(!receipt?.uploadId)throw Error('Audit upload did not return a receipt.');
   imported=true;await maybeAutoProcessCurrentDate();
   const meta=await window.getDailySnapshotMeta(data.date);
   return meta?.status==='completed'&&meta.fingerprint===buildInputFingerprint(data.date)
    ?'Audit imported. Firestore snapshot verified for the currently available sources.'
    :'Audit source imported and cached in this browser. Processed cloud snapshot is not yet verified; check Master Pricing and Source Availability. Keep the source sheet until verification.';
  }catch(error){
   if(uploadStarted&&!imported&&window.wakeSuiteSessionReports){if(prior&&prior.reportDate===data.date)window.wakeSuiteSessionReports.marketplace_audit_report=prior;else delete window.wakeSuiteSessionReports.marketplace_audit_report;}
   if(imported)throw Error('Audit source imported, but cloud verification failed: '+error.message);
   throw error;
  }finally{dateControl.disabled=dateDisabled;if(upload)upload.disabled=uploadDisabled;updateReadiness();}
 }
 window.WakeSuiteLiveAudit={prepare,read,save,spreadsheetId,tab};
 const panel=document.getElementById('liveAuditPanel');if(!panel)return;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 panel.append(el('h2','Live URL scraping audit'));
 panel.append(el('p','Read master_final_with_flipkart using your connected work Google account. Import after the team finishes scraping. The source sheet is read-only.'));
 const date=el('input');date.type='date';date.value=document.getElementById('reportDate')?.value||todayIso();date.setAttribute('aria-label','Audit Report Date');
 const readButton=el('button','Read live audit sheet'),saveButton=el('button','Import reviewed audit');readButton.type=saveButton.type='button';saveButton.disabled=true;
 const check=el('input');check.type='checkbox';const label=el('label');label.append(check,document.createTextNode(' I confirm the scrape is complete and the displayed Amazon / Flipkart results belong to this Report Date.'));
 const status=el('p');status.setAttribute('role','status');
 panel.append(date,readButton,status,label,saveButton);
 function reset(){preview=null;check.checked=false;saveButton.disabled=true;}
 date.addEventListener('change',reset);
 check.addEventListener('change',()=>{saveButton.disabled=busy||!preview||!check.checked;});
 async function action(fn){if(busy)return;busy=true;readButton.disabled=saveButton.disabled=date.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;readButton.disabled=date.disabled=false;saveButton.disabled=!preview||!check.checked;}}
 readButton.addEventListener('click',()=>action(async()=>{reset();status.textContent='Reading live audit results…';preview=await read(date.value);status.textContent=preview.rowCount+' scraped rows: '+preview.amazon+' Amazon, '+preview.flipkart+' Flipkart; '+preview.unfilled+' input-only rows excluded. Read at '+preview.readAt+'. Confirm completion before importing. amazon_timestamp is used as the shared scrape timestamp for Amazon and Flipkart.';}));
 saveButton.addEventListener('click',()=>action(async()=>{status.textContent='Importing audit and verifying snapshot…';const message=await save(preview,check.checked);reset();status.textContent=message;}));
})();
