/* Shared loading feedback for report controls throughout WakeSuite. */
(function(){
  'use strict';
  let active=0;
  const wrapped=new WeakMap(),replayed=new WeakSet(),locks=new Map(),reads=new Map();
  function surface(){
    let el=document.getElementById('wsReportLoading');
    if(!el){el=document.createElement('div');el.id='wsReportLoading';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<div class="ws-report-loading-card"><span class="ws-report-spinner" aria-hidden="true"></span><strong>Loading data…</strong><span>Please wait while the selected report is prepared.</span></div>';document.body.append(el);}
    return el;
  }
  function show(){
    surface().hidden=false;
    document.querySelectorAll('main.main, #mainSidebar').forEach(el=>{if(!locks.has(el))locks.set(el,{inert:el.inert,busy:el.getAttribute('aria-busy')});el.inert=true;el.setAttribute('aria-busy','true');});
  }
  function hide(){
    surface().hidden=true;
    for(const [el,old] of locks){el.inert=old.inert;if(old.busy===null)el.removeAttribute('aria-busy');else el.setAttribute('aria-busy',old.busy);}locks.clear();
  }
  function paint(){return new Promise(resolve=>{
    let done=false;const finish=()=>{if(!done){done=true;resolve();}};
    setTimeout(finish,80);
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(finish,0));
    else setTimeout(finish,0);
  });}
  function yieldUi(){return new Promise(resolve=>setTimeout(resolve,0));}
  async function run(fn,context,args){
    const first=active++===0;
    if(first)show();
    try{if(first)await paint();return await fn.apply(context,args);}
    catch(error){
      if(!error?.wsLoadingReported){
        try{error.wsLoadingReported=true;}catch(_e){}
        if(typeof window.showWakeSuiteToast==='function')window.showWakeSuiteToast(error?.message||'Unable to load data. Please try again.','error','Report loading failed');
      }
      throw error;
    }finally{if(--active===0)hide();}
  }
  function wrap(fn){
    if(typeof fn!=='function')return fn;
    if(wrapped.has(fn))return wrapped.get(fn);
    const result=function(...args){return run(fn,this,args);};
    wrapped.set(fn,result);wrapped.set(result,result);return result;
  }
  window.WakeSuiteLoading={wrap,paint,yield:yieldUi,get busy(){return active>0;}};
  window.WakeSuiteReadOnce=function(key,read){
    if(reads.has(key))return reads.get(key);
    const pending=Promise.resolve().then(read).finally(()=>{if(reads.get(key)===pending)reads.delete(key);});
    reads.set(key,pending);return pending;
  };
  // Replay native handlers intact after painting. Never replay upload changes.
  document.addEventListener('change',event=>{
    const target=event.target;
    if(replayed.has(event)||!target?.matches?.('select,input[type="date"],input[type="month"]')||!target.closest?.('.app-view'))return;
    event.stopImmediatePropagation();
    if(active)return;
    run(()=>{if(!target.isConnected)return;const replay=new Event('change',{bubbles:true,cancelable:true});replayed.add(replay);target.dispatchEvent(replay);},null,[]).catch(()=>{});
  },true);
  function install(){
    const names=['loadSnapshotCached','v4LoadSnapshotsForRange','v7LoadSnapshots','v72LoadStoredSnapshotOnly',
      'loadDashboardOverview','runDashboardSearch','loadHistoricalModule','loadDisparityExplorer','loadMarketplaceInsights',
      'loadMarketplaceData','loadPricingHistory','loadInventoryHistory','loadDailyCommunications','loadOperationalControls',
      'loadSuppressionManagement','loadAmazonPricingIssues','loadPriceParityReport','loadPriceUpdatesPreview','loadPriceUpdatesV93',
      'loadBusinessInsightsV93','loadHistoryHub','loadDisparityOrders','loadExceptionInsights','loadPricingExceptionsManager',
      'loadDataAdministrationAudit','loadDataAdminAudit'];
    names.forEach(name=>{if(typeof window[name]==='function')window[name]=wrap(window[name]);});
  }
  document.addEventListener('DOMContentLoaded',install,{once:true});
  window.WakeSuiteLoading.install=install;
})();
