/* ======================================================
   WakeSuite V9.1 · Operations + Decision Intelligence
   21 Aug 2026

   This layer intentionally contains only V9.1 product changes.
   Proven processing logic remains in wakesuite-app.js.
====================================================== */

const WS91_VERSION = "9.1.0";
const WS91_CATEGORIES = ["Mattress","Furniture","Accessories","Office Chairs"];
const WS91_FULL_MODULES = [
  "dashboard","marketplaceInsights","pricingInsights","inventoryInsights",
  "amazonListing","amazonLive","amazonMrp","amazonPricingIssues","amazonPriceUpdates","amazonMinMaxUpdates",
  "amazonSuppression","amazonBuyBox","suppressionManagement",
  "flipkartListing","flipkartLive","flipkartMrp","flipkartPriceUpdates",
  "dailyCommunications","uploadCenter","masterPricing","marketplaceData","pricingExceptions","settings","dataAdministration"
];
const WS91_FULL_ACTIONS = [
  "view","search","download","upload","email","settings","userAdmin",
  "managePricingExceptions","suppressionOverride","pocEscalation","manageSuppressions",
  "raiseCaseId","managePoaQc","priceUpdates","dataAdministration"
];

window.WakeSuiteVersion = WS91_VERSION;
window.ws91PriceUpdateState = {marketplace:"amazon",mode:"price_mrp",rows:[],selected:new Set(),date:null};
window.ws91SuppressionOverrides = [];
window.ws91MarketplaceUpdates = [];

