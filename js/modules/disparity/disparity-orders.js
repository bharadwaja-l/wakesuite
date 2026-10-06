/* WakeSuite V9.3.5 · Amazon Disparity Orders
 * Shows only Amazon order rows whose purchase date overlaps a raw Live Price
 * Disparity for the same ASIN/AZ SKU on that date.
 */
(function(){
  'use strict';

  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[c]));
  const num = value => {
    const n = Number(String(value ?? '').replace(/[^0-9.-]/g,''));
    return Number.isFinite(n) ? n : 0;
  };
  const money = value => typeof formatINR === 'function'
    ? formatINR(num(value))
    : `₹${num(value).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
  const shift = (date,delta) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate()+delta);
    return typeof localIsoDate === 'function' ? localIsoDate(d) : d.toISOString().slice(0,10);
  };

  let state = {rows:[],filtered:[],from:'',to:''};

  function selectedRange(){
    const period=document.getElementById('disparityOrdersPeriod')?.value||'last7';
    let to=document.getElementById('disparityOrdersToDate')?.value||todayIso();
    let from=to;
    if(period==='yesterday') from=to=shift(to,-1);
    else if(period==='last7') from=shift(to,-6);
    else if(period==='last14') from=shift(to,-13);
    else if(period==='last30') from=shift(to,-29);
    else if(period==='custom'){
      from=document.getElementById('disparityOrdersFromDate')?.value||to;
      to=document.getElementById('disparityOrdersToDate')?.value||to;
      if(from>to) [from,to]=[to,from];
    }
    return [from,to];
  }

  function toggleCustomDates(){
    const isCustom=document.getElementById('disparityOrdersPeriod')?.value==='custom';
    document.getElementById('disparityOrdersCustomDates')?.classList.toggle('hidden',!isCustom);
  }

  function rawLive(row){
    return row?.rawLivePriceDisparity === true || row?.rawLivePriceDisparity === 'true';
  }

  function disparityKeyBySku(date,sku){return sku?`${date}|sku|${String(sku).trim()}`:'';}
  function disparityKeyByAsin(date,asin){return asin?`${date}|asin|${String(asin).trim()}`:'';}

  function pickBest(existing,row){
    if(!existing) return row;
    if(row?.livePriceDisparity && !existing?.livePriceDisparity) return row;
    if(row?.azSku && !existing?.azSku) return row;
    return existing;
  }

  async function buildRows(){
    const [from,to]=selectedRange();
    if(typeof v4LoadSnapshotsForRange!=='function') throw new Error('Snapshot history is unavailable.');
    if(!window.WakeSuiteV933?.loadOrders) throw new Error('Amazon Order Report analytics is unavailable.');

    const [snapshots,orders]=await Promise.all([
      v4LoadSnapshotsForRange(from,to),
      window.WakeSuiteV933.loadOrders()
    ]);

    const disparityBySku=new Map();
    const disparityByAsin=new Map();

    for(const snapshot of snapshots||[]){
      const date=String(snapshot?.reportDate||'').slice(0,10);
      if(!date) continue;
      for(const row of (typeof getSnapshotAmazonRows==='function'?getSnapshotAmazonRows(snapshot):[])||[]){
        if(!rawLive(row)) continue;
        const skuKey=disparityKeyBySku(date,row.azSku);
        const asinKey=disparityKeyByAsin(date,row.asin);
        if(skuKey) disparityBySku.set(skuKey,pickBest(disparityBySku.get(skuKey),row));
        if(asinKey) disparityByAsin.set(asinKey,pickBest(disparityByAsin.get(asinKey),row));
      }
    }

    const rows=[];
    const seen=new Set();
    for(const order of orders||[]){
      if(order.marketplace!=='amazon'||order.date<from||order.date>to) continue;
      const disparity = disparityBySku.get(disparityKeyBySku(order.date,order.azSku))
        || disparityByAsin.get(disparityKeyByAsin(order.date,order.asin));
      if(!disparity) continue;

      const unique=[order.orderItemId||'',order.orderId||'',order.date||'',order.azSku||'',order.asin||'',order.itemPrice||'',order.units||''].join('|');
      if(seen.has(unique)) continue;
      seen.add(unique);

      const actionable=disparity.livePriceDisparity===true || disparity.livePriceDisparity==='true';
      rows.push({
        disparityDate:order.date,
        purchaseDateTime:order.purchaseDateTime||order.date,
        orderId:order.orderId||'',
        orderItemId:order.orderItemId||'',
        asin:order.asin||disparity.asin||'',
        azSku:order.azSku||disparity.azSku||'',
        wfSku:order.wfSku||disparity.wfSku||'',
        category:order.category||disparity.category||'',
        fulfillment:order.fulfillment||'Unknown',
        fulfillmentRaw:order.fulfillmentRaw||'',
        quantity:num(order.units),
        itemPrice:num(order.itemPrice ?? order.revenue),
        orderStatus:order.orderStatus||order.itemStatus||'',
        wfPrice:num(disparity.wfPrice),
        amazonLivePrice:num(disparity.finalLivePrice),
        livePriceDifference:num(disparity.livePriceDiff ?? (num(disparity.finalLivePrice)-num(disparity.wfPrice))),
        exceptionStatus:actionable?'No Effective Live Price Exception':'Exception Excluded',
        actionable,
        rawLivePriceDisparity:true
      });
    }

    state={rows,filtered:rows,from,to};
    return state;
  }

  function categoryOptions(){
    const sel=document.getElementById('disparityOrdersCategory');
    if(!sel) return;
    const current=sel.value||'all';
    const cats=[...new Set(state.rows.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    sel.innerHTML='<option value="all">All Categories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value=cats.includes(current)?current:'all';
  }

  function applyFilters(){
    const category=document.getElementById('disparityOrdersCategory')?.value||'all';
    const fulfillment=document.getElementById('disparityOrdersFulfillment')?.value||'all';
    const exception=document.getElementById('disparityOrdersException')?.value||'all';
    const q=String(document.getElementById('disparityOrdersSearch')?.value||'').trim().toLowerCase();
    state.filtered=state.rows.filter(r=>{
      if(category!=='all'&&r.category!==category) return false;
      if(fulfillment!=='all'&&r.fulfillment!==fulfillment) return false;
      if(exception==='actionable'&&!r.actionable) return false;
      if(exception==='excluded'&&r.actionable) return false;
      if(q){
        const hay=[r.orderId,r.orderItemId,r.asin,r.azSku,r.wfSku,r.category].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
    render();
  }

  function render(){
    const rows=state.filtered;
    const orderCount=new Set(rows.map(r=>r.orderId).filter(Boolean)).size;
    const units=rows.reduce((s,r)=>s+r.quantity,0);
    const revenue=rows.reduce((s,r)=>s+r.itemPrice,0);
    const asins=new Set(rows.map(r=>r.asin).filter(Boolean)).size;
    const excluded=rows.filter(r=>!r.actionable).length;

    const kpis=document.getElementById('disparityOrdersKpis');
    if(kpis) kpis.innerHTML=`
      <div class="v93-kpi"><span>Live Disparity ASINs</span><strong>${asins.toLocaleString('en-IN')}</strong></div>
      <div class="v93-kpi"><span>Orders</span><strong>${orderCount.toLocaleString('en-IN')}</strong></div>
      <div class="v93-kpi"><span>Units</span><strong>${units.toLocaleString('en-IN')}</strong></div>
      <div class="v93-kpi"><span>Order Revenue</span><strong>${money(revenue)}</strong></div>
      <div class="v93-kpi"><span>Exception-Excluded Rows</span><strong>${excluded.toLocaleString('en-IN')}</strong></div>`;

    const info=document.getElementById('disparityOrdersInfo');
    if(info) info.textContent=`${state.from} to ${state.to} · ${rows.length.toLocaleString('en-IN')} matching order rows`;

    const cols=[
      ['disparityDate','Disparity Date'],['purchaseDateTime','Purchase Date'],['orderId','Amazon Order ID'],['orderItemId','Order Item ID'],
      ['asin','ASIN'],['azSku','AZ SKU'],['wfSku','WF SKU'],['category','Category'],['fulfillment','FBA / FBM'],['quantity','Quantity'],
      ['itemPrice','Item Price'],['orderStatus','Order Status'],['wfPrice','WF Price'],['amazonLivePrice','Amazon Live Price'],['livePriceDifference','Live Price Difference'],['exceptionStatus','Exception Status']
    ];
    const table=document.getElementById('disparityOrdersTable');
    if(!table) return;
    const body=rows.length?rows.slice().sort((a,b)=>String(b.disparityDate).localeCompare(String(a.disparityDate))||String(a.orderId).localeCompare(String(b.orderId))).map(r=>{
      return '<tr>'+cols.map(([key])=>{
        let value=r[key];
        if(['itemPrice','wfPrice','amazonLivePrice','livePriceDifference'].includes(key)) value=money(value);
        if(key==='asin'&&typeof clickId==='function') return `<td>${clickId(value,'disparityOrders')}</td>`;
        if(key==='exceptionStatus') return `<td><span class="ws-do-status ${r.actionable?'is-actionable':'is-excluded'}">${esc(value)}</span></td>`;
        return `<td>${esc(value??'')}</td>`;
      }).join('')+'</tr>';
    }).join(''):`<tr><td colspan="${cols.length}" class="empty-row">No Amazon orders overlapped a Live Price Disparity in the selected period.</td></tr>`;
    table.innerHTML='<thead><tr>'+cols.map(([,label])=>`<th>${esc(label)}</th>`).join('')+'</tr></thead><tbody>'+body+'</tbody>';
  }

  async function load(){
    const table=document.getElementById('disparityOrdersTable');
    if(table) table.innerHTML='<tbody><tr><td class="empty-row">Loading disparity orders…</td></tr></tbody>';
    try{
      await buildRows();
      categoryOptions();
      applyFilters();
    }catch(error){
      console.error('Disparity Orders failed',error);
      if(table) table.innerHTML=`<tbody><tr><td class="empty-row">${esc(error.message||'Unable to load disparity orders.')}</td></tr></tbody>`;
      const info=document.getElementById('disparityOrdersInfo');if(info)info.textContent='Data unavailable';
    }
  }

  function reset(){
    const p=document.getElementById('disparityOrdersPeriod');if(p)p.value='last7';
    const cat=document.getElementById('disparityOrdersCategory');if(cat)cat.value='all';
    const f=document.getElementById('disparityOrdersFulfillment');if(f)f.value='all';
    const e=document.getElementById('disparityOrdersException');if(e)e.value='all';
    const q=document.getElementById('disparityOrdersSearch');if(q)q.value='';
    toggleCustomDates();
    load();
  }

  function download(){
    if(!window.XLSX){alert('Excel library is not loaded.');return;}
    const data=state.filtered.map(r=>({
      'Disparity Date':r.disparityDate,
      'Purchase Date':r.purchaseDateTime,
      'Amazon Order ID':r.orderId,
      'Order Item ID':r.orderItemId,
      'ASIN':r.asin,
      'AZ SKU':r.azSku,
      'WF SKU':r.wfSku,
      'Category':r.category,
      'FBA / FBM':r.fulfillment,
      'Fulfillment Raw':r.fulfillmentRaw,
      'Quantity':r.quantity,
      'Item Price':r.itemPrice,
      'Order Status':r.orderStatus,
      'WF Price':r.wfPrice,
      'Amazon Live Price':r.amazonLivePrice,
      'Live Price Difference':r.livePriceDifference,
      'Exception Status':r.exceptionStatus
    }));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.length?data:[{'Status':'No Live Price Disparity orders for selected filters'}]),'Disparity Orders');
    XLSX.writeFile(wb,`WakeSuite_Amazon_Disparity_Orders_${state.from}_to_${state.to}.xlsx`);
  }

  function open(){
    if(typeof showView==='function') showView('disparityOrdersSection');
    else{
      document.querySelectorAll('.app-view').forEach(el=>el.classList.remove('active'));
      document.getElementById('disparityOrdersSection')?.classList.add('active');
    }
    const title=document.getElementById('pageTitle');if(title)title.textContent='Disparity Orders';
    toggleCustomDates();
    load();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('disparityOrdersPeriod')?.addEventListener('change',toggleCustomDates);
    document.getElementById('disparityOrdersSearch')?.addEventListener('input',applyFilters);
    ['disparityOrdersCategory','disparityOrdersFulfillment','disparityOrdersException'].forEach(id=>document.getElementById(id)?.addEventListener('change',applyFilters));
    toggleCustomDates();
  });

  window.openDisparityOrders=open;
  window.loadDisparityOrders=load;
  window.resetDisparityOrders=reset;
  window.downloadDisparityOrders=download;
  window.WakeSuiteDisparityOrders={open,load,download,getState:()=>state};
})();
