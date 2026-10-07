/* WakeSuite V9.3.9
 * Priority report-action visibility guard.
 * Scope is intentionally small: do not change report qualification, email, APT or analytics logic.
 */
(function(){
  'use strict';

  const REQUIRED_ACTIONS=[
    {container:'#reportModuleActions',id:'reportDownloadButton',label:'Download Excel',onclick:'downloadHistoricalModule()'},
    {container:'#reportModuleActions',id:'reportEmailButton',label:'Share via Email',onclick:'openShareEmailModal()'},
    {container:'#disparityExplorerActions',id:'disparityExplorerDownloadButton',label:'Download Excel',onclick:'downloadDisparityExplorer()'},
    {container:'#disparityExplorerActions',id:'disparityExplorerEmailButton',label:'Share via Email',onclick:'openDisparityExplorerEmail()'},
    {container:'#disparityOrdersActions',id:'disparityOrdersDownloadButton',label:'Download Excel',onclick:'downloadDisparityOrders()'},
    {container:'#marketplaceInsightsActions',id:'marketplaceInsightsDownloadButton',label:'Download Excel',onclick:'downloadMarketplaceInsights()'}
  ];

  function ensureAction(def){
    const container=document.querySelector(def.container);
    if(!container)return;
    let button=document.getElementById(def.id);
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='secondary-btn';
      button.id=def.id;
      button.textContent=def.label;
      button.setAttribute('onclick',def.onclick);
      container.appendChild(button);
    }
    // These are normal report actions, not conditional business-state controls.
    button.removeAttribute('aria-hidden');
    button.style.removeProperty('display');
    button.style.removeProperty('visibility');
    button.style.removeProperty('opacity');
  }

  function stabilizeReportActions(){
    REQUIRED_ACTIONS.forEach(ensureAction);
  }

  document.addEventListener('DOMContentLoaded',stabilizeReportActions);
  window.addEventListener('pageshow',stabilizeReportActions);
  setTimeout(stabilizeReportActions,0);
  setTimeout(stabilizeReportActions,500);

  window.WakeSuiteV939={stabilizeReportActions};
})();