/* ======================================================
   UI ICONS · no abbreviation badges
====================================================== */
const WS91_ICONS = {
  dashboard:'<path d="M4 13a8 8 0 1 1 16 0"/><path d="M12 13l4-4"/><path d="M7 18h10"/>',
  insights:'<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M3 19h18"/>',
  price:'<path d="M4 7h16"/><path d="M7 4v6"/><path d="M17 14v6"/><path d="M4 17h16"/>',
  update:'<path d="M20 7h-7"/><path d="M17 3l4 4-4 4"/><path d="M4 17h7"/><path d="M7 13l-4 4 4 4"/>',
  suppression:'<path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5z"/><path d="M4 4l16 16"/>',
  upload:'<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M4 20h16"/>',
  database:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  table:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M9 5v14"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
  parity:'<path d="M6 6h12M6 18h12"/><path d="M9 9l6 6M15 9l-6 6"/>',
  disparity:'<path d="M5 17l4-5 4 3 6-9"/><circle cx="5" cy="17" r="1"/><circle cx="19" cy="6" r="1"/>',
  impact:'<path d="M7 5h10M7 9h10M9 5c0 8 7 4 7 10"/><path d="M9 15l6 5"/>',
  buybox:'<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>'
};
function ws91IconSvg(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${WS91_ICONS[name]||WS91_ICONS.table}</svg>`;}
function ws91RenderIcons(){
  document.querySelectorAll("[data-nav-icon]").forEach(el=>{el.innerHTML=ws91IconSvg(el.dataset.navIcon);});
  document.querySelectorAll("[data-ui-icon]").forEach(el=>{el.innerHTML=ws91IconSvg(el.dataset.uiIcon);});
}

/* ======================================================
   ACCESS · Super Admin is authoritative
====================================================== */
function ws91IsSuperAdmin(){return window.currentWakeSuiteAccess?.role === "super_admin";}
function ws91HasAction(action){return ws91IsSuperAdmin() || (typeof v7HasAction === "function" && v7HasAction(action));}
function ws91Scopes(){
  if(ws91IsSuperAdmin()) return {marketplaces:["amazon","flipkart"],categories:["*"],modules:[...WS91_FULL_MODULES],allData:true};
  return typeof v7CurrentScopes === "function" ? v7CurrentScopes() : (window.currentWakeSuiteAccess?.scopes||{});
}
function ws91AllowedCategories(){const cats=ws91Scopes().categories||["*"];return cats.includes("*")?WS91_CATEGORIES:[...cats];}
function ws91CategoryAllowed(category){return ws91AllowedCategories().includes(String(category||""));}
function ws91EnforceSuperAdminEditor(){
  const root=document.getElementById("userAccessDirectory"); if(!root)return;
  root.querySelectorAll('[data-access-role]').forEach(roleEl=>{
    if(roleEl.value!=="super_admin")return;
    const card=roleEl.closest(".access-card,.v7-access-editor,tr")||root;
    card.querySelectorAll('input[type="checkbox"]').forEach(cb=>{cb.checked=true;cb.disabled=true;});
  });
}

/* ======================================================
   EXCEPTION ENGINE · raw issue preserved, actionability overlaid
====================================================== */
function ws91Norm(v){return String(v??"").trim();}
function ws91Num(v){const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?n:0;}
function ws91DateActive(ex,date){
  if(!date)return true;
  const from=ex.effectiveFrom||"0000-01-01",to=ex.effectiveTo||"9999-12-31";
  return date>=from && date<=to;
}
function ws91ExceptionTargetMatches(ex,target,marketplace){
  const t=String(ex.target||ex.exceptionTarget||"").toLowerCase();
  if(t){
    if(t==="all_pricing")return true;
    if(t==="price_mrp")return ["listing","live","mrp"].includes(target);
    return t===target;
  }
  // backwards compatibility for V7/V8 records
  return typeof v9ExceptionAppliesToType === "function" ? v9ExceptionAppliesToType(ex.exceptionType,marketplace,target) : true;
}
function ws91ExceptionIdentifierMatches(ex,row,marketplace){
  const category=ws91Norm(ex.category).toLowerCase();
  const rowCategory=ws91Norm(row.category).toLowerCase();
  if(category && !["all","*","unmapped"].includes(category) && category!==rowCategory)return false;
  const identifiers=[];
  if(ex.wfSku)identifiers.push(ws91Norm(ex.wfSku)===ws91Norm(row.wfSku));
  if(marketplace==="amazon"){
    if(ex.asin)identifiers.push(ws91Norm(ex.asin)===ws91Norm(row.asin));
    if(ex.azSku||ex.marketplaceSku)identifiers.push(ws91Norm(ex.azSku||ex.marketplaceSku)===ws91Norm(row.azSku));
    if(!ex.asin&&!ex.azSku&&!ex.marketplaceSku&&ex.identifier){const x=ws91Norm(ex.identifier);identifiers.push(x===ws91Norm(row.asin)||x===ws91Norm(row.azSku));}
  }else{
    if(ex.fsn)identifiers.push(ws91Norm(ex.fsn)===ws91Norm(row.fsn));
    if(ex.fkSku||ex.marketplaceSku)identifiers.push(ws91Norm(ex.fkSku||ex.marketplaceSku)===ws91Norm(row.fkSku));
    if(!ex.fsn&&!ex.fkSku&&!ex.marketplaceSku&&ex.identifier){const x=ws91Norm(ex.identifier);identifiers.push(x===ws91Norm(row.fsn)||x===ws91Norm(row.fkSku));}
  }
  // Category-level exceptions intentionally need no product identifier.
  if(!identifiers.length && category && !["all","*","unmapped"].includes(category))return true;
  return identifiers.length>0 && identifiers.every(Boolean);
}
function ws91ActualExpected(row,target,marketplace){
  if(target==="listing")return [ws91Num(row.listingPrice),ws91Num(row.wfPrice)];
  if(target==="live")return [ws91Num(row.finalLivePrice??row.livePrice),ws91Num(row.wfPrice)];
  if(target==="mrp")return [ws91Num(marketplace==="amazon"?row.azMrp:row.fkMrp),ws91Num(row.wfMrp)];
  if(target==="min_sap")return [ws91Num(row.minAllowedPrice),ws91Num(row.correctedMin)];
  if(target==="max_sap")return [ws91Num(row.maxAllowedPrice),ws91Num(row.wfMrp||row.azMrp)];
  return [0,0];
}
function ws91ExceptionRuleMatches(ex,row,target,marketplace){
  const rule=String(ex.rule||ex.exceptionRule||"full_exclusion").toLowerCase();
  if(rule==="full_exclusion"||!rule)return true;
  const [actual,expected]=ws91ActualExpected(row,target,marketplace);
  const a=ws91Num(ex.ruleValue??ex.approvedFrom),b=ws91Num(ex.ruleValueTo??ex.approvedTo);
  if(rule==="approved_price")return Math.abs(actual-a)<=0.01;
  if(rule==="approved_range")return actual>=Math.min(a,b)&&actual<=Math.max(a,b);
  if(rule==="tolerance_inr")return Math.abs(actual-expected)<=a;
  if(rule==="tolerance_pct")return expected>0 && (Math.abs(actual-expected)/expected*100)<=a;
  return true;
}
function ws91FindException(row,marketplace,target,reportDate){
  return (typeof v7PricingExceptions!=="undefined"?v7PricingExceptions:[]).find(ex=>{
    const status=String(ex.status||"active").toLowerCase();
    if(["disabled","expired","rejected"].includes(status))return false;
    if(ex.marketplace&&![marketplace,"all"].includes(String(ex.marketplace).toLowerCase()))return false;
    return ws91DateActive(ex,reportDate)&&ws91ExceptionTargetMatches(ex,target,marketplace)&&ws91ExceptionIdentifierMatches(ex,row,marketplace)&&ws91ExceptionRuleMatches(ex,row,target,marketplace);
  })||null;
}
function ws91ApplyRowExceptions(row,marketplace,reportDate){
  const raw={
    listing:row.rawListingPriceDisparity ?? !!row.listingPriceDisparity,
    live:row.rawLivePriceDisparity ?? !!row.livePriceDisparity,
    mrp:row.rawMrpDisparity ?? !!row.mrpDisparity
  };
  row.rawListingPriceDisparity=raw.listing; row.rawLivePriceDisparity=raw.live; row.rawMrpDisparity=raw.mrp;
  const listingEx=raw.listing?ws91FindException(row,marketplace,"listing",reportDate):null;
  const liveEx=raw.live?ws91FindException(row,marketplace,"live",reportDate):null;
  const mrpEx=raw.mrp?ws91FindException(row,marketplace,"mrp",reportDate):null;
  row.listingPriceException=!!listingEx; row.livePriceException=!!liveEx; row.mrpException=!!mrpEx;
  row.approvedException=listingEx||liveEx||mrpEx||null;
  row.listingPriceDisparity=raw.listing&&!listingEx;
  row.livePriceDisparity=raw.live&&!liveEx;
  row.mrpDisparity=raw.mrp&&!mrpEx;
  if(listingEx)row.listingDailyRevenueImpact=0;
  if(liveEx)row.liveDailyRevenueImpact=0;
  row.dailyRevenueImpact=row.livePriceDisparity?ws91Num(row.liveDailyRevenueImpact):(row.listingPriceDisparity?ws91Num(row.listingDailyRevenueImpact):0);
  return row;
}
// Replace the old broad matcher with target-aware matching.
v7FindException = ws91FindException;

const ws91BaseGetAmazonRows = getSnapshotAmazonRows;
getSnapshotAmazonRows = function(snapshot){
  const date=snapshot?.reportDate||snapshot?.date||todayIso();
  return (ws91BaseGetAmazonRows(snapshot)||[]).map(r=>ws91ApplyRowExceptions({...r},"amazon",date));
};
const ws91BaseGetFlipkartRows = getSnapshotFlipkartRows;
getSnapshotFlipkartRows = function(snapshot){
  const date=snapshot?.reportDate||snapshot?.date||todayIso();
  return (ws91BaseGetFlipkartRows(snapshot)||[]).map(r=>ws91ApplyRowExceptions({...r},"flipkart",date));
};

function ws91SyncExceptionRuleInputs(prefix="exception"){
  const rule=document.getElementById(`${prefix}Rule`)?.value||document.getElementById(`${prefix}ExceptionRule`)?.value||"full_exclusion";
  const one=document.getElementById(`${prefix}RuleValue`),two=document.getElementById(`${prefix}RuleValueTo`);
  if(one)one.hidden=rule==="full_exclusion";
  if(two)two.hidden=rule!=="approved_range";
  if(one){
    one.placeholder=rule==="approved_price"?"Approved price":rule==="approved_range"?"Range from":rule==="tolerance_inr"?"Tolerance ₹":"Tolerance %";
  }
}

/* Identifier-only upload + conditions configured in UI. */
uploadPricingExceptions = async function(){
  if(!ws91HasAction("managePricingExceptions")){showWakeSuiteToast("Manage Pricing Exceptions permission is required.","warning");return;}
  const file=document.getElementById("pricingExceptionsFile")?.files?.[0];
  if(!file){showWakeSuiteToast("Choose an identifier file first.","warning");return;}
  const selected=[...document.querySelectorAll('[data-exception-column]:checked')].map(x=>x.dataset.exceptionColumn);
  if(!selected.length){showWakeSuiteToast("Select at least one identifier column used for matching.","warning");return;}
  try{
    const parsed=await readWakeSuiteFile(file); const available=new Set(parsed.headers.map(h=>canonicalHeader(h)));
    const missing=selected.filter(h=>!available.has(canonicalHeader(h)));
    if(missing.length)throw new Error(`Selected identifier columns are missing from the file: ${missing.join(", ")}`);
    const marketplace=document.getElementById("exceptionMarketplace")?.value||"amazon";
    const category=document.getElementById("exceptionCategory")?.value||"all";
    const exceptionType=document.getElementById("exceptionType")?.value||"Pricing";
    const target=document.getElementById("exceptionTarget")?.value||"all_pricing";
    const rule=document.getElementById("exceptionRule")?.value||"full_exclusion";
    const ruleValue=ws91Num(document.getElementById("exceptionRuleValue")?.value);
    const ruleValueTo=ws91Num(document.getElementById("exceptionRuleValueTo")?.value);
    const effectiveFrom=document.getElementById("exceptionEffectiveFrom")?.value||todayIso();
    const effectiveTo=document.getElementById("exceptionEffectiveTo")?.value||effectiveFrom;
    const remarks=ws91Norm(document.getElementById("exceptionRemarks")?.value);
    if(effectiveTo<effectiveFrom)throw new Error("Effective To cannot be earlier than Effective From.");
    if(rule!=="full_exclusion"&&!(ruleValue>0))throw new Error("Enter the approved price / range / tolerance for the selected rule.");
    const normalized=[];
    parsed.rows.forEach((r,index)=>{
      const entry={marketplace,category,exceptionType,target,rule,ruleValue,ruleValueTo,effectiveFrom,effectiveTo,remarks,status:"active",source:"Identifier Upload"};
      if(selected.includes("WF SKU"))entry.wfSku=ws91Norm(getRowValue(r,"WF SKU"));
      if(selected.includes("AZ SKU"))entry.azSku=ws91Norm(getRowValue(r,"AZ SKU"));
      if(selected.includes("ASIN"))entry.asin=ws91Norm(getRowValue(r,"ASIN"));
      if(selected.includes("FK SKU"))entry.fkSku=ws91Norm(getRowValue(r,"FK SKU"));
      if(selected.includes("FSN"))entry.fsn=ws91Norm(getRowValue(r,"FSN"));
      if(![entry.wfSku,entry.azSku,entry.asin,entry.fkSku,entry.fsn].some(Boolean))return;
      normalized.push(entry);
    });
    if(!normalized.length)throw new Error("No usable identifiers were found in the selected columns.");
    await window.savePricingExceptions(normalized);
    v7PricingExceptionsLoaded=false; await v7EnsurePricingExceptionsLoaded(true);
    snapshotCache.clear();
    await loadPricingExceptionsManager();
    await loadDashboardOverview();
    showWakeSuiteToast(`${normalized.length} exceptions applied immediately to WakeSuite actionability.`,"success","Pricing Exceptions");
    clearSelectedFile("pricingExceptionsFile");
  }catch(error){showWakeSuiteToast(error.message,"error","Pricing Exceptions upload failed");}
};

function downloadPricingExceptionsTemplate(){
  const data=[["WF SKU","AZ SKU","ASIN","FK SKU","FSN"],["","","B0EXAMPLE01","",""]];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),"Identifiers");
  XLSX.writeFile(wb,"WakeSuite_Pricing_Exception_Identifiers.xlsx");
}

/* Manual exception from any operational row. */
function openPricingExceptionModal(row=null,marketplace=null,target=null){
  window.ws91PendingBulkException=null;
  const modal=document.getElementById("pricingExceptionModal"); if(!modal)return;
  const r=row||{}; const market=marketplace||r.marketplace||window.ws91PriceUpdateState.marketplace||"amazon";
  document.getElementById("manualExceptionMarketplace").value=market;
  document.getElementById("manualExceptionIdentifier").value=market==="amazon"?(r.asin||r.azSku||""):(r.fsn||r.fkSku||"");
  document.getElementById("manualExceptionTarget").value=target||"all_pricing";
  document.getElementById("manualExceptionFrom").value=window.ws91PriceUpdateState.date||todayIso();
  document.getElementById("manualExceptionTo").value=window.ws91PriceUpdateState.date||todayIso();
  modal.dataset.row=encodeURIComponent(JSON.stringify({wfSku:r.wfSku||"",azSku:r.azSku||"",asin:r.asin||"",fkSku:r.fkSku||"",fsn:r.fsn||"",category:r.category||"all"}));
  modal.classList.add("open");modal.setAttribute("aria-hidden","false");ws91SyncExceptionRuleInputs("manualException");
}
function closePricingExceptionModal(){const m=document.getElementById("pricingExceptionModal");m?.classList.remove("open");m?.setAttribute("aria-hidden","true");const id=document.getElementById("manualExceptionIdentifier");if(id)id.disabled=false;window.ws91PendingBulkException=null;}
async function saveManualPricingException(){
  if(!ws91HasAction("managePricingExceptions")){showWakeSuiteToast("Manage Pricing Exceptions permission is required.","warning");return;}
  const modal=document.getElementById("pricingExceptionModal");
  let saved={};try{saved=JSON.parse(decodeURIComponent(modal?.dataset.row||"%7B%7D"));}catch(_e){}
  const marketplace=document.getElementById("manualExceptionMarketplace")?.value||"amazon";
  const identifier=ws91Norm(document.getElementById("manualExceptionIdentifier")?.value);
  const target=document.getElementById("manualExceptionTarget")?.value||"all_pricing";
  const rule=document.getElementById("manualExceptionRule")?.value||"full_exclusion";
  const ruleValue=ws91Num(document.getElementById("manualExceptionRuleValue")?.value);
  const ruleValueTo=ws91Num(document.getElementById("manualExceptionRuleValueTo")?.value);
  const effectiveFrom=document.getElementById("manualExceptionFrom")?.value||todayIso();
  const effectiveTo=document.getElementById("manualExceptionTo")?.value||effectiveFrom;
  const exceptionType=document.getElementById("manualExceptionType")?.value||"Pricing";
  const remarks=ws91Norm(document.getElementById("manualExceptionRemarks")?.value);
  if(!identifier && !saved.wfSku){showWakeSuiteToast("Enter or select a product identifier.","warning");return;}
  if(rule!=="full_exclusion"&&!(ruleValue>0)){showWakeSuiteToast("Enter the approved price / tolerance.","warning");return;}
  const makeRow=(base)=>{const row={...base,marketplace,category:base.category||"all",target,rule,ruleValue,ruleValueTo,effectiveFrom,effectiveTo,exceptionType,remarks,source:"Manual"};if(marketplace==="amazon"&&!row.asin&&!row.azSku)row.asin=identifier;if(marketplace==="flipkart"&&!row.fsn&&!row.fkSku)row.fsn=identifier;return row;};
  const pending=Array.isArray(window.ws91PendingBulkException)?window.ws91PendingBulkException:null;
  const rowsToSave=pending?.length?pending.map(r=>makeRow({wfSku:r.wfSku||"",azSku:r.azSku||"",asin:r.asin||"",fkSku:r.fkSku||"",fsn:r.fsn||"",category:r.category||"all"})):[makeRow(saved)];
  try{
    await window.savePricingExceptions(rowsToSave);v7PricingExceptionsLoaded=false;await v7EnsurePricingExceptionsLoaded(true);snapshotCache.clear();closePricingExceptionModal();
    await loadPricingExceptionsManager();await loadDashboardOverview();
    if(document.getElementById("priceUpdatesSection")?.classList.contains("active"))await loadPriceUpdatesPreview();
    showWakeSuiteToast("Exception added and removed from actionable disparity/update output.","success");
  }catch(error){showWakeSuiteToast(error.message,"error","Unable to add exception");}
}

/* ======================================================
   AMAZON PRICING ISSUES · analysis only
====================================================== */
function ws91AmazonPricingRows(snapshot){
  const minPct=ws91Num(document.getElementById("amazonMinPriceCorrectionPct")?.value||localStorage.getItem("wakesuite.amazon.minPct")||5);
  const reduction=minPct/100;
  return getSnapshotAmazonRows(snapshot).map(r=>{
    const listing=ws91Num(r.listingPrice),targetMrp=ws91Num(r.wfMrp||r.azMrp);
    const correctedMin=Math.round(listing*(1-reduction)*100)/100;
    const min=ws91Num(r.minAllowedPrice),max=ws91Num(r.maxAllowedPrice);
    const minIssue=listing>0 && (!(min>0)||min>=listing);
    const maxIssue=listing>0 && targetMrp>0 && (!(max>0)||max<listing||Math.abs(max-targetMrp)>0.01);
    const minException=minIssue?ws91FindException({...r,correctedMin},"amazon","min_sap",snapshot.reportDate):null;
    const maxException=maxIssue?ws91FindException({...r,correctedMin},"amazon","max_sap",snapshot.reportDate):null;
    return {...r,correctedMin,correctedMax:targetMrp,minIssue:minIssue&&!minException,maxIssue:maxIssue&&!maxException,minSapException:!!minException,maxSapException:!!maxException,pricingIssue:(minIssue&&!minException)||(maxIssue&&!maxException)};
  });
}
v8AmazonPricingRows = ws91AmazonPricingRows;

loadAmazonPricingIssues = async function(){
  const date=document.getElementById("amazonPricingIssuesDate")?.value||todayIso(),snapshot=await loadSnapshotCached(date);
  if(!snapshot){showWakeSuiteToast("No stored snapshot for the selected date.","warning");return;}
  let rows=ws91AmazonPricingRows(snapshot);
  const cat=document.getElementById("amazonPricingIssuesCategory"),old=cat?.value||"all";populateCategorySelectFromRows(cat,rows,old);
  const category=cat?.value||"all",type=document.getElementById("amazonPricingIssuesType")?.value||"all",skuType=document.getElementById("amazonPricingIssuesSkuType")?.value||"all",q=ws91Norm(document.getElementById("amazonPricingIssuesSearch")?.value).toLowerCase();
  rows=rows.filter(r=>(category==="all"||r.category===category)&&(!q||`${r.asin} ${r.azSku} ${r.wfSku}`.toLowerCase().includes(q))&&(skuType==="all"||v8SkuType(r.azSku,r.category).toLowerCase()===skuType)&&(type==="all"?r.pricingIssue:type==="min"?r.minIssue:r.maxIssue));
  window.v8CurrentAmazonPricingRows=rows;
  const t=document.getElementById("amazonPricingIssuesTable");
  let html='<thead><tr><th>Category</th><th>WF SKU</th><th>AZ SKU</th><th>ASIN</th><th>Listing Price</th><th>WF MRP</th><th>Amazon MRP</th><th>Current Min SAP</th><th>Target Min SAP</th><th>Current Max SAP</th><th>Target Max SAP</th><th>Issue</th><th>Action</th></tr></thead><tbody>';
  if(!rows.length)html+='<tr><td colspan="13" class="empty-row">No actionable Amazon Pricing Issues.</td></tr>';
  rows.forEach(r=>{const issues=[r.minIssue&&"Min SAP",r.maxIssue&&"Max SAP"].filter(Boolean).join(" + ");html+=`<tr><td>${escapeHtml(r.category||"")}</td><td>${escapeHtml(r.wfSku||"")}</td><td>${escapeHtml(r.azSku||"")}</td><td><button class="asin-link" onclick='openProductDrawer("amazon",${JSON.stringify(r.asin||"")})'>${escapeHtml(r.asin||"")}</button></td><td>${formatINR(r.listingPrice)}</td><td>${formatINR(r.wfMrp)}</td><td>${formatINR(r.azMrp)}</td><td>${r.minAllowedPrice?formatINR(r.minAllowedPrice):"Missing"}</td><td>${formatINR(r.correctedMin)}</td><td>${r.maxAllowedPrice?formatINR(r.maxAllowedPrice):"Missing"}</td><td>${formatINR(r.correctedMax)}</td><td>${escapeHtml(issues)}</td><td><button class="secondary-btn" onclick='openPricingExceptionModal(${JSON.stringify(r)},"amazon","${r.maxIssue?"max_sap":"min_sap"}")'>Add Exception</button></td></tr>`;});
  t.innerHTML=html+'</tbody>';
  document.getElementById("amazonPricingIssuesKpis").innerHTML=`<div class="v7-kpi"><span>Actionable SKUs</span><strong>${formatNumber(rows.length)}</strong></div><div class="v7-kpi"><span>Min SAP Issues</span><strong>${formatNumber(rows.filter(r=>r.minIssue).length)}</strong></div><div class="v7-kpi"><span>Max SAP Issues</span><strong>${formatNumber(rows.filter(r=>r.maxIssue).length)}</strong></div><div class="v7-kpi"><span>Exceptions</span><strong>${formatNumber(ws91AmazonPricingRows(snapshot).filter(r=>r.minSapException||r.maxSapException).length)}</strong></div>`;
};

/* ======================================================
   PRICE UPDATES · Amazon exact template / Flipkart CSV
====================================================== */
function openPriceUpdates(marketplace,mode="price_mrp"){
  if(!ws91HasAction("priceUpdates")&&!ws91HasAction("download")){showWakeSuiteToast("Price Updates permission is required.","warning");return;}
  window.ws91PriceUpdateState={marketplace,mode,rows:[],selected:new Set(),date:null};
  showView("priceUpdatesSection");
  finalSetText("priceUpdatesTitle",`${marketplace==="amazon"?"Amazon":"Flipkart"} Price Updates`);
  finalSetText("priceUpdatesSubtitle",mode==="min_max"?"Generate Amazon Min / Max SAP corrections from Pricing Issues.":"Generate marketplace-ready Price / MRP corrections from actionable disparities.");
  const type=document.getElementById("priceUpdatesType");
  if(type){type.innerHTML=mode==="min_max"?'<option value="both">Min + Max SAP</option><option value="min">Min SAP Only</option><option value="max">Max SAP Only</option>':'<option value="both">Price + MRP</option><option value="price">Price Only</option><option value="mrp">MRP Only</option>';}
  const minWrap=document.getElementById("priceUpdatesMinPctWrap");if(minWrap)minWrap.hidden=mode!=="min_max";
  const date=document.getElementById("priceUpdatesDate");if(date)date.value=document.getElementById("dashboardToDate")?.value||todayIso();
  loadPriceUpdatesPreview();
}
function ws91PriceUpdateRows(snapshot,marketplace,mode,type){
  if(marketplace==="amazon"){
    const source=mode==="min_max"?ws91AmazonPricingRows(snapshot):getSnapshotAmazonRows(snapshot);
    return source.filter(r=>{
      if(mode==="min_max")return type==="min"?r.minIssue:type==="max"?r.maxIssue:(r.minIssue||r.maxIssue);
      return type==="price"?r.listingPriceDisparity:type==="mrp"?r.mrpDisparity:(r.listingPriceDisparity||r.mrpDisparity);
    });
  }
  return getSnapshotFlipkartRows(snapshot).filter(r=>type==="price"?r.listingPriceDisparity:type==="mrp"?r.mrpDisparity:(r.listingPriceDisparity||r.mrpDisparity));
}
async function loadPriceUpdatesPreview(){
  const state=window.ws91PriceUpdateState; const date=document.getElementById("priceUpdatesDate")?.value||todayIso();state.date=date;
  const snapshot=await loadSnapshotCached(date); if(!snapshot){showWakeSuiteToast("No stored snapshot for the selected date.","warning");return;}
  const type=document.getElementById("priceUpdatesType")?.value||"both",category=document.getElementById("priceUpdatesCategory")?.value||"all",q=ws91Norm(document.getElementById("priceUpdatesSearch")?.value).toLowerCase();
  let base=ws91PriceUpdateRows(snapshot,state.marketplace,state.mode,type);
  const cat=document.getElementById("priceUpdatesCategory"),old=cat?.value||"all";populateCategorySelectFromRows(cat,base,old);const selectedCat=cat?.value||"all";
  base=base.filter(r=>(selectedCat==="all"||r.category===selectedCat)&&(!q||`${r.asin||r.fsn} ${r.azSku||r.fkSku} ${r.wfSku}`.toLowerCase().includes(q)));
  state.rows=base;state.selected=new Set(base.map(r=>state.marketplace==="amazon"?r.azSku:r.fkSku));
  ws91RenderPriceUpdates();
}
function ws91RenderPriceUpdates(){
  const state=window.ws91PriceUpdateState,rows=state.rows||[],market=state.marketplace,mode=state.mode;
  const selected=rows.filter(r=>state.selected.has(market==="amazon"?r.azSku:r.fkSku));
  const priceCount=rows.filter(r=>r.listingPriceDisparity).length,mrpCount=rows.filter(r=>r.mrpDisparity).length,minCount=rows.filter(r=>r.minIssue).length,maxCount=rows.filter(r=>r.maxIssue).length;
  document.getElementById("priceUpdatesKpis").innerHTML=mode==="min_max"?`<div class="v7-kpi"><span>Actionable SKUs</span><strong>${rows.length}</strong></div><div class="v7-kpi"><span>Min SAP</span><strong>${minCount}</strong></div><div class="v7-kpi"><span>Max SAP</span><strong>${maxCount}</strong></div><div class="v7-kpi"><span>Selected</span><strong>${selected.length}</strong></div>`:`<div class="v7-kpi"><span>Actionable SKUs</span><strong>${rows.length}</strong></div><div class="v7-kpi"><span>Price Updates</span><strong>${priceCount}</strong></div><div class="v7-kpi"><span>MRP Updates</span><strong>${mrpCount}</strong></div><div class="v7-kpi"><span>Selected</span><strong>${selected.length}</strong></div>`;
  finalSetText("priceUpdatesSelectionCount",`${selected.length} selected`);
  const t=document.getElementById("priceUpdatesTable");
  let h='<thead><tr><th></th><th>Category</th><th>WF SKU</th><th>Marketplace SKU</th><th>ASIN / FSN</th><th>Current Price</th><th>New Price</th><th>Current MRP</th><th>New MRP</th>'+(mode==="min_max"?'<th>Current Min</th><th>Target Min</th><th>Current Max</th><th>Target Max</th>':'')+'<th>Action</th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="14" class="empty-row">No actionable updates for the selected filters.</td></tr>';
  rows.forEach(r=>{const key=market==="amazon"?r.azSku:r.fkSku;h+=`<tr><td><input type="checkbox" data-price-update-key="${escapeHtml(key)}" ${state.selected.has(key)?"checked":""} onchange="togglePriceUpdateRow(this)"></td><td>${escapeHtml(r.category||"")}</td><td>${escapeHtml(r.wfSku||"")}</td><td>${escapeHtml(key||"")}</td><td>${escapeHtml(market==="amazon"?r.asin:r.fsn)}</td><td>${formatINR(r.listingPrice)}</td><td>${r.listingPriceDisparity?formatINR(r.wfPrice):"—"}</td><td>${formatINR(market==="amazon"?r.azMrp:r.fkMrp)}</td><td>${r.mrpDisparity?formatINR(r.wfMrp):"—"}</td>${mode==="min_max"?`<td>${r.minAllowedPrice?formatINR(r.minAllowedPrice):"Missing"}</td><td>${r.minIssue?formatINR(r.correctedMin):"—"}</td><td>${r.maxAllowedPrice?formatINR(r.maxAllowedPrice):"Missing"}</td><td>${r.maxIssue?formatINR(r.correctedMax):"—"}</td>`:""}<td><button class="secondary-btn" onclick='openPricingExceptionModal(${JSON.stringify(r)},"${market}","${mode==="min_max"?(r.maxIssue?"max_sap":"min_sap"):(r.mrpDisparity?"mrp":"listing")}")'>Add Exception</button></td></tr>`;});
  t.innerHTML=h+'</tbody>';
}
function togglePriceUpdateRow(cb){const key=cb.dataset.priceUpdateKey,state=window.ws91PriceUpdateState;if(cb.checked)state.selected.add(key);else state.selected.delete(key);ws91RenderPriceUpdates();}
function toggleAllPriceUpdateRows(cb){const checked=typeof cb==="boolean"?cb:!!cb.checked;const state=window.ws91PriceUpdateState;if(checked)state.rows.forEach(r=>state.selected.add(state.marketplace==="amazon"?r.azSku:r.fkSku));else state.selected.clear();ws91RenderPriceUpdates();}
function addSelectedPriceUpdatesToException(){
  const state=window.ws91PriceUpdateState,selected=state.rows.filter(r=>state.selected.has(state.marketplace==="amazon"?r.azSku:r.fkSku));
  if(!selected.length){showWakeSuiteToast("Select at least one row.","warning");return;}
  if(selected.length===1){openPricingExceptionModal(selected[0],state.marketplace,state.mode==="min_max"?(selected[0].maxIssue?"max_sap":"min_sap"):(selected[0].mrpDisparity?"mrp":"listing"));return;}
  openPricingExceptionModal(selected[0],state.marketplace,state.mode==="min_max"?"all_pricing":"price_mrp");
  window.ws91PendingBulkException=selected;
  document.getElementById("manualExceptionIdentifier").value=`${selected.length} selected products`;
  document.getElementById("manualExceptionIdentifier").disabled=true;
}

async function ws91DownloadAmazonUpdate(rows){
  const state=window.ws91PriceUpdateState,type=document.getElementById("priceUpdatesType")?.value||"both",minPct=ws91Num(document.getElementById("priceUpdatesMinPct")?.value||localStorage.getItem("wakesuite.amazon.minPct")||5);
  const wb=await v8BuildAmazonWorkbook(rows,minPct,0,false,{mode:state.mode,updateType:type});
  const file=`Amazon_${state.mode==="min_max"?"Min_Max":"Price_MRP"}_Update_${state.date}.xlsm`;
  XLSX.writeFile(wb,file,{bookType:"xlsm",bookVBA:true});return file;
}
function ws91CsvEscape(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
async function ws91DownloadFlipkartUpdate(rows){
  const state=window.ws91PriceUpdateState,type=document.getElementById("priceUpdatesType")?.value||"both",raw=await v8GetLatestRawFile(state.date,"flipkart_listing_file");
  if(!raw)throw new Error("The latest Flipkart Listing File for this date is not available in this browser. Upload that listing file in Data Center first.");
  const wb=XLSX.read(raw.bytes,{type:"array",cellDates:false}),sheet=wb.Sheets[wb.SheetNames[0]],aoa=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});
  let headerRow=-1,skuIdx=-1,priceIdx=-1,mrpIdx=-1;
  for(let i=0;i<Math.min(20,aoa.length);i++){
    const h=aoa[i].map(x=>ws91Norm(x)); const s=h.findIndex(x=>canonicalHeader(x)===canonicalHeader("Seller SKU Id"));
    const p=h.findIndex(x=>canonicalHeader(x)===canonicalHeader("Your Selling Price")); const m=h.findIndex(x=>canonicalHeader(x)===canonicalHeader("MRP"));
    if(s>=0&&p>=0&&m>=0){headerRow=i;skuIdx=s;priceIdx=p;mrpIdx=m;break;}
  }
  if(headerRow<0)throw new Error("Flipkart Listing File header was not found (Seller SKU Id / Your Selling Price / MRP).");
  const map=new Map(rows.map(r=>[ws91Norm(r.fkSku),r])),out=aoa.slice(0,headerRow+1).map(r=>[...r]);
  for(let i=headerRow+1;i<aoa.length;i++){
    const sku=ws91Norm(aoa[i][skuIdx]),r=map.get(sku);if(!r)continue;const copy=[...aoa[i]];
    if((type==="price"||type==="both")&&r.listingPriceDisparity)copy[priceIdx]=r.wfPrice;
    if((type==="mrp"||type==="both")&&r.mrpDisparity)copy[mrpIdx]=r.wfMrp;
    out.push(copy);
  }
  const csv=out.map(row=>row.map(ws91CsvEscape).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`Flipkart_Price_MRP_Update_${state.date}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);return `Flipkart_Price_MRP_Update_${state.date}.csv`;
}
async function downloadPriceUpdates(){
  const state=window.ws91PriceUpdateState,rows=state.rows.filter(r=>state.selected.has(state.marketplace==="amazon"?r.azSku:r.fkSku));
  if(!rows.length){showWakeSuiteToast("Select at least one update row.","warning");return;}
  try{
    const file=state.marketplace==="amazon"?await ws91DownloadAmazonUpdate(rows):await ws91DownloadFlipkartUpdate(rows);
    if(typeof window.saveMarketplaceUpdateBatch==="function")await window.saveMarketplaceUpdateBatch({reportDate:state.date,marketplace:state.marketplace,mode:state.mode,updateType:document.getElementById("priceUpdatesType")?.value||"both",fileName:file,rows:rows.map(r=>({category:r.category,wfSku:r.wfSku,marketSku:state.marketplace==="amazon"?r.azSku:r.fkSku,identifier:state.marketplace==="amazon"?r.asin:r.fsn,targetPrice:r.listingPriceDisparity?r.wfPrice:null,targetMrp:r.mrpDisparity?r.wfMrp:null,targetMin:r.minIssue?r.correctedMin:null,targetMax:r.maxIssue?r.correctedMax:null,status:"Pending Reflection"}))});
    showWakeSuiteToast(`${rows.length} rows generated. Verification will compare future marketplace snapshots against these targets.`,"success","Price Update File");
    await ws91LoadUpdateVerification();
  }catch(error){showWakeSuiteToast(error.message,"error","Unable to generate update file");}
}

