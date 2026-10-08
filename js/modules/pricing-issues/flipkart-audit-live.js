/* Flipkart live price: selected-date audit evidence only.
 * Blank/missing audit prices never inherit listing prices or unverified saved values.
 */
(function(){
  'use strict';
  const RULE='FK_AUDIT_ONLY_V1',auditCache=new WeakMap();
  const key=v=>String(v??'').trim();
  function currentAudit(date){const r=window.wakeSuiteSessionReports?.marketplace_audit_report;return r?.reportDate===date&&Array.isArray(r.parsedFile?.rows)?r:null;}
  function auditMap(report){
    const rows=report?.parsedFile?.rows;if(!Array.isArray(rows))return null;
    if(auditCache.has(rows))return auditCache.get(rows);
    const map=new Map();
    for(const raw of rows){
      const fsn=normalizeKey(getRowValue(raw,'FSN'));if(!fsn)continue;
      const value=Number(parseMoney(getRowValue(raw,'flipkart_selling_price'))),buyNow=parseAuditBoolean(getRowValue(raw,'flipkart_buy_now_present'));
      const next={fsn,livePrice:Number.isFinite(value)&&value>0?value:null,buyNow,conflict:false};
      const previous=map.get(fsn);
      if(previous&&(previous.conflict||previous.livePrice!==next.livePrice||previous.buyNow!==next.buyNow))next.conflict=true;
      map.set(fsn,next);
    }
    auditCache.set(rows,map);return map;
  }
  function unavailable(found,reason,status='No Data Available'){return {auditFound:found,buyBoxStatus:status,finalLivePrice:null,priceSource:reason,eligibleForComparison:false};}
  resolveFlipkartLiveState=function(fsn,_listingPrice,map){
    const audit=map?.get(normalizeKey(fsn));
    if(!audit)return unavailable(false,'Live Price Unavailable - FSN absent from selected audit','Audit Missing');
    if(audit.conflict)return unavailable(true,'Live Price Unavailable - conflicting audit rows');
    if(audit.buyNow===false)return unavailable(true,'Live Price Unavailable - Buy Now false','No Buy Box');
    if(audit.buyNow!==true)return unavailable(true,'Live Price Unavailable - Buy Now status unknown','Unknown');
    if(!(Number(audit.livePrice)>0))return unavailable(true,'Live Price Unavailable - audit price blank or invalid','Available');
    return {auditFound:true,buyBoxStatus:'Available',finalLivePrice:Number(audit.livePrice),priceSource:'Audit Live Price',eligibleForComparison:true};
  };
  function clearLive(row,reason){return {...row,finalLivePrice:null,livePriceDiff:null,priceDiff:null,livePriceDisparity:false,rawLivePriceDisparity:false,livePriceException:false,liveMatchesListing:false,eligibleForComparison:false,livePriceAction:'Live Price Unavailable',requiredAction:'Live Price Unavailable',disparity:false,priceGap:0,priceGapPercent:0,revenueImpact:0,liveCalculatedRevenue:0,liveDailyRevenueImpact:0,calculatedRevenue:row.listingCalculatedRevenue||0,dailyRevenueImpact:row.listingPriceDisparity?Number(row.listingDailyRevenueImpact||0):0,priceSource:reason,liveAuditVerified:false};}
  function evidence(row,date,report,state){return {rule:RULE,reportDate:date,fsn:key(row.fsn),price:state.finalLivePrice,buyNow:state.eligibleForComparison,sourceVersion:report?.versionId||'',sourceFile:report?.parsedFile?.fileName||report?.fileName||'',source:state.priceSource};}
  function guardRow(row,date,map){
    if(map){
      const state=resolveFlipkartLiveState(row.fsn,null,map);
      if(!state.eligibleForComparison)return {...clearLive(row,state.priceSource),auditFound:state.auditFound,fkAuditLive:evidence(row,date,null,state)};
      // A saved analysis with a different price requires reprocessing for valid
      // revenue/allocation and exceptions; never mix its old metrics with a new price.
      if(Number(row.finalLivePrice)!==state.finalLivePrice)return clearLive(row,'Live Price Unavailable - current audit changed; reprocess this date');
      const {buyBoxStatus:_retired,...liveState}=state;
      return {...row,...liveState,liveAuditVerified:true,fkAuditLive:evidence(row,date,currentAudit(date),state)};
    }
    const proof=row.fkAuditLive;
    if(proof?.rule===RULE&&proof.reportDate===date&&key(proof.fsn)===key(row.fsn)&&proof.buyNow===true&&Number(proof.price)>0&&Number(proof.price)===Number(row.finalLivePrice))return {...row,priceSource:'Audit Live Price',liveAuditVerified:true};
    return clearLive(row,'Live Price Unavailable - saved audit evidence missing; reprocess this date');
  }
  const baseBuild=buildFlipkartModularResult;
  buildFlipkartModularResult=function(date){
    const report=currentAudit(date),map=auditMap(report),original=report?.auditSummary;
    if(report)report.auditSummary={...(original||{}),flipkartMap:map};
    let result;try{result=baseBuild(date);}finally{if(report)report.auditSummary=original;}
    if(result){result.rows=(result.rows||[]).map(row=>{const state=map?resolveFlipkartLiveState(row.fsn,null,map):unavailable(false,'No selected-date audit');const guarded=state.eligibleForComparison?row:clearLive(row,state.priceSource);return {...guarded,fkAuditLive:evidence(row,date,report,state),liveAuditVerified:state.eligibleForComparison};});result.livePriceDisparityRows=result.rows.filter(r=>r.livePriceDisparity);v7RefreshResultSummary(result,'flipkart');}
    return result;
  };
  const baseCompact=compactFlipkartRow,baseExpand=expandFlipkartRow;
  compactFlipkartRow=function(row){return [...baseCompact(row),{fkAuditLive:row.fkAuditLive||null}];};
  expandFlipkartRow=function(row){const result=baseExpand(row),tail=row[row.length-1];if(tail&&typeof tail==='object'&&!Array.isArray(tail)&&'fkAuditLive' in tail)result.fkAuditLive=tail.fkAuditLive;return result;};
  const baseRows=getSnapshotFlipkartRows;
  getSnapshotFlipkartRows=function(snapshot){const date=snapshot?.reportDate||'',map=auditMap(currentAudit(date)||snapshot?.__fkCurrentAudit);return baseRows(snapshot).map(row=>guardRow(row,date,map));};
  function guardSnapshot(snapshot){
    if(!snapshot)return snapshot;
    const rows=getSnapshotFlipkartRows(snapshot),result={rows,summary:{...(snapshot.flipkartSummary||{})}};
    v7RefreshResultSummary(result,'flipkart');
    return {...snapshot,flipkartRows:rows,flipkartSummary:result.summary,insights:{...(snapshot.insights||{}),flipkart:{...(snapshot.insights?.flipkart||{}),live:calcParityStats(rows,'live','flipkart'),livePriceImpact:result.summary.liveTotalDailyRevenueImpact||0}}};
  }
  const baseLoad=loadSnapshotCached;
  loadSnapshotCached=async function(date){
    const snapshot=await baseLoad(date);if(!snapshot)return snapshot;
    let local=currentAudit(date);
    if(!local&&typeof idbGetReportsForDate==='function')try{const item=(await idbGetReportsForDate(date)).find(x=>x.configId==='marketplace_audit_report');if(item?.record?.reportDate===date)local=item.record;}catch(_error){}
    const guarded=guardSnapshot({...snapshot,__fkCurrentAudit:local});snapshotCache.set(date,guarded);return guarded;
  };
  const baseHydrate=hydrateSnapshot;
  hydrateSnapshot=function(snapshot){return baseHydrate(guardSnapshot(snapshot));};
  // Missing/invalid audit evidence is not proof that an existing escalation was
  // resolved. Preserve that history without offering unverified rows for sending.
  function protectedIssueKeys(keys,date,existing){
    const current=new Set(keys||[]),snapshot=snapshotCache.get(date),rows=getSnapshotFlipkartRows(snapshot);
    const verified=new Set(rows.filter(r=>r.liveAuditVerified&&r.eligibleForComparison).map(r=>key(r.fsn)));
    for(const issue of existing||[]){
      if(issue.marketplace==='flipkart'&&issue.status!=='Resolved'&&!verified.has(key(issue.productId||issue.fsn)))current.add(issue.issueKey);
    }
    return [...current].filter(Boolean);
  }
  const baseCommunications=loadDailyCommunications;
  loadDailyCommunications=async function(...args){
    const sync=window.syncPocEscalationResolution;
    if(typeof sync==='function'&&!sync.fkAuditGuard){
      const guarded=async function(keys,date){const existing=typeof window.loadPocEscalations==='function'?await window.loadPocEscalations():[];return sync(protectedIssueKeys(keys,date,existing),date);};
      guarded.fkAuditGuard=true;window.syncPocEscalationResolution=guarded;
    }
    return baseCommunications(...args);
  };
  // Invalidate old calculations even when a replacement file keeps its name,
  // size, modification time and row count. Parsed audit values are authoritative.
  const baseFingerprint=buildInputFingerprint;
  buildInputFingerprint=function(date){const report=currentAudit(date);let hash=2166136261;const text=JSON.stringify((report?.parsedFile?.rows||[]).map(r=>[getRowValue(r,'FSN'),getRowValue(r,'flipkart_selling_price'),getRowValue(r,'flipkart_buy_now_present')]));for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${baseFingerprint(date)}::${RULE}:${text.length}:${hash>>>0}`;};
  Object.assign(window,{resolveFlipkartLiveState,getSnapshotFlipkartRows,buildFlipkartModularResult,hydrateSnapshot,loadDailyCommunications});
  window.WakeSuiteFlipkartAudit={RULE,auditMap,currentAudit,guardRow,guardSnapshot,protectedIssueKeys};
})();
