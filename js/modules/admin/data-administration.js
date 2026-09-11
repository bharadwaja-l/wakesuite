/* WakeSuite V9.3 · Super Admin Data Administration */
(function(){
  let previewSummaries=[],previewRecords=[],sourceVersions=[],auditRows=[];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  function superAdmin(){return window.currentWakeSuiteAccess?.role==='super_admin';}
  function requireSA(){if(!superAdmin())throw new Error('Data Administration is restricted to Super Admin.');}
  function shift(date,n){const d=new Date(`${date}T00:00:00`);d.setDate(d.getDate()+n);return localIsoDate(d);}
  function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v;}
  function dateScope(prefix){
    const mode=document.getElementById(`${prefix}DateMode`)?.value||'today',base=todayIso();
    let from=base,to=base;
    if(mode==='yesterday')from=to=shift(base,-1);
    else if(mode==='single')from=to=document.getElementById(`${prefix}Date`)?.value||base;
    else if(mode==='custom'){
      from=document.getElementById(`${prefix}FromDate`)?.value||base;
      to=document.getElementById(`${prefix}ToDate`)?.value||base;
      if(from>to)[from,to]=[to,from];
    }
    setVal(`${prefix}Date`,to);setVal(`${prefix}FromDate`,from);setVal(`${prefix}ToDate`,to);
    return[from,to];
  }
  function dates(from,to){
    const out=[],d=new Date(`${from}T00:00:00`),end=new Date(`${to}T00:00:00`);
    while(d<=end&&out.length<367){out.push(localIsoDate(d));d.setDate(d.getDate()+1);}return out;
  }
  function selectedTypes(){return [...document.querySelectorAll('[data-data-admin-type]:checked')].map(x=>x.dataset.dataAdminType);}
  function scope(){return document.querySelector('input[name="dataAdminScope"]:checked')?.value||'selected';}
  function filters(){return {marketplace:document.getElementById('dataAdminMarketplace')?.value||'all',category:document.getElementById('dataAdminCategory')?.value||'all',status:document.getElementById('dataAdminIssueStatus')?.value||'all',identifier:String(document.getElementById('dataAdminIdentifier')?.value||'').trim()};}
  function ensureColumnsUi(tableId,key,label){
    const table=document.getElementById(tableId);if(!table||document.getElementById(`${key}Columns`))return;
    const wrap=table.closest('.table-wrap');if(!wrap)return;
    const bar=document.createElement('div');bar.className='v93-table-tools';
    bar.innerHTML=`<div></div><details class="column-picker"><summary>Columns</summary><div class="column-picker-panel"><div class="v8-column-actions"><button type="button" data-col-action="all">Select All</button><button type="button" data-col-action="clear">Clear All</button><button type="button" data-col-action="default">Set as Default</button><button type="button" data-col-action="restore">Restore Default</button></div><div id="${key}Columns"></div></div></details>`;
    wrap.parentNode.insertBefore(bar,wrap);
    bar.querySelector('[data-col-action="all"]')?.addEventListener('click',()=>WakeSuiteColumns.selectAll(key));
    bar.querySelector('[data-col-action="clear"]')?.addEventListener('click',()=>WakeSuiteColumns.clearAll(key));
    bar.querySelector('[data-col-action="default"]')?.addEventListener('click',()=>WakeSuiteColumns.setDefault(key));
    bar.querySelector('[data-col-action="restore"]')?.addEventListener('click',()=>WakeSuiteColumns.restoreDefault(key));
  }
  function datasetLabel(v){const m={amazonRows:'Amazon Pricing / Disparity',flipkartRows:'Flipkart Pricing / Disparity',amazonSuppressions:'Amazon ASIN Suppression',amazonBuyBox:'Amazon Buy Box',amazonInventoryRows:'Amazon Inventory',flipkartInventoryRows:'Flipkart Inventory',amazon_pricing_issues:'Amazon Pricing Issues',amazon_price_updates:'Amazon Price Updates',flipkart_price_updates:'Flipkart Price Updates',pricing_exceptions:'Pricing Exceptions',snapshot:'Processed Snapshot'};return m[v]||v;}
  function selectedPreviewKeys(){return [...document.querySelectorAll('[data-admin-record-key]:checked')].map(x=>x.dataset.adminRecordKey);}
  function selectAllPreview(on){document.querySelectorAll('[data-admin-record-key]').forEach(x=>x.checked=!!on);updatePreviewSelectionText();}
  function updatePreviewSelectionText(){
    const el=document.getElementById('dataAdminPreview'),selected=selectedPreviewKeys().length,total=previewRecords.length;
    if(el&&scope()==='selected')el.textContent=`Preview: ${total} matching record(s). ${selected} selected for deletion.`;
  }
  async function previewClear(){
    try{
      requireSA();const [from,to]=dateScope('dataAdmin'),types=selectedTypes();if(!types.length)throw new Error('Select at least one dataset.');
      previewSummaries=[];previewRecords=[];const f=filters();
      for(const d of dates(from,to)){
        let p;
        if(window.previewProcessedDataV93)p=await window.previewProcessedDataV93({reportDate:d,types,scope:scope(),...f});
        else {const counts=await window.previewProcessedDataClear?.(d,types)||{};p={counts,records:[]};}
        const counts=p?.counts||{};Object.entries(counts).forEach(([dataset,count])=>previewSummaries.push({date:d,dataset,count:Number(count||0)}));
        (p?.records||[]).forEach(r=>previewRecords.push({...r,date:r.date||d}));
      }
      renderPreview();
      const total=previewSummaries.reduce((s,r)=>s+Number(r.count||0),0),el=document.getElementById('dataAdminPreview');
      if(el)el.textContent=scope()==='selected'?`Preview: ${previewRecords.length} matching record(s). Select the exact records to delete.`:`Preview: ${total} affected record(s) across ${from} to ${to}.`;
    }catch(e){showWakeSuiteToast?.(e.message,'error','Data Administration preview');}
  }
  function renderPreview(){
    const t=document.getElementById('dataAdminPreviewTable');if(!t)return;
    if(scope()==='selected'){
      const cols=[['select','Select'],['date','Date'],['dataset','Dataset'],['marketplace','Marketplace'],['category','Category'],['identifier','Identifier'],['status','Status']];
      t.dataset.wsColumnTable='dataAdminPreview';
      t.innerHTML='<thead><tr><th><input type="checkbox" id="dataAdminSelectAllPreview" title="Select all previewed records"></th>'+cols.slice(1).map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+(previewRecords.length?previewRecords.map(r=>`<tr><td><input type="checkbox" data-admin-record-key="${esc(r.key)}"></td><td>${esc(r.date||'')}</td><td>${esc(datasetLabel(r.dataset))}</td><td>${esc(r.marketplace||'')}</td><td>${esc(r.category||'')}</td><td>${esc(r.identifier||'')}</td><td>${esc(r.status||'')}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-row">No matching records found.</td></tr>')+'</tbody>';
      ensureColumnsUi('dataAdminPreviewTable','dataAdminPreview','Preview columns');
      WakeSuiteColumns.register('dataAdminPreview',cols.map(c=>({key:c[0],label:c[1]})),cols.map(c=>c[0]),'dataAdminPreviewColumns');
      document.getElementById('dataAdminSelectAllPreview')?.addEventListener('change',e=>selectAllPreview(e.target.checked));
      t.querySelectorAll('[data-admin-record-key]').forEach(cb=>cb.addEventListener('change',updatePreviewSelectionText));
    }else{
      const cols=[['date','Date'],['dataset','Dataset'],['count','Affected Records']];
      t.dataset.wsColumnTable='dataAdminPreview';
      t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+(previewSummaries.length?previewSummaries.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(datasetLabel(r.dataset))}</td><td>${r.count}</td></tr>`).join(''):'<tr><td colspan="3" class="empty-row">No affected records found.</td></tr>')+'</tbody>';
      ensureColumnsUi('dataAdminPreviewTable','dataAdminPreview','Preview columns');
      WakeSuiteColumns.register('dataAdminPreview',cols.map(c=>({key:c[0],label:c[1]})),cols.map(c=>c[0]),'dataAdminPreviewColumns');
    }
  }
  async function executeClear(){
    try{
      requireSA();const [from,to]=dateScope('dataAdmin'),types=selectedTypes(),reason=String(document.getElementById('dataAdminReason')?.value||'').trim(),mode=scope(),f=filters();
      if(!reason)throw new Error('A deletion reason is required.');if(!types.length)throw new Error('Select at least one dataset.');
      if(!previewSummaries.length&&!previewRecords.length)await previewClear();
      const keys=mode==='selected'?selectedPreviewKeys():[];
      if(mode==='selected'&&!keys.length)throw new Error('Select at least one preview record before deleting.');
      const count=mode==='selected'?keys.length:previewSummaries.reduce((s,r)=>s+Number(r.count||0),0);
      if(!count)throw new Error('No affected records are available for the selected scope.');
      if(!confirm(`Clear ${count} processed record(s) from ${from} to ${to}? Uploaded source files are not deleted by this action.`))return;
      for(const d of dates(from,to)){
        const dateKeys=keys.filter(k=>k.includes(`|${d}|`)||previewRecords.some(r=>r.date===d&&r.key===k));
        if(mode==='selected'&&!dateKeys.length)continue;
        if(window.clearProcessedDataV93)await window.clearProcessedDataV93({reportDate:d,types,scope:mode,...f,selectedKeys:dateKeys,reason});
        else await window.clearProcessedData?.(d,types,reason);
      }
      if(typeof snapshotCache!=='undefined')snapshotCache.clear();
      previewSummaries=[];previewRecords=[];renderPreview();await loadAudit();
      const el=document.getElementById('dataAdminPreview');if(el)el.textContent='';
      showWakeSuiteToast?.('Selected processed data cleared and audited.','success');
    }catch(e){showWakeSuiteToast?.(e.message,'error','Clear Processed Data');}
  }
  async function localVersions(){
    const db=await openWakeSuiteDb();return await new Promise((res,rej)=>{if(!db.objectStoreNames.contains('report_versions'))return res([]);const tx=db.transaction('report_versions','readonly'),q=tx.objectStore('report_versions').getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});
  }
  async function previewSources(){
    try{
      requireSA();const [from,to]=dateScope('sourceDelete'),type=document.getElementById('sourceDeleteType')?.value||'all';let x=await localVersions();
      x=x.filter(v=>String(v.reportDate||'')>=from&&String(v.reportDate||'')<=to&&(type==='all'||v.configId===type));sourceVersions=x.sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));renderSources();
    }catch(e){showWakeSuiteToast?.(e.message,'error','Source versions');}
  }
  const sourceImpact={wakefit_daily_pricing:['amazon_pricing','flipkart_pricing','inventory'],amazon_all_listings:['amazon_pricing','amazon_suppression','amazon_buybox','inventory'],amazon_fba_inventory:['amazon_pricing','amazon_suppression','amazon_buybox','inventory'],amazon_business_reports:['amazon_pricing','amazon_suppression','amazon_buybox'],amazon_order_report:['exception_insights'],marketplace_audit_report:['amazon_pricing','amazon_suppression','amazon_buybox','flipkart_pricing'],shared_audit_report:['amazon_pricing','amazon_suppression','amazon_buybox','flipkart_pricing'],flipkart_listing_file:['flipkart_pricing','inventory'],flipkart_listing:['flipkart_pricing','inventory'],flipkart_order_report:['flipkart_pricing','exception_insights'],flipkart_orders:['flipkart_pricing','exception_insights']};
  function renderSources(){
    const t=document.getElementById('sourceDeleteTable');if(!t)return;
    const cols=[['select','Select'],['reportDate','Report Date'],['source','Source'],['file','File'],['rows','Rows'],['uploaded','Uploaded'],['uploader','Uploader'],['status','Status'],['version','Version'],['impact','Affected Processed Outputs']];
    t.dataset.wsColumnTable='dataAdminSources';
    t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+(sourceVersions.length?sourceVersions.map(v=>{const impacted=sourceImpact[v.configId]||[];return `<tr><td><input type="checkbox" data-source-version="${esc(v.versionId)}"></td><td>${esc(v.reportDate)}</td><td>${esc(v.configId)}</td><td>${esc(v.fileName)}</td><td>${Number(v.rowCount||0)}</td><td>${v.createdAt?esc(new Date(v.createdAt).toLocaleString()):''}</td><td>${esc(v.uploadedBy||v.createdBy||v.userEmail||v.user||'')}</td><td>${esc(v.status||'')}</td><td>${esc(v.versionId)}</td><td>${esc(impacted.map(datasetLabel).join(', '))}</td></tr>`;}).join(''):'<tr><td colspan="10" class="empty-row">No uploaded source versions match the selected date/source filters.</td></tr>')+'</tbody>';
    ensureColumnsUi('sourceDeleteTable','dataAdminSources','Source columns');
    WakeSuiteColumns.register('dataAdminSources',cols.map(c=>({key:c[0],label:c[1]})),['select','reportDate','source','file','rows','uploaded','uploader','status','impact'],'dataAdminSourcesColumns');
  }
  async function deleteVersionLocal(version){
    const db=await openWakeSuiteDb();await new Promise((res,rej)=>{const stores=['report_versions',...(db.objectStoreNames.contains('raw_files')?['raw_files']:[])],tx=db.transaction(stores,'readwrite');stores.forEach(s=>tx.objectStore(s).delete(version.versionId));tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
  }
  async function deleteSources(){
    try{
      requireSA();const ids=[...document.querySelectorAll('[data-source-version]:checked')].map(x=>x.dataset.sourceVersion),reason=String(document.getElementById('sourceDeleteReason')?.value||'').trim();
      if(!ids.length)throw new Error('Select at least one uploaded source version.');if(!reason)throw new Error('A deletion reason is required.');
      const chosen=sourceVersions.filter(v=>ids.includes(v.versionId));
      const lines=chosen.slice(0,8).map(v=>`${v.reportDate} · ${v.configId} · ${v.fileName}`).join('\n');
      if(!confirm(`Delete ${chosen.length} selected uploaded source version(s)?\n\n${lines}${chosen.length>8?'\n…':''}\n\nOnly downstream processed outputs for the affected source/date will be invalidated.`))return;
      for(const v of chosen){
        const types=sourceImpact[v.configId]||[];
        if(window.deleteSourceVersionV93)await window.deleteSourceVersionV93({...v,reason,affectedProcessedTypes:types});
        await deleteVersionLocal(v);
        if(types.length&&window.clearProcessedDataV93){
          try{await window.clearProcessedDataV93({reportDate:v.reportDate,types,scope:'dataset',marketplace:'all',category:'all',status:'all',identifier:'',reason:`Source version deleted: ${v.fileName}. ${reason}`});}
          catch(e){console.warn('Derived processed-data invalidation could not complete',e);}
        }
      }
      if(typeof snapshotCache!=='undefined')snapshotCache.clear();await previewSources();await loadAudit();
      showWakeSuiteToast?.('Selected source version(s) deleted and downstream processed data invalidated. Upload the corrected replacement file when ready.','success');
    }catch(e){showWakeSuiteToast?.(e.message,'error','Delete Source File');}
  }
  function tab(which,btn){
    document.querySelectorAll('[data-data-admin-tab]').forEach(b=>b.classList.remove('active'));btn?.classList.add('active');
    const pp=document.getElementById('dataAdminProcessedPanel'),sp=document.getElementById('dataAdminSourcePanel');if(pp)pp.hidden=which!=='processed';if(sp)sp.hidden=which!=='source';if(which==='source')previewSources();
  }
  async function loadAudit(){
    try{auditRows=await window.loadDataAdminAudit?.()||[];}catch(_){auditRows=[];}
    const cols=[['action','Action'],['reportDate','Date'],['scope','Scope'],['types','Dataset(s)'],['selectedRecordCount','Selected'],['reason','Reason'],['byEmail','User'],['createdAt','Timestamp']];
    const t=document.getElementById('dataAdminAuditTable');if(!t)return;t.dataset.wsColumnTable='dataAdminAudit';
    t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${c[1]}</th>`).join('')+'</tr></thead><tbody>'+(auditRows.length?auditRows.slice(0,500).map(r=>`<tr><td>${esc(r.action||r.type||'Processed Data Clear')}</td><td>${esc(r.reportDate||r.fromDate||'')}</td><td>${esc(r.scope||'')}</td><td>${esc(Array.isArray(r.types)?r.types.map(datasetLabel).join(', '):(r.sourceType||''))}</td><td>${esc(r.selectedRecordCount??'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.byEmail||r.deletedBy||r.uid||'')}</td><td>${esc(r.createdAt?.toDate?r.createdAt.toDate().toLocaleString():(r.createdAt||r.deletedAtText||r.deletedAt||''))}</td></tr>`).join(''):'<tr><td colspan="8" class="empty-row">No Data Administration audit records.</td></tr>')+'</tbody>';
    WakeSuiteColumns.register('dataAdminAudit',cols.map(c=>({key:c[0],label:c[1]})),['action','reportDate','scope','types','reason','byEmail','createdAt'],'dataAdminAuditColumns');
  }
  function bind(){
    document.querySelectorAll('input[name="dataAdminScope"]').forEach(r=>r.addEventListener('change',()=>{if(previewSummaries.length||previewRecords.length)renderPreview();}));
    if(document.getElementById('dataAdministrationPane'))loadAudit();
  }
  document.addEventListener('DOMContentLoaded',bind);
  window.showDataAdminModeV93=tab;
  window.setDataAdminTab=function(which){const btn=[...document.querySelectorAll('[data-admin-tab]')].find(b=>b.dataset.adminTab===which);tab(which,btn);};
  window.previewDataAdministrationV93=previewClear;window.executeDataAdministrationV93=executeClear;window.previewSourceVersionsV93=previewSources;window.deleteSelectedSourceVersionsV93=deleteSources;window.loadDataAdminAuditV93=loadAudit;
})();