/* ======================================================
   UPDATE VERIFICATION
====================================================== */
async function ws91LoadUpdateVerification(){
  if(typeof window.loadMarketplaceUpdateBatches!=="function")return;
  try{window.ws91MarketplaceUpdates=await window.loadMarketplaceUpdateBatches();}catch(_e){return;}
  const rows=[];
  for(const batch of window.ws91MarketplaceUpdates){
    const latest=(await window.getLatestCompletedSnapshot?.())||null; if(!latest)continue;
    const marketRows=batch.marketplace==="amazon"?getSnapshotAmazonRows(latest):getSnapshotFlipkartRows(latest);
    const map=new Map(marketRows.map(r=>[batch.marketplace==="amazon"?r.azSku:r.fkSku,r]));
    (batch.rows||[]).forEach(u=>{
      const r=map.get(u.marketSku);let checks=[];
      if(r){if(u.targetPrice!=null)checks.push(Math.abs(ws91Num(r.listingPrice)-ws91Num(u.targetPrice))<=0.01);if(u.targetMrp!=null)checks.push(Math.abs(ws91Num(batch.marketplace==="amazon"?r.azMrp:r.fkMrp)-ws91Num(u.targetMrp))<=0.01);if(u.targetMin!=null)checks.push(Math.abs(ws91Num(r.minAllowedPrice)-ws91Num(u.targetMin))<=0.01);if(u.targetMax!=null)checks.push(Math.abs(ws91Num(r.maxAllowedPrice)-ws91Num(u.targetMax))<=0.01);}
      const status=!r?"Pending Reflection":checks.length&&checks.every(Boolean)?"Reflected":checks.some(Boolean)?"Partially Reflected":"Still Incorrect";
      rows.push({...u,batchId:batch.id,marketplace:batch.marketplace,generatedDate:batch.reportDate,status});
    });
  }
  window.ws91UpdateVerificationRows=rows;ws91RenderUpdateVerification(rows);
}
function ws91RenderUpdateVerification(rows){
  const c={Reflected:0,"Partially Reflected":0,"Pending Reflection":0,"Still Incorrect":0};rows.forEach(r=>c[r.status]=(c[r.status]||0)+1);
  const summary=document.getElementById("marketplaceUpdateVerificationSummary");if(summary)summary.innerHTML=`<div class="verification-row"><span>Reflected</span><strong>${c.Reflected}</strong></div><div class="verification-row"><span>Partially Reflected</span><strong>${c["Partially Reflected"]}</strong></div><div class="verification-row"><span>Pending</span><strong>${c["Pending Reflection"]}</strong></div><div class="verification-row"><span>Still Incorrect</span><strong>${c["Still Incorrect"]}</strong></div>`;
  const table=document.getElementById("priceUpdateVerificationTable");if(table){table.innerHTML='<thead><tr><th>Marketplace</th><th>Generated</th><th>SKU</th><th>Identifier</th><th>Status</th></tr></thead><tbody>'+(rows.length?rows.slice(0,250).map(r=>`<tr><td>${escapeHtml(r.marketplace)}</td><td>${escapeHtml(r.generatedDate||"")}</td><td>${escapeHtml(r.marketSku||"")}</td><td>${escapeHtml(r.identifier||"")}</td><td><span class="update-status ${r.status==="Reflected"?"reflected":r.status==="Partially Reflected"?"partial":r.status==="Still Incorrect"?"incorrect":"pending"}">${escapeHtml(r.status)}</span></td></tr>`).join(""):'<tr><td colspan="5" class="empty-row">No generated update batches yet.</td></tr>')+'</tbody>';}
}

