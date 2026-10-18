/* Import selected local Amazon / SQL downloads through the existing uploader. */
(() => {
  'use strict';
  const allowed = new Set(['wakefit_daily_pricing','amazon_all_listings','amazon_fba_inventory','amazon_business_reports','amazon_order_report']);
  const receiptsKey = 'ws-download-import-receipts-v1';
  let busy = false;
  const yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0));
  function assertAccess(id){
    if(typeof v7HasAction!=='function' || !v7HasAction('upload'))throw new Error('Your account does not allow report uploads.');
    if(!allowed.has(id))throw new Error('This trial imports Amazon and Wakefit SQL only.');
    if(typeof window.v8CanUploadType!=='function' || !window.v8CanUploadType(id))throw new Error('Your upload scope does not allow this report type.');
  }
  function definitions(){return Object.values(REPORT_DEFINITIONS);}
  function identify(headers){
    const matches=definitions().filter(def=>reportMatchesHeaders(headers,def).matches).sort((a,b)=>b.requiredHeaders.length-a.requiredHeaders.length);
    const detected=matches[0];
    if(!detected || !allowed.has(detected.id))return null;
    if(detected.id==='amazon_order_report'){
      const keys=new Set(headers.map(canonicalHeader));
      if(!keys.has('amazonorderid') || !['purchasedate','orderdate'].some(key=>keys.has(key)))return null;
    }
    return detected;
  }
  function configs(){return typeof uploadConfig==='undefined'?[]:uploadConfig;}
  function dateValid(value){return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;}
  function receiptKey(item,date,coverage){
    const uid=window.wakeSuiteFirebase?.auth?.currentUser?.uid || window.currentWakeSuiteAccess?.uid || window.currentWakeSuiteAccess?.email || '';
    return [uid,date,item.definition.id,coverage?.from||'',coverage?.to||'',item.digest].join('|');
  }
  function receipts(){try{return JSON.parse(localStorage.getItem(receiptsKey)||'{}');}catch{return {};}}
  function remember(key,result){
    try{const prior=receipts();prior[key]={uploadId:result.uploadId,at:Date.now()};const retained=Object.fromEntries(Object.entries(prior).sort((a,b)=>b[1].at-a[1].at).slice(0,100));localStorage.setItem(receiptsKey,JSON.stringify(retained));}catch{}
  }
  async function inspect(files,onProgress=()=>{}){
    if(busy)throw new Error('An import is already running.');
    if(files.length>10)throw new Error('Choose up to 10 files for review, with one file per report type selected for import.');
    if(files.reduce((total,file)=>total+file.size,0)>250*1024*1024)throw new Error('Choose files totalling up to 250 MB per batch; import larger sets in separate batches.');
    busy=true;
    try{
      const items=[];
      for(const file of files){
        onProgress('Reading '+file.name+'…');await yieldUi();
        const item={file,selected:false,status:'Not recognised',definition:null,parsed:null};
        try{
          if(!/\.(csv|txt|tsv|xlsx|xls|xlsm)$/i.test(file.name))throw new Error('Unsupported file type.');
          if(!file.size)throw new Error('File is empty.');
          if(file.size>200*1024*1024)throw new Error('This browser trial supports files up to 200 MB.');
          const parsed=await readWakeSuiteFile(file);
          const definition=identify(parsed.headers);
          if(!definition)throw new Error('Not a supported Amazon / SQL report. Flipkart and audit files are excluded.');
          assertAccess(definition.id);
          if(!parsed.rowCount)throw new Error('The report has no data rows.');
          const config=configs().find(config=>config.id===definition.id);
          if(!config)throw new Error('This report type is not configured in Data Center yet.');
          const validation=validateSelectedReport(config.menu,config.folder,parsed.headers);
          if(!validation.valid)throw new Error(validation.message);
          const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
          const digest=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
          Object.assign(item,{definition,config,parsed,digest,selected:true,status:'Ready · '+parsed.rowCount.toLocaleString()+' rows'});
          if(definition.id==='amazon_order_report')item.coverage=v936OrderCoverageFromRows(definition.id,parsed.rows);
        }catch(error){item.status=error.message;}
        items.push(item);
      }
      return items;
    }finally{busy=false;}
  }
  async function importItems(items,{reportDate,businessCoverage,confirmBusinessCoverage=false,replace=false,onProgress=()=>{}}={}){
    if(busy)throw new Error('An import is already running.');
    if(!dateValid(reportDate))throw new Error('Choose a valid Report Date for this import.');
    if(typeof processingLock!=='undefined' && processingLock)throw new Error('Wakesuite is processing another report. Wait for it to finish before importing.');
    const selected=items.filter(item=>item.selected && item.definition && item.parsed);
    if(!selected.length)throw new Error('Select at least one validated report.');
    const ids=selected.map(item=>item.definition.id);
    if(new Set(ids).size!==ids.length)throw new Error('Select only one file for each report type.');
    if(ids.includes('amazon_business_reports') && (!confirmBusinessCoverage || !dateValid(businessCoverage?.from) || !dateValid(businessCoverage?.to) || businessCoverage.from>businessCoverage.to))throw new Error('Confirm the actual ASIN Sales coverage dates before importing.');
    selected.forEach(item=>assertAccess(item.definition.id));
    // Pin the session date for existing processing functions. Do not change menu/file controls.
    const reportDateControl=document.getElementById('reportDate');
    if(!reportDateControl)throw new Error('Data Center is unavailable. Refresh Wakesuite.');
    const manualUpload=document.getElementById('uploadButton');
    if(manualUpload?.disabled)throw new Error('Another upload is running. Wait for it to finish.');
    const manualWasDisabled=manualUpload?.disabled;
    if(manualUpload)manualUpload.disabled=true;
    busy=true;reportDateControl.value=reportDate;
    const dateWasDisabled=reportDateControl.disabled;
    reportDateControl.disabled=true;
    const results=[];
    const order=['wakefit_daily_pricing','amazon_all_listings','amazon_fba_inventory','amazon_business_reports','amazon_order_report'];
    try{
      if(currentSessionDate!==reportDate)await restoreSessionForDate(reportDate);
      for(const item of selected.sort((a,b)=>order.indexOf(a.definition.id)-order.indexOf(b.definition.id))){
        await yieldUi();
        const coverage=item.definition.id==='amazon_business_reports'?businessCoverage:item.definition.id==='amazon_order_report'?{from:'',to:''}:null;
        const key=receiptKey(item,reportDate,item.definition.id==='amazon_order_report'?item.coverage:coverage);
        if(!replace && receipts()[key]){item.status='Already imported · identical file/date/coverage';onProgress(item);results.push({item,skipped:true});continue;}
        item.status='Importing…';onProgress(item);
        const prior=window.wakeSuiteSessionReports?.[item.definition.id];
        try{
          const result=await window.uploadData({reportDate,menu:item.config.menu,folder:item.config.folder,file:item.file,parsedFile:item.parsed,coverage,silent:true,deferProcessing:true});
          if(!result?.uploadId)throw new Error('Wakesuite did not return an upload receipt.');
          item.status='Imported · '+result.rowCount.toLocaleString()+' rows';item.uploadId=result.uploadId;
          remember(key,result);results.push({item,result});
        }catch(error){
          if(window.wakeSuiteSessionReports){if(prior)window.wakeSuiteSessionReports[item.definition.id]=prior;else delete window.wakeSuiteSessionReports[item.definition.id];}
          updateReadiness();item.status='Failed · '+error.message;results.push({item,error:error.message});
        }
        onProgress(item);
      }
      let snapshot={saved:false,message:'Sources imported; processing / mapping still required.'};
      if(results.some(entry=>entry.result || entry.skipped)){
        onProgress(null,'Checking the Firestore snapshot…');await yieldUi();
        try{
          await maybeAutoProcessCurrentDate();
          const meta=await window.getDailySnapshotMeta(reportDate);
          if(meta?.status==='completed' && meta.fingerprint===buildInputFingerprint(reportDate))snapshot={saved:true,message:'Firestore snapshot verified for the currently available sources.'};
          else snapshot.message='Upload receipts saved and source files cached locally. Firestore snapshot is pending or the existing snapshot was retained; check Source Availability and Master Pricing.';
        }catch(error){snapshot.message='Source import finished; snapshot verification failed: '+error.message;}
      }
      return {results,snapshot};
    }finally{busy=false;reportDateControl.disabled=dateWasDisabled;if(manualUpload)manualUpload.disabled=manualWasDisabled;}
  }
  window.WakeSuiteDownloadImport={inspect,importItems,identify,get busy(){return busy;}};
  const panel=document.getElementById('downloadImportPanel');
  if(!panel)return;
  panel.classList.add('mwf-import');
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const label=(text,input)=>{const node=el('label');node.append(el('span',text),input);return node;};
  panel.append(el('h2','Import Amazon + SQL downloads'));
  panel.append(el('p','Choose the downloaded files together, review their types and dates, then import. Flipkart and audit files are excluded. No Drive connection is needed.'));
  const controls=el('div');controls.className='mwf-import-controls';
  const date=el('input');date.type='date';date.value=document.getElementById('reportDate')?.value||todayIso();
  const files=el('input');files.type='file';files.multiple=true;files.accept='.csv,.txt,.tsv,.xlsx,.xls,.xlsm';
  controls.append(label('Report Date',date),label('Downloaded reports',files));panel.append(controls);
  const coverage=el('fieldset');coverage.hidden=true;coverage.append(el('legend','ASIN Sales coverage — confirm the dates used for this file'));
  const from=el('input'),to=el('input');from.type=to.type='date';
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const first=new Date(yesterday);first.setDate(first.getDate()-29);
  const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');from.value=iso(first);to.value=iso(yesterday);
  const confirmed=el('input');confirmed.type='checkbox';
  coverage.append(label('Data From',from),label('Data To',to),label('I confirm these are the actual dates covered by the ASIN Sales file',confirmed));panel.append(coverage);
  const replace=el('input');replace.type='checkbox';panel.append(label('Re-import identical files for this date (normally skipped)',replace));
  const table=el('table');table.className='result-table';const head=el('tr');['Use','File','Detected source','Coverage','Status'].forEach(text=>head.append(el('th',text)));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');table.append(tbody);const wrap=el('div');wrap.className='table-wrap';wrap.append(table);panel.append(wrap);
  const button=el('button','Import selected reports');button.className='primary-btn';button.disabled=true;panel.append(button);
  const status=el('p','Select Amazon / SQL files to preview.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  panel.append(el('p','An import receipt is not a complete raw-file cloud backup. Keep the original downloads until the stored historical output is verified.'));
  let items=[];const rowCells=new Map();
  function lock(value){panel.querySelectorAll('input,button').forEach(input=>input.disabled=value);if(!value){button.disabled=!items.some(item=>item.selected && item.definition);for(const [item,cell]of rowCells){const checkbox=cell.parentElement?.querySelector('input[type=checkbox]');if(checkbox)checkbox.disabled=!item.definition;}}}
  function rowStatus(item,message){if(item && rowCells.has(item))rowCells.get(item).textContent=item.status;if(message)status.textContent=message;}
  function render(){tbody.replaceChildren();rowCells.clear();for(const item of items){const tr=el('tr'),check=el('input');check.type='checkbox';check.checked=item.selected;check.disabled=!item.definition;check.addEventListener('change',()=>{item.selected=check.checked;button.disabled=!items.some(item=>item.selected);});const use=el('td');use.append(check);const result=el('td',item.status);rowCells.set(item,result);tr.append(use,el('td',item.file.name),el('td',item.definition?.label||'Excluded'),el('td',item.coverage?.from?item.coverage.from+' → '+item.coverage.to:item.definition?.id==='amazon_business_reports'?'Confirm below':'Daily snapshot'),result);tbody.append(tr);}coverage.hidden=!items.some(item=>item.definition?.id==='amazon_business_reports');}
  files.addEventListener('change',async()=>{lock(true);confirmed.checked=false;try{items=await inspect([...files.files],message=>{status.textContent=message;});render();status.textContent=items.some(item=>item.definition)?'Preview ready. Check Report Date, selected files and any sales coverage dates.':'No supported Amazon / SQL files were found. Check the per-file messages.';}catch(error){status.textContent=error.message;}finally{lock(false);}});
  button.addEventListener('click',async()=>{lock(true);try{const result=await importItems(items,{reportDate:date.value,businessCoverage:{from:from.value,to:to.value},confirmBusinessCoverage:confirmed.checked,replace:replace.checked,onProgress:rowStatus});const saved=result.results.filter(entry=>entry.result).length,skipped=result.results.filter(entry=>entry.skipped).length,failed=result.results.filter(entry=>entry.error).length;status.textContent=saved+' imported · '+skipped+' already imported · '+failed+' failed. '+result.snapshot.message;}catch(error){status.textContent=error.message;}finally{lock(false);}});
})();
