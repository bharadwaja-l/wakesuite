/* WakeSuite V9.3.4 · Shared Analytics Filter Bar
   Presentation/compatibility layer. Existing page controls remain the source
   of truth for the proven analytical engines. */
(function(){
  'use strict';
  const PAGES={
    dashboard:{section:'dashboardHome',period:'dashboardPeriod',from:'dashboardFromDate',to:'dashboardToDate',market:'dashboardMarketplace',category:'dashboardCategory',search:'dashboardGlobalSearch',apply:()=>{window.loadDashboardOverview?.();if(document.getElementById('dashboardGlobalSearch')?.value?.trim())window.runDashboardSearch?.();}},
    parity:{section:'priceParitySection',period:'priceParityPeriod',from:'priceParityFromDate',to:'priceParityToDate',selected:'priceParitySelectedDate',category:'priceParityCategory',search:'priceParitySearch',apply:()=>window.loadPriceParityReport?.()},
    revenue:{section:'revenueImpactSection',period:'revenueImpactPeriod',from:'revenueImpactFromDate',to:'revenueImpactToDate',category:'revenueImpactCategory',search:'revenueImpactSearch',apply:()=>window.loadRevenueImpactReport?.()},
    marketplace:{section:'marketplaceInsightsSection',period:'insightsPeriod',from:'insightsFromDate',to:'insightsToDate',market:'insightsMarketplace',category:'insightsCategory',apply:()=>window.loadMarketplaceInsights?.()},
    disparity:{section:'priceDisparityExplorerSection',period:'disparityExplorerPeriod',from:'disparityExplorerFromDate',to:'disparityExplorerToDate',category:'disparityExplorerCategory',search:'disparityExplorerSearch',apply:()=>window.loadDisparityExplorer?.()},
    history:{section:'historyHubSection',period:'historyPeriod',from:'historyFromDate',to:'historyToDate',market:'historyMarketplace',category:'historyCategory',search:'historySearch',apply:()=>window.loadHistoryHub?.()}
  };
  const PERIODS=[['today','Today'],['yesterday','Yesterday'],['last7','Last 7 Days'],['last14','Last 14 Days'],['last30','Last 30 Days'],['custom','Custom Range']];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'');
  function options(id,fallback=[]){const el=document.getElementById(id);return el?[...el.options].map(o=>({value:o.value,label:o.textContent.trim()})):fallback;}
  function build(key,p){
    const market=p.market?options(p.market,[{value:'all',label:'All Marketplaces'},{value:'amazon',label:'Amazon'},{value:'flipkart',label:'Flipkart'}]):[];
    const category=options(p.category,[{value:'all',label:'All Categories'}]);
    const currentPeriod=document.getElementById(p.period)?.value||'last7';
    return `<div class="ws-shared-analytics-bar" id="wsSharedAnalytics_${key}">
      <div class="ws-filter-field"><label>Period</label><select data-kind="period">${PERIODS.map(([v,l])=>`<option value="${v}" ${v===currentPeriod?'selected':''}>${l}</option>`).join('')}</select></div>
      ${market.length?`<div class="ws-filter-field"><label>Marketplace</label><select data-kind="market">${market.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`:''}
      <div class="ws-filter-field"><label>Category</label><select data-kind="category">${category.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>
      <div class="ws-filter-field ws-identifier-field"><label>Identifier Search</label><input data-kind="search" type="search" placeholder="ASIN, FSN, WF SKU, AZ SKU, FK SKU"/></div>
      <div class="ws-filter-actions"><button class="primary-btn" type="button" data-action="apply">Apply</button><button class="secondary-btn" type="button" data-action="reset">Reset</button></div>
      <div class="ws-custom-dates" data-kind="dates" hidden><label>From<input type="date" data-kind="from"></label><label>To<input type="date" data-kind="to"></label></div>
      <div class="ws-filter-chips" data-kind="chips"></div>
    </div>`;
  }
  function val(id){return document.getElementById(id)?.value??'';}
  function setLegacy(id,value){const el=document.getElementById(id);if(el&&value!==undefined){el.value=value;}}
  function syncFrom(p,bar){
    const pairs=[['period',p.period],['market',p.market],['category',p.category],['search',p.search],['from',p.from],['to',p.to]];
    pairs.forEach(([kind,id])=>{const el=bar.querySelector(`[data-kind="${kind}"]`);if(el&&id&&document.getElementById(id))el.value=val(id);});
    toggleDates(bar);renderChips(p,bar);
  }
  function syncTo(p,bar){
    const pairs=[['period',p.period],['market',p.market],['category',p.category],['search',p.search],['from',p.from],['to',p.to]];
    pairs.forEach(([kind,id])=>{const el=bar.querySelector(`[data-kind="${kind}"]`);if(el&&id)setLegacy(id,el.value);});
    renderChips(p,bar);
  }
  function toggleDates(bar){const period=bar.querySelector('[data-kind="period"]')?.value;const dates=bar.querySelector('[data-kind="dates"]');if(dates)dates.hidden=period!=='custom';}
  function renderChips(p,bar){
    const host=bar.querySelector('[data-kind="chips"]');if(!host)return;const chips=[];
    const add=(label,kind,all='all')=>{const e=bar.querySelector(`[data-kind="${kind}"]`);if(!e||!e.value||e.value===all)return;const text=e.selectedOptions?.[0]?.textContent||e.value;chips.push(`<span class="ws-filter-chip">${esc(label)}: ${esc(text)}</span>`);};
    add('Period','period','last7');add('Marketplace','market');add('Category','category');const q=bar.querySelector('[data-kind="search"]')?.value?.trim();if(q)chips.push(`<span class="ws-filter-chip">Search: ${esc(q)}</span>`);host.innerHTML=chips.join('');
  }
  function inject(key,p){
    const section=document.getElementById(p.section);if(!section||document.getElementById(`wsSharedAnalytics_${key}`))return;
    const anchor=section.querySelector('.command-surface, .v93-filter-grid, .disparity-explorer-controls, .module-actions, .panel');if(!anchor)return;
    const holder=document.createElement('div');holder.innerHTML=build(key,p);const bar=holder.firstElementChild;anchor.insertAdjacentElement('beforebegin',bar);section.classList.add('ws-shared-filter-active');
    syncFrom(p,bar);
    bar.addEventListener('change',e=>{if(e.target.matches('[data-kind="period"]'))toggleDates(bar);syncTo(p,bar);});
    bar.addEventListener('input',()=>renderChips(p,bar));
    bar.querySelector('[data-action="apply"]')?.addEventListener('click',()=>{syncTo(p,bar);p.apply?.();});
    bar.querySelector('[data-action="reset"]')?.addEventListener('click',()=>{const period=bar.querySelector('[data-kind="period"]');if(period)period.value='last7';const market=bar.querySelector('[data-kind="market"]');if(market&&market.querySelector('option[value="all"]'))market.value='all';const cat=bar.querySelector('[data-kind="category"]');if(cat)cat.value='all';const q=bar.querySelector('[data-kind="search"]');if(q)q.value='';syncTo(p,bar);toggleDates(bar);p.apply?.();});
  }
  function setup(){const dp=document.getElementById('dashboardPeriod');if(dp&&!dp.querySelector('option[value="last14"]')){const o=document.createElement('option');o.value='last14';o.textContent='Last 14 Days';dp.insertBefore(o,dp.querySelector('option[value="last15"]')||null);}Object.entries(PAGES).forEach(([k,p])=>inject(k,p));}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,180));
  window.WakeSuiteSharedAnalyticsFilterBar={setup};
})();