/* ======================================================
   DASHBOARD · category breakdown / exceptions / Action Center / Data Health
====================================================== */
function ws91CategoryCounts(rows,predicate,value="count"){
  const out={};ws91AllowedCategories().forEach(c=>{const rr=rows.filter(r=>r.category===c&&predicate(r));out[c]=value==="impact"?rr.reduce((a,r)=>a+ws91Num(r.dailyRevenueImpact||r.revenueImpactPerDay),0):rr.length;});return out;
}
function ws91CategoryParity(rows){const out={};ws91AllowedCategories().forEach(c=>{const rr=rows.filter(r=>r.category===c&&!r.approvedException),parity=rr.filter(r=>!r.listingPriceDisparity&&!r.livePriceDisparity).length;out[c]=rr.length?`${(parity/rr.length*100).toFixed(0)}%`:"—";});return out;}
function ws91BreakdownHtml(map,format=x=>x){return Object.entries(map).map(([k,v])=>`<div class="metric-category-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(format(v))}</strong></div>`).join("");}
function ws91SetHtml(id,html){const e=document.getElementById(id);if(e)e.innerHTML=html;}
async function ws91EnhanceDashboard(){
  const date=document.getElementById("dashboardToDate")?.value||todayIso(),snap=await loadSnapshotCached(date).catch(()=>null);if(!snap)return;
  await v7EnsurePricingExceptionsLoaded(true).catch(()=>{});
  const az=getSnapshotAmazonRows(snap),fk=getSnapshotFlipkartRows(snap);
  const azEx=az.filter(r=>r.approvedException).length,fkEx=fk.filter(r=>r.approvedException).length;
  ws91SetHtml("amazonParityExceptionDetail",`<span class="metric-context-link" onclick="openDashboardInsight('amazon','exceptions')">${azEx} exceptions excluded</span>`);
  ws91SetHtml("amazonParityCategoryBreakdown",ws91BreakdownHtml(ws91CategoryParity(az)));
  ws91SetHtml("amazonDisparityExceptionDetail",`<span class="metric-context-link" onclick="openDashboardInsight('amazon','exceptions')">${azEx} Approved Exceptions</span>`);
  ws91SetHtml("amazonDisparityCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(az,r=>r.listingPriceDisparity||r.livePriceDisparity||r.mrpDisparity)));
  ws91SetHtml("amazonTotalExclusionDetail",`<span class="metric-context-muted">${azEx} exceptions excluded</span>`);
  ws91SetHtml("amazonTotalCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(az,r=>r.dailyRevenueImpact>0,"impact"),v=>formatINR(v)));
  ws91SetHtml("flipkartParityExceptionDetail",`<span class="metric-context-link" onclick="openDashboardInsight('flipkart','exceptions')">${fkEx} exceptions excluded</span>`);
  ws91SetHtml("flipkartParityCategoryBreakdown",ws91BreakdownHtml(ws91CategoryParity(fk)));
  ws91SetHtml("flipkartDisparityExceptionDetail",`<span class="metric-context-link" onclick="openDashboardInsight('flipkart','exceptions')">${fkEx} Approved Exceptions</span>`);
  ws91SetHtml("flipkartDisparityCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(fk,r=>r.listingPriceDisparity||r.livePriceDisparity||r.mrpDisparity)));
  ws91SetHtml("flipkartTotalExclusionDetail",`<span class="metric-context-muted">${fkEx} exceptions excluded</span>`);
  ws91SetHtml("flipkartTotalCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(fk,r=>r.dailyRevenueImpact>0,"impact"),v=>formatINR(v)));
  const overrides=typeof window.loadSuppressionOverrides==="function"?await window.loadSuppressionOverrides(date,date).catch(()=>[]):[];window.ws91SuppressionOverrides=overrides;
  const suppress=(snap.amazonSuppressions||[]).map(row=>Array.isArray(row)&&typeof expandAmazonIssueRow==="function"?expandAmazonIssueRow(row):row).filter(Boolean);
  const overrideCount=overrides.length;
  ws91SetHtml("amazonSuppressionOverrideDetail",`<span class="metric-context-link" onclick="openSuppressionManagement('Overridden')">${overrideCount} Overridden</span>`);
  const supRows=(typeof getSnapshotAmazonIssueRows==="function"?getSnapshotAmazonIssueRows(snap,"amazonSuppressions"):suppress).filter(r=>!overrides.some(o=>o.asin===r.asin));
  ws91SetHtml("amazonSuppressionCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(supRows,()=>true)));
  const bb=typeof getSnapshotAmazonIssueRows==="function"?getSnapshotAmazonIssueRows(snap,"amazonBuyBox"):[];ws91SetHtml("amazonBuyBoxCategoryBreakdown",ws91BreakdownHtml(ws91CategoryCounts(bb,()=>true)));
  await ws91RenderActionCenter(snap,az,fk,overrides);
  ws91RenderDataHealth(snap,date);
  await ws91LoadUpdateVerification();
}
async function ws91RenderActionCenter(snap,az,fk,overrides){
  let cases=[];try{cases=typeof window.loadSuppressionCases==="function"?await window.loadSuppressionCases():[];}catch(_e){}
  const actions=[
    {label:"High-impact price disparities",count:[...az,...fk].filter(r=>(r.listingPriceDisparity||r.livePriceDisparity||r.mrpDisparity)&&ws91Num(r.dailyRevenueImpact)>=1000).length,go:"openDashboardInsight('combined','price_disparity')"},
    {label:"Suppressions awaiting Case ID",count:cases.filter(r=>!r.caseId&&!['Reactivated','Closed'].includes(r.status)).length,go:"openSuppressionManagement()"},
    {label:"POC escalations pending",count:cases.filter(r=>r.pocEscalationStatus==='Required').length,go:"openSuppressionManagement()"},
    {label:"Exceptions expiring in 7 days",count:(typeof v7PricingExceptions!=="undefined"?v7PricingExceptions:[]).filter(ex=>{if(!ex.effectiveTo)return false;const d=(new Date(ex.effectiveTo)-new Date(todayIso()))/86400000;return d>=0&&d<=7;}).length,go:"openDashboardInsight('combined','exceptions')"},
    {label:"Generated updates not reflected",count:(window.ws91UpdateVerificationRows||[]).filter(r=>r.status!=="Reflected").length,go:"openPriceUpdates('amazon','price_mrp')"}
  ].filter(x=>x.count>0);
  const box=document.getElementById("actionCenterList");if(box)box.innerHTML=actions.length?actions.map(a=>`<button class="action-center-row" onclick="${a.go}"><span>${escapeHtml(a.label)}</span><strong>${a.count}</strong></button>`).join(""):'<div class="utility-empty">No priority actions in the selected data.</div>';
}
function ws91RenderDataHealth(snap,date){
  const availability=snap.sourceAvailability||{};
  const sources=[
    ["Wakefit Pricing",availability.wakefitPricing||availability.wakefit_daily_pricing],
    ["Amazon Listings",availability.amazonListings||availability.amazon_all_listings],
    ["Amazon Business",availability.amazonBusiness||availability.amazon_business_reports],
    ["Shared Audit",availability.audit||availability.marketplace_audit_report],
    ["Flipkart Listing",availability.flipkartListing||availability.flipkart_listing_file],
    ["Flipkart Orders",availability.flipkartOrders||availability.flipkart_order_report]
  ];
  const box=document.getElementById("dataHealthSummary");if(box)box.innerHTML=sources.map(([label,ok])=>`<div class="health-row"><span>${escapeHtml(label)}</span><strong class="${ok?'health-good':'health-missing'}">${ok?'Current':'Missing'}</strong></div>`).join("")+`<div class="health-row"><span>Snapshot</span><strong>${escapeHtml(date)}</strong></div>`;
}

const ws91BaseDashboardOverview=loadDashboardOverview;
loadDashboardOverview=async function(...args){const result=await ws91BaseDashboardOverview(...args);try{await ws91EnhanceDashboard();}catch(error){console.warn("V9.1 dashboard enhancement failed",error);}return result;};

/* ======================================================
   MARKETPLACE INSIGHTS · focused analysis + business domains
====================================================== */
function setInsightsDomain(domain){
  window.ws91InsightsDomain=domain;
  document.querySelectorAll(".insights-domain-tab").forEach(b=>b.classList.toggle("active",b.dataset.domain===domain));
  const overview=document.getElementById("insightsOverviewHero"),pricing=document.getElementById("pricingInsightsPanel"),inventory=document.getElementById("inventoryInsightsPanel");
  if(overview)overview.hidden=domain!=="overview";if(pricing)pricing.hidden=domain!=="pricing";if(inventory)inventory.hidden=domain!=="inventory";
  if(domain==="pricing")loadPricingBusinessInsights();else if(domain==="inventory")loadInventoryBusinessInsights();else loadMarketplaceInsights();
}
function ws91FocusLabel(f){return ({all:"Overview",parity:"Price Parity",price_disparity:"Price Disparity",amazon_suppression:"ASIN Suppression",amazon_buybox:"Buy Box Suppression",exceptions:"Approved Exceptions",total_impact:"Total Revenue Impact"})[f]||"Overview";}
const ws91BaseSetFocus=setMarketplaceInsightFocus;
setMarketplaceInsightFocus=function(focus){v6InsightFocus=focus;finalSetText("insightsActiveMode",ws91FocusLabel(focus));document.querySelectorAll("[data-insight-card]").forEach(c=>c.classList.toggle("active",c.dataset.insightCard===focus));loadMarketplaceInsights();};
openDashboardInsight=function(market,focus){showView("marketplaceInsightsSection");setInsightsDomain("overview");const m=document.getElementById("insightsMarketplace");if(m)m.value=market;const p=document.getElementById("insightsPeriod");if(p)p.value="last7";setMarketplaceInsightFocus(focus);};
function ws91RenderFocusSummary(state){
  const box=document.getElementById("insightsFocusSummary");if(!box||!state)return;
  const rows=state.focusRows||[],focus=v6InsightFocus;
  let cards=[];
  if(focus==="parity"){
    const eligible=state.priceRows?.filter(r=>!r.approvedException)||[];const parity=rows.length;cards=[["Parity %",eligible.length?`${(parity/eligible.length*100).toFixed(1)}%`:"—"],["Parity Products",parity],["Eligible Checks",eligible.length],["Exceptions Excluded",state.priceRows?.filter(r=>r.approvedException).length||0]];
  }else if(focus==="exceptions")cards=[["Approved Exceptions",rows.length],["Products Excluded",new Set(rows.map(r=>r.asin||r.fsn||r.wfSku)).size],["Revenue Excluded",formatINR(rows.reduce((a,r)=>a+ws91Num(r.rawDailyRevenueImpact),0))],["Scope","Current Period"]];
  else if(focus==="price_disparity")cards=[["Actionable Rows",rows.length],["Products",new Set(rows.map(r=>r.asin||r.fsn)).size],["Revenue Impact",formatINR(rows.reduce((a,r)=>a+ws91Num(r.impact),0))],["Exceptions",state.priceRows?.filter(r=>r.approvedException).length||0]];
  else cards=[["Selected Insight",ws91FocusLabel(focus)],["Rows",rows.length],["Period",document.getElementById("insightsPeriod")?.selectedOptions?.[0]?.textContent||""],["Marketplace",document.getElementById("insightsMarketplace")?.selectedOptions?.[0]?.textContent||""]];
  box.innerHTML=cards.map(([l,v])=>`<div class="insights-focus-card"><span>${escapeHtml(l)}</span><strong>${escapeHtml(v)}</strong></div>`).join("");
}
const ws91BaseLoadInsights=loadMarketplaceInsights;
loadMarketplaceInsights=async function(...args){const r=await ws91BaseLoadInsights(...args);try{if(v6InsightsState){v6InsightsState.priceRows=(v6InsightsState.snapshots||[]).flatMap(s=>{const m=document.getElementById("insightsMarketplace")?.value||"combined";return [...(m!=="flipkart"?getSnapshotAmazonRows(s):[]),...(m!=="amazon"?getSnapshotFlipkartRows(s):[])];});ws91RenderFocusSummary(v6InsightsState);}ws91ApplyFocusedInsightVisibility();}catch(error){console.warn("V9.1 insights focus failed",error);}return r;};
function ws91ApplyFocusedInsightVisibility(){
  const focus=v6InsightFocus||"all";const chart=document.getElementById("insightsChartGrid"),details=document.querySelector("#marketplaceInsightsSection .insights-detail-grid");
  document.querySelectorAll("[data-chart-focus]").forEach(card=>{const key=card.dataset.chartFocus;card.style.display=(focus==="all"||key===focus||key==="contribution")?"":"none";});
  if(chart&&document.getElementById("insightsViewSwitch")?.querySelector('[data-v8-insights-view="chart"].active'))chart.style.display="grid";
  if(details)details.style.display="grid";
}

async function ws91InsightsRange(){const [from,to]=v4SetRangeControls("insightsPeriod","insightsFromDate","insightsToDate","insightsDate");return {from,to,snaps:await v4LoadSnapshotsForRange(from,to)};}
function ws91ObservedRevenuePerDay(r){
  if(r.marketplace==="amazon" && ws91Num(r.asinRevenue)>0){const days=ws91Num(r.businessReportDays)||DEFAULT_AMAZON_BUSINESS_REPORT_DAYS;return ws91Num(r.asinRevenue)/Math.max(1,days);}
  if(r.marketplace==="flipkart" && ws91Num(r.calculatedRevenue)>0){const days=ws91Num(r.orderPeriodDays||r.periodDays||r.revenuePeriodDays)||1;return ws91Num(r.calculatedRevenue)/Math.max(1,days);}
  return ws91Num(r.avgRevenuePerDay);
}
async function loadPricingBusinessInsights(){
  const {from,to,snaps}=await ws91InsightsRange();const market=document.getElementById("insightsMarketplace")?.value||"combined",category=document.getElementById("insightsCategory")?.value||"all",windowDays=Number(document.getElementById("pricingInsightWindow")?.value||7);
  const daily=[];snaps.forEach(s=>{if(market!=="flipkart")getSnapshotAmazonRows(s).forEach(r=>daily.push({...r,marketplace:"amazon",date:s.reportDate,id:r.azSku}));if(market!=="amazon")getSnapshotFlipkartRows(s).forEach(r=>daily.push({...r,marketplace:"flipkart",date:s.reportDate,id:r.fkSku}));});
  const filtered=daily.filter(r=>category==="all"||r.category===category),groups=new Map();filtered.forEach(r=>{const k=`${r.marketplace}|${r.id}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
  const insights=[];groups.forEach(arr=>{arr.sort((a,b)=>a.date.localeCompare(b.date));for(let i=1;i<arr.length;i++){const prev=arr[i-1],cur=arr[i];if(Math.abs(ws91Num(cur.listingPrice)-ws91Num(prev.listingPrice))<0.01)continue;const before=arr.slice(Math.max(0,i-windowDays),i),after=arr.slice(i,Math.min(arr.length,i+windowDays));if(!before.length||!after.length)continue;const avg=x=>x.length?x.reduce((a,r)=>a+ws91ObservedRevenuePerDay(r),0)/x.length:0;const b=avg(before),a=avg(after),change=a-b,pct=b?change/b*100:0,invBefore=before.reduce((x,r)=>x+ws91Num(r.inventory),0)/before.length,invAfter=after.reduce((x,r)=>x+ws91Num(r.inventory),0)/after.length;const confounded=invBefore>0&&invAfter<invBefore*.35;const pricePct=ws91Num(prev.listingPrice)?(ws91Num(cur.listingPrice)-ws91Num(prev.listingPrice))/ws91Num(prev.listingPrice)*100:0;let finding=confounded?"Inconclusive · inventory constraint":change>0?"Positive revenue response":"Negative revenue response";insights.push({marketplace:cur.marketplace,category:cur.category,wfSku:cur.wfSku,identifier:cur.asin||cur.fsn,marketSku:cur.id,changeDate:cur.date,oldPrice:prev.listingPrice,newPrice:cur.listingPrice,pricePct,beforeRevenue:b,afterRevenue:a,observedChange:change,observedPct:pct,inventoryBefore:invBefore,inventoryAfter:invAfter,finding});}});
  window.ws91PricingBusinessRows=insights;finalSetText("pricingInsightsChangedSkus",formatNumber(new Set(insights.map(x=>`${x.marketplace}|${x.marketSku}`)).size));finalSetText("pricingInsightsPositive",formatINR(insights.filter(x=>x.observedChange>0&&!x.finding.startsWith("Inconclusive")).reduce((a,x)=>a+x.observedChange,0)));finalSetText("pricingInsightsNegative",formatINR(Math.abs(insights.filter(x=>x.observedChange<0&&!x.finding.startsWith("Inconclusive")).reduce((a,x)=>a+x.observedChange,0))));finalSetText("pricingInsightsNetChange",formatINR(insights.filter(x=>!x.finding.startsWith("Inconclusive")).reduce((a,x)=>a+x.observedChange,0)));
  const t=document.getElementById("pricingInsightsTable");if(t)t.innerHTML='<thead><tr><th>Marketplace</th><th>Category</th><th>SKU</th><th>Change Date</th><th>Old Price</th><th>New Price</th><th>Price Δ</th><th>Observed Revenue Before</th><th>After</th><th>Observed Change</th><th>Insight</th></tr></thead><tbody>'+(insights.length?insights.sort((a,b)=>Math.abs(b.observedChange)-Math.abs(a.observedChange)).slice(0,300).map(x=>`<tr><td>${x.marketplace}</td><td>${escapeHtml(x.category)}</td><td>${escapeHtml(x.marketSku)}</td><td>${x.changeDate}</td><td>${formatINR(x.oldPrice)}</td><td>${formatINR(x.newPrice)}</td><td>${x.pricePct.toFixed(1)}%</td><td>${formatINR(x.beforeRevenue)}</td><td>${formatINR(x.afterRevenue)}</td><td>${formatINR(x.observedChange)}</td><td>${escapeHtml(x.finding)}</td></tr>`).join(""):'<tr><td colspan="11" class="empty-row">More historical observations are required to compare price changes.</td></tr>')+'</tbody>';
  ws91RenderSimpleCategoryBars("pricingInsightsCategory",insights,x=>Math.abs(x.observedChange));
  finalSetText("pricingInsightsTrend","");
}
function ws91RenderSimpleCategoryBars(id,rows,valueFn){const box=document.getElementById(id);if(!box)return;const map={};rows.forEach(r=>map[r.category]=(map[r.category]||0)+valueFn(r));const max=Math.max(1,...Object.values(map));box.innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="category-bar-row"><span class="category-bar-label">${escapeHtml(c)}</span><div class="category-bar-track"><div class="category-bar-fill" style="width:${Math.max(3,v/max*100)}%"></div></div><span class="category-bar-value">${formatINR(v)}</span></div>`).join("")||'<div class="utility-empty">No data for the selected period.</div>';}
async function loadInventoryBusinessInsights(){
  const {snaps}=await ws91InsightsRange(),market=document.getElementById("insightsMarketplace")?.value||"combined",category=document.getElementById("insightsCategory")?.value||"all";const rows=[];
  snaps.forEach(s=>{if(market!=="flipkart")v7SnapshotInventoryRows(s,"amazon").forEach(r=>rows.push({...r,marketplace:"amazon",date:s.reportDate}));if(market!=="amazon")v7SnapshotInventoryRows(s,"flipkart").forEach(r=>rows.push({...r,marketplace:"flipkart",date:s.reportDate}));});
  const f=rows.filter(r=>category==="all"||r.category===category),groups=new Map();f.forEach(r=>{const k=`${r.marketplace}|${r.identifier}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});const current=[];let recoveredRevenue=0;
  groups.forEach(arr=>{arr.sort((a,b)=>a.date.localeCompare(b.date));const last=arr.at(-1),dailyUnits=(ws91Num(last.listingPrice)>0&&ws91Num(last.avgRevenuePerDay)>0)?ws91Num(last.avgRevenuePerDay)/ws91Num(last.listingPrice):0,daysCover=dailyUnits>0?ws91Num(last.inventory)/dailyUnits:null,oos=last.inventoryKnown&&ws91Num(last.inventory)<=0,risk=!oos&&daysCover!=null&&daysCover<=7,overstock=daysCover!=null&&daysCover>60;for(let i=1;i<arr.length;i++){if(ws91Num(arr[i-1].inventory)<=0&&ws91Num(arr[i].inventory)>0)recoveredRevenue+=ws91Num(arr[i].avgRevenuePerDay);}current.push({...last,daysCover,oos,risk,overstock});});
  finalSetText("inventoryInsightsOos",formatNumber(current.filter(x=>x.oos).length));finalSetText("inventoryInsightsLoss",formatINR(current.filter(x=>x.oos).reduce((a,x)=>a+ws91Num(x.avgRevenuePerDay),0)));finalSetText("inventoryInsightsAtRisk",formatNumber(current.filter(x=>x.risk).length));finalSetText("inventoryInsightsRecovered",formatINR(recoveredRevenue));
  const matrix=document.getElementById("inventoryInsightsMatrix");if(matrix){const highRev=current.length?current.map(x=>ws91Num(x.avgRevenuePerDay)).sort((a,b)=>a-b)[Math.floor(current.length*.65)]||0:0;const q=[['Replenishment Risk',current.filter(x=>(x.oos||x.risk)&&ws91Num(x.avgRevenuePerDay)>=highRev).length,'Low stock / OOS + high revenue'],['Potential Over-stock',current.filter(x=>x.overstock&&ws91Num(x.avgRevenuePerDay)<highRev).length,'High cover + lower revenue'],['Healthy',current.filter(x=>!x.oos&&!x.risk&&!x.overstock).length,'Balanced availability'],['Watch',current.filter(x=>!x.oos&&!x.risk&&x.daysCover!=null&&x.daysCover<=14).length,'7–14 days of cover']];matrix.innerHTML=q.map(([l,n,s])=>`<div class="inventory-quadrant"><strong>${l}</strong><b>${n}</b><span>${s}</span></div>`).join("");}
  const t=document.getElementById("inventoryInsightsTable");if(t)t.innerHTML='<thead><tr><th>Marketplace</th><th>Category</th><th>Identifier</th><th>SKU</th><th>Inventory</th><th>Avg Rev / Day</th><th>Days of Cover</th><th>Insight</th></tr></thead><tbody>'+current.sort((a,b)=>ws91Num(b.avgRevenuePerDay)-ws91Num(a.avgRevenuePerDay)).slice(0,300).map(x=>`<tr><td>${x.marketplace}</td><td>${escapeHtml(x.category)}</td><td>${escapeHtml(x.identifier)}</td><td>${escapeHtml(x.marketSku||"")}</td><td>${formatNumber(x.inventory)}</td><td>${formatINR(x.avgRevenuePerDay)}</td><td>${x.daysCover==null?"—":x.daysCover.toFixed(1)}</td><td>${x.oos?'Critical OOS':x.risk?'Replenishment Risk':x.overstock?'Potential Over-stock':'Healthy / Watch'}</td></tr>`).join("")+'</tbody>';
  const catRows=current.map(x=>({...x,impact:x.oos?ws91Num(x.avgRevenuePerDay):0}));ws91RenderSimpleCategoryBars("inventoryInsightsCategory",catRows,x=>x.impact);
}

/* ======================================================
   SUPPRESSION MANAGEMENT · state + permission-aware controls
====================================================== */
async function openSuppressionManagement(state=null){showView("suppressionManagementSection");if(state){const s=document.getElementById("suppressionManagementState");if(s)s.value=state;}await loadSuppressionManagement();}
function ws91SuppressionState(row){if(row.overrideActive)return"Overridden";if(row.status==="Reactivated")return"Reactivated";if(row.status==="Closed")return"Closed";return"Active";}
function ws91SuppressionFiltersByPermission(){
  document.querySelectorAll('[data-suppression-filter-permission]').forEach(w=>{const p=w.dataset.suppressionFilterPermission;w.style.display=!p||ws91HasAction(p)?"":"none";});
  const category=document.getElementById("suppressionManagementCategory");if(category){const old=category.value;category.innerHTML='<option value="all">Category</option>'+ws91AllowedCategories().map(c=>`<option>${escapeHtml(c)}</option>`).join("");if([...category.options].some(o=>o.value===old))category.value=old;}
}
const ws91BaseLoadSuppression=loadSuppressionManagement;
loadSuppressionManagement=async function(){
  ws91SuppressionFiltersByPermission();
  try{v7SuppressionCases=typeof window.loadSuppressionCases==="function"?await window.loadSuppressionCases():[];}catch(error){console.warn(error);v7SuppressionCases=[];}
  const [from,to]=v4SetRangeControls("suppressionManagementPeriod","suppressionManagementFromDate","suppressionManagementToDate");
  window.ws91SuppressionOverrides=typeof window.loadSuppressionOverrides==="function"?await window.loadSuppressionOverrides(from,to).catch(()=>[]):[];
  const overMap=new Map(window.ws91SuppressionOverrides.map(o=>[`${o.reportDate}|${o.asin}`,o]));v7SuppressionCases=v7SuppressionCases.map(r=>({...r,overrideActive:!!overMap.get(`${r.lastDetected||r.firstDetected}|${r.asin}`)}));
  renderSuppressionManagement();
};
renderSuppressionManagement=function(){
  const table=document.getElementById("suppressionManagementTable"),kpis=document.getElementById("suppressionManagementKpis");if(!table||!kpis)return;
  const [from,to]=v4SetRangeControls("suppressionManagementPeriod","suppressionManagementFromDate","suppressionManagementToDate"),state=document.getElementById("suppressionManagementState")?.value||"all",status=document.getElementById("suppressionManagementStatus")?.value||"all",category=document.getElementById("suppressionManagementCategory")?.value||"all",q=ws91Norm(document.getElementById("suppressionManagementSearch")?.value).toLowerCase();
  let rows=(v7SuppressionCases||[]).filter(r=>{const d=r.lastDetected||r.firstDetected||"";return (!d||(d>=from&&d<=to))&&ws91CategoryAllowed(r.category)&&(category==="all"||r.category===category)&&(state==="all"||ws91SuppressionState(r)===state)&&(status==="all"||r.status===status)&&(!q||`${r.asin} ${r.caseId||""}`.toLowerCase().includes(q));});
  const active=rows.filter(r=>ws91SuppressionState(r)==="Active").length,over=rows.filter(r=>ws91SuppressionState(r)==="Overridden").length,pending=rows.filter(r=>!r.caseId&&ws91SuppressionState(r)==="Active").length,impact=rows.filter(r=>ws91SuppressionState(r)==="Active").reduce((a,r)=>a+ws91Num(r.revenueImpactPerDay),0);
  kpis.innerHTML=`<div class="v7-kpi"><span>Active</span><strong>${active}</strong></div><div class="v7-kpi"><span>Overridden</span><strong>${over}</strong></div><div class="v7-kpi"><span>Pending Case IDs</span><strong>${pending}</strong></div><div class="v7-kpi"><span>Active Rev Exposure / Day</span><strong>${formatINR(impact)}</strong></div>`;
  const canManage=ws91HasAction("manageSuppressions"),canCase=ws91HasAction("raiseCaseId"),canDocs=ws91HasAction("managePoaQc"),canPoc=ws91HasAction("pocEscalation"),canOverride=ws91HasAction("suppressionOverride");
  if(!rows.length){table.innerHTML='<tbody><tr><td class="empty-row">No suppression cases match the selected filters.</td></tr></tbody>';return;}
  table.innerHTML='<thead><tr><th>Category</th><th>ASIN</th><th>Suppression State</th><th>Rev Impact / Day</th><th>Case ID</th><th>Case Status</th><th>POA / QC</th><th>POC</th><th>Action</th></tr></thead><tbody>'+rows.map(r=>{const st=ws91SuppressionState(r);return`<tr data-case-id="${escapeHtml(r.id)}"><td>${escapeHtml(r.category||"")}</td><td><button class="asin-link" onclick='openProductDrawer("amazon",${JSON.stringify(r.asin)})'>${escapeHtml(r.asin)}</button></td><td><span class="suppression-state ${st.toLowerCase()}">${st}</span></td><td>${st==="Active"?formatINR(r.revenueImpactPerDay):"₹0"}</td><td>${canCase?`<input data-case-field="caseId" class="v7-inline-edit" value="${escapeHtml(r.caseId||"")}">`:escapeHtml(r.caseId||"—")}</td><td>${canManage?`<select data-case-field="status">${['Detected','Under Review','Documents Pending','Case Raised','Awaiting Resolution','Reactivated','Closed'].map(x=>`<option ${r.status===x?'selected':''}>${x}</option>`).join('')}</select>`:escapeHtml(r.status||"Detected")}</td><td>${canDocs?`<select data-case-field="poaStatus"><option>${escapeHtml(r.poaStatus||"Not Required")}</option><option>Required</option><option>Prepared</option><option>Submitted</option><option>Accepted</option></select><select data-case-field="qcStatus"><option>${escapeHtml(r.qcStatus||"Not Required")}</option><option>Required</option><option>Prepared</option><option>Submitted</option><option>Accepted</option></select>`:`${escapeHtml(r.poaStatus||"Not Required")} / ${escapeHtml(r.qcStatus||"Not Required")}`}</td><td>${canPoc?`<select data-case-field="pocEscalationStatus"><option>${escapeHtml(r.pocEscalationStatus||"Not Required")}</option><option>Not Required</option><option>Required</option><option>Escalated</option><option>Resolved</option></select>`:v7HtmlStatus(r.pocEscalationStatus||"Not Required")}</td><td class="v7-action-row">${(canManage||canCase||canDocs||canPoc)?`<button class="secondary-btn" onclick="v8SaveSuppressionCase('${escapeHtml(r.id)}')">Save</button>`:""}${canOverride&&st==="Active"?`<button class="primary-btn" onclick='openSuppressionOverrideModal(${JSON.stringify(r.asin)},${JSON.stringify(r.lastDetected||r.firstDetected)},${JSON.stringify(r.category)})'>Override</button>`:""}</td></tr>`;}).join("")+'</tbody>';
};
function openSuppressionOverrideModal(asin,date,category){
  if(!ws91HasAction("suppressionOverride")){showWakeSuiteToast("Suppression Override permission is required.","warning");return;}
  document.getElementById("suppressionOverrideAsin").value=asin;document.getElementById("suppressionOverrideDate").value=date;document.getElementById("suppressionOverrideReason").value="";document.getElementById("suppressionOverrideModal").dataset.category=category||"Unmapped";document.getElementById("suppressionOverrideModal").classList.add("open");
}
saveCurrentSuppressionOverride=async function(){const asin=document.getElementById("suppressionOverrideAsin")?.value,date=document.getElementById("suppressionOverrideDate")?.value,reason=ws91Norm(document.getElementById("suppressionOverrideReason")?.value),category=document.getElementById("suppressionOverrideModal")?.dataset.category||"Unmapped";if(!reason){showWakeSuiteToast("Enter a reason for the override.","warning");return;}try{await window.saveSuppressionOverride({asin,reportDate:date,reason,category});snapshotCache.delete(date);closeSuppressionOverrideModal();await loadSuppressionManagement();await loadDashboardOverview();showWakeSuiteToast(`${asin} marked Overridden for ${date}.`,"success");}catch(error){showWakeSuiteToast(error.message,"error","Override failed");}};

/* ======================================================
   PRODUCT DRAWER
====================================================== */
async function openProductDrawer(marketplace,identifier){
  const back=document.getElementById("productDrawerBackdrop");back?.classList.add("open");finalSetText("productDrawerMarket",marketplace==="amazon"?"Amazon":"Flipkart");finalSetText("productDrawerTitle",identifier);
  const date=document.getElementById("dashboardToDate")?.value||todayIso(),snap=await loadSnapshotCached(date).catch(()=>null);let row=null;
  if(snap){row=(marketplace==="amazon"?getSnapshotAmazonRows(snap):getSnapshotFlipkartRows(snap)).find(r=>(marketplace==="amazon"?r.asin:r.fsn)===identifier);}
  const body=document.getElementById("productDrawerBody");if(!body)return;if(!row){body.innerHTML='<div class="utility-empty">Product data is not available in the selected snapshot.</div>';return;}
  body.innerHTML=`<div class="product-detail-grid">${[['Category',row.category],['WF SKU',row.wfSku],['Marketplace SKU',marketplace==='amazon'?row.azSku:row.fkSku],['Inventory',row.inventory],['WF Price',formatINR(row.wfPrice)],['Marketplace Price',formatINR(row.listingPrice)],['Live Price',formatINR(row.finalLivePrice)],['WF MRP',formatINR(row.wfMrp)]].map(([l,v])=>`<div class="product-detail"><span>${l}</span><strong>${escapeHtml(v??'—')}</strong></div>`).join('')}</div><div class="product-drawer-section"><h3>Current State</h3><div class="v7-security-note">${row.approvedException?'Approved pricing exception is active.':(row.listingPriceDisparity||row.livePriceDisparity||row.mrpDisparity)?'Actionable pricing issue detected.':'No actionable pricing issue in this snapshot.'}</div></div>`;
}
function closeProductDrawer(event){if(event&&event.target?.id!=="productDrawerBackdrop")return;document.getElementById("productDrawerBackdrop")?.classList.remove("open");}

/* ======================================================
   DATA ADMINISTRATION · Super Admin only
====================================================== */
function ws91SelectedDataAdminTypes(){return [...document.querySelectorAll('[data-data-admin-type]:checked')].map(x=>x.dataset.dataAdminType);}
async function previewDataAdministration(){
  if(!ws91IsSuperAdmin()){showWakeSuiteToast("Data Administration is restricted to Super Admin.","warning");return;}
  const date=document.getElementById("dataAdminDate")?.value||todayIso(),types=ws91SelectedDataAdminTypes();if(!types.length){showWakeSuiteToast("Select at least one processed dataset.","warning");return;}
  try{const info=await window.previewProcessedDataClear(date,types);ws91SetHtml("dataAdminPreview",`<strong>${escapeHtml(date)}</strong><br>${Object.entries(info.counts||{}).map(([k,v])=>`${escapeHtml(k)}: ${formatNumber(v)} rows`).join('<br>')}<br><br>Uploaded source-file history will not be deleted.`);}catch(error){showWakeSuiteToast(error.message,"error","Unable to preview data");}
}
async function clearSelectedProcessedData(){
  if(!ws91IsSuperAdmin()){showWakeSuiteToast("Data Administration is restricted to Super Admin.","warning");return;}
  const date=document.getElementById("dataAdminDate")?.value||todayIso(),types=ws91SelectedDataAdminTypes(),reason=ws91Norm(document.getElementById("dataAdminReason")?.value);if(!types.length||!reason){showWakeSuiteToast("Select datasets and enter a deletion reason.","warning");return;}
  if(!confirm(`Clear selected processed WakeSuite data for ${date}?\n\nUploaded source files are not deleted.`))return;
  try{await window.clearProcessedData(date,types,reason);snapshotCache.delete(date);showWakeSuiteToast(`Processed data cleared for ${date}.`,"success");await previewDataAdministration();await loadDataAdministrationAudit();}catch(error){showWakeSuiteToast(error.message,"error","Unable to clear processed data");}
}
async function loadDataAdministrationAudit(){if(!ws91IsSuperAdmin())return;const rows=typeof window.loadDataAdminAudit==="function"?await window.loadDataAdminAudit().catch(()=>[]):[];const t=document.getElementById("dataAdminAuditTable");if(t)t.innerHTML='<thead><tr><th>Date</th><th>Datasets</th><th>Reason</th><th>By</th><th>When</th></tr></thead><tbody>'+(rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.reportDate||"")}</td><td>${escapeHtml((r.types||[]).join(", "))}</td><td>${escapeHtml(r.reason||"")}</td><td>${escapeHtml(r.deletedBy||"")}</td><td>${escapeHtml(r.deletedAtText||"")}</td></tr>`).join(""):'<tr><td colspan="5" class="empty-row">No data-administration actions recorded.</td></tr>')+'</tbody>';}

/* Remove the old aggregate KPI whenever legacy Inventory History is opened. */
const ws91BaseLoadInventoryHistory=loadInventoryHistory;
loadInventoryHistory=async function(...args){const r=await ws91BaseLoadInventoryHistory(...args);const k=document.getElementById("inventoryHistoryKpis");if(k){[...k.children].forEach(c=>{if(c.textContent.includes("OOS Product Days"))c.remove();});}return r;};

/* ======================================================
   INITIALIZATION
====================================================== */
function ws91Init(){
  ws91RenderIcons();
  document.getElementById("exceptionRule")?.addEventListener("change",()=>ws91SyncExceptionRuleInputs("exception"));
  document.getElementById("manualExceptionRule")?.addEventListener("change",()=>ws91SyncExceptionRuleInputs("manualException"));
  document.getElementById("dataAdminDate")&&(document.getElementById("dataAdminDate").value=todayIso());
  document.getElementById("priceUpdatesMinPct")&&(document.getElementById("priceUpdatesMinPct").value=localStorage.getItem("wakesuite.amazon.minPct")||"5");
  ws91SyncExceptionRuleInputs("exception");
  const observer=new MutationObserver(()=>ws91EnforceSuperAdminEditor());observer.observe(document.getElementById("userAccessDirectory")||document.body,{childList:true,subtree:true});
}

function refreshPriceUpdateVerification(){return ws91LoadUpdateVerification();}
function downloadCurrentPriceUpdate(){return downloadPriceUpdates();}
function addSelectedPriceUpdateExceptions(){return addSelectedPriceUpdatesToException();}

Object.assign(window,{
  refreshPriceUpdateVerification,downloadCurrentPriceUpdate,addSelectedPriceUpdateExceptions,
  setInsightsDomain,loadPricingBusinessInsights,loadInventoryBusinessInsights,
  openPriceUpdates,loadPriceUpdatesPreview,togglePriceUpdateRow,toggleAllPriceUpdateRows,addSelectedPriceUpdatesToException,downloadPriceUpdates,
  openPricingExceptionModal,closePricingExceptionModal,saveManualPricingException,
  openSuppressionManagement,openSuppressionOverrideModal,
  openProductDrawer,closeProductDrawer,
  previewDataAdministration,clearSelectedProcessedData,loadDataAdministrationAudit
});

document.addEventListener("DOMContentLoaded",ws91Init,{once:true});

/* ======================================================
   V9.1 POST-LOAD INTEGRITY PATCHES
   These execute after all core V8 definitions.
====================================================== */

// Persist both raw detection and current actionability so later exception
// changes can be applied without destroying the marketplace truth.
v7ApplyExceptions=function(result,marketplace,reportDate){
  if(!result)return result;
  (result.rows||[]).forEach(row=>ws91ApplyRowExceptions(row,marketplace,reportDate));
  result.listingPriceDisparityRows=(result.rows||[]).filter(r=>r.listingPriceDisparity);
  result.livePriceDisparityRows=(result.rows||[]).filter(r=>r.livePriceDisparity);
  result.mrpDisparityRows=(result.rows||[]).filter(r=>r.mrpDisparity);
  return result;
};
const ws91CompactAmazonBase=compactAmazonRow,ws91ExpandAmazonBase=expandAmazonRow;
compactAmazonRow=function(r){return [...ws91CompactAmazonBase(r),!!r.rawListingPriceDisparity,!!r.rawLivePriceDisparity,!!r.rawMrpDisparity];};
expandAmazonRow=function(a){const r=ws91ExpandAmazonBase(a);if(a.length>36){r.rawListingPriceDisparity=!!a[34];r.rawLivePriceDisparity=!!a[35];r.rawMrpDisparity=!!a[36];}return r;};
const ws91CompactFlipBase=compactFlipkartRow,ws91ExpandFlipBase=expandFlipkartRow;
compactFlipkartRow=function(r){return [...ws91CompactFlipBase(r),!!r.rawListingPriceDisparity,!!r.rawLivePriceDisparity,!!r.rawMrpDisparity];};
expandFlipkartRow=function(a){const r=ws91ExpandFlipBase(a);if(a.length>37){r.rawListingPriceDisparity=!!a[35];r.rawLivePriceDisparity=!!a[36];r.rawMrpDisparity=!!a[37];}return r;};

// Exception state must be available before primary dashboard/insight metrics render.
const ws91DashboardWithEnhancements=loadDashboardOverview;
loadDashboardOverview=async function(...args){await v7EnsurePricingExceptionsLoaded(true).catch(()=>{});return ws91DashboardWithEnhancements(...args);};
const ws91InsightsWithEnhancements=loadMarketplaceInsights;
loadMarketplaceInsights=async function(...args){await v7EnsurePricingExceptionsLoaded(true).catch(()=>{});return ws91InsightsWithEnhancements(...args);};

function openMarketplaceInsights(domain="overview"){
  showView("marketplaceInsightsSection");
  setInsightsDomain(domain);
}
window.openMarketplaceInsights=openMarketplaceInsights;

// Use V9.1 module names in access control UI; history remains a drill-down,
// not a primary permission/menu surface.
if(typeof V7_ALL_MODULES!=="undefined"){
  V7_ALL_MODULES.splice(0,V7_ALL_MODULES.length,...WS91_FULL_MODULES);
}
v7ModuleCheckboxes=function(scopes,prefix){
  const labels={dashboard:"Dashboard",marketplaceInsights:"Marketplace Insights",pricingInsights:"Pricing Insights",inventoryInsights:"Inventory Insights",amazonListing:"Amazon Listing Price Disparity",amazonLive:"Amazon Live Price Disparity",amazonMrp:"Amazon MRP Disparity",amazonPricingIssues:"Amazon Pricing Issues",amazonPriceUpdates:"Amazon Price & MRP Update",amazonMinMaxUpdates:"Amazon Min / Max Price Update",amazonSuppression:"Amazon ASIN Suppression",amazonBuyBox:"Amazon Buy Box Suppression",suppressionManagement:"Suppression Management",flipkartListing:"Flipkart Listing Price Disparity",flipkartLive:"Flipkart Live Price Disparity",flipkartMrp:"Flipkart MRP Disparity",flipkartPriceUpdates:"Flipkart Price & MRP Update",dailyCommunications:"Daily Communications",uploadCenter:"Data Center",masterPricing:"Master Pricing",marketplaceData:"Marketplace Data",pricingExceptions:"Pricing Exceptions",settings:"Settings",dataAdministration:"Data Administration"};
  const modules=ws91IsSuperAdmin()?[...WS91_FULL_MODULES]:(scopes.modules||[]);
  return WS91_FULL_MODULES.map(key=>`<label><input type="checkbox" data-v7-module="${key}" data-prefix="${escapeHtml(prefix)}" ${modules.includes(key)?"checked":""}> ${escapeHtml(labels[key]||key)}</label>`).join("");
};

function ws91LockSuperAdminRow(row,lock=true){
  if(!row)return;
  row.querySelectorAll('.v7-access-editor input[type="checkbox"]').forEach(cb=>{if(lock)cb.checked=true;cb.disabled=lock;});
}
function ws91HandleRoleControl(control){
  if(!control)return;const row=control.closest('[data-v7-record-key]');ws91LockSuperAdminRow(row,control.value==="super_admin");
}
document.addEventListener("change",event=>{
  if(event.target.matches('[data-v7-role-for],[id^="v7-role-"]'))ws91HandleRoleControl(event.target);
});
const ws91OldEnforceSuperAdminEditor=ws91EnforceSuperAdminEditor;
ws91EnforceSuperAdminEditor=function(){
  document.querySelectorAll('[data-v7-record-key]').forEach(row=>{
    const role=row.querySelector('[data-v7-role-for],[id^="v7-role-"]')?.value || row.children?.[1]?.textContent?.trim().toLowerCase().replaceAll(' ','_');
    if(role==="super_admin")ws91LockSuperAdminRow(row,true);
  });
  const tab=document.getElementById("dataAdministrationSettingsTab");if(tab)tab.style.display=ws91IsSuperAdmin()?"":"none";
};

// Ensure old V8 Max % persistence cannot influence V9.1. Max SAP = target MRP.
const ws91LoadOpsBase=loadOperationalControls;
loadOperationalControls=async function(){const r=await ws91LoadOpsBase();try{localStorage.removeItem("wakesuite.amazon.maxPct");}catch(_e){}return r;};
const ws91SaveOpsBase=saveOperationalControls;
saveOperationalControls=async function(){const r=await ws91SaveOpsBase();try{localStorage.removeItem("wakesuite.amazon.maxPct");}catch(_e){}return r;};

// Show audit immediately when the Super Admin opens Data Administration.
const ws91ShowSettingsPaneBase=showSettingsPane;
showSettingsPane=function(paneId,button){const r=ws91ShowSettingsPaneBase(paneId,button);if(paneId==="dataAdministrationPane")loadDataAdministrationAudit();return r;};

// V9.1 public exports after final overrides.
Object.assign(window,{loadDashboardOverview,loadMarketplaceInsights,loadAmazonPricingIssues,uploadPricingExceptions,downloadPricingExceptionsTemplate,showSettingsPane});

/* Dashboard utility aliases used by declarative HTML controls. */
function refreshActionCenter(){return loadDashboardOverview();}
function refreshDataHealth(){return loadDashboardOverview();}
function openDashboardExceptions(marketplace){return openDashboardInsight(marketplace||"combined","exceptions");}
function openSuppressionManagementByState(state){return openSuppressionManagement(state||"all");}
function openLatestUpdateVerification(){
  const latest=(window.ws91MarketplaceUpdates||[])[0];
  return openPriceUpdates(latest?.marketplace||"amazon",latest?.mode||"price_mrp");
}
Object.assign(window,{refreshActionCenter,refreshDataHealth,openDashboardExceptions,openSuppressionManagementByState,openLatestUpdateVerification});
