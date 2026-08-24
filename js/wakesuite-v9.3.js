/* WakeSuite V9.3 integration layer · 23 Aug 2026 · AI intentionally excluded */
(function(){
  'use strict';
  const VERSION='9.3.0';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'');
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=v=>typeof formatNumber==='function'?formatNumber(num(v)):String(num(v));
  const money=v=>typeof formatINR==='function'?formatINR(num(v)):`₹${num(v).toLocaleString('en-IN')}`;
  const today=()=>typeof todayIso==='function'?todayIso():new Date().toISOString().slice(0,10);
  const allowedMarket=m=>typeof v7MarketAllowed!=='function'||v7MarketAllowed(m);
  const allowedCategory=c=>typeof v7CategoryAllowed!=='function'||v7CategoryAllowed(c);
  const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const clickId=(identifier,context)=>identifier?`<button class="v93-link-id" onclick='WakeSuiteProduct360.open(${JSON.stringify(String(identifier))},{context:${JSON.stringify(context)}})'>${esc(identifier)}</button>`:'—';

  /* ---------- navigation/view titles ---------- */
  try{
    Object.assign(FINAL_VIEW_TITLES,{
      priceParitySection:'Price Parity',revenueImpactSection:'Revenue Impact',businessInsightsSection:'Business Insights',
      pricingHistorySection:'Pricing History',inventoryHistorySection:'Inventory History',historyHubSection:'History',
      marketplaceDataSection:'Marketplace Data',pricingExceptionsSection:'Pricing Exceptions',suppressionManagementSection:'Suppression Management'
    });
  }catch(_e){}

  /* ---------- permanently retire Flipkart Buy Box from current runtime ---------- */
  try{delete HISTORICAL_VIEWS.flipkart_buybox;}catch(_e){}
  try{delete EMAIL_REPORT_DEFS_V4.flipkart_buybox;}catch(_e){}
  try{
    if(Array.isArray(V8_UPLOAD_TYPES)){const i=V8_UPLOAD_TYPES.indexOf('pricing_exceptions');if(i>=0)V8_UPLOAD_TYPES.splice(i,1);}
    if(typeof V8_ACCESS_UPLOAD_LABELS==='object')delete V8_ACCESS_UPLOAD_LABELS.pricing_exceptions;
  }catch(_e){}
  // Neutralize legacy Flipkart Buy Box fields at the normalized row boundary and in future persisted compact rows.
  try{
    const baseGetFlipkart=getSnapshotFlipkartRows;
    getSnapshotFlipkartRows=function(snapshot){return (baseGetFlipkart(snapshot)||[]).map(row=>{const x={...row};delete x.buyBoxStatus;delete x.buyBoxRevenueImpactPerDay;delete x.noBuyBox;return x;});};
    const baseCompactFk=compactFlipkartRow;
    compactFlipkartRow=function(row){const a=baseCompactFk({...row,buyBoxStatus:null,buyBoxRevenueImpactPerDay:0});if(Array.isArray(a)){if(a.length>10)a[10]=null;if(a.length>28)a[28]=0;}return a;};
    const baseExpandFk=expandFlipkartRow;
    expandFlipkartRow=function(a){const r=baseExpandFk(a);delete r.buyBoxStatus;delete r.buyBoxRevenueImpactPerDay;return r;};
  }catch(_e){}

  /* ---------- live-price rule: valid live price is compared directly with WF, even if equal to listing ---------- */
  try{
    const listingFallback=v4PriceObservations;
    v4PriceObservations=function(snapshot,marketplace,category='all'){
      const rows=(marketplace==='amazon'?getSnapshotAmazonRows(snapshot):getSnapshotFlipkartRows(snapshot)).filter(r=>dashboardCategoryMatches(r,category));
      const liveKey=marketplace==='amazon'?'amazonLive':'flipkartLive';
      const liveAvailable=v4SnapshotModuleState(snapshot,liveKey)!=='unavailable';
      if(liveAvailable){
        return rows.filter(r=>r.eligibleForComparison&&num(r.finalLivePrice)>0).map(r=>{
          const exception=!!r.livePriceException,disparity=!!r.livePriceDisparity;
          const impact=v4SnapshotRevenueAvailable(snapshot,marketplace)?num(r.liveDailyRevenueImpact||r.dailyRevenueImpact):null;
          return {...r,reportDate:snapshot.reportDate,priceSignal:'Live',parityStatus:exception?'Approved Exception':(disparity?'Disparity':'Parity'),priceImpact:exception?0:impact};
        });
      }
      return listingFallback(snapshot,marketplace,category).map(r=>({...r,parityStatus:r.listingPriceException?'Approved Exception':r.parityStatus,priceImpact:r.listingPriceException?0:r.priceImpact}));
    };
  }catch(_e){}

  /* ---------- Marketplace Data: latest available snapshot, true states, native quick switches ---------- */
  const legacyMarketplaceLoad=window.loadMarketplaceData;
  async function latestSnapshotDate(preferredMarket='all'){
    try{
      const metas=await listDailySnapshotMetas();
      const rows=(metas||[]).filter(m=>m?.status==='completed'||m?.reportDate).sort((a,b)=>String(b.reportDate||'').localeCompare(String(a.reportDate||'')));
      if(preferredMarket==='all'||preferredMarket==='mapping')return rows[0]?.reportDate||'';
      for(const m of rows){
        try{const s=await loadSnapshotCached(m.reportDate);if(!s)continue;const n=preferredMarket==='amazon'?getSnapshotAmazonRows(s).length:getSnapshotFlipkartRows(s).length;if(n)return m.reportDate;}catch(_e){}
      }
      return rows[0]?.reportDate||'';
    }catch(_e){return '';}
  }
  async function loadMarketplaceDataV93(){
    const dateEl=document.getElementById('marketplaceDataDate'),view=document.getElementById('marketplaceDataView')?.value||'all';
    let date=dateEl?.value||'';setText('marketplaceDataAvailability','Loading…');
    try{
      let snap=date?await loadSnapshotCached(date):null;
      if(!snap){const latest=await latestSnapshotDate(view);if(latest){date=latest;if(dateEl)dateEl.value=latest;snap=await loadSnapshotCached(latest);if(date&&latest)setText('marketplaceDataAvailability',`No processed data for selected date · showing latest available ${latest}`);}}
      if(!snap){
        try{currentMarketplaceData={date:date||today(),view,type:document.getElementById('marketplaceDataType')?.value||'core',baseRows:[],rows:[],defaultColumns:[]};}catch(_e){}
        setText('marketplaceDataAvailability','No processed data available');setText('marketplaceDataAsOf',`As of ${date||'—'}`);setText('marketplaceDataRowCount','0 rows');setText('marketplaceDataCategoryCount','0 categories');
        const t=document.getElementById('marketplaceDataTable');if(t)t.innerHTML='<tbody><tr><td class="empty-row">No processed marketplace data is available for this date.</td></tr></tbody>';return;
      }
      if(dateEl)dateEl.value=date;
      await legacyMarketplaceLoad?.();
      const count=Number(String(document.getElementById('marketplaceDataRowCount')?.textContent||'0').replace(/\D/g,''))||0;
      setText('marketplaceDataAvailability',count?'Available':'Loaded · 0 matching rows');setText('marketplaceDataAsOf',`As of ${date}`);
      const table=document.getElementById('marketplaceDataTable');
      if(table){table.dataset.wsColumnTable='marketplaceData';const headers=[...table.querySelectorAll('thead th')].map((th,i)=>({key:`c${i}`,label:th.textContent.trim()}));if(headers.length)WakeSuiteColumns?.register('marketplaceData',headers,headers.map(h=>h.key),'marketplaceDataColumns');}
    }catch(error){console.error(error);setText('marketplaceDataAvailability','Load Error');const t=document.getElementById('marketplaceDataTable');if(t)t.innerHTML=`<tbody><tr><td class="empty-row">Unable to load Marketplace Data: ${esc(error.message)}</td></tr></tbody>`;}
  }
  window.loadMarketplaceData=loadMarketplaceDataV93;
  window.openMarketplaceData=async function(ctx={}){wakeSuiteNavigate?.('marketplaceDataSection');const v=document.getElementById('marketplaceDataView');if(ctx.marketplace&&v)v.value=ctx.marketplace;const d=document.getElementById('marketplaceDataDate');if(ctx.date&&d)d.value=ctx.date;await loadMarketplaceDataV93();};
  window.setMarketplaceQuickView=async function(type){const view=document.getElementById('marketplaceDataView'),presence=document.getElementById('marketplaceDataPresence'),mapping=document.getElementById('marketplaceDataMappingStatus');if(type==='amazon_only'&&view)view.value='amazon';if(type==='flipkart_only'&&view)view.value='flipkart';if(presence)presence.value='all';if(type==='conflict'&&mapping)mapping.value='conflict';await loadMarketplaceDataV93();};

  /* ---------- Pricing History: read-only analytical manipulation ---------- */
  let pricingHistoryRowsV93=[],pricingHistoryColsV93=[];
  function historyRange(prefix){
    const p=document.getElementById(`${prefix}Period`)?.value||'last7',base=document.getElementById(`${prefix}ToDate`)?.value||today();let from=base,to=base;
    const shift=n=>{const d=new Date(`${base}T00:00:00`);d.setDate(d.getDate()+n);return localIsoDate(d);};
    if(p==='yesterday')from=to=shift(-1);else if(p==='last7')from=shift(-6);else if(p==='last14')from=shift(-13);else if(p==='last30')from=shift(-29);else if(p==='custom'){from=document.getElementById(`${prefix}FromDate`)?.value||base;to=document.getElementById(`${prefix}ToDate`)?.value||base;if(from>to)[from,to]=[to,from];}
    const a=document.getElementById(`${prefix}FromDate`),b=document.getElementById(`${prefix}ToDate`);if(a)a.value=from;if(b)b.value=to;return[from,to];
  }
  function priceHistAtomic(snaps){const out=[];for(const s of snaps||[]){if(allowedMarket('amazon'))for(const r of getSnapshotAmazonRows(s))if(allowedCategory(r.category))out.push({date:s.reportDate,marketplace:'Amazon',marketKey:'amazon',category:r.category,wfSku:r.wfSku||'',marketSku:r.azSku||'',identifier:r.asin||'',wfPrice:num(r.wfPrice),listingPrice:num(r.listingPrice),livePrice:num(r.finalLivePrice),wfMrp:num(r.wfMrp),marketMrp:num(r.azMrp),listingStatus:r.listingPriceException?'Approved Exception':(r.listingPriceDisparity?'Actionable Disparity':'Parity'),liveStatus:r.livePriceException?'Approved Exception':(r.livePriceDisparity?'Actionable Disparity':'Parity'),mrpStatus:r.mrpException?'Approved Exception':(r.mrpDisparity?'Actionable Disparity':'Parity'),inventory:num(r.inventory),suppression:/supp|true/i.test(String(r.suppressionStatus||'')),buyBox:/supp|no buy/i.test(String(r.buyBoxStatus||''))});if(allowedMarket('flipkart'))for(const r of getSnapshotFlipkartRows(s))if(allowedCategory(r.category))out.push({date:s.reportDate,marketplace:'Flipkart',marketKey:'flipkart',category:r.category,wfSku:r.wfSku||'',marketSku:r.fkSku||'',identifier:r.fsn||'',wfPrice:num(r.wfPrice),listingPrice:num(r.listingPrice),livePrice:num(r.finalLivePrice),wfMrp:num(r.wfMrp),marketMrp:num(r.fkMrp),listingStatus:r.listingPriceException?'Approved Exception':(r.listingPriceDisparity?'Actionable Disparity':'Parity'),liveStatus:r.livePriceException?'Approved Exception':(r.livePriceDisparity?'Actionable Disparity':'Parity'),mrpStatus:r.mrpException?'Approved Exception':(r.mrpDisparity?'Actionable Disparity':'Parity'),inventory:num(r.inventory),suppression:false,buyBox:false});}return out;}
  function addPriceMovement(rows,type){const groups=new Map();rows.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>{const k=`${r.marketKey}|${r.marketSku}|${r.identifier}|${r.wfSku}`;const prev=groups.get(k);const field=type==='live'?'livePrice':type==='mrp'?'marketMrp':type==='listing'?'listingPrice':'wfPrice';r.previousValue=prev?prev[field]:null;r.currentValue=r[field];r.change=r.previousValue==null?0:r.currentValue-r.previousValue;r.changePct=r.previousValue?100*r.change/r.previousValue:0;r.direction=r.previousValue==null||r.change===0?'No Change':r.change>0?'Increase':'Decrease';r.changed=r.previousValue!=null&&r.change!==0;r.interference=(r.inventory<=0?'Inventory':'')+(r.suppression||r.buyBox?((r.inventory<=0?' + ':'')+'Suppression / Buy Box'):'');groups.set(k,r);});return rows;}
  function renderPricingHistoryV93(rows){
    const type=document.getElementById('pricingHistoryType')?.value||'all';let cols=[['date','Date'],['marketplace','Marketplace'],['category','Category'],['wfSku','WF SKU'],['marketSku','Marketplace SKU'],['identifier','ASIN / FSN']];if(['all','wf'].includes(type))cols.push(['wfPrice','WF Price']);if(['all','listing'].includes(type))cols.push(['listingPrice','Listing Price'],['listingStatus','Listing Status']);if(['all','live'].includes(type))cols.push(['livePrice','Live Price'],['liveStatus','Live Status']);if(['all','mrp'].includes(type))cols.push(['wfMrp','WF MRP'],['marketMrp','Marketplace MRP'],['mrpStatus','MRP Status']);cols.push(['previousValue','Previous Selected Price'],['currentValue','Current Selected Price'],['direction','Movement'],['changePct','Change %'],['interference','Interference']);pricingHistoryColsV93=cols;
    const t=document.getElementById('pricingHistoryTable');if(!t)return;t.dataset.wsColumnTable='pricingHistory';t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+(rows.length?rows.slice(0,3000).map(r=>'<tr>'+cols.map(([k])=>{let v=r[k];if(['wfPrice','listingPrice','livePrice','wfMrp','marketMrp','previousValue','currentValue'].includes(k))v=v==null?'—':money(v);if(k==='changePct')v=`${num(v).toFixed(1)}%`;if(['wfSku','marketSku','identifier'].includes(k))return`<td>${clickId(v,'pricingHistory')}</td>`;return`<td>${esc(v||v===0?v:'—')}</td>`;}).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty-row">No pricing history matches the selected controls.</td></tr>`)+'</tbody>';WakeSuiteColumns?.register('pricingHistory',cols.map(c=>({key:c[0],label:c[1]})),cols.map(c=>c[0]),'pricingHistoryColumns');
  }
  window.loadPricingHistory=async function(){
    const [from,to]=historyRange('pricingHistory'),snaps=await v4LoadSnapshotsForRange(from,to),market=document.getElementById('pricingHistoryMarketplace')?.value||'all',cat=document.getElementById('pricingHistoryCategory')?.value||'all',type=document.getElementById('pricingHistoryType')?.value||'all',q=String(document.getElementById('pricingHistorySearch')?.value||'').toLowerCase(),dir=document.getElementById('pricingHistoryDirection')?.value||'all',changed=document.getElementById('pricingHistoryChangedOnly')?.value||'all',inter=document.getElementById('pricingHistoryInterference')?.value||'all';let raw=priceHistAtomic(snaps).filter(r=>(market==='all'||r.marketKey===market));
    const cats=[...new Set(raw.map(r=>r.category).filter(Boolean))].sort(),ce=document.getElementById('pricingHistoryCategory'),old=ce?.value||'all';if(ce){ce.innerHTML='<option value="all">All Categories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join('');ce.value=cats.includes(old)?old:'all';}
    raw=addPriceMovement(raw,type).filter(r=>(cat==='all'||r.category===cat)&&(!q||`${r.identifier} ${r.marketSku} ${r.wfSku}`.toLowerCase().includes(q))&&(dir==='all'||r.direction.toLowerCase().replace(' ','_')===dir||r.direction.toLowerCase()===dir)&&(changed!=='changed'||r.changed)&&(inter==='all'||(inter==='none'&&!r.interference)||(inter==='inventory'&&/Inventory/.test(r.interference))||(inter==='suppression'&&/Suppression/.test(r.interference))));
    const sort=document.getElementById('pricingHistorySort')?.value||'date_desc';raw.sort((a,b)=>sort==='identifier_asc'?String(a.identifier).localeCompare(String(b.identifier)):sort==='category_asc'?String(a.category).localeCompare(String(b.category)):String(b.date).localeCompare(String(a.date)));pricingHistoryRowsV93=raw;renderPricingHistoryV93(raw);setText('pricingHistoryInfo',`${fmt(raw.length)} rows · ${from} to ${to}`);
  };
  window.openPricingHistory=async function(ctx={}){wakeSuiteNavigate?.('pricingHistorySection');if(ctx.marketplace)document.getElementById('pricingHistoryMarketplace').value=ctx.marketplace;if(ctx.period)document.getElementById('pricingHistoryPeriod').value=ctx.period;if(ctx.from)document.getElementById('pricingHistoryFromDate').value=ctx.from;if(ctx.to)document.getElementById('pricingHistoryToDate').value=ctx.to;await window.loadPricingHistory();};
  window.resetPricingHistoryFilters=function(){['pricingHistoryMarketplace','pricingHistoryCategory','pricingHistoryType','pricingHistoryDirection','pricingHistoryChangedOnly','pricingHistoryInterference'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});const p=document.getElementById('pricingHistoryPeriod');if(p)p.value='last7';const q=document.getElementById('pricingHistorySearch');if(q)q.value='';window.loadPricingHistory();};
  function visibleKeys(key,cols){try{const state=WakeSuiteColumns?.visible?.(key);if(Array.isArray(state))return state;}catch(_e){}return cols.map(c=>c[0]);}
  function exportRows(rows,cols,keys){return rows.map(r=>Object.fromEntries(cols.filter(c=>keys.includes(c[0])).map(([k,label])=>[label,r[k]])));}
  window.downloadPricingHistory=function(){if(!pricingHistoryRowsV93.length)return showWakeSuiteToast?.('No pricing history rows to download.','warning');writeExcelReport(`WakeSuite_Pricing_History_${today()}.xlsx`,{},exportRows(pricingHistoryRowsV93,pricingHistoryColsV93,visibleKeys('pricingHistory',pricingHistoryColsV93)));};
  window.downloadPricingHistoryFull=function(){if(!pricingHistoryRowsV93.length)return showWakeSuiteToast?.('No pricing history rows to download.','warning');writeExcelReport(`WakeSuite_Pricing_History_Full_${today()}.xlsx`,{},exportRows(pricingHistoryRowsV93,pricingHistoryColsV93,pricingHistoryColsV93.map(c=>c[0])));};

  /* ---------- Inventory History: atomic mapping rows + analysis controls ---------- */
  let inventoryHistoryRowsV93=[],inventoryHistoryColsV93=[];
  function invDaily(snaps,market){const out=[];for(const s of snaps||[]){const inv=v7SnapshotInventoryRows(s,market);const base=market==='amazon'?getSnapshotAmazonRows(s):getSnapshotFlipkartRows(s);for(const r of inv){const b=base.find(x=>(market==='amazon'?x.azSku:x.fkSku)===r.marketSku&&String(market==='amazon'?x.asin:x.fsn)===String(r.identifier))||{};const units=num(r.avgDailyUnits||b.avgDailyUnits||b.unitsPerDay||b.dailyUnits||b.averageDailyUnits),inventory=r.inventoryKnown===false?null:Number(r.inventory);const doc=units>0&&inventory!=null?inventory/units:null,status=inventory==null?'No Data':inventory<=0?'OOS':'In Stock',state=status==='OOS'?'OOS':doc==null?'No Velocity':doc<3?'Critical':doc<=7?'At Risk':doc<=14?'Watch':'Healthy',rev=r.avgRevenuePerDay==null?num(b.avgRevenuePerDay||b.dailyRevenue||(market==='amazon'&&b.asinRevenue?num(b.asinRevenue)/60:0)):num(r.avgRevenuePerDay);out.push({reportDate:r.reportDate,marketplace:market,category:r.category,wfSku:r.wfSku||'',marketSku:r.marketSku||'',identifier:r.identifier||'',inventory,status,unitsPerDay:units,daysCover:doc,state,avgRevenuePerDay:rev||null,oosLoss:status==='OOS'&&rev?rev:0,revenueRisk:rev>=10000?'High':rev>=3000?'Medium':'Normal'});}}return out;}
  function addInvEvents(rows){const prev=new Map();rows.slice().sort((a,b)=>a.reportDate.localeCompare(b.reportDate)).forEach(r=>{const k=`${r.marketplace}|${r.marketSku}|${r.identifier}|${r.wfSku}`,p=prev.get(k);r.stockChange=p&&r.inventory!=null&&p.inventory!=null?r.inventory-p.inventory:null;r.event=!p?'Initial':p.status==='OOS'&&r.status==='In Stock'?'Restock':r.status==='OOS'&&p.status!=='OOS'?'OOS':r.stockChange>0?'Increase':r.stockChange<0?'Decrease':'No Change';prev.set(k,r);});return rows;}
  function consolidateInv(rows){const groups=new Map();for(const r of rows){const k=`${r.marketplace}|${r.marketSku}|${r.identifier}|${r.wfSku}`;if(!groups.has(k))groups.set(k,{...r,firstDate:r.reportDate,lastDate:r.reportDate,observedDays:0,oosDays:0,inStockDays:0,noDataDays:0,periodLoss:0,opening:r.inventory,min:r.inventory,max:r.inventory,latest:r.inventory,latestState:r.state,restocks:0});const g=groups.get(k);g.observedDays++;if(r.status==='OOS')g.oosDays++;else if(r.status==='In Stock')g.inStockDays++;else g.noDataDays++;g.periodLoss+=num(r.oosLoss);if(r.event==='Restock')g.restocks++;if(r.inventory!=null){if(g.opening==null)g.opening=r.inventory;g.min=g.min==null?r.inventory:Math.min(g.min,r.inventory);g.max=g.max==null?r.inventory:Math.max(g.max,r.inventory);if(r.reportDate>=g.lastDate){g.latest=r.inventory;g.latestState=r.state;g.daysCover=r.daysCover;g.avgRevenuePerDay=r.avgRevenuePerDay;g.revenueRisk=r.revenueRisk;g.lastDate=r.reportDate;}}}return [...groups.values()];}
  function renderInventoryHistoryV93(rows,view){let cols=view==='daily'?[['reportDate','Date'],['marketplace','Marketplace'],['category','Category'],['wfSku','WF SKU'],['marketSku','Marketplace SKU'],['identifier','ASIN / FSN'],['inventory','Inventory'],['unitsPerDay','Avg Units/Day'],['daysCover','Days of Cover'],['state','Inventory State'],['event','Stock Event'],['avgRevenuePerDay','Avg Revenue / Day'],['oosLoss','Potential OOS Revenue Loss']]:[['marketplace','Marketplace'],['category','Category'],['wfSku','WF SKU'],['marketSku','Marketplace SKU'],['identifier','ASIN / FSN'],['firstDate','First Date'],['lastDate','Latest Date'],['opening','Opening Inventory'],['min','Lowest Inventory'],['max','Highest Inventory'],['latest','Latest Inventory'],['daysCover','Days of Cover'],['latestState','Inventory State'],['oosDays','OOS Days'],['inStockDays','In-Stock Days'],['restocks','Restocks'],['avgRevenuePerDay','Avg Revenue / Day'],['periodLoss','Potential OOS Revenue Loss'],['revenueRisk','Revenue Risk']];inventoryHistoryColsV93=cols;const t=document.getElementById('inventoryHistoryTable');if(!t)return;t.dataset.wsColumnTable='inventoryHistory';t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+(rows.length?rows.slice(0,3000).map(r=>'<tr>'+cols.map(([k])=>{let v=r[k];if(['avgRevenuePerDay','oosLoss','periodLoss'].includes(k))v=v==null?'—':money(v);if(k==='daysCover')v=v==null?'—':num(v).toFixed(1);if(['wfSku','marketSku','identifier'].includes(k))return`<td>${clickId(v,'inventoryHistory')}</td>`;return`<td>${esc(v??'—')}</td>`;}).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty-row">No inventory history matches the selected controls.</td></tr>`)+'</tbody>';WakeSuiteColumns?.register('inventoryHistory',cols.map(c=>({key:c[0],label:c[1]})),cols.map(c=>c[0]),'inventoryHistoryColumns');}
  window.loadInventoryHistory=async function(){const [from,to]=historyRange('inventoryHistory'),snaps=await v4LoadSnapshotsForRange(from,to),market=document.getElementById('inventoryHistoryMarketplace')?.value||'all',cat=document.getElementById('inventoryHistoryCategory')?.value||'all',view=document.getElementById('inventoryHistoryView')?.value||'consolidated',q=String(document.getElementById('inventoryHistorySearch')?.value||'').toLowerCase();let daily=[];if((market==='all'||market==='amazon')&&allowedMarket('amazon'))daily.push(...invDaily(snaps,'amazon'));if((market==='all'||market==='flipkart')&&allowedMarket('flipkart'))daily.push(...invDaily(snaps,'flipkart'));addInvEvents(daily);const cats=[...new Set(daily.map(r=>r.category).filter(Boolean))].sort(),ce=document.getElementById('inventoryHistoryCategory'),old=ce?.value||'all';if(ce){ce.innerHTML='<option value="all">All Categories</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join('');ce.value=cats.includes(old)?old:'all';}
    const st=document.getElementById('inventoryHistoryState')?.value||'all',minEl=document.getElementById('inventoryHistoryDocMin'),maxEl=document.getElementById('inventoryHistoryDocMax'),min=minEl?.value===''?null:Number(minEl?.value),max=maxEl?.value===''?null:Number(maxEl?.value),event=document.getElementById('inventoryHistoryEvent')?.value||'all',risk=document.getElementById('inventoryHistoryRisk')?.value||'all',stateMap={oos:'OOS',critical:'Critical',at_risk:'At Risk',watch:'Watch',healthy:'Healthy'};daily=daily.filter(r=>(cat==='all'||r.category===cat)&&(!q||`${r.identifier} ${r.marketSku} ${r.wfSku}`.toLowerCase().includes(q))&&(st==='all'||r.state===stateMap[st])&&(min==null||r.daysCover!=null&&r.daysCover>=min)&&(max==null||r.daysCover!=null&&r.daysCover<=max)&&(event==='all'||(event==='oos_only'&&r.status==='OOS')||(event==='restock_only'&&r.event==='Restock')||(event==='increase'&&r.event==='Increase')||(event==='decrease'&&r.event==='Decrease'))&&(risk==='all'||String(r.revenueRisk).toLowerCase()===risk));let rows=view==='daily'?daily:consolidateInv(daily);const sort=document.getElementById('inventoryHistorySort')?.value||'loss_desc';rows.sort((a,b)=>sort==='oos_desc'?num(b.oosDays)-num(a.oosDays):sort==='inventory_asc'?num(a.latest??a.inventory)-num(b.latest??b.inventory):sort==='identifier_asc'?String(a.identifier).localeCompare(String(b.identifier)):num(b.periodLoss??b.oosLoss)-num(a.periodLoss??a.oosLoss));inventoryHistoryRowsV93=rows;renderInventoryHistoryV93(rows,view);const currentLatest=view==='daily'?daily.filter(r=>r.reportDate===to):rows;const oos=new Set(currentLatest.filter(r=>(r.latestState||r.state)==='OOS').map(r=>`${r.marketplace}|${r.marketSku}|${r.identifier}`)).size,risky=currentLatest.filter(r=>['Critical','At Risk'].includes(r.latestState||r.state)).length,loss=daily.reduce((s,r)=>s+num(r.oosLoss),0);const k=document.getElementById('inventoryHistoryKpis');if(k)k.innerHTML=`<div class="v7-kpi"><span>Currently OOS</span><strong>${fmt(oos)}</strong></div><div class="v7-kpi"><span>Critical / At Risk</span><strong>${fmt(risky)}</strong></div><div class="v7-kpi"><span>Potential OOS Revenue Loss</span><strong>${money(loss)}</strong></div><div class="v7-kpi"><span>Observed Days</span><strong>${fmt(snaps.length)}</strong></div>`;setText('inventoryHistoryInfo',`${fmt(rows.length)} atomic mapping rows · ${from} to ${to}`);};
  window.openInventoryHistory=async function(ctx={}){wakeSuiteNavigate?.('inventoryHistorySection');if(ctx.marketplace)document.getElementById('inventoryHistoryMarketplace').value=ctx.marketplace;if(ctx.period)document.getElementById('inventoryHistoryPeriod').value=ctx.period;if(ctx.from)document.getElementById('inventoryHistoryFromDate').value=ctx.from;if(ctx.to)document.getElementById('inventoryHistoryToDate').value=ctx.to;await window.loadInventoryHistory();};
  window.resetInventoryHistoryFilters=function(){['inventoryHistoryMarketplace','inventoryHistoryCategory','inventoryHistoryState','inventoryHistoryEvent','inventoryHistoryRisk'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='all';});['inventoryHistoryDocMin','inventoryHistoryDocMax','inventoryHistorySearch'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const p=document.getElementById('inventoryHistoryPeriod');if(p)p.value='last7';window.loadInventoryHistory();};
  window.downloadInventoryHistory=function(){if(!inventoryHistoryRowsV93.length)return showWakeSuiteToast?.('No inventory history rows to download.','warning');writeExcelReport(`WakeSuite_Inventory_History_${today()}.xlsx`,{},exportRows(inventoryHistoryRowsV93,inventoryHistoryColsV93,visibleKeys('inventoryHistory',inventoryHistoryColsV93)));};
  window.downloadInventoryHistoryFull=function(){if(!inventoryHistoryRowsV93.length)return showWakeSuiteToast?.('No inventory history rows to download.','warning');writeExcelReport(`WakeSuite_Inventory_History_Full_${today()}.xlsx`,{},exportRows(inventoryHistoryRowsV93,inventoryHistoryColsV93,inventoryHistoryColsV93.map(c=>c[0])));};

  /* ---------- Dashboard: native category drilldowns and inventory-risk cards ---------- */
  function categoryRowsHtml(map,market,dest,valueFormatter=v=>fmt(v)){return Object.entries(map).sort((a,b)=>num(b[1])-num(a[1])).map(([cat,v])=>`<button class="metric-category-row" onclick="event.stopPropagation();openDashboardCategoryDestination('${market}','${dest}',${JSON.stringify(cat)})"><span>${esc(cat)}</span><strong>${esc(valueFormatter(v))}</strong></button>`).join('');}
  function dashboardCategoryMetrics(snaps,market){const parity={},disp={},supp={},buy={},inv={},total={};const catSet=new Set();for(const s of snaps||[]){for(const r of (market==='amazon'?getSnapshotAmazonRows(s):getSnapshotFlipkartRows(s))){if(!allowedCategory(r.category))continue;catSet.add(r.category);const obs=v4PriceObservations(s,market,r.category).filter(x=>(market==='amazon'?x.azSku:x.fkSku)===(market==='amazon'?r.azSku:r.fkSku));for(const o of obs){if(o.parityStatus==='Parity'){parity[r.category]??={p:0,d:0};parity[r.category].p++;}else if(o.parityStatus==='Disparity'){parity[r.category]??={p:0,d:0};parity[r.category].d++;disp[r.category]=(disp[r.category]||0)+1;total[r.category]=(total[r.category]||0)+num(o.priceImpact);}}}
      if(market==='amazon'){for(const r of getSnapshotAmazonIssueRows(s,'amazonSuppressions').filter(x=>allowedCategory(x.category))){supp[r.category]=(supp[r.category]||0)+1;total[r.category]=(total[r.category]||0)+num(r.revenueImpactPerDay);}for(const r of getSnapshotAmazonIssueRows(s,'amazonBuyBox').filter(x=>allowedCategory(x.category))){buy[r.category]=(buy[r.category]||0)+1;total[r.category]=(total[r.category]||0)+num(r.revenueImpactPerDay);}}
    }
    const latest=[...(snaps||[])].sort((a,b)=>String(a.reportDate).localeCompare(String(b.reportDate))).at(-1);if(latest){for(const r of v7SnapshotInventoryRows(latest,market)){if(!allowedCategory(r.category))continue;const stock=r.inventoryKnown===false?null:Number(r.inventory);if(stock!=null&&stock<=7)inv[r.category]=(inv[r.category]||0)+1;}}
    const parityPct={};for(const [c,x] of Object.entries(parity))parityPct[c]=(x.p+x.d)?(100*x.p/(x.p+x.d)):0;return {parityPct,disp,supp,buy,inv,total};
  }
  try{
    const baseDash=renderDashboardFromSnapshots;
    renderDashboardFromSnapshots=function(snaps,period,anchor,category){baseDash(snaps,period,anchor,category);for(const market of ['amazon','flipkart']){const m=dashboardCategoryMetrics(snaps,market);const cap=market[0].toUpperCase()+market.slice(1);const p=document.getElementById(`${market}ParityCategoryBreakdown`);if(p)p.innerHTML=categoryRowsHtml(m.parityPct,market,'parity',v=>`${num(v).toFixed(1)}%`);const d=document.getElementById(`${market}DisparityCategoryBreakdown`);if(d)d.innerHTML=categoryRowsHtml(m.disp,market,'price_disparity');const i=document.getElementById(`${market}InventoryCategoryBreakdown`);if(i)i.innerHTML=categoryRowsHtml(m.inv,market,'inventory');const tt=document.getElementById(`${market}TotalCategoryBreakdown`);if(tt)tt.innerHTML=categoryRowsHtml(m.total,market,'total_impact',v=>money(v));if(market==='amazon'){const s=document.getElementById('amazonSuppressionCategoryBreakdown');if(s)s.innerHTML=categoryRowsHtml(m.supp,'amazon','amazon_suppression');const b=document.getElementById('amazonBuyBoxCategoryBreakdown');if(b)b.innerHTML=categoryRowsHtml(m.buy,'amazon','amazon_buybox');}
      const latest=[...(snaps||[])].sort((a,b)=>String(a.reportDate).localeCompare(String(b.reportDate))).at(-1),invRows=latest?v7SnapshotInventoryRows(latest,market).filter(r=>allowedCategory(r.category)):[],oos=invRows.filter(r=>r.inventoryKnown!==false&&num(r.inventory)<=0).length,risk=invRows.filter(r=>r.inventoryKnown!==false&&num(r.inventory)<=7).length;setText(`${market}InventoryRiskCount`,fmt(risk));setText(`${market}InventoryOosCount`,fmt(oos));setText(`${market}InventoryRiskDetail`,latest?`${fmt(risk)} OOS / low-stock mappings as of ${latest.reportDate}`:'No Data Available');}
    };
  }catch(_e){}

  /* ---------- clean obsolete UI fragments and responsive state ---------- */
  function cleanup(){
    document.querySelectorAll('[data-ws-module="flipkartBuyBox"], [data-history-view="flipkart_buybox"]').forEach(e=>e.remove());
    document.querySelectorAll('[data-upload-type="pricing_exceptions"], [data-v8-upload="pricing_exceptions"]').forEach(e=>e.closest('label,.upload-card,.settings-field')?.remove?.()||e.remove());
    document.documentElement.style.overflowX='hidden';document.body.style.overflowX='hidden';
    const side=document.getElementById('mainSidebar');if(side)side.setAttribute('data-responsive-drawer','true');
  }
  document.addEventListener('DOMContentLoaded',()=>{cleanup();setTimeout(cleanup,500);},{once:true});

  window.WakeSuiteV93={version:VERSION,aiIncluded:false};
  window.WakeSuiteModules?.register('v9.3',{version:VERSION,aiIncluded:false});
})();
