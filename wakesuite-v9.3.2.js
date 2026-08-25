/* WakeSuite V9.3.2 · consolidated UI/data integration safeguards */
(function(){
  'use strict';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'');
  const nf=v=>typeof formatNumber==='function'?formatNumber(Number(v)||0):String(Number(v)||0);
  const money=v=>window.WakeSuiteUI?.money?WakeSuiteUI.money(v):(typeof formatINR==='function'?formatINR(Number(v)||0):String(v??''));
  const isSuper=()=>window.currentWakeSuiteAccess?.role==='super_admin';
  const can=a=>isSuper()||(typeof v7HasAction==='function'&&v7HasAction(a));
  const lower=v=>String(v??'').toLowerCase();
  function dashboardContext(){return{period:document.getElementById('dashboardPeriod')?.value||'today',from:document.getElementById('dashboardFromDate')?.value||'',to:document.getElementById('dashboardToDate')?.value||'',date:document.getElementById('dashboardToDate')?.value||document.getElementById('dashboardDate')?.value||'',category:document.getElementById('dashboardCategory')?.value||'all',marketplace:document.getElementById('dashboardMarketplace')?.value||'all'};}
  function periodForSuppression(p){return({last14:'last15',custom:'custom',today:'today',yesterday:'yesterday',last7:'last7',last15:'last15',last30:'last30'}[p]||'last7');}

  /* Dashboard native routing extension */
  const baseDashboardDestination=window.openDashboardDestination;
  window.openDashboardDestination=function(market,focus,extra={}){
    if(focus==='pricing_insights'){const c={...dashboardContext(),...extra};return openBusinessInsights?.('pricing',{...c,marketplace:market,source:'dashboard'});}
    return baseDashboardDestination?.(market,focus,extra);
  };
  try{openDashboardDestination=window.openDashboardDestination;}catch(_e){}

  function dailyRevenue(r,market){if(market==='amazon'){if(Number(r.avgRevenuePerDay)>0)return Number(r.avgRevenuePerDay);if(Number(r.asinRevenue)>0)return Number(r.asinRevenue)/Math.max(1,Number(r.businessReportDays)||60);}else{if(Number(r.avgRevenuePerDay)>0)return Number(r.avgRevenuePerDay);if(Number(r.calculatedRevenue)>0)return Number(r.calculatedRevenue)/Math.max(1,Number(r.orderPeriodDays||r.periodDays||r.revenuePeriodDays)||1);}return 0;}
  function snapshotMarketRows(s,market){return market==='amazon'?(getSnapshotAmazonRows(s)||[]):(getSnapshotFlipkartRows(s)||[]);}
  async function pricePerformance(market){
    const c=dashboardContext(),from=c.from||c.date,to=c.to||c.date;if(!from||!to)return[];let snaps=[];try{snaps=await v4LoadSnapshotsForRange(from,to);}catch(_e){return[];}if(snaps.length<2)return[];
    const groups=new Map();for(const s of snaps){for(const r of snapshotMarketRows(s,market)){if(c.category!=='all'&&r.category!==c.category)continue;const key=market==='amazon'?(r.azSku||r.asin):(r.fkSku||r.fsn);if(!key)continue;const x={date:s.reportDate,category:r.category||'Unmapped',price:Number(r.listingPrice||r.wfPrice)||0,revenue:dailyRevenue(r,market),inventory:r.inventory==null?null:Number(r.inventory),interference:market==='amazon'?(!!r.suppressionStatus||!!r.buyBoxStatus):false};if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}}
    const out=[];for(const hist of groups.values()){hist.sort((a,b)=>a.date.localeCompare(b.date));for(let i=1;i<hist.length;i++){const a=hist[i-1],b=hist[i];if(Math.abs(b.price-a.price)<0.01)continue;const revPct=a.revenue?((b.revenue-a.revenue)/a.revenue*100):0,inventoryConstraint=a.inventory!=null&&b.inventory!=null&&a.inventory>0&&b.inventory<a.inventory*.35;let signal='Neutral';if(inventoryConstraint||b.interference)signal='Inconclusive';else if(revPct>5)signal='Positive';else if(revPct<-5)signal='Review';out.push({...b,revPct,signal});}}
    return out;
  }
  function setHtml(id,html){const e=document.getElementById(id);if(e)e.innerHTML=html;}
  function setText(id,text){const e=document.getElementById(id);if(e)e.textContent=text;}
  async function renderPricePerformanceCard(market){const rows=await pricePerformance(market),pre=market==='amazon'?'amazon':'flipkart',pos=rows.filter(r=>r.signal==='Positive').length,review=rows.filter(r=>r.signal==='Review').length,neutral=rows.filter(r=>r.signal==='Neutral').length,inc=rows.filter(r=>r.signal==='Inconclusive').length;setText(`${pre}PriceChangedCount`,rows.length?nf(rows.length):'0');setText(`${pre}PricePositiveCount`,nf(pos));setText(`${pre}PricePerformanceDetail`,rows.length?`${review} review · ${neutral} neutral · ${inc} inconclusive`:'No price changes in selected period');const cat={};rows.forEach(r=>{cat[r.category]=(cat[r.category]||0)+1;});setHtml(`${pre}PricePerformanceBreakdown`,Object.entries(cat).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`<div class="metric-category-row"><span>${esc(k)}</span><strong>${nf(v)}</strong></div>`).join(''));}
  function fixDashboardLinks(){
    const azEx=document.getElementById('amazonDisparityExceptionDetail'),fkEx=document.getElementById('flipkartDisparityExceptionDetail'),azPar=document.getElementById('amazonParityExceptionDetail'),fkPar=document.getElementById('flipkartParityExceptionDetail');
    [[azEx,'amazon'],[azPar,'amazon'],[fkEx,'flipkart'],[fkPar,'flipkart']].forEach(([e,m])=>{if(!e)return;e.onclick=ev=>{ev.stopPropagation();openDashboardExceptionsNative?.(m);};});
    const ov=document.getElementById('amazonSuppressionOverrideDetail');if(ov)ov.onclick=ev=>{ev.stopPropagation();openSuppressionManagementForAction('overridden');};
  }
  async function afterDashboard(){fixDashboardLinks();await Promise.allSettled([renderPricePerformanceCard('amazon'),renderPricePerformanceCard('flipkart')]);try{await v7EnsurePricingExceptionsLoaded?.(true);const c=dashboardContext(),from=c.from||c.date||'0000-01-01',to=c.to||c.date||'9999-12-31',all=typeof v7PricingExceptions!=='undefined'?v7PricingExceptions:[];for(const m of ['amazon','flipkart']){const n=all.filter(x=>lower(x.status)!=='removed'&&lower(x.marketplace)===m&&(c.category==='all'||x.category===c.category)&&(!x.effectiveFrom||x.effectiveFrom<=to)&&(!x.effectiveTo||x.effectiveTo>=from)).length;const ids=m==='amazon'?['amazonParityExceptionDetail','amazonDisparityExceptionDetail']:['flipkartParityExceptionDetail','flipkartDisparityExceptionDetail'];ids.forEach((id,i)=>{const e=document.getElementById(id);if(e)e.textContent=`${nf(n)} ${i?'Approved Exceptions':'exceptions excluded'}`;});}}catch(_e){}WakeSuiteDateControls?.setup?.();}
  const baseDashboardLoad=window.loadDashboardOverview;
  if(baseDashboardLoad){window.loadDashboardOverview=async function(...args){const r=await baseDashboardLoad(...args);afterDashboard().catch(console.warn);return r;};try{loadDashboardOverview=window.loadDashboardOverview;}catch(_e){}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>afterDashboard().catch(()=>{}),250));


  const baseOpenSuppressionManagement=window.openSuppressionManagement;
  if(baseOpenSuppressionManagement){window.openSuppressionManagement=async function(...args){window.__suppressionActionFilter='';return baseOpenSuppressionManagement(...args);};try{openSuppressionManagement=window.openSuppressionManagement;}catch(_e){}}
  /* Dashboard Action Center → exact operational filter */
  window.openSuppressionManagementForAction=async function(kind){
    const c=dashboardContext();window.WakeSuiteNavigation?.stack?.push(window.WakeSuiteNavigation.capture());await openSuppressionManagement?.('Suppressed');
    window.__suppressionActionFilter=kind||'';
    const state=document.getElementById('suppressionManagementState');if(state)state.value='Suppressed';
    const p=document.getElementById('suppressionManagementPeriod');if(p)p.value=periodForSuppression(c.period);
    const f=document.getElementById('suppressionManagementFromDate'),t=document.getElementById('suppressionManagementToDate'),cat=document.getElementById('suppressionManagementCategory');if(f&&c.from)f.value=c.from;if(t&&c.to)t.value=c.to;if(cat&&c.category)cat.value=c.category;
    const poc=document.getElementById('suppressionManagementPoc'),status=document.getElementById('suppressionManagementStatus'),ov=document.getElementById('suppressionManagementOverride');
    if(poc)poc.value=kind==='poc'?'required':'all';if(status)status.value='all';if(ov)ov.value=kind==='overridden'?'overridden':'all';
    if(kind==='case'){const q=document.getElementById('suppressionManagementSearch');if(q)q.value='';}
    await loadSuppressionManagement?.();
  };
  window.openDashboardExpiringExceptions=function(){const c=dashboardContext();return openPricingExceptions?.('manager',{marketplace:c.marketplace==='all'?'all':c.marketplace,category:c.category,from:c.from,to:c.to,status:'active'});};
  try{
    ws911ActionRows=function(az,fk,cases){return [
      {label:'High-impact price disparities',detail:'Prioritize high-revenue pricing issues',count:[...(az||[]),...(fk||[])].filter(r=>(r.listingPriceDisparity||r.livePriceDisparity||r.mrpDisparity)&&Number(r.dailyRevenueImpact||0)>=1000).length,go:"openDashboardDestination('amazon','price_disparity')"},
      {label:'Suppressions awaiting Case ID',detail:'Cases requiring marketplace follow-up',count:(cases||[]).filter(r=>!r.caseId&&String(r.suppressionState||'Suppressed')!=='Live').length,go:"openSuppressionManagementForAction('case')"},
      {label:'POC escalations pending',detail:'Escalations requiring action',count:(cases||[]).filter(r=>r.pocEscalationStatus==='Required'&&String(r.suppressionState||'Suppressed')!=='Live').length,go:"openSuppressionManagementForAction('poc')"},
      {label:'Exceptions expiring soon',detail:'Approved exceptions ending within 7 days',count:(typeof v7PricingExceptions!=='undefined'?v7PricingExceptions:[]).filter(ex=>{if(!ex.effectiveTo||lower(ex.status)==='removed')return false;const d=(new Date(ex.effectiveTo)-new Date(todayIso()))/86400000;return d>=0&&d<=7;}).length,go:'openDashboardExpiringExceptions()'}
    ].filter(x=>x.count>0);};
  }catch(_e){}

  /* Marketplace Insights canonical Approved Exceptions */
  function exceptionEffective(ex,from,to){if(lower(ex.status)==='removed')return false;const ef=ex.effectiveFrom||'',et=ex.effectiveTo||'';return(!ef||ef<=to)&&(!et||et>=from);}
  async function refreshMarketplaceExceptionKpi(){
    const e=document.getElementById('insightsExceptions');if(!e)return;try{await v7EnsurePricingExceptionsLoaded?.(true);const market=document.getElementById('insightsMarketplace')?.value||'combined',cat=document.getElementById('insightsCategory')?.value||'all',from=document.getElementById('insightsFromDate')?.value||'',to=document.getElementById('insightsToDate')?.value||from||todayIso();const list=(typeof v7PricingExceptions!=='undefined'?v7PricingExceptions:[]).filter(x=>exceptionEffective(x,from||'0000-01-01',to||'9999-12-31')&&(market==='combined'||market==='all'||lower(x.marketplace)===market)&&(cat==='all'||x.category===cat)&&(typeof v7CategoryAllowed!=='function'||v7CategoryAllowed(x.category)));e.textContent=nf(list.length);const sub=document.getElementById('insightsExceptionsSub');if(sub)sub.textContent='Approved exceptions excluded from actionable pricing';const card=e.closest('[data-insight-card="exceptions"]');if(card)card.onclick=()=>openPricingExceptions?.('manager',{marketplace:market==='combined'?'all':market,category:cat,from,to,status:'active'});}catch(err){console.warn('Exception KPI unavailable',err);}}
  const baseInsights=window.loadMarketplaceInsights;if(baseInsights){window.loadMarketplaceInsights=async function(...args){const r=await baseInsights(...args);await refreshMarketplaceExceptionKpi();document.getElementById('pricingInsightsPanel')?.setAttribute('hidden','');document.getElementById('inventoryInsightsPanel')?.setAttribute('hidden','');WakeSuiteDateControls?.setup?.();return r;};try{loadMarketplaceInsights=window.loadMarketplaceInsights;}catch(_e){}}

  /* Marketplace Data: canonical diagnostics + less redundant controls */
  function marketplaceDiagnostics(){const avail=document.getElementById('marketplaceDataAvailability');if(!avail)return;let base=0,filtered=0;try{base=currentMarketplaceData?.baseRows?.length||0;filtered=currentMarketplaceData?.rows?.length||0;}catch(_e){}const d=document.getElementById('marketplaceDataDate')?.value||'—';if(base>0)avail.textContent=`Source ${nf(base)} rows loaded · ${nf(filtered)} after filters`;else if(!/No processed|Load Error/i.test(avail.textContent||''))avail.textContent=`No processed data for ${d}`;const pres=document.getElementById('marketplaceDataPresence'),view=document.getElementById('marketplaceDataView')?.value||'all';if(pres)pres.style.display=['all','mapping'].includes(view)?'':'none';}
  const baseMarketplaceLoad=window.loadMarketplaceData;if(baseMarketplaceLoad){window.loadMarketplaceData=async function(...args){const r=await baseMarketplaceLoad(...args);marketplaceDiagnostics();return r;};try{loadMarketplaceData=window.loadMarketplaceData;}catch(_e){}}
  const baseMarketplaceOpen=window.openMarketplaceData;if(baseMarketplaceOpen){window.openMarketplaceData=async function(ctx={}){if(!ctx.preserveFilters){['marketplaceDataCategory','marketplaceDataSkuType','marketplaceDataMappingStatus','marketplaceDataInventoryStatus','marketplaceDataPriceStatus','marketplaceDataPresence'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});}const r=await baseMarketplaceOpen(ctx);marketplaceDiagnostics();return r;};try{openMarketplaceData=window.openMarketplaceData;}catch(_e){}}
  document.addEventListener('change',e=>{if(['marketplaceDataView','marketplaceDataCategory','marketplaceDataSkuType','marketplaceDataMappingStatus','marketplaceDataInventoryStatus','marketplaceDataPriceStatus','marketplaceDataPresence'].includes(e.target?.id))setTimeout(marketplaceDiagnostics,80);});

  /* ASIN Suppression report: bulk Override only for permitted users */
  const overrideSelected=new Map();
  function injectSuppressionOverrideSelection(){
    const table=document.getElementById('reportModuleTable');if(!table)return;const isSupp=typeof currentHistoricalViewKey!=='undefined'&&currentHistoricalViewKey==='amazon_suppression';let bar=document.getElementById('historicalOverrideBulkBar');if(!isSupp||!can('suppressionOverride')){bar?.remove();table.querySelectorAll('.v932-report-select').forEach(x=>x.remove());return;}
    const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim()),asinIx=heads.findIndex(x=>/^ASIN$/i.test(x)),catIx=heads.findIndex(x=>/Category/i.test(x));if(asinIx<0)return;
    const trh=table.querySelector('thead tr');if(trh&&!trh.querySelector('.v932-report-select')){const th=document.createElement('th');th.className='v932-report-select';th.textContent='Select';trh.prepend(th);}
    table.querySelectorAll('tbody tr').forEach((tr,i)=>{if(tr.querySelector('.empty-row')||tr.querySelector('.v932-report-select'))return;const cells=[...tr.children],asin=cells[asinIx]?.textContent.trim(),category=catIx>=0?cells[catIx]?.textContent.trim():'';if(!asin)return;const td=document.createElement('td');td.className='v932-report-select';td.innerHTML=`<input type="checkbox" data-override-asin="${esc(asin)}" data-override-category="${esc(category)}">`;tr.prepend(td);});
    if(!bar){bar=document.createElement('div');bar.id='historicalOverrideBulkBar';bar.className='v932-bulk-bar';bar.innerHTML='<label><input id="historicalOverrideSelectAll" type="checkbox"> Select visible</label><button class="secondary-btn" type="button" id="historicalOverrideSelectFiltered">Select all filtered</button><button class="secondary-btn" type="button" id="historicalOverrideClear">Clear selection</button><strong id="historicalOverrideCount">0 selected</strong><button class="primary-btn" onclick="bulkOverrideHistoricalSuppression()">Override Selected</button>';table.closest('.table-wrap')?.insertAdjacentElement('beforebegin',bar);bar.querySelector('#historicalOverrideSelectAll')?.addEventListener('change',ev=>{table.querySelectorAll('[data-override-asin]').forEach(cb=>{cb.checked=ev.target.checked;cb.dispatchEvent(new Event('change'));});});bar.querySelector('#historicalOverrideSelectFiltered')?.addEventListener('click',()=>{table.querySelectorAll('[data-override-asin]').forEach(cb=>{cb.checked=true;cb.dispatchEvent(new Event('change'));});});bar.querySelector('#historicalOverrideClear')?.addEventListener('click',()=>{overrideSelected.clear();table.querySelectorAll('[data-override-asin]').forEach(cb=>cb.checked=false);const c=document.getElementById('historicalOverrideCount');if(c)c.textContent='0 selected';const a=document.getElementById('historicalOverrideSelectAll');if(a)a.checked=false;});}
    table.querySelectorAll('[data-override-asin]').forEach(cb=>cb.addEventListener('change',()=>{const k=cb.dataset.overrideAsin;if(cb.checked)overrideSelected.set(k,{asin:k,category:cb.dataset.overrideCategory});else overrideSelected.delete(k);const c=document.getElementById('historicalOverrideCount');if(c)c.textContent=`${overrideSelected.size} selected`;}));
  }
  window.bulkOverrideHistoricalSuppression=async function(){if(!can('suppressionOverride'))return showWakeSuiteToast?.('Suppression Override permission is required.','warning');const list=[...overrideSelected.values()];if(!list.length)return showWakeSuiteToast?.('Select at least one ASIN.','warning');const reason=prompt('Override reason for selected ASINs:','');if(reason===null||!reason.trim())return;const date=document.getElementById('reportToDate')?.value||document.getElementById('reportFromDate')?.value||todayIso();if(!confirm(`Override ${list.length} selected ASIN(s) for ${date}?`))return;try{for(const x of list)await window.saveSuppressionOverride?.({asin:x.asin,reportDate:date,reason:reason.trim(),category:x.category||'Unmapped'});overrideSelected.clear();if(typeof snapshotCache!=='undefined')snapshotCache.delete(date);await loadHistoricalModule?.();showWakeSuiteToast?.(`${list.length} ASIN(s) overridden.`,'success');}catch(e){showWakeSuiteToast?.(e.message,'error','Bulk Override');}};
  const baseHistoricalLoad=window.loadHistoricalModule;if(baseHistoricalLoad){window.loadHistoricalModule=async function(...args){const r=await baseHistoricalLoad(...args);setTimeout(injectSuppressionOverrideSelection,0);WakeSuiteDateControls?.setup?.();return r;};try{loadHistoricalModule=window.loadHistoricalModule;}catch(_e){}}

  /* Common component consistency */
  const obs=new MutationObserver(()=>{WakeSuiteDateControls?.setup?.();document.querySelectorAll('.metric-category-breakdown input').forEach(x=>x.replaceWith(document.createTextNode(x.value||x.textContent||'')));});
  document.addEventListener('DOMContentLoaded',()=>{obs.observe(document.body,{childList:true,subtree:true});document.querySelectorAll('#marketplaceDataSection .data-toolbar-secondary .secondary-btn').forEach(b=>{if(/Amazon Only|Flipkart Only/.test(b.textContent||''))b.remove();});WakeSuiteDateControls?.setup?.();});
})();
