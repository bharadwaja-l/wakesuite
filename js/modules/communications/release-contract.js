/* WakeSuite V9.3.11 locked release contract, 07 Oct 2026.
 * POC and normal report sharing are separate paths. Approved APT and assets are immutable.
 */
function formatRevenueImpact(v){return '₹'+Math.round(Number(v)||0).toLocaleString('en-IN');}
(function(){
  'use strict';
  const categories=['Mattress','Furniture','Accessories','Office Chairs'];
  const api=window.WakeSuiteV9311;
  const clean=v=>String(v??'').trim(),esc=v=>escapeHtml(String(v??''));
  const impact=r=>r.revenueAvailable===false?null:(r.latestImpact??r.revenueImpactPerDay??r.liveDailyRevenueImpact??r.buyBoxRevenueImpactPerDay??null);
  const id=(r,m)=>clean(m==='amazon'?(r.asin||r.productId||r.identifier||r.ASIN):(r.fsn||r.productId||r.identifier||r.FSN));
  const count=(rows,m)=>new Set(rows.map(r=>id(r,m)).filter(Boolean)).size;
  const money=v=>v===null?'Revenue Data Unavailable':api.formatImpact(v);
  function clock(date=new Date()){return date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});}
  function stampedName(name,time=clock()){return name.replace(/(\.[^.]+)$/,'_'+time.replace(/:/g,'-').replace(/ /g,'-')+'$1');}
  function stampMessage(message,n=1,time=clock()){
    return {...message,subject:message.subject+(n>1?` | Escalation - ${n}`:'')+` | ${time}`,attachments:(message.attachments||[]).map(a=>({...a,name:stampedName(a.name,time)}))};
  }
  function assertIds(rows,m){if(!rows.length)throw new Error('No current actionable rows match the selected filters.');if(rows.some(r=>!id(r,m)))throw new Error('An ASIN/FSN identifier could not be resolved. Refresh the report before sending.');}
  function renderCategorySettings(){
    const host=document.getElementById('flipkartCategoryPocSettings');if(!host)return;
    const configured=v7OperationalControls.flipkartPocByCategory||{};
    host.innerHTML=categories.map((c,i)=>{const cfg=configured[c]||{};return `<div class="settings-grid"><div class="settings-field"><label>Category</label><input value="${esc(c)}" readonly></div><div class="settings-field"><label>POC Name</label><input id="fkCategoryName${i}" value="${esc(cfg.name||'')}"></div><div class="settings-field"><label>To</label><input id="fkCategoryTo${i}" value="${esc(cfg.to||'')}" placeholder="email1, email2"></div><div class="settings-field"><label>CC</label><input id="fkCategoryCc${i}" value="${esc(cfg.cc||'')}"></div></div>`;}).join('');
  }
  function readCategorySettings(){return Object.fromEntries(categories.map((c,i)=>[c,{name:clean(document.getElementById(`fkCategoryName${i}`)?.value),to:clean(document.getElementById(`fkCategoryTo${i}`)?.value),cc:clean(document.getElementById(`fkCategoryCc${i}`)?.value)}]));}
  function buyBoxRows(rows,snapshots=[]){
    return rows.map(row=>{
      const snapshot=snapshots.find(s=>s.reportDate===(row.reportDate||row.latestDate))||[...snapshots].sort((a,b)=>String(b.reportDate).localeCompare(String(a.reportDate)))[0];
      const atomic=snapshot?getSnapshotAmazonRows(snapshot).filter(r=>r.asin===id(row,'amazon')&&(!row.wfSku||r.wfSku===row.wfSku)):[];
      const source=atomic.find(r=>Number(r.wfPrice)>0);
      return {...row,wfPrice:Number(row.wfPrice)>0?row.wfPrice:source?.wfPrice,wfSku:row.wfSku||source?.wfSku||'',revenueImpactPerDay:row.latestImpact??row.revenueImpactPerDay??source?.buyBoxRevenueImpactPerDay??null};
    });
  }
  function buyBoxSummary(rows){
    const body=categories.concat([...new Set(rows.map(r=>r.category||'Unmapped'))].filter(c=>!categories.includes(c))).filter(c=>rows.some(r=>(r.category||'Unmapped')===c)).map(c=>{const group=rows.filter(r=>(r.category||'Unmapped')===c);return [c,count(group,'amazon'),money(sum(group))];});
    return table(['Category','No. of ASINs','Rev Impact / Day'],[...body,['Total ASINs',count(rows,'amazon'),money(sum(rows))]]);
  }
  function sum(rows){const valid=rows.filter(r=>impact(r)!==null&&Number.isFinite(Number(impact(r))));return rows.length&&!valid.length?null:valid.reduce((s,r)=>s+Number(impact(r)),0);}
  function table(headers,rows){return `<table style="border-collapse:collapse;margin:14px 0;font-family:Arial,sans-serif;font-size:12px"><thead><tr>${headers.map(h=>`<th style="border:1px solid #c8c8c8;padding:7px;background:#ffe600;text-align:left">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td style="border:1px solid #c8c8c8;padding:7px">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
  function internalData(state){
    const i=state.issues.internal;
    const groups={azLive:i.amazonLive||[],azSupp:i.amazonSupp||[],azBuy:buyBoxRows(i.amazonBuy||[],[state.snapshot]),fkLive:i.flipkartLive||[]};
    const azHeaders=['Category','Live Price Disparity','ASIN Suppression','Buy Box Suppression'];
    const cats=[...new Set(categories.concat(Object.values(groups).flat().map(r=>r.category||'Unmapped')))];
    const azRows=cats.filter(c=>['azLive','azSupp','azBuy'].some(k=>groups[k].some(r=>(r.category||'Unmapped')===c))).map(c=>[c,...['azLive','azSupp','azBuy'].map(k=>count(groups[k].filter(r=>(r.category||'Unmapped')===c),'amazon'))]);
    azRows.push(['Total ASINs',...['azLive','azSupp','azBuy'].map(k=>count(groups[k],'amazon'))],['Rev Impact / Day',...['azLive','azSupp','azBuy'].map(k=>money(sum(groups[k])))]);
    const fkRows=cats.filter(c=>groups.fkLive.some(r=>(r.category||'Unmapped')===c)).map(c=>[c,count(groups.fkLive.filter(r=>(r.category||'Unmapped')===c),'flipkart')]);
    fkRows.push(['Total FSNs',count(groups.fkLive,'flipkart')],['Rev Impact / Day',money(sum(groups.fkLive))]);
    const azParts=['azLive','azSupp','azBuy'].map(k=>sum(groups[k]));
    const azTotal=azParts.some(v=>v===null)?null:azParts.reduce((a,b)=>a+b,0),fkTotal=sum(groups.fkLive),total=azTotal===null||fkTotal===null?null:azTotal+fkTotal;
    const final=[['Amazon Total Rev Impact',money(azTotal)],['Flipkart Total Rev Impact',money(fkTotal)],['Total Marketplace Impact',money(total)]];
    return {groups,azHeaders,azRows,fkRows,azTotal,fkTotal,total,final};
  }
  function internalWorkbook(state){
    const d=internalData(state),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Amazon'],d.azHeaders,...d.azRows,['Amazon Total Rev Impact / Day',money(d.azTotal)],[],['Flipkart'],['Category','Live Price Disparity'],...d.fkRows,['Flipkart Total Rev Impact / Day',money(d.fkTotal)],[],...d.final]),'Summary');
    const spec=[['AZ Live Price','azLive','amazon'],['AZ ASIN Suppression','azSupp','amazon'],['AZ Buy Box Suppression','azBuy','amazon'],['FK Live Price','fkLive','flipkart']];
    spec.forEach(([name,k,m])=>{
      const cols=[['Category',r=>r.category||''],[m==='amazon'?'ASIN':'FSN',r=>id(r,m)],['WF SKU',r=>r.wfSku||'']];
      if(k==='azLive'||k==='fkLive')cols.push(['WF Price',r=>r.wfPrice??''],['Live Price',r=>r.finalLivePrice??''],['Diff',r=>r.livePriceDiff??'']);
      if(k==='azBuy')cols.push(['WF Price',r=>r.wfPrice??'']);
      cols.push(['Rev Impact / Day',r=>impact(r)===null?'Revenue Data Unavailable':api.roundImpact(impact(r))]);
      const built=api.createWb(name,d.groups[k],cols);XLSX.utils.book_append_sheet(wb,built.ws,name);
    });return wb;
  }
  function internalHtml(state){const d=internalData(state);return `<div style="font-family:Arial,sans-serif;font-size:13px"><p>Hi Team,</p><p>Daily Marketplace Report for ${esc(state.date)}.</p><h3>Amazon</h3>${table(d.azHeaders,d.azRows)}<p><strong>Amazon Total Rev Impact / Day: ${money(d.azTotal)}</strong></p><h3>Flipkart</h3>${table(['Category','Live Price Disparity'],d.fkRows)}<p><strong>Flipkart Total Rev Impact / Day: ${money(d.fkTotal)}</strong></p>${table(['Marketplace','Rev Impact / Day'],d.final)}${api.signatureHtml()}</div>`;}
  function downloadInternal(state){XLSX.writeFile(internalWorkbook(state),stampedName(`WakeSuite_Daily_Marketplace_Report_${state.date}.xlsx`));}
  function visibleReportData(){
    const tableNode=document.getElementById('reportModuleTable');
    if(!tableNode)throw new Error('The visible report table is unavailable.');
    const visible=cell=>!cell.hidden&&cell.style.display!=='none'&&getComputedStyle(cell).display!=='none';
    const columns=[...tableNode.querySelectorAll('thead tr:last-child th')].map((cell,i)=>({i,name:clean(cell.textContent),visible:visible(cell)})).filter(c=>c.visible&&!/^(Action|Override|Action\s*\/\s*Override)$/i.test(c.name));
    if(!columns.length)throw new Error('No visible report columns are available.');
    const rows=[...tableNode.querySelectorAll('tbody tr')].filter(tr=>visible(tr)&&!tr.querySelector('.empty-row')).map(tr=>{const cells=[...tr.children];return columns.map(c=>clean(cells[c.i]?.textContent));});
    return {headers:columns.map(c=>c.name),rows};
  }
  function visibleWorkbook(){const data=visibleReportData(),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([data.headers,...data.rows]),'Data');return wb;}
  function downloadVisibleReport(report){XLSX.writeFile(visibleWorkbook(),stampedName(reportFilename(report.def.title.replace(/[^A-Za-z0-9]+/g,'_'),report.period,report.fromDate,report.toDate)));}
  async function prepareReportPackage(report,viewKey){
    const m=report.def.marketplace,data=visibleReportData();
    const source=(report.rows||v4EmailIssueRows(report)).map(r=>({...r,[m==='amazon'?'asin':'fsn']:id(r,m)}));
    const rows=source.slice(0,data.rows.length);assertIds(rows,m);
    const template={...(loadEmailState().templates?.[viewKey]||{})};
    const greeting=template.greeting?`<div style="margin-bottom:12px">${esc(v4ReplaceEmailVars(template.greeting,v4EmailVariableContext(report)))}</div>`:'';
    const extraHtml=table(data.headers,data.rows),sig=api.signatureHtml();
    const identifierColumn=data.headers.findIndex(h=>h===(m==='amazon'?'ASIN':'FSN'));
    const visibleCount=identifierColumn<0?count(rows,m):new Set(data.rows.map(r=>r[identifierColumn]).filter(Boolean)).size;
    if(!visibleCount)throw new Error('The visible report identifiers could not be resolved.');
    const messageText=`Please find the ${report.def.title} for ${v4FormatEmailDate(report.fromDate,report.toDate)}. No. of ${m==='amazon'?'ASINs':'FSNs'}: ${visibleCount}.`;
    // Normal report sharing never triggers POA generation or POC routing.
    const attachments=m==='flipkart'?[]:[api.wbAttachment(`${report.def.title}_${report.fromDate}_to_${report.toDate}.xlsx`,visibleWorkbook())];
    return {rows,template,subject:`${report.def.title} | ${v4FormatEmailDate(report.fromDate,report.toDate)}`,html:`<div style="font-family:Arial,sans-serif;font-size:13px">${greeting}<p>${esc(messageText)}</p>${extraHtml}${sig}</div>`,attachments,messageText,greetingHtml:greeting,signatureHtml:sig,extraHtml};
  }
  let sending=false;
  async function sendCommunication(kind,market,issueType=''){
    if(sending){showWakeSuiteToast('An email send is already in progress. Please wait for it to finish.','info');return;}
    if(!v7HasAction('email')||(kind!=='internal'&&!v7HasAction('pocEscalation'))){showWakeSuiteToast('Email / POC Escalation permission is required.','warning');return;}
    sending=true;
    try{
      // Refresh authoritative selected-day data at every click, including resends.
      const date=document.getElementById('communicationsDate')?.value||v7CommunicationsState?.date||todayIso();
      snapshotCache.delete(date);v7CommunicationsState=null;await loadDailyCommunications();
      const state=v7CommunicationsState;if(!state||state.date!==date)throw new Error('Current communication data could not be loaded.');
      if(kind==='internal'){
        const to=v7SplitEmails(v7OperationalControls.internalMarketplaceRecipients);if(!to.length)throw new Error('Configure internal recipients in Operational Controls.');
        const message=stampMessage({subject:`Daily Marketplace Report - ${date}`,html:internalHtml(state),attachments:[api.wbAttachment(`WakeSuite_Daily_Marketplace_Report_${date}.xlsx`,internalWorkbook(state))]});
        const sent=await api.gmailDeliver({to,...message});await window.saveCommunicationLog({reportDate:date,communicationType:'Daily Marketplace Report',marketplace:'combined',recipients:to,status:'Sent',subject:sent.wakeSuiteDelivery?.subject||message.subject,gmailId:sent.id||'',sentAtIso:new Date().toISOString()});
      }else{
        let rows=api.issueRows(kind,market,issueType);assertIds(rows,market);
        rows=rows.map(r=>({...r,marketplace:market,productId:id(r,market),issueKey:r.issueKey||v7IssueKey(market,r.issueType,id(r,market))}));
        if(market==='amazon')rows=rows.map(r=>r.issueType==='Buy Box Suppression'?buyBoxRows([r],[state.snapshot])[0]:r);
        const categoryGroups=market==='flipkart'?[...new Set(rows.map(r=>r.category||'Unmapped'))]:[''];
        // Check every route before generating attachments or sending any category.
        const routes=categoryGroups.map(category=>{
          const cfg=market==='amazon'?v7OperationalControls.amazonPoc:v7OperationalControls.flipkartPocByCategory?.[category];
          const to=market==='amazon'?v7Unique([cfg?.email,...v7SplitEmails(cfg?.additional)]).filter(Boolean):v7SplitEmails(cfg?.to);
          if(!to.length)throw new Error(`Configure ${market==='amazon'?'Amazon':`Flipkart ${category}`} POC To / CC in Operational Controls.`);
          return {category,cfg,to,cc:v7SplitEmails(cfg?.cc)};
        });
        for(const route of routes){
          let group=route.category?rows.filter(r=>r.category===route.category):rows;
          if(group.some(r=>r.issueType==='ASIN Suppression')){
            if(!v7HasAction('managePoaQc'))throw new Error('POA/QC permission is required to generate and store suppression POAs.');
            const prepared=await api.ensureSuppressionPoaLinks(group.filter(r=>r.issueType==='ASIN Suppression'),date,{generate:true}),byId=new Map(prepared.map(r=>[id(r,'amazon'),r]));
            group=group.map(r=>r.issueType==='ASIN Suppression'?{...r,...byId.get(id(r,'amazon'))}:r);
          }
          const channel=`${market}|${issueType||'combined'}|${route.category}`;
          const prior=(state.logs||[]).filter(l=>l.status==='Sent'&&(l.channel===channel||(!l.channel&&market==='amazon'&&l.marketplace===market&&(l.issueType||'')===issueType&&/^POC /.test(l.communicationType||''))));
          const number=1+Math.max(prior.length,...prior.map(l=>Number(l.escalationNumber)||0));
          let message=await api.buildPocEmail(kind,market,issueType,state,group);
          if(market==='amazon'&&issueType==='Buy Box Suppression')message.html=message.html.replace(/<p><strong>No\. of ASINs:.*?<\/strong><\/p>/,buyBoxSummary(group));
          if(market==='flipkart'){
            message.subject=`Action Required : Flipkart Live Price Disparity - ${date} | ${route.category}`;
            message.html=`<div style="font-family:Arial,sans-serif;font-size:13px"><p>Hi${route.cfg?.name?' '+esc(route.cfg.name):''},</p><p>Please update the prices for the FSNs showing a disparity on the front end.</p>${api.flipkartInlineTable(group)}${api.signatureHtml()}</div>`;
            message.attachments=[api.wbAttachment(`Flipkart_Live_Price_Disparity_${route.category}_${date}.xlsx`,api.flipkartLiveWorkbook(group))];
          }
          message=stampMessage(message,number);
          const result=await api.gmailDeliver({to:route.to,cc:route.cc,...message});
          // Record send first; if escalation state storage fails, preserve delivery evidence.
          await window.saveCommunicationLog({reportDate:date,communicationType:`POC Escalation${issueType?' · '+issueType:''}`,marketplace:market,category:route.category,channel,escalationNumber:number,recipients:route.to,cc:route.cc,status:'Sent',issueType,issueCount:group.length,uniqueIdentifierCount:count(group,market),identifiers:group.map(r=>id(r,market)),subject:result.wakeSuiteDelivery?.subject||message.subject,gmailId:result.id||'',sentAtIso:new Date().toISOString()});
          await window.recordPocEscalations(group,date);
        }
      }
      showWakeSuiteToast('Communication sent successfully.','success');await loadDailyCommunications();
    }catch(error){showWakeSuiteToast(error.message,'error','Communication failed');}finally{sending=false;}
  }
  // Share one in-flight snapshot request per date and retain existing cache invalidation.
  const inFlight=new Map(),baseSnapshot=loadSnapshotCached;
  loadSnapshotCached=function(date){if(snapshotCache.has(date))return Promise.resolve(snapshotCache.get(date));if(inFlight.has(date))return inFlight.get(date);const promise=baseSnapshot(date).finally(()=>inFlight.delete(date));inFlight.set(date,promise);return promise;};
  const baseRender=renderHistoricalTable;
  renderHistoricalTable=function(def,rows){if(def?.type==='amazon_buybox')rows=buyBoxRows(rows,currentHistoricalReport?.snapshots||[]).map(r=>({...r,listingPrice:r.wfPrice}));return baseRender(def,rows);};
  window.renderHistoricalTable=renderHistoricalTable;
  const originalWriteFile=XLSX.writeFile;
  XLSX.writeFile=function(wb,name,...args){normalizeRevenueWorkbook(wb);return originalWriteFile.call(this,wb,/\d{2}-\d{2}-(?:AM|PM)\./.test(name)?name:stampedName(name),...args);};
  // Apply rounding by semantic export header while preserving prices and template fields.
  const originalWrite=XLSX.write;
  function normalizeRevenueWorkbook(wb){for(const name of wb.SheetNames||[]){const ws=wb.Sheets[name];if(!ws?.['!ref'])continue;const range=XLSX.utils.decode_range(ws['!ref']);for(let c=range.s.c;c<=range.e.c;c++){const header=ws[XLSX.utils.encode_cell({r:range.s.r,c})]?.v;if(!/impact|exposure|revenue/i.test(String(header||'')))continue;for(let r=range.s.r+1;r<=range.e.r;r++){const cell=ws[XLSX.utils.encode_cell({r,c})];if(cell?.t==='n'){cell.v=api.roundImpact(cell.v);cell.z='₹#,##0';delete cell.w;}}}}}
  XLSX.write=function(wb,...args){normalizeRevenueWorkbook(wb);return originalWrite.call(this,wb,...args);};
  const baseRows=v4EmailIssueRows;
  v4EmailIssueRows=function(report){const rows=baseRows(report);if(rows.some(r=>!id(r,report.def.marketplace)))throw new Error('Report identifiers could not be resolved. Refresh before sharing.');return rows;};
  window.WakeSuiteRelease={sendCommunication,stampMessage,stampedName,clock,renderCategorySettings,readCategorySettings,buyBoxRows,buyBoxSummary,internalData,internalWorkbook,internalHtml,downloadInternal,visibleReportData,visibleWorkbook,downloadVisibleReport,prepareReportPackage};
})();
