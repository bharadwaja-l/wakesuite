/* WakeSuite V9.3.2 · shared UI controls, date selector, currency/decimal formatting */
(function(){
  'use strict';
  const nfMoney = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2});
  const nfPct = new Intl.NumberFormat('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});
  const number = v => {
    if(v===null||v===undefined||v==='') return null;
    const n=Number(String(v).replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:null;
  };
  function money(v){const n=number(v);return n===null?'—':nfMoney.format(n);}
  function decimal(v,d=2){const n=number(v);return n===null?'—':n.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:d});}
  function percent(v,d=2){const n=number(v);return n===null?'—':`${nfPct.format(Number(n.toFixed(d)))}%`;}

  // Keep full precision internally; only presentation is rounded.
  window.WakeSuiteUI={...(window.WakeSuiteUI||{}),money,decimal,percent,number};
  window.formatINR=function(v){const n=number(v);return nfMoney.format(n===null?0:n);};

  function setDisplay(el,show){if(!el)return;el.hidden=!show;el.style.display=show?'':'none';}
  function dateSetup(selectId,{singleId,fromId,toId,rangeWrap}={}){
    const select=document.getElementById(selectId);if(!select)return;
    const single=singleId?document.getElementById(singleId):null,from=fromId?document.getElementById(fromId):null,to=toId?document.getElementById(toId):null,wrap=rangeWrap?document.querySelector(rangeWrap):null;
    const render=()=>{
      const v=select.value;
      const isSingle=['single','selected'].includes(v),isCustom=v==='custom';
      setDisplay(single,isSingle);
      if(wrap){setDisplay(wrap,isCustom);}else{setDisplay(from,isCustom);setDisplay(to,isCustom);}
      if(!isCustom && !wrap){setDisplay(from,false);setDisplay(to,false);}
    };
    if(!select.dataset.ws932DateBound){select.addEventListener('change',render);select.dataset.ws932DateBound='1';}render();
  }
  function setupDates(){
    dateSetup('dashboardPeriod',{fromId:'dashboardFromDate',toId:'dashboardToDate',rangeWrap:'#dashboardHome .date-range'});
    dateSetup('insightsPeriod',{fromId:'insightsFromDate',toId:'insightsToDate'});
    dateSetup('businessPeriod',{fromId:'businessFromDate',toId:'businessToDate'});
    dateSetup('priceParityPeriod',{singleId:'priceParitySelectedDate',fromId:'priceParityFromDate',toId:'priceParityToDate'});
    dateSetup('revenueImpactPeriod',{fromId:'revenueImpactFromDate',toId:'revenueImpactToDate'});
    dateSetup('pricingHistoryPeriod',{fromId:'pricingHistoryFromDate',toId:'pricingHistoryToDate'});
    dateSetup('inventoryHistoryPeriod',{fromId:'inventoryHistoryFromDate',toId:'inventoryHistoryToDate'});
    dateSetup('historyPeriod',{fromId:'historyFromDate',toId:'historyToDate'});
    dateSetup('suppressionManagementPeriod',{fromId:'suppressionManagementFromDate',toId:'suppressionManagementToDate'});
    dateSetup('dataAdminDateMode',{singleId:'dataAdminDate',fromId:'dataAdminFromDate',toId:'dataAdminToDate'});
    dateSetup('sourceDeleteDateMode',{singleId:'sourceDeleteDate',fromId:'sourceDeleteFromDate',toId:'sourceDeleteToDate'});
  }

  const moneyHeaders=/revenue|rev impact|impact \/ day|price|mrp|sales|asp|exposure|loss/i;
  function formatTableCurrency(table){
    if(!table||table.dataset.wsCurrencyFormatted==='busy')return;
    const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    if(!heads.length)return;
    table.dataset.wsCurrencyFormatted='busy';
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      [...tr.children].forEach((td,i)=>{
        if(!moneyHeaders.test(heads[i]||''))return;
        const t=td.textContent.trim();
        if(!t||/[A-Za-z]/.test(t)||t.includes('%')||t==='—')return;
        const n=number(t);if(n===null)return;
        // Do not convert identifiers/count columns just because "price" appears in unrelated text.
        if(/count|days|status|date/i.test(heads[i]||''))return;
        td.textContent=money(n);
      });
    });
    delete table.dataset.wsCurrencyFormatted;
  }
  function formatAllTables(root=document){root.querySelectorAll?.('table.result-table').forEach(formatTableCurrency);}
  let timer=null;
  function scheduleFormat(){clearTimeout(timer);timer=setTimeout(()=>formatAllTables(),60);}

  document.addEventListener('DOMContentLoaded',()=>{
    setupDates();formatAllTables();
    const mo=new MutationObserver(scheduleFormat);mo.observe(document.body,{childList:true,subtree:true});
  },{once:true});
  window.WakeSuiteDateControls={setup:setupDates,dateSetup};
})();
