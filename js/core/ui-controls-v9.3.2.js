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
        const formatted=money(n);
        if(td.textContent!==formatted)td.textContent=formatted;
      });
    });
    delete table.dataset.wsCurrencyFormatted;
  }
  function formatAllTables(root=document){root.querySelectorAll?.('table.result-table').forEach(formatTableCurrency);}
  // Observe table changes only. Disconnect while formatting so our own text
  // replacements cannot schedule another pass over the report tables.
  let timer=null,observer=null;
  const pendingTables=new Set();
  const observe=()=>observer.observe(document.body,{childList:true,characterData:true,subtree:true});
  function collectTables(node){
    const el=node?.nodeType===1?node:node?.parentElement;
    if(!el)return;
    const parent=el.closest?.('table.result-table');
    if(parent)pendingTables.add(parent);
    el.querySelectorAll?.('table.result-table').forEach(table=>pendingTables.add(table));
  }
  function scheduleFormat(records){
    for(const record of records){
      // A mutation of body/main must not rescan every existing descendant table.
      const el=record.target?.nodeType===1?record.target:record.target?.parentElement;
      const table=el?.closest?.('table.result-table');
      if(table)pendingTables.add(table);
      for(const node of record.addedNodes||[])collectTables(node);
    }
    if(!pendingTables.size||timer!==null)return;
    timer=setTimeout(()=>{
      timer=null;
      observer.disconnect();
      try{
        for(const table of pendingTables)if(table.isConnected)formatTableCurrency(table);
      }finally{
        pendingTables.clear();
        observe();
      }
    },60);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    setupDates();formatAllTables();
    observer=new MutationObserver(scheduleFormat);observe();
  },{once:true});
  window.WakeSuiteDateControls={setup:setupDates,dateSetup};
})();
