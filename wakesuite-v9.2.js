/* WakeSuite V9.2 integration layer · 22 Aug 2026 · AI intentionally excluded */
(function(){
  function today(){return typeof window.todayIso==='function'?window.todayIso():new Date().toISOString().slice(0,10);}
  // Mobile drawer: fixed off-canvas, never shifts the document.
  const baseToggle=window.toggleMobileSidebar;
  window.toggleMobileSidebar=function(force){
    const side=document.querySelector('.sidebar');if(!side)return baseToggle?.();
    let backdrop=document.getElementById('v92MobileSidebarBackdrop');if(!backdrop){backdrop=document.createElement('div');backdrop.id='v92MobileSidebarBackdrop';backdrop.className='mobile-sidebar-backdrop';backdrop.hidden=true;backdrop.addEventListener('click',()=>window.toggleMobileSidebar(false));document.body.appendChild(backdrop);}
    const open=typeof force==='boolean'?force:!side.classList.contains('mobile-open');side.classList.toggle('mobile-open',open);document.body.classList.toggle('mobile-nav-open',open);backdrop.hidden=!open;
  };
  document.addEventListener('click',e=>{if(innerWidth<=760&&e.target.closest('.sidebar .nav-link'))window.toggleMobileSidebar(false);});

  // Dashboard identifier search: a single exact identifier opens full Product 360 when resolvable.
  const baseSearch=window.runDashboardSearch;
  window.runDashboardSearch=async function(){
    const q=String(document.getElementById('dashboardGlobalSearch')?.value||'').trim();if(!q)return baseSearch?.();
    const res=await window.WakeSuiteProductResolver?.resolve(q,{date:document.getElementById('dashboardToDate')?.value||today()});
    if(res&&(res.amazon.length||res.flipkart.length)){await window.WakeSuiteProduct360?.open(q,{context:'global'});return;}
    return baseSearch?.();
  };

  // Pricing Exceptions modal periods are date-only and support Today / Custom / No Expiry.
  function syncExceptionPeriod(prefix){const p=document.getElementById(prefix+'Period'),from=document.getElementById(prefix+(prefix==='manualException'?'From':'EffectiveFrom')),to=document.getElementById(prefix+(prefix==='manualException'?'To':'EffectiveTo'));if(!p||!from||!to)return;const mode=p.value;if(mode==='today'){from.value=today();to.value=today();from.disabled=true;to.disabled=true;}else if(mode==='no_expiry'){if(!from.value)from.value=today();to.value='';from.disabled=false;to.disabled=true;}else{from.disabled=false;to.disabled=false;if(!from.value)from.value=today();if(!to.value)to.value=from.value;}}
  document.addEventListener('change',e=>{if(e.target.id==='exceptionPeriod')syncExceptionPeriod('exception');if(e.target.id==='manualExceptionPeriod')syncExceptionPeriod('manualException');});

  // Ensure Min/Max Pricing Issues no longer expose general Pricing Exception treatment.
  const basePricingIssues=window.loadAmazonPricingIssues;
  window.loadAmazonPricingIssues=async function(...args){const r=await basePricingIssues?.(...args);document.querySelectorAll('#amazonPricingIssuesSection select option').forEach(o=>{if(/exception|parity|deal tag|opt-in/i.test(o.textContent||''))o.remove();});return r;};

  // Public aliases expected by declarative V9.2 HTML.
  window.openPricingExceptions=window.openPricingExceptions||function(mode){window.showView?.('pricingExceptionsSection');};
  window.openBusinessInsights=window.openBusinessInsights||function(){window.showView?.('businessInsightsSection');};

  document.addEventListener('DOMContentLoaded',()=>{
    syncExceptionPeriod('exception');syncExceptionPeriod('manualException');
    // A safety net against accidental page-level horizontal overflow.
    document.documentElement.style.overflowX='hidden';document.body.style.overflowX='hidden';
  },{once:true});
})();

/* V9.2 actionability + exception edit/remove integrity */
(function(){
  if(typeof window.ws91FindException==='function'){
    const base=window.ws91FindException;
    window.ws91FindException=function(row,marketplace,target,reportDate){
      const ex=base(row,marketplace,target,reportDate);return ex&&String(ex.status||'active').toLowerCase()==='removed'?null:ex;
    };
  }

  const baseManualSave=window.saveManualPricingException;
  window.saveManualPricingException=async function(){
    const modal=document.getElementById('pricingExceptionModal'),editId=modal?.dataset.editId||'';
    const period=document.getElementById('manualExceptionPeriod')?.value||'today';
    const from=document.getElementById('manualExceptionFrom')?.value||(typeof window.todayIso==='function'?window.todayIso():new Date().toISOString().slice(0,10));
    const to=period==='no_expiry'?'9999-12-31':(document.getElementById('manualExceptionTo')?.value||from);
    const remarks=String(document.getElementById('manualExceptionRemarks')?.value||'').trim();
    if(!remarks){window.showWakeSuiteToast?.('Remarks / Reason is required.','warning');return;}
    if(!editId)return baseManualSave?.();
    try{
      const patch={target:document.getElementById('manualExceptionTarget')?.value||'all_pricing',rule:document.getElementById('manualExceptionRule')?.value||'full_exclusion',ruleValue:Number(document.getElementById('manualExceptionRuleValue')?.value||0),ruleValueTo:Number(document.getElementById('manualExceptionRuleValueTo')?.value||0),exceptionType:document.getElementById('manualExceptionType')?.value||'Pricing',effectiveFrom:from,effectiveTo:to,remarks,status:'active'};
      await window.updatePricingExceptionRecord(editId,patch);delete modal.dataset.editId;window.closePricingExceptionModal?.();
      if(typeof window.v7EnsurePricingExceptionsLoaded==='function'){window.v7PricingExceptionsLoaded=false;await window.v7EnsurePricingExceptionsLoaded(true);}window.snapshotCache?.clear?.();await window.openPricingExceptions?.('manager');window.showWakeSuiteToast?.('Exception updated.','success');
    }catch(e){window.showWakeSuiteToast?.(e.message,'error','Unable to update exception');}
  };
})();
