/* WakeSuite V9.3.10
 * Individual report controls + permission hydration fix.
 * Priority sale-readiness patch.
 *
 * Scope:
 * - Preserve Download + Share actions on individual reports when the user's
 *   effective role/permission allows them.
 * - Backward-compatible permission hydration for access records created before
 *   the `download` key was persisted explicitly.
 * - Restore the Price Disparity report-type dropdown for strict side-menu views.
 * - Keep Listing / Live / MRP as separate operational reports; changing the
 *   dropdown navigates to the corresponding strict report rather than mixing rows.
 * - Correct stale URL hash when a Price Disparity side-menu report is opened.
 */
(function(){
  'use strict';

  const DOWNLOAD_BUTTONS=[
    'reportDownloadButton',
    'disparityExplorerDownloadButton',
    'disparityOrdersDownloadButton',
    'marketplaceInsightsDownloadButton',
    'dashboardSearchDownload'
  ];

  function mergedPermissions(){
    try{
      if(typeof v7CurrentPermissions==='function') return v7CurrentPermissions();
    }catch(_e){}
    const access=window.currentWakeSuiteAccess||{};
    const fallback={view:true,upload:false,download:true,email:false,settings:false,userAdmin:false};
    try{
      const preset=(typeof ACCESS_ROLE_PRESETS!=='undefined'&&ACCESS_ROLE_PRESETS[access.role])||fallback;
      if(access.role==='super_admin') return {...preset,download:true,email:true};
      return {...preset,...(access.permissions||{})};
    }catch(_e){
      return {...fallback,...(access.permissions||{})};
    }
  }

  // The legacy V5 permission helper returned the raw stored permissions object.
  // Older access documents may not contain a `download` field even though their
  // role grants download. Merge role defaults first, then apply explicit overrides.
  try{
    if(typeof v5CurrentPermissions==='function'){
      v5CurrentPermissions=function(){ return mergedPermissions(); };
    }
  }catch(_e){}

  function syncReportActionPermissions(){
    const permissions=mergedPermissions();
    const canDownload=permissions.download!==false;
    const canEmail=!!permissions.email;

    DOWNLOAD_BUTTONS.forEach(id=>{
      const button=document.getElementById(id);
      if(!button)return;
      button.classList.toggle('ws-permission-hidden',!canDownload);
      if(canDownload){
        button.style.removeProperty('display');
        button.style.removeProperty('visibility');
        button.style.removeProperty('opacity');
      }
    });

    // Do not unhide contextually-hidden email controls (e.g. dashboard analysis).
    ['reportEmailButton','disparityExplorerEmailButton'].forEach(id=>{
      const button=document.getElementById(id);
      if(!button)return;
      button.classList.toggle('ws-permission-hidden',!canEmail);
      if(canEmail){
        button.style.removeProperty('display');
        button.style.removeProperty('visibility');
        button.style.removeProperty('opacity');
      }
    });
  }

  function setDisparityHash(){
    try{
      const base=location.href.split('#')[0];
      history.replaceState({wakeSuite:true,viewId:'priceDisparityExplorerSection'},'',base+'#priceDisparityExplorerSection');
    }catch(_e){}
  }

  function configureDisparityTypeSelector(){
    const select=document.getElementById('disparityExplorerType');
    if(!select)return;
    let strict=false;
    try{ strict=v6DisparityExplorerMode==='strict'; }catch(_e){}
    const allOption=select.querySelector('option[value="all"]');

    if(strict){
      select.hidden=false;
      select.disabled=false;
      select.removeAttribute('hidden');
      select.setAttribute('aria-label','Price disparity report type');
      if(allOption) allOption.hidden=true;
      try{
        if(v6DisparityExplorerStrictType) select.value=v6DisparityExplorerStrictType;
      }catch(_e){}
    }else{
      if(allOption) allOption.hidden=false;
    }
  }

  function wireDisparityTypeNavigation(){
    const select=document.getElementById('disparityExplorerType');
    if(!select||select.dataset.wsV9310Wired==='1')return;
    select.dataset.wsV9310Wired='1';
    select.addEventListener('change',event=>{
      let strict=false;
      let market='amazon';
      try{ strict=v6DisparityExplorerMode==='strict'; }catch(_e){}
      if(!strict)return;
      const type=String(event.target.value||'');
      if(!['listing','live','mrp'].includes(type))return;
      try{ market=currentDisparityExplorerMarketplace||market; }catch(_e){}
      const key=`${market}_${type}`;
      if(typeof openHistoricalModule==='function') openHistoricalModule(key);
    });
  }

  // Wrap the strict Price Disparity opener so its report selector and actions
  // remain visible after the legacy function intentionally hides the type select.
  try{
    if(typeof openSideMenuPriceView==='function'){
      const baseOpenSideMenuPriceView=openSideMenuPriceView;
      openSideMenuPriceView=async function(...args){
        const out=await baseOpenSideMenuPriceView.apply(this,args);
        configureDisparityTypeSelector();
        wireDisparityTypeNavigation();
        syncReportActionPermissions();
        setDisparityHash();
        return out;
      };
    }
  }catch(_e){}

  // Re-apply effective permissions after the existing permission engine runs.
  try{
    if(typeof applyAccessPermissions==='function'){
      const baseApplyAccessPermissions=applyAccessPermissions;
      applyAccessPermissions=function(...args){
        const out=baseApplyAccessPermissions.apply(this,args);
        syncReportActionPermissions();
        return out;
      };
      window.applyAccessPermissions=applyAccessPermissions;
    }
  }catch(_e){}

  function stabilize(){
    configureDisparityTypeSelector();
    wireDisparityTypeNavigation();
    syncReportActionPermissions();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    stabilize();
    setTimeout(stabilize,250);
    setTimeout(stabilize,900);
  });
  window.addEventListener('pageshow',stabilize);

  window.WakeSuiteV9310={
    mergedPermissions,
    syncReportActionPermissions,
    configureDisparityTypeSelector,
    wireDisparityTypeNavigation
  };
})();
