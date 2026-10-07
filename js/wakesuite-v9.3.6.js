/* WakeSuite V9.3.6
 * - Data coverage controls for Amazon Business Reports + Amazon/Flipkart Order Reports
 * - UI cleanup for duplicate analytics filters and Business Insights overflow
 * - Route restoration for direct/hash navigation
 */
(function(){
  'use strict';
  const COVERAGE = new Set(['amazon_business_reports','amazon_order_report','flipkart_order_report']);
  const ORDER = new Set(['amazon_order_report','flipkart_order_report']);

  function currentUploadConfig(){
    try{
      const menu=document.getElementById('menu')?.value||'';
      const folder=document.getElementById('folder')?.value||'';
      return menu&&folder&&typeof getSelectedConfig==='function'?getSelectedConfig(menu,folder):null;
    }catch(_e){return null;}
  }

  function syncCoverageFields(){
    const cfg=currentUploadConfig();
    const show=!!cfg&&COVERAGE.has(cfg.id);
    const fromWrap=document.getElementById('sourceCoverageFromField');
    const toWrap=document.getElementById('sourceCoverageToField');
    const note=document.getElementById('sourceCoverageNote');
    [fromWrap,toWrap,note].forEach(el=>{if(el){el.hidden=!show;el.style.display=show?'':'none';}});
    if(!show)return;
    if(note){
      if(cfg.id==='amazon_business_reports'){
        note.innerHTML='<strong>Coverage required.</strong> Enter the exact Business Report date range. Overlapping Business Report ranges are blocked because period aggregates cannot be safely added together. Uploading the exact same range is treated as a replacement.';
      }else{
        note.innerHTML='<strong>Coverage protected.</strong> Data From / To can be entered manually or left blank; WakeSuite will identify the actual order-date range from the file. Overlapping Order Report uploads are allowed and duplicate atomic order lines are removed automatically.';
      }
    }
  }

  function removeRedundantBusinessNote(){
    document.querySelectorAll('#businessInsightsSection .v933-business-note').forEach(el=>el.remove());
  }

  function syncLiveImpactVisibility(){
    // V9.3.8: order evidence belongs exclusively to Disparity Orders.
    document.getElementById('liveDisparityImpactPanel')?.remove();
  }

  // Keep Business Insights date behavior attached after its dynamic controls are rebuilt.
  const baseBusinessOpen=window.openBusinessInsights;
  if(typeof baseBusinessOpen==='function'){
    window.openBusinessInsights=async function(...args){
      const out=await baseBusinessOpen.apply(this,args);
      window.WakeSuiteDateControls?.setup?.();
      removeRedundantBusinessNote();
      return out;
    };
  }

  const baseDisparityLoad=window.loadDisparityExplorer;
  if(typeof baseDisparityLoad==='function'){
    window.loadDisparityExplorer=async function(...args){
      const out=await baseDisparityLoad.apply(this,args);
      syncLiveImpactVisibility();
      return out;
    };
  }

  // Keep the selected shared-filter layout clean when modules are opened dynamically.
  const baseSharedSetup=window.WakeSuiteSharedAnalyticsFilterBar?.setup;
  if(typeof baseSharedSetup==='function'){
    window.WakeSuiteSharedAnalyticsFilterBar.setup=function(...args){
      const out=baseSharedSetup.apply(this,args);
      document.querySelectorAll('.ws-shared-analytics-bar').forEach(bar=>bar.closest('.app-view')?.classList.add('ws-shared-filter-active'));
      return out;
    };
  }

  function restoreHashView(){
    const id=String(location.hash||'').replace(/^#/,'');
    if(!id||id==='dashboardHome')return;
    const target=document.getElementById(id);
    if(!target?.classList.contains('app-view'))return;
    const active=document.querySelector('.app-view.active')?.id;
    if(active===id)return;
    try{
      if(id==='businessInsightsSection'){window.openBusinessInsights?.('pricing');return;}
      if(id==='revenueImpactSection'){window.showView?.(id);window.loadRevenueImpactReport?.();return;}
      if(id==='priceDisparityExplorerSection'){window.showView?.(id);window.loadDisparityExplorer?.();return;}
      if(id==='disparityOrdersSection'){window.showView?.(id);window.loadDisparityOrders?.();return;}
      if(id==='priceParitySection'){window.showView?.(id);window.loadPriceParityReport?.();return;}
      window.showView?.(id);
    }catch(e){console.warn('WakeSuite hash restore failed',e);}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('menu')?.addEventListener('change',()=>setTimeout(syncCoverageFields,0));
    document.getElementById('folder')?.addEventListener('change',syncCoverageFields);
    document.getElementById('disparityExplorerType')?.addEventListener('change',syncLiveImpactVisibility);
    syncCoverageFields();
    removeRedundantBusinessNote();
    setTimeout(()=>{
      document.querySelectorAll('.ws-shared-analytics-bar').forEach(bar=>bar.closest('.app-view')?.classList.add('ws-shared-filter-active'));
      restoreHashView();
    },450);
  });

  window.WakeSuiteV936={syncCoverageFields,syncLiveImpactVisibility};
})();
