/* WakeSuite V9.3 canonical identifier resolver · one-to-many mappings preserved */
(function(){
  const norm=v=>String(v??'').trim().toLowerCase();
  const allowedCategory=r=>{try{return typeof v7CategoryAllowed==='function'?v7CategoryAllowed(r.category):true;}catch(_e){return true;}};
  const allowedMarket=m=>{try{return typeof v7MarketAllowed==='function'?v7MarketAllowed(m):true;}catch(_e){return true;}};
  function matchRow(r,q,market){const ids=market==='amazon'?[r.asin,r.azSku,r.wfSku]:[r.fsn,r.fkSku,r.wfSku];return ids.some(x=>norm(x)===q);}
  async function snapshotFor(preferred){
    if(typeof loadSnapshotCached!=='function')return {date:preferred||'',snapshot:null};
    if(preferred){try{const s=await loadSnapshotCached(preferred);if(s)return {date:preferred,snapshot:s};}catch(_e){}}
    if(typeof listDailySnapshotMetas==='function'){
      try{const metas=(await listDailySnapshotMetas()).filter(x=>x?.reportDate).sort((a,b)=>String(b.reportDate).localeCompare(String(a.reportDate)));for(const m of metas){try{const s=await loadSnapshotCached(m.reportDate);if(s)return {date:m.reportDate,snapshot:s};}catch(_e){}}}catch(_e){}
    }
    return {date:preferred||'',snapshot:null};
  }
  async function resolve(identifier,opts={}){
    const q=norm(identifier);if(!q)return null;
    const preferred=opts.date||document.getElementById('dashboardToDate')?.value||document.getElementById('dashboardDate')?.value||(typeof todayIso==='function'?todayIso():new Date().toISOString().slice(0,10));
    const found=await snapshotFor(preferred),snap=found.snapshot,date=found.date;
    if(!snap)return {query:identifier,date,amazon:[],flipkart:[],wfSkus:[]};
    let amazon=allowedMarket('amazon')&&typeof getSnapshotAmazonRows==='function'?getSnapshotAmazonRows(snap).filter(r=>allowedCategory(r)&&matchRow(r,q,'amazon')):[];
    let flipkart=allowedMarket('flipkart')&&typeof getSnapshotFlipkartRows==='function'?getSnapshotFlipkartRows(snap).filter(r=>allowedCategory(r)&&matchRow(r,q,'flipkart')):[];
    // If an identifier resolves to a WF SKU, return every permitted atomic marketplace mapping for that WF SKU.
    const wf=new Set([...amazon,...flipkart].map(r=>norm(r.wfSku)).filter(Boolean));
    if(wf.size){
      if(allowedMarket('amazon'))amazon=getSnapshotAmazonRows(snap).filter(r=>allowedCategory(r)&&wf.has(norm(r.wfSku)));
      if(allowedMarket('flipkart'))flipkart=getSnapshotFlipkartRows(snap).filter(r=>allowedCategory(r)&&wf.has(norm(r.wfSku)));
    }
    return {query:identifier,date,snapshot:snap,amazon,flipkart,wfSkus:[...new Set([...amazon,...flipkart].map(r=>r.wfSku).filter(Boolean))]};
  }
  window.WakeSuiteProductResolver={resolve};
  window.WakeSuiteModules?.register('productResolver',window.WakeSuiteProductResolver);
})();
