/* WakeSuite V9.3.7
 * Amazon Buy Box APT generation
 * - Uses the user-provided Buy Box suppression APT workbook exactly as the base template.
 * - Merchant SKUs = WF SKU mapped to the affected ASIN.
 * - GL = WakeSuite category.
 * - Landed / competitor / shipping / L7+ override values = WF Price only.
 * - Marketplace ID + Seller ID are read from the template defaults and remain fixed.
 * - POA / QC document generation is intentionally deferred to a later release.
 */
(function(){
  'use strict';

  const TEMPLATE_URL='./assets/BuyBox_APT_Template.xlsx';
  let templateBuffer=null;
  let visibleBuyBoxRows=[];

  async function templateWorkbook(){
    if(!templateBuffer){
      const response=await fetch(TEMPLATE_URL,{cache:'no-store'});
      if(!response.ok) throw new Error('Buy Box APT template could not be loaded from assets/BuyBox_APT_Template.xlsx.');
      templateBuffer=await response.arrayBuffer();
    }
    return XLSX.read(templateBuffer.slice(0),{type:'array',cellStyles:true,cellFormula:true,cellNF:true});
  }

  function cloneStyleCell(sheet,addr,styleAddr){
    const styleCell=sheet[styleAddr]||{};
    const current=sheet[addr]||{};
    const out={};
    for(const key of ['s','z']){
      if(current[key]!==undefined) out[key]=current[key];
      else if(styleCell[key]!==undefined) out[key]=styleCell[key];
    }
    return out;
  }

  function setValue(sheet,addr,value,styleAddr){
    const cell=cloneStyleCell(sheet,addr,styleAddr);
    delete cell.f; delete cell.F; delete cell.w; delete cell.h;
    if(value===null||value===undefined||value===''){
      cell.t='s'; cell.v='';
    }else if(typeof value==='number' && Number.isFinite(value)){
      cell.t='n'; cell.v=value;
    }else{
      cell.t='s'; cell.v=String(value);
    }
    sheet[addr]=cell;
  }

  function setFormula(sheet,addr,formula,styleAddr){
    const cell=cloneStyleCell(sheet,addr,styleAddr);
    delete cell.v; delete cell.w; delete cell.F;
    cell.t='s';
    cell.f=formula;
    sheet[addr]=cell;
  }

  function cleanText(v){return String(v??'').trim();}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}

  function resolveAtomicRows(issueRows,options={}){
    const issueAsin=r=>cleanText(r?.asin||r?.productId||r?.identifier||r?.ASIN);
    const targets=new Set((issueRows||[]).map(issueAsin).filter(Boolean));
    const byKey=new Map();
    const suppliedSnapshots=Array.isArray(options?.snapshots)?options.snapshots:[];
    const snapshots=suppliedSnapshots.length?suppliedSnapshots:(Array.isArray(currentHistoricalReport?.snapshots)?currentHistoricalReport.snapshots:[]);
    const latestSnapshot=[...snapshots].sort((a,b)=>cleanText(b?.reportDate).localeCompare(cleanText(a?.reportDate)))[0];

    if(latestSnapshot){
      const source=typeof getSnapshotAmazonRows==='function'?getSnapshotAmazonRows(latestSnapshot):[];
      source.forEach(r=>{
        const asin=cleanText(r.asin),wfSku=cleanText(r.wfSku);
        if(!targets.has(asin)||!wfSku||r.buyBoxStatus!=='Buy Box Suppressed')return;
        const key=`${asin}||${wfSku}`;
        if(!byKey.has(key))byKey.set(key,{...r,reportDate:cleanText(r.reportDate||latestSnapshot?.reportDate)});
      });
    }

    // Fallback only when no snapshot is available in the current report context.
    if(!latestSnapshot){
      (issueRows||[]).forEach(r=>{
        const asin=issueAsin(r),wfSku=cleanText(r.wfSku);
        if(!asin||!wfSku)return;
        const key=`${asin}||${wfSku}`;
        if(!byKey.has(key))byKey.set(key,r);
      });
    }

    return [...byKey.values()].sort((a,b)=>
      cleanText(a.category).localeCompare(cleanText(b.category))||
      cleanText(a.asin).localeCompare(cleanText(b.asin))||
      cleanText(a.wfSku).localeCompare(cleanText(b.wfSku))
    );
  }

  function validateRows(rows){
    const bad=[];
    rows.forEach(r=>{
      const missing=[];
      if(!cleanText(r.asin))missing.push('ASIN');
      if(!cleanText(r.wfSku))missing.push('WF SKU');
      if(!cleanText(r.category))missing.push('Category');
      if(!(num(r.wfPrice)>0))missing.push('WF Price');
      if(missing.length)bad.push(`${cleanText(r.asin)||'Unknown ASIN'} (${missing.join(', ')})`);
    });
    if(bad.length){
      throw new Error(`APT cannot be generated because required mapped data is missing for ${bad.length} row(s): ${bad.slice(0,6).join('; ')}${bad.length>6?'…':''}`);
    }
  }

  function clearTemplateData(sheet,maxRow){
    // Convert the exported Google-Sheets array header into the visible literal header so it cannot spill over generated rows.
    setValue(sheet,'I1','Brand Manufacturer/Competitor product URL','I1');
    for(let r=2;r<=maxRow;r++){
      for(let c=0;c<12;c++){
        const addr=XLSX.utils.encode_cell({r:r-1,c});
        const styleAddr=XLSX.utils.encode_cell({r:1,c});
        setValue(sheet,addr,'',styleAddr);
      }
    }
  }

  async function buildAptWorkbook(issueRows,options={}){
    if(typeof XLSX==='undefined')throw new Error('Excel library is not loaded.');
    const rows=resolveAtomicRows(issueRows,options);
    if(!rows.length)throw new Error('No Buy Box suppressed ASINs are available for APT generation.');
    validateRows(rows);

    const wb=await templateWorkbook();
    const sheet=wb.Sheets['APT Template']||wb.Sheets[wb.SheetNames[0]];
    if(!sheet)throw new Error('APT Template sheet was not found.');

    const marketplaceId=cleanText(sheet.A2?.v)||'A21TJRUUN4KGV';
    const sellerId=cleanText(sheet.C2?.v)||'A1LJE4YE17OE1D';
    const existingRange=XLSX.utils.decode_range(sheet['!ref']||'A1:L166');
    const maxRow=Math.max(existingRange.e.r+1,rows.length+1);
    clearTemplateData(sheet,maxRow);

    rows.forEach((r,index)=>{
      const row=index+2;
      const wfPrice=num(r.wfPrice);
      const wfSku=cleanText(r.wfSku);
      const asin=cleanText(r.asin);
      const category=cleanText(r.category);
      setValue(sheet,`A${row}`,marketplaceId,'A2');
      setValue(sheet,`B${row}`,asin,'B2');
      setValue(sheet,`C${row}`,sellerId,'C2');
      setValue(sheet,`D${row}`,wfSku,'D2');
      setValue(sheet,`E${row}`,category,'E2');
      setValue(sheet,`F${row}`,wfPrice,'F2');
      setFormula(sheet,`G${row}`,`="https://csi.amazon.com/tico/v3/?ts=tico&item_id="&F${row}&"&fn_sku=&customer_id="&B${row}&"&sku="&D${row}&"&marketplace_id="&A${row}&"&order_id=&filter=true&stage=prod&listing_type=purchasable&"`,'G2');
      setValue(sheet,`H${row}`,'','H2');
      setValue(sheet,`I${row}`,`https://www.wakefit.co/mattress/orthopaedic-memory-foam-mattress/${wfSku}`,'I2');
      setValue(sheet,`J${row}`,wfPrice,'J2');
      setValue(sheet,`K${row}`,wfPrice,'K2');
      setValue(sheet,`L${row}`,wfPrice,'L2');
    });

    sheet['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(rows.length,1),c:11}});
    if(wb.Workbook){
      wb.Workbook.CalcPr={...(wb.Workbook.CalcPr||{}),fullCalcOnLoad:true,forceFullCalc:true,calcMode:'auto'};
    }
    return {wb,rows};
  }

  function aptFilename(rows,scope='filtered'){
    const date=(currentHistoricalReport?.toDate||document.getElementById('reportToDate')?.value||todayIso?.()||'').replace(/[^0-9-]/g,'');
    if(scope==='row'){
      const asins=[...new Set(rows.map(r=>cleanText(r.asin)).filter(Boolean))];
      if(asins.length===1)return `Amazon_Buy_Box_APT_${asins[0]}_${date}.xlsx`;
    }
    const from=(currentHistoricalReport?.fromDate||date).replace(/[^0-9-]/g,'');
    return from===date?`Amazon_Buy_Box_APT_${date}.xlsx`:`Amazon_Buy_Box_APT_${from}_to_${date}.xlsx`;
  }

  async function downloadApt(issueRows,scope='filtered'){
    try{
      const built=await buildAptWorkbook(issueRows);
      XLSX.writeFile(built.wb,aptFilename(built.rows,scope),{bookType:'xlsx',cellStyles:true});
      showWakeSuiteToast?.(`APT generated for ${built.rows.length} Buy Box row${built.rows.length===1?'':'s'}.`,'success','Buy Box APT');
    }catch(error){
      showWakeSuiteToast?.(error.message,'error','Unable to generate Buy Box APT');
      if(!window.showWakeSuiteToast)console.error(error);
    }
  }

  async function generateBuyBoxAptFiltered(){
    if(currentHistoricalReport?.def?.type!=='amazon_buybox'){
      showWakeSuiteToast?.('Open Amazon Buy Box Suppression before generating APT.','warning');
      return;
    }
    const rows=currentHistoricalReport.rows||[];
    if(!rows.length){showWakeSuiteToast?.('No filtered Buy Box suppression rows are available.','warning');return;}
    await downloadApt(rows,'filtered');
  }

  async function generateBuyBoxAptForRow(index){
    const row=visibleBuyBoxRows[Number(index)];
    if(!row){showWakeSuiteToast?.('The selected Buy Box row is no longer available. Refresh the report and try again.','warning');return;}
    await downloadApt([row],'row');
  }

  function syncAptButton(def){
    const button=document.getElementById('generateBuyBoxAptButton');
    if(button){
      const show=def?.type==='amazon_buybox';
      button.hidden=!show;
      button.style.display=show?'':'none';
    }
  }

  if(typeof renderHistoricalTable==='function'){
    const baseRender=renderHistoricalTable;
    renderHistoricalTable=function(def,rows){
      baseRender(def,rows);
      syncAptButton(def);
      if(def?.type!=='amazon_buybox')return;
      visibleBuyBoxRows=(rows||[]).slice(0,1800);
      const table=document.getElementById('reportModuleTable');
      const head=table?.tHead?.rows?.[0];
      if(head){
        const th=document.createElement('th');
        th.textContent='APT';
        head.appendChild(th);
      }
      [...(table?.tBodies?.[0]?.rows||[])].forEach((tr,index)=>{
        const td=document.createElement('td');
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='secondary-btn';
        btn.textContent='Generate APT';
        btn.addEventListener('click',()=>generateBuyBoxAptForRow(index));
        td.appendChild(btn);
        tr.appendChild(td);
      });
    };
  }

  if(typeof openHistoricalModule==='function'){
    const baseOpen=openHistoricalModule;
    openHistoricalModule=async function(viewKey,...rest){
      const out=await baseOpen(viewKey,...rest);
      syncAptButton(HISTORICAL_VIEWS?.[viewKey]);
      return out;
    };
  }

  document.addEventListener('DOMContentLoaded',()=>syncAptButton(HISTORICAL_VIEWS?.[currentHistoricalViewKey]));

  Object.assign(window,{
    generateBuyBoxAptFiltered,
    generateBuyBoxAptForRow,
    WakeSuiteBuyBoxApt:{buildAptWorkbook,resolveAtomicRows,template:TEMPLATE_URL}
  });
})();
