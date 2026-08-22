/* WakeSuite V9.2 canonical identifier resolver */
(function(){
  const norm=v=>String(v??'').trim().toLowerCase();
  const allowedCategory=r=>typeof window.ws91CategoryAllowed==='function'?window.ws91CategoryAllowed(r.category):true;
  const allowedMarket=m=>{try{return typeof window.v7mMarketAllowed==='function'?window.v7mMarketAllowed(m):true;}catch(_e){return true;}};
  function matchRow(r,q,market){
    const ids=market==='amazon'?[r.asin,r.azSku,r.wfSku]:[r.fsn,r.fkSku,r.wfSku];
    return ids.some(x=>norm(x)===q);
  }
  async function resolve(identifier,opts={}){
    const q=norm(identifier); if(!q)return null;
    const date=opts.date||document.getElementById('dashboardToDate')?.value||document.getElementById('dashboardDate')?.value||(typeof window.todayIso==='function'?window.todayIso():new Date().toISOString().slice(0,10));
    const snap=typeof window.loadSnapshotCached==='function'?await window.loadSnapshotCached(date).catch(()=>null):null;
    if(!snap)return {query:identifier,date,amazon:[],flipkart:[],wfSkus:[]};
    let amazon=allowedMarket('amazon')&&typeof window.getSnapshotAmazonRows==='function'?window.getSnapshotAmazonRows(snap).filter(r=>allowedCategory(r)&&matchRow(r,q,'amazon')):[];
    let flipkart=allowedMarket('flipkart')&&typeof window.getSnapshotFlipkartRows==='function'?window.getSnapshotFlipkartRows(snap).filter(r=>allowedCategory(r)&&matchRow(r,q,'flipkart')):[];
    const wf=new Set([...amazon,...flipkart].map(r=>norm(r.wfSku)).filter(Boolean));
    if(wf.size){
      if(allowedMarket('amazon')&&typeof window.getSnapshotAmazonRows==='function') amazon=window.getSnapshotAmazonRows(snap).filter(r=>allowedCategory(r)&&wf.has(norm(r.wfSku)));
      if(allowedMarket('flipkart')&&typeof window.getSnapshotFlipkartRows==='function') flipkart=window.getSnapshotFlipkartRows(snap).filter(r=>allowedCategory(r)&&wf.has(norm(r.wfSku)));
    }
    return {query:identifier,date,snapshot:snap,amazon,flipkart,wfSkus:[...new Set([...amazon,...flipkart].map(r=>r.wfSku).filter(Boolean))]};
  }
  window.WakeSuiteProductResolver={resolve};
  window.WakeSuiteModules?.register('productResolver',window.WakeSuiteProductResolver);
})();
