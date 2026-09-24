/* WakeSuite V9.3.3
 * Order-report analytics extension:
 * - Amazon/Flipkart Order Reports remain analytical sources for Exception Insights,
 *   Live Price Disparity Impact and Inventory History velocity analysis.
 * - Amazon FBA/FBM and Flipkart Listing File "Fulfillment By" are exposed as
 *   analysis dimensions.
 * - Active effective Live Price exceptions exclude overlapping disparity orders
 *   and modeled impact from actionable impact totals while preserving raw mismatch.
 */
(function(){
  'use strict';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'');
  const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
  const money=v=>typeof formatINR==='function'?formatINR(num(v)):`₹${num(v).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
  const iso=v=>{
    if(!v)return '';
    if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
    const d=new Date(v); return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
  };
  const canon=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const pick=(r,aliases)=>{const m=new Map(Object.keys(r||{}).map(k=>[canon(k),k]));for(const a of aliases){const k=m.get(canon(a));if(k!==undefined&&r[k]!==''&&r[k]!==null&&r[k]!==undefined)return r[k];}return '';};
  const shift=(d,n)=>{const x=new Date(`${d}T00:00:00`);x.setDate(x.getDate()+n);return typeof localIsoDate==='function'?localIsoDate(x):x.toISOString().slice(0,10);};
  const days=(a,b)=>a&&b&&a<=b?Math.floor((new Date(`${b}T00:00:00`)-new Date(`${a}T00:00:00`))/86400000)+1:0;

  function normalizeAmazonFulfillment(v){
    const s=String(v??'').trim().toLowerCase();
    if(!s)return 'Unknown';
    if(/afn|amazon/.test(s))return 'FBA';
    if(/mfn|merchant|seller/.test(s))return 'FBM';
    return String(v).trim();
  }
  function normalizeFlipFulfillment(v){return String(v??'').trim()||'Unknown';}

  async function rawVersions(configId){
    if(typeof openWakeSuiteDb!=='function'||!window.XLSX)return [];
    try{
      const db=await openWakeSuiteDb();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(['report_versions','raw_files'],'readonly');
        const q=tx.objectStore('report_versions').getAll();
        q.onsuccess=()=>{
          const latest=new Map();
          (q.result||[]).filter(v=>v.configId===configId&&v.status==='successful').forEach(v=>{
            const key=v.dateConfig||`${v.reportDate}::${v.configId}`;
            const old=latest.get(key); if(!old||Number(v.createdAt)>Number(old.createdAt))latest.set(key,v);
          });
          const versions=[...latest.values()];
          if(!versions.length){resolve([]);return;}
          const out=[];let left=versions.length;
          versions.forEach(v=>{const r=tx.objectStore('raw_files').get(v.versionId);r.onsuccess=()=>{if(r.result)out.push({...v,raw:r.result});if(--left===0)resolve(out);};r.onerror=()=>{if(--left===0)resolve(out);};});
        };
        q.onerror=()=>reject(q.error);
      });
    }catch(e){console.warn('V9.3.3 order source read failed',e);return [];}
  }
  function parseRaw(raw){
    try{const wb=XLSX.read(raw.bytes,{type:'array',cellDates:true});let out=[];wb.SheetNames.forEach(name=>{const arr=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:false});if(arr.length)out.push(...arr);});return out;}catch(e){console.warn('V9.3.3 workbook parse failed',e);return [];}
  }
  function amazonMap(){
    const m=new Map();
    try{const p=prepareAmazonMasterPricing();for(const [k,v] of p.masterMap)m.set(String(k),v);}catch(_e){(window.masterPricingAmazon?.rows||[]).forEach(v=>{if(v.azSku)m.set(String(v.azSku),v);});}
    return m;
  }
  function flipMap(){
    const byFsn=new Map(),bySku=new Map();
    try{const p=prepareFlipkartMasterPricing();for(const [k,v] of p.masterMap){bySku.set(String(k),v);if(v.fsn)byFsn.set(String(v.fsn),v);}}catch(_e){(window.masterPricingFlipkart?.rows||[]).forEach(v=>{if(v.fkSku)bySku.set(String(v.fkSku),v);if(v.fsn)byFsn.set(String(v.fsn),v);});}
    return {byFsn,bySku};
  }
  async function loadOrders(){
    const out=[];const az=amazonMap();
    for(const v of await rawVersions('amazon_order_report')){
      for(const r of parseRaw(v.raw)){
        const sku=String(pick(r,['sku','seller-sku','seller sku','merchant-sku','merchant sku'])||'').trim();if(!sku)continue;
        const status=String(pick(r,['order-status','order status','item-status','item status','status'])||'').toLowerCase();if(/cancel/.test(status))continue;
        const date=iso(pick(r,['purchase-date','purchase date','order-date','order date','date']))||iso(v.reportDate);if(!date)continue;
        const qty=Math.max(0,num(pick(r,['quantity','quantity-purchased','quantity purchased','units','qty']))||1);
        const revenue=num(pick(r,['item-price','item price','product-sales','product sales','revenue','sales','item subtotal','item-total','order value']));
        const orderId=String(pick(r,['amazon-order-id','amazon order id','order-id','order id','order_id'])||'').trim();
        const m=az.get(sku)||{};
        out.push({marketplace:'amazon',date,azSku:sku,asin:String(pick(r,['asin'])||m.asin||''),wfSku:m.wfSku||'',category:m.category||'',units:qty,revenue,orderId,fulfillment:normalizeAmazonFulfillment(pick(r,['fulfillment-channel','fulfillment channel','fulfilment-channel','fulfilment channel','fulfilled-by']))});
      }
    }
    const fk=flipMap();
    for(const v of await rawVersions('flipkart_order_report')){
      for(const r of parseRaw(v.raw)){
        const fsn=String(pick(r,['fsn','flipkart serial number'])||'').trim();if(!fsn)continue;
        const status=String(pick(r,['order_item_status','order item status','status'])||'').toLowerCase();if(/cancel/.test(status))continue;
        const date=iso(pick(r,['order_date','order date','order_date_time','ordered date','date']))||iso(v.reportDate);if(!date)continue;
        const qty=Math.max(0,num(pick(r,['quantity','units','qty']))||1);
        const orderId=String(pick(r,['order_id','order id','order_item_id','order item id'])||'').trim();
        const m=fk.byFsn.get(fsn)||{};const fkSku=String(pick(r,['sku','seller sku id','seller sku','fk sku'])||m.fkSku||'');
        out.push({marketplace:'flipkart',date,fsn,fkSku,wfSku:m.wfSku||'',category:m.category||'',units:qty,revenue:0,orderId,fulfillment:normalizeFlipFulfillment(pick(r,['fulfilment_source','fulfilment source','fulfilment_type','fulfilment type']))});
      }
    }
    return out;
  }
  async function flipFulfillmentMap(){
    const versions=await rawVersions('flipkart_listing_file');const map=new Map();
    versions.sort((a,b)=>String(b.reportDate).localeCompare(String(a.reportDate)));
    const v=versions[0];if(!v)return map;
    for(const r of parseRaw(v.raw)){
      const fsn=String(pick(r,['Flipkart Serial Number','fsn'])||'').trim();const sku=String(pick(r,['Seller SKU Id','seller sku id','sku'])||'').trim();const f=normalizeFlipFulfillment(pick(r,['Fulfillment By','fulfillment by']));
      if(fsn)map.set(`fsn:${fsn}`,f);if(sku)map.set(`sku:${sku}`,f);
    }
    return map;
  }
  function selectedRange(prefix){
    const p=document.getElementById(`${prefix}Period`)?.value||'last7';let to=document.getElementById(`${prefix}ToDate`)?.value||todayIso();let from=to;
    if(p==='today')from=to;else if(p==='yesterday')from=to=shift(to,-1);else if(p==='last7')from=shift(to,-6);else if(p==='last14')from=shift(to,-13);else if(p==='last30')from=shift(to,-29);else if(p==='custom'){from=document.getElementById(`${prefix}FromDate`)?.value||to;to=document.getElementById(`${prefix}ToDate`)?.value||to;if(from>to)[from,to]=[to,from];}
    return [from,to];
  }
  function rowIdentity(r){return r.marketplace==='amazon'?String(r.asin||r.azSku||r.wfSku):String(r.fsn||r.fkSku||r.wfSku);}

  function ensureImpactPanel(){
    const anchor=document.getElementById('disparityExplorerTable')?.closest('.analytics-card')||document.getElementById('disparityExplorerTable')?.parentElement?.parentElement;
    if(!anchor||document.getElementById('liveDisparityImpactPanel'))return;
    const p=document.createElement('div');p.id='liveDisparityImpactPanel';p.className='analytics-card v933-impact-panel';p.innerHTML=`<div class="analytics-card-head"><div><strong>Live Price Disparity · Order Impact</strong><div class="v7-muted">Orders are attributed only to dates where the live disparity was active. Active effective Live Price exceptions are excluded from actionable impact. Orders are attributed per affected ASIN/FSN; one marketplace order containing multiple affected identifiers can appear in multiple identifier rows.</div></div><span id="v933ImpactInfo">Waiting for order data</span></div><div class="v93-kpi-grid" id="v933ImpactKpis"></div><div class="v933-impact-grid"><div><h4>Category Impact</h4><div id="v933ImpactCategory"></div></div><div><h4>Fulfillment Impact</h4><div id="v933ImpactFulfillment"></div></div></div><div class="table-wrap"><table class="result-table" id="v933ImpactTable"></table></div>`;
    anchor.parentElement?.insertBefore(p,anchor.nextSibling);
  }
  function getRange(){
    const p=document.getElementById('disparityExplorerPeriod')?.value||'last7';let to=document.getElementById('disparityExplorerToDate')?.value||todayIso(),from=to;
    if(p==='yesterday')from=to=shift(to,-1);else if(p==='last7')from=shift(to,-6);else if(p==='last14')from=shift(to,-13);else if(p==='last30')from=shift(to,-29);else if(p==='custom'){from=document.getElementById('disparityExplorerFromDate')?.value||to;to=document.getElementById('disparityExplorerToDate')?.value||to;if(from>to)[from,to]=[to,from];}return[from,to];
  }
  async function liveImpact(){
    ensureImpactPanel();const panel=document.getElementById('liveDisparityImpactPanel');if(!panel)return;
    const [from,to]=getRange();const snaps=await v4LoadSnapshotsForRange(from,to);const orders=await loadOrders();const fulfillment=await flipFulfillmentMap();
    const active=new Map();const activeDays=new Set();
    for(const s of snaps||[]){
      for(const r of getSnapshotAmazonRows(s)||[]){
        if(!r.rawLivePriceDisparity)continue;const key=`amazon|${r.asin||r.azSku||r.wfSku}`;
        const entry=active.get(key)||{marketplace:'amazon',identifier:r.asin||r.azSku,wfSku:r.wfSku||'',category:r.category||'',days:0,impact:0,excludedDays:0};
        if(r.livePriceDisparity){entry.days++;entry.impact+=num(r.liveDailyRevenueImpact||r.dailyRevenueImpact);activeDays.add(`${key}|${s.reportDate}`);}else entry.excludedDays++;
        active.set(key,entry);
      }
      for(const r of getSnapshotFlipkartRows(s)||[]){
        if(!r.rawLivePriceDisparity)continue;const key=`flipkart|${r.fsn||r.fkSku||r.wfSku}`;
        const entry=active.get(key)||{marketplace:'flipkart',identifier:r.fsn||r.fkSku,wfSku:r.wfSku||'',category:r.category||'',days:0,impact:0,excludedDays:0};
        if(r.livePriceDisparity){entry.days++;entry.impact+=num(r.liveDailyRevenueImpact||r.dailyRevenueImpact);activeDays.add(`${key}|${s.reportDate}`);}else entry.excludedDays++;
        active.set(key,entry);
      }
    }
    const orderIndex=new Map();for(const o of orders){if(o.date<from||o.date>to)continue;const k=`${o.marketplace}|${rowIdentity(o)}|${o.date}`;const a=orderIndex.get(k)||[];a.push(o);orderIndex.set(k,a);}
    const rows=[];
    for(const a of active.values()){
      if(a.days===0)continue;
      const inDays=new Set();let units=0,revenue=0,orderSet=new Set();const fulfill={};
      for(let d=from;d<=to;d=shift(d,1)){if(!activeDays.has(`${a.marketplace}|${a.identifier}|${d}`))continue;const os=orderIndex.get(`${a.marketplace}|${a.identifier}|${d}`)||[];if(os.length)inDays.add(d);for(const o of os){units+=num(o.units);revenue+=num(o.revenue);if(o.orderId)orderSet.add(o.orderId);const f=a.marketplace==='flipkart'?(fulfillment.get(`fsn:${o.fsn}`)||fulfillment.get(`sku:${o.fkSku}`)||o.fulfillment):o.fulfillment;fulfill[f]=(fulfill[f]||0)+num(o.units);}}
      rows.push({...a,orders:orderSet.size||0,units,revenue,impact:a.impact,fulfillment:fulfill,orderDays:inDays.size,orderOverlapPct:a.days?inDays.size/a.days*100:0});
    }
    const filtered=rows.filter(r=>r.marketplace==='amazon'||r.marketplace==='flipkart');
    const ordersTotal=filtered.reduce((s,r)=>s+r.orders,0),unitsTotal=filtered.reduce((s,r)=>s+r.units,0),revTotal=filtered.reduce((s,r)=>s+r.revenue,0),impactTotal=filtered.reduce((s,r)=>s+r.impact,0),excluded=filtered.reduce((s,r)=>s+r.excludedDays,0);
    const k=document.getElementById('v933ImpactKpis');if(k)k.innerHTML=`<div class="v93-kpi"><span>Disparity ASINs / FSNs</span><strong>${filtered.length.toLocaleString('en-IN')}</strong></div><div class="v93-kpi"><span>Orders During Disparity</span><strong>${ordersTotal.toLocaleString('en-IN')}</strong></div><div class="v93-kpi"><span>Units During Disparity</span><strong>${unitsTotal.toLocaleString('en-IN')}</strong></div><div class="v93-kpi"><span>Order Revenue · Amazon</span><strong>${money(revTotal)}</strong></div><div class="v93-kpi"><span>Modeled Revenue Impact</span><strong>${money(impactTotal)}</strong></div><div class="v93-kpi"><span>Exception-Excluded Disparity Days</span><strong>${excluded.toLocaleString('en-IN')}</strong></div>`;
    const info=document.getElementById('v933ImpactInfo');if(info)info.textContent=`${from} to ${to} · ${orders.length.toLocaleString('en-IN')} order rows available`;
    const cm={};const fm={};filtered.forEach(r=>{cm[r.category]=(cm[r.category]||0)+r.orders;Object.entries(r.fulfillment).forEach(([f,v])=>fm[f]=(fm[f]||0)+v);});
    const bar=(m,fmt)=>{const max=Math.max(1,...Object.values(m));return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([x,v])=>`<div class="v93-bar-row"><span>${esc(x)}</span><div class="v93-bar-track"><div class="v93-bar-fill" style="width:${v/max*100}%"></div></div><strong>${fmt(v)}</strong></div>`).join('')||'<div class="v7-muted">No order overlap</div>';};
    document.getElementById('v933ImpactCategory').innerHTML=`<div class="v93-bar-chart">${bar(cm,v=>Number(v).toLocaleString('en-IN'))}</div>`;
    document.getElementById('v933ImpactFulfillment').innerHTML=`<div class="v93-bar-chart">${bar(fm,v=>Number(v).toLocaleString('en-IN'))}</div>`;
    const t=document.getElementById('v933ImpactTable');const cols=[['marketplace','Marketplace'],['identifier','ASIN / FSN'],['wfSku','WF SKU'],['category','Category'],['days','Actionable Disparity Days'],['excludedDays','Exception-Excluded Days'],['orders','Orders'],['units','Units'],['revenue','Order Revenue'],['impact','Modeled Revenue Impact'],['orderOverlapPct','Order-Day Overlap %']];
    t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${c[1]}</th>`).join('')+'</tr></thead><tbody>'+(filtered.length?filtered.sort((a,b)=>b.impact-a.impact).slice(0,3000).map(r=>'<tr>'+cols.map(([k])=>{let v=r[k];if(['revenue','impact'].includes(k))v=money(v);if(k==='orderOverlapPct')v=`${num(v).toFixed(1)}%`;if(k==='marketplace')v=r.marketplace==='amazon'?'Amazon':'Flipkart';if(k==='identifier')return`<td>${typeof clickId==='function'?clickId(v,'disparityExplorer'):esc(v)}</td>`;return`<td>${esc(v??'—')}</td>`;}).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty-row">No Live Price Disparity order overlap for the selected period.</td></tr>`)+'</tbody>';
  }

  async function enhanceInventoryHistory(){
    const table=document.getElementById('inventoryHistoryTable');if(!table)return;if(table.dataset.v933VelocityEnhanced==='1')return;table.dataset.v933VelocityEnhanced='1';
    const [from,to]=selectedRange('inventoryHistory');const orders=await loadOrders();const fkFulfill=await flipFulfillmentMap();
    const view=document.getElementById('inventoryHistoryView')?.value||'consolidated';
    const rows=[...table.querySelectorAll('tbody tr')];if(!rows.length)return;
    const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
    const isDaily=view==='daily';
    const extra=['Units Sold','DRR','Order Days','Fulfillment','Sales vs Opening Stock %'];
    extra.forEach(x=>{if(!headers.includes(x))table.querySelector('thead tr')?.insertAdjacentHTML('beforeend',`<th>${x}</th>`);});
    rows.forEach(tr=>{
      const cells=[...tr.children];const marketplace=(cells[1]?.textContent||'').toLowerCase().includes('flip')?'flipkart':'amazon';
      const identifier=(cells[isDaily?5:4]?.textContent||'').trim();const wfSku=(cells[isDaily?3:2]?.textContent||'').trim();const marketSku=(cells[isDaily?4:3]?.textContent||'').trim();const date=isDaily?(cells[0]?.textContent||'').trim():null;
      const os=orders.filter(o=>o.marketplace===marketplace&&rowIdentity(o)===identifier&&o.wfSku===wfSku&&o.date>=from&&o.date<=to&&(!date||o.date===date));const units=os.reduce((s,o)=>s+num(o.units),0);const sellingDays=new Set(os.map(o=>o.date)).size;const drr=sellingDays?units/sellingDays:0;
      const f=marketplace==='amazon'?[...new Set(os.map(o=>o.fulfillment).filter(Boolean))].join(' / ')||'No Order Data':[fkFulfill.get(`fsn:${identifier}`)||fkFulfill.get(`sku:${marketSku}`)||'No Listing Data'];
      const openingCell=isDaily?null:num((cells[7]?.textContent||'').replace(/,/g,''));const consumption=openingCell>0?units/openingCell*100:null;
      [units.toLocaleString('en-IN'),drr.toFixed(2),sellingDays.toLocaleString('en-IN'),f,consumption==null?'—':`${consumption.toFixed(1)}%`].forEach(v=>tr.insertAdjacentHTML('beforeend',`<td>${esc(v)}</td>`));
    });
    const info=document.getElementById('inventoryHistoryInfo');if(info)info.textContent+=` · Order velocity ${from} to ${to} · DRR = units sold ÷ selling days`;
  }

  function upgradeBusinessUi(){
    const host=document.getElementById('businessInsightsContent');if(!host)return;
    const shell=host.closest('.business-insights-shell');if(shell&&!shell.querySelector('.v933-business-note')){
      const note=document.createElement('div');note.className='v933-business-note';note.innerHTML='<strong>Business Insights</strong><span>Marketplace Insights-style analysis for Pricing and Inventory. Metrics are decision support; revenue response is observed, not causal.</span>';shell.insertBefore(note,host);
    }
  }
  const baseBI=window.openBusinessInsights;
  if(typeof baseBI==='function')window.openBusinessInsights=async function(type='pricing',ctx={}){upgradeBusinessUi();return baseBI(type,ctx);};
  const baseInv=window.loadInventoryHistory;
  if(typeof baseInv==='function')window.loadInventoryHistory=async function(){const t=document.getElementById('inventoryHistoryTable');if(t)delete t.dataset.v933VelocityEnhanced;const result=await baseInv();try{await enhanceInventoryHistory();}catch(e){console.warn('V9.3.3 inventory velocity enhancement failed',e);}return result;};
  const baseDisp=window.loadDisparityExplorer;
  if(typeof baseDisp==='function')window.loadDisparityExplorer=async function(){const result=await baseDisp();try{await liveImpact();}catch(e){console.warn('V9.3.3 live disparity impact failed',e);}return result;};
  document.addEventListener('DOMContentLoaded',()=>{upgradeBusinessUi();ensureImpactPanel();});
  window.WakeSuiteV933={loadOrders,liveImpact,enhanceInventoryHistory};
})();
