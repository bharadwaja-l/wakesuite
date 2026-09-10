/* WakeSuite V9.3.4 · Shared Analytics Filter Bar
   UI layer only: preserves legacy controls as compatibility nodes and keeps
   page-specific analysis filters intact. */
(function(){
  'use strict';
  const PAGES = {
    dashboard:{section:'dashboardHome', period:'dashboardPeriod', from:'dashboardFromDate', to:'dashboardToDate', market:'dashboardMarketplace', category:'dashboardCategory', search:'dashboardGlobalSearch', apply:()=>{window.loadDashboardOverview?.(); if(document.getElementById('dashboardGlobalSearch')?.value?.trim()) window.runDashboardSearch?.();}},
    parity:{section:'priceParitySection', period:'priceParityPeriod', from:'priceParityFromDate', to:'priceParityToDate', selected:'priceParitySelectedDate', category:'priceParityCategory', search:'priceParitySearch', apply:()=>window.loadPriceParityReport?.()},
    revenue:{section:'revenueImpactSection', period:'revenueImpactPeriod', from:'revenueImpactFromDate', to:'revenueImpactToDate', category:'revenueImpactCategory', search:'revenueImpactSearch', apply:()=>window.loadRevenueImpactReport?.()},
    marketplace:{section:'marketplaceInsightsSection', period:'insightsPeriod', from:'insightsFromDate', to:'insightsToDate', market:'insightsMarketplace', category:'insightsCategory', search:null, apply:()=>window.loadMarketplaceInsights?.()},
    disparity:{section:'priceDisparityExplorerSection', period:'disparityExplorerPeriod', from:'disparityExplorerFromDate', to:'disparityExplorerToDate', category:'disparityExplorerCategory', search:'disparityExplorerSearch', apply:()=>window.loadDisparityExplorer?.()},
    history:{section:'historyHubSection', period:'historyPeriod', from:'historyFromDate', to:'historyToDate', market:'historyMarketplace', category:'historyCategory', search:'historySearch', apply:()=>window.loadHistoryHub?.()},
    pricingHistory:{section:'pricingHistorySection', period:'pricingHistoryPeriod', from:'pricingHistoryFromDate', to:'pricingHistoryToDate', market:'pricingHistoryMarketplace', category:'pricingHistoryCategory', search:'pricingHistorySearch', apply:()=>window.loadPricingHistory?.()},
    inventoryHistory:{section:'inventoryHistorySection', period:'inventoryHistoryPeriod', from:'inventoryHistoryFromDate', to:'inventoryHistoryToDate', market:'inventoryHistoryMarketplace', category:'inventoryHistoryCategory', search:'inventoryHistorySearch', apply:()=>window.loadInventoryHistory?.()},
    business:{section:'businessInsightsSection', period:'businessPeriod', from:'businessFromDate', to:'businessToDate', market:'businessMarketplace', category:'businessCategory', search:'businessSearch', apply:()=>window.loadBusinessInsightsV93?.()}
  };
  const PERIODS=[['today','Today'],['yesterday','Yesterday'],['selected','Selected Date'],['last7','Last 7 Days'],['last14','Last 14 Days'],['last30','Last 30 Days'],['custom','Custom Range']];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  function activeSection(){return Object.values(PAGES).find(p=>document.getElementById(p.section)?.classList.contains('active'));}
  function optionsFrom(id,fallback){const e=document.getElementById(id); if(!e)return fallback; return [...e.options].map(o=>({value:o.value,label:o.textContent.trim()}));}
  function makeBar(key,p){
    const id=`wsSharedAnalytics_${key}`;
    const marketOpts=p.market?optionsFrom(p.market,[{value:'all',label:'All Marketplaces'},{value:'amazon',label:'Amazon'},{value:'flipkart',label:'Flipkart'}]):[];
    return `<div class="ws-shared-analytics-bar" id="${id}" data-ws-analytics-bar="${key}">
      <div class="ws-filter-field ws-period-field"><label>Period</label><select data-ws-shared="period">${PERIODS.filter(([v])=>v!=='selected'||p.selected).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
      ${marketOpts.length?`<div class="ws-filter-field"><label>Marketplace</label><select data-ws-shared="market">${marketOpts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`:''}
      <div class="ws-filter-field"><label>Category</label><select data-ws-shared="category"><option value="all">All Categories</option></select></div>
      <div class="ws-filter-field ws-identifier-field"><label>Identifier Search</label><input data-ws-shared="search" type="search" placeholder="ASIN, FSN, WF SKU, AZ SKU, FK SKU"/></div>
      <div class="ws-filter-actions"><button class="primary-btn" type="button" data-ws-shared="apply">Apply</button><button class="secondary-btn" type="button" data-ws-shared="reset">Reset</button></div>
      <div class="ws-filter-chips" data-ws-shared="chips" aria-live="polite"></div>
      <div class="ws-custom-dates" data-ws-shared="dates" hidden><div data-ws-date-mode="range"><label>From<input type="date" data-ws-shared="from"></label><label>To<input type="date" data-ws-shared="to"></label></div><label data-ws-date-mode="single" hidden>Selected Date<input type="date" data-ws-shared="selected"></label></div>
    </div>`;
  }
  function inject(key,p){
    if(document.getElementById(`wsSharedAnalytics_${key}`))return;
    const section=document.getElementById(p.section); if(!section)return;
    const target=section.querySelector('.command-surface, .v93-filter-grid, .control-row, .disparity-explorer-controls, .business-insights-shell > .panel');
    if(!target)return;
    const host=document.createElement('div'); host.innerHTML=makeBar(key,p); const bar=host.firstElementChild;
    if(key==='business'){ const host=document.getElementById('businessInsightsContent'); if(host) host.insertAdjacentElement('beforebegin',bar); else return; } else target.insertAdjacentElement('beforebegin',bar);
    const legacyIds=[p.period,p.from,p.to,p.selected,p.market,p.category,p.search].filter(Boolean); legacyIds.forEach(id=>document.getElementById(id)?.classList.add('ws-shared-legacy-hidden')); if(key==='dashboard') target.classList.add('ws-legacy-filter-compat');
    bind(key,p,bar); syncFromLegacy(key,p,bar); populateCategory(key,p,bar); updateDates(bar,p);
  }
  function populateCategory(key,p,bar){const dst=bar.querySelector('[data-ws-shared="category"]'); if(!dst)return; const src=document.getElementById(p.category); if(!src)return; dst.innerHTML=[...src.options].map(o=>`<option value="${esc(o.value)}">${esc(o.textContent.trim())}</option>`).join(''); dst.value=src.value||'all';}
  function syncFromLegacy(key,p,bar){
    const set=(kind,id)=>{const src=document.getElementById(id),dst=bar.querySelector(`[data-ws-shared="${kind}"]`);if(src&&dst)dst.value=src.value||dst.value;};
    set('period',p.period); set('market',p.market); set('category',p.category); set('search',p.search); set('from',p.from); set('to',p.to); set('selected',p.selected); updateDates(bar,p); renderChips(key,p,bar);
  }
  function syncToLegacy(key,p,bar){
    const copy=(kind,id)=>{const src=bar.querySelector(`[data-ws-shared="${kind}"]`),dst=document.getElementById(id);if(src&&dst){dst.value=src.value;}};
    copy('period',p.period); if(p.market)copy('market',p.market); copy('category',p.category); copy('search',p.search); if(p.selected){const sharedPeriod=bar.querySelector('[data-ws-shared="period"]')?.value;if(sharedPeriod==='selected'&&document.getElementById(p.selected)){const d=document.getElementById(p.selected);const from=bar.querySelector('[data-ws-shared="from"]');if(from)d.value=from.value||d.value;}}
    const period=bar.querySelector('[data-ws-shared="period"]')?.value;
    if(period==='custom'){copy('from',p.from);copy('to',p.to);} else if(period==='selected'&&p.selected){copy('selected',p.selected);} else {const from=bar.querySelector('[data-ws-shared="from"]')?.value,to=bar.querySelector('[data-ws-shared="to"]')?.value;if(from&&document.getElementById(p.from))document.getElementById(p.from).value=from;if(to&&document.getElementById(p.to))document.getElementById(p.to).value=to;}
    renderChips(key,p,bar);
  }
  function updateDates(bar,p){const period=bar.querySelector('[data-ws-shared="period"]')?.value; const dates=bar.querySelector('[data-ws-shared="dates"]'); if(dates)dates.hidden=!['custom','selected'].includes(period); const range=bar.querySelector('[data-ws-date-mode="range"]'),single=bar.querySelector('[data-ws-date-mode="single"]'); if(range)range.hidden=period!=='custom'; if(single)single.hidden=period!=='selected';}
  function renderChips(key,p,bar){const host=bar.querySelector('[data-ws-shared="chips"]');if(!host)return;const vals=[];const add=(label,id,all='all')=>{const e=document.getElementById(id);if(!e||e.value===all||!e.value)return;const text=e.selectedOptions?.[0]?.textContent?.trim()||e.value;vals.push(`<button type="button" class="ws-filter-chip" data-remove="${id}">${esc(label)}: ${esc(text)} ×</button>`);};
    add('Period',p.period,'today'); add('Marketplace',p.market,'all'); add('Category',p.category,'all'); const q=document.getElementById(p.search)?.value?.trim(); if(q)vals.push(`<button type="button" class="ws-filter-chip" data-remove="${p.search}">Search: ${esc(q)} ×</button>`); host.innerHTML=vals.join('');
  }
  function reset(key,p,bar){const period=bar.querySelector('[data-ws-shared="period"]');if(period)period.value='last7';const market=bar.querySelector('[data-ws-shared="market"]');if(market)market.value=market.querySelector('option[value="all"]')?'all':market.value;const cat=bar.querySelector('[data-ws-shared="category"]');if(cat)cat.value='all';const search=bar.querySelector('[data-ws-shared="search"]');if(search)search.value='';const from=bar.querySelector('[data-ws-shared="from"]');if(from)from.value='';const to=bar.querySelector('[data-ws-shared="to"]');if(to)to.value='';const selected=bar.querySelector('[data-ws-shared="selected"]');if(selected)selected.value='';syncToLegacy(key,p,bar);p.apply?.();}
  function bind(key,p,bar){
    bar.addEventListener('change',e=>{const t=e.target;if(t.matches('[data-ws-shared="period"]'))updateDates(bar,p);syncToLegacy(key,p,bar);});
    bar.addEventListener('input',e=>{if(e.target.matches('[data-ws-shared="search"], [data-ws-shared="from"], [data-ws-shared="to"], [data-ws-shared="selected"]'))renderChips(key,p,bar);});
    bar.querySelector('[data-ws-shared="apply"]')?.addEventListener('click',()=>{syncToLegacy(key,p,bar);p.apply?.();});
    bar.querySelector('[data-ws-shared="reset"]')?.addEventListener('click',()=>reset(key,p,bar));
    bar.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const id=b.dataset.remove;const src=document.getElementById(id);if(src){src.value=src.tagName==='SELECT'?'all':'';src.dispatchEvent(new Event('change',{bubbles:true}));}syncFromLegacy(key,p,bar);});
    document.addEventListener('change',e=>{if([p.period,p.market,p.category,p.search,p.from,p.to].includes(e.target?.id))syncFromLegacy(key,p,bar);});
  }
  function hideLegacy(){document.querySelectorAll('.ws-legacy-filter-compat').forEach(el=>el.setAttribute('data-ws-legacy-hidden','true'));document.querySelectorAll('.ws-shared-legacy-hidden').forEach(el=>el.setAttribute('data-ws-shared-hidden','true'));}
  function setup(){const dp=document.getElementById('dashboardPeriod');if(dp&&!dp.querySelector('option[value="last14"]')){const o=document.createElement('option');o.value='last14';o.textContent='Last 14 Days';dp.insertBefore(o,dp.querySelector('option[value="last15"]')||null);}Object.entries(PAGES).forEach(([key,p])=>{if(key!=='business')inject(key,p);});hideLegacy();}
  function setupBusiness(){const p=PAGES.business;if(!document.getElementById(p.section))return;if(!document.getElementById('businessMarketplace'))return;inject('business',p);hideLegacy();}
  const observer=new MutationObserver(()=>{if(document.getElementById('businessMarketplace'))setupBusiness();});
  const oldRange=window.v4DateRangeForPeriod; if(typeof oldRange==='function'&&!window.__ws934DateRangePatched){window.__ws934DateRangePatched=true;window.v4DateRangeForPeriod=function(period,from,to){if(period==='last14'){const today=todayIso();return [v6AddDaysIso(today,-13),today];}return oldRange(period,from,to);};}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(setup,120);observer.observe(document.getElementById('businessInsightsContent')||document.body,{childList:true,subtree:true});setTimeout(setupBusiness,250);});
  window.WakeSuiteSharedAnalyticsFilterBar={setup,refresh:setup};
})();
