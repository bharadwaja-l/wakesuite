/* WakeSuite V9.3 · context-aware in-app navigation history */
(function(){
  const stack=[]; let restoring=false;
  const CONTROL_SELECTOR='input[id],select[id],textarea[id]';
  function activeView(){return document.querySelector('.app-view.active')?.id||'dashboardHome';}
  function capture(){
    const viewId=activeView(),view=document.getElementById(viewId),controls={};
    view?.querySelectorAll(CONTROL_SELECTOR).forEach(el=>{if(el.type==='file'||el.type==='password')return;if(el.type==='checkbox'||el.type==='radio')controls[el.id]={checked:el.checked,value:el.value};else if(el.multiple)controls[el.id]=[...el.selectedOptions].map(o=>o.value);else controls[el.id]=el.value;});
    return {viewId,controls,scrollY:window.scrollY||0,ts:Date.now()};
  }
  function restoreControls(state){Object.entries(state?.controls||{}).forEach(([id,val])=>{const el=document.getElementById(id);if(!el)return;try{if(el.type==='checkbox'||el.type==='radio'){el.checked=!!val.checked;el.value=val.value??el.value;}else if(el.multiple&&Array.isArray(val)){[...el.options].forEach(o=>o.selected=val.includes(o.value));}else el.value=val??'';}catch(_){}});}
  function renderForView(id){
    try{
      if(id==='dashboardHome') window.loadDashboardOverview?.();
      else if(id==='pricingHistorySection') window.loadPricingHistory?.();
      else if(id==='inventoryHistorySection') window.loadInventoryHistory?.();
      else if(id==='marketplaceDataSection') window.loadMarketplaceData?.();
      else if(id==='suppressionManagementSection') window.loadSuppressionManagement?.();
      else if(id==='historyHubSection') window.loadHistoryHub?.();
      else if(id==='priceParitySection') window.loadPriceParityReport?.();
      else if(id==='revenueImpactSection') window.loadRevenueImpactReport?.();
    }catch(error){console.warn('WakeSuite back refresh failed',error);}
  }
  function navigate(viewId,opts={}){
    if(!restoring&&opts.push!==false&&activeView()!==viewId) stack.push(capture());
    window.showView?.(viewId);
    if(opts.controls) restoreControls({controls:opts.controls});
    if(opts.hash!==false){try{history.pushState({wakeSuite:true,viewId},'',location.href.split('#')[0]+'#'+viewId);}catch(_){}}
    return viewId;
  }
  function back(){
    const state=stack.pop();
    if(!state){if(history.length>1){history.back();return;}window.showView?.('dashboardHome');window.loadDashboardOverview?.();return;}
    restoring=true;window.showView?.(state.viewId);restoreControls(state);renderForView(state.viewId);requestAnimationFrame(()=>window.scrollTo({top:state.scrollY||0,behavior:'auto'}));setTimeout(()=>restoring=false,0);
  }
  window.addEventListener('popstate',()=>{if(restoring)return;const state=stack.pop();if(!state)return;restoring=true;window.showView?.(state.viewId);restoreControls(state);renderForView(state.viewId);requestAnimationFrame(()=>window.scrollTo(0,state.scrollY||0));setTimeout(()=>restoring=false,0);});
  window.WakeSuiteNavigation={stack,capture,navigate,back};
  window.wakeSuiteNavigate=navigate;window.wakeSuiteBack=back;
})();
