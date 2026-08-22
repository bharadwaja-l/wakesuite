/* WakeSuite V9.2 Pricing Exceptions workspace */
(function(){
  const esc=s=>typeof window.escapeHtml==='function'?window.escapeHtml(s??''):String(s??'');
  const activeRows=()=>Array.isArray(window.v7PricingExceptions)?window.v7PricingExceptions:[];
  function addWorkspace(){
    const host=document.getElementById('pricingExceptionsWorkspace');if(!host)return;
    host.innerHTML='<div class="panel"><div class="v7-security-note">Use the Pricing Exceptions controls in Data Center to upload identifier-only exceptions, or add an exception directly from a marketplace row. Exception Target and Exception Type are separate; Parity is available for all general pricing targets.</div><div class="module-actions" style="margin-top:12px"><button class="primary-btn" onclick="showView(\'uploadSection\')">Open Exception Upload</button><button class="secondary-btn" onclick="openPricingExceptions(\'manager\')">Open Exceptions Manager</button></div></div>';
  }
  async function managerWorkspace(){
    const host=document.getElementById('pricingExceptionsWorkspace');if(!host)return;
    host.innerHTML='<div class="panel"><div class="module-actions"><select id="v92ExceptionStatus"><option value="active">Active</option><option value="expired">Expired</option><option value="removed">Removed</option><option value="all">All Statuses</option></select><input id="v92ExceptionSearch" placeholder="Search ASIN / FSN / SKU"><button class="secondary-btn" onclick="renderV92ExceptionManager()">Apply</button></div><div id="v92ExceptionKpis" class="v7-kpis"></div><div class="table-wrap"><table id="v92ExceptionTable" class="result-table"></table></div></div>';
    if(typeof window.v7EnsurePricingExceptionsLoaded==='function')await window.v7EnsurePricingExceptionsLoaded(true).catch(()=>{});
    renderManager();
  }
  function stateOf(r){
    if(String(r.status||'').toLowerCase()==='removed')return'Removed';
    const today=typeof window.todayIso==='function'?window.todayIso():new Date().toISOString().slice(0,10);
    if(r.effectiveTo&&today>r.effectiveTo)return'Expired';return'Active';
  }
  function renderManager(){
    const table=document.getElementById('v92ExceptionTable'),k=document.getElementById('v92ExceptionKpis');if(!table||!k)return;
    const status=document.getElementById('v92ExceptionStatus')?.value||'active',q=String(document.getElementById('v92ExceptionSearch')?.value||'').toLowerCase();
    const rows=activeRows().map(r=>({...r,v92State:stateOf(r)})).filter(r=>(status==='all'||r.v92State.toLowerCase()===status)&&(!q||JSON.stringify([r.wfSku,r.azSku,r.asin,r.fkSku,r.fsn,r.category,r.exceptionType,r.target]).toLowerCase().includes(q)));
    const all=activeRows().map(r=>stateOf(r));k.innerHTML=`<div class="v7-kpi"><span>Active</span><strong>${all.filter(x=>x==='Active').length}</strong></div><div class="v7-kpi"><span>Expired</span><strong>${all.filter(x=>x==='Expired').length}</strong></div><div class="v7-kpi"><span>Removed</span><strong>${all.filter(x=>x==='Removed').length}</strong></div>`;
    table.innerHTML='<thead><tr><th>Marketplace</th><th>Category</th><th>Identifiers</th><th>Target</th><th>Type</th><th>Period</th><th>Remarks</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+(rows.length?rows.map(r=>{const ids=[r.wfSku&&`WF ${r.wfSku}`,r.azSku&&`AZ ${r.azSku}`,r.asin&&`ASIN ${r.asin}`,r.fkSku&&`FK ${r.fkSku}`,r.fsn&&`FSN ${r.fsn}`].filter(Boolean).join(' · ');return`<tr><td>${esc(r.marketplace)}</td><td>${esc(r.category||'All')}</td><td>${esc(ids||r.identifier||'—')}</td><td>${esc(r.target||'All Pricing')}</td><td>${esc(r.exceptionType||'Pricing')}</td><td>${esc(r.effectiveFrom||'—')} → ${esc(r.effectiveTo||'No Expiry')}</td><td>${esc(r.remarks||r.reason||'—')}</td><td>${esc(r.v92State)}</td><td>${r.v92State==='Active'?`<button class="secondary-btn" onclick='editV92Exception(${JSON.stringify(r.id)})'>Edit</button> <button class="secondary-btn" onclick='removeV92Exception(${JSON.stringify(r.id)})'>Remove Exception</button>`:'—'}</td></tr>`;}).join(''):'<tr><td colspan="9" class="empty-row">No exceptions match this filter.</td></tr>')+'</tbody>';
  }
  function find(id){return activeRows().find(r=>r.id===id);}
  function edit(id){const r=find(id);if(!r)return;window.openPricingExceptionModal?.(r,r.marketplace,r.target);const m=document.getElementById('pricingExceptionModal');if(m)m.dataset.editId=id;['manualExceptionType','manualExceptionRemarks','manualExceptionFrom','manualExceptionTo','manualExceptionPeriod'].forEach(()=>{});if(document.getElementById('manualExceptionType'))document.getElementById('manualExceptionType').value=r.exceptionType||'Pricing';if(document.getElementById('manualExceptionRemarks'))document.getElementById('manualExceptionRemarks').value=r.remarks||r.reason||'';}
  async function remove(id){const r=find(id);if(!r)return;const remarks=prompt('Removal remarks (optional):','')??null;if(remarks===null)return;try{if(typeof window.removePricingExceptionRecord!=='function')throw new Error('Exception removal service is not available.');await window.removePricingExceptionRecord(id,remarks);if(typeof window.v7EnsurePricingExceptionsLoaded==='function'){window.v7PricingExceptionsLoaded=false;await window.v7EnsurePricingExceptionsLoaded(true);}if(window.snapshotCache?.clear)window.snapshotCache.clear();renderManager();window.showWakeSuiteToast?.('Exception removed. If the raw issue still exists, it is actionable again.','success');}catch(e){window.showWakeSuiteToast?.(e.message,'error','Remove Exception failed');}}
  function open(mode='add'){window.showView?.('pricingExceptionsSection');document.querySelectorAll('[data-exception-tab]').forEach(b=>b.classList.toggle('active',b.dataset.exceptionTab===mode));mode==='manager'?managerWorkspace():addWorkspace();}
  window.openPricingExceptions=open;window.renderV92ExceptionManager=renderManager;window.editV92Exception=edit;window.removeV92Exception=remove;
  window.WakeSuiteModules?.register('pricingExceptions',{open,renderManager});
})();
