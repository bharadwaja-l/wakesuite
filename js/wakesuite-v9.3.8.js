/* WakeSuite V9.3.8
 * Reliability + communications + performance follow-up
 * - Fixes strict disparity email counts/attachments through core helpers in wakesuite-app.js.
 * - Restores Download alongside email actions in Daily Communications.
 * - Adds separate issue-type POC sends while retaining combined marketplace sends.
 * - Automatically attaches Buy Box APT to Amazon Buy Box POC escalation emails.
 * - Uses unique ASIN / FSN counts in POC email bodies.
 * - Retires the legacy embedded Live Disparity Order Impact panel; dedicated Disparity Orders owns that evidence.
 */
(function(){
  'use strict';

  const ISSUE_TYPES={
    amazon:['Live Price Disparity','ASIN Suppression','Buy Box Suppression'],
    flipkart:['Live Price Disparity']
  };

  function clean(v){return String(v??'').trim();}
  function marketName(market){return market==='amazon'?'Amazon':'Flipkart';}
  function identifierLabel(market){return market==='amazon'?'ASINs':'FSNs';}
  function rowIdentifier(row,market=''){
    const r=row||{};
    if(market==='amazon')return clean(r.asin||r.productId||r.identifier||r.ASIN);
    if(market==='flipkart')return clean(r.fsn||r.productId||r.identifier||r.FSN);
    return clean(r.productId||r.asin||r.fsn||r.identifier||r.ASIN||r.FSN);
  }
  function normalizeEmailRow(row,market){
    const r=row||{};
    const id=rowIdentifier(r,market);
    if(market==='amazon')return {...r,productId:clean(r.productId)||id,identifier:clean(r.identifier)||id,asin:clean(r.asin)||id,azSku:clean(r.azSku||r.marketSku||r['AZ SKU'])};
    if(market==='flipkart')return {...r,productId:clean(r.productId)||id,identifier:clean(r.identifier)||id,fsn:clean(r.fsn)||id,fkSku:clean(r.fkSku||r.marketSku||r['FK SKU'])};
    return {...r,productId:clean(r.productId)||id,identifier:clean(r.identifier)||id};
  }
  function uniqueProducts(rows,market=''){return new Set((rows||[]).map(r=>rowIdentifier(r,market)).filter(Boolean));}
  function issueRows(kind,market,issueType=''){
    const state=v7CommunicationsState;
    if(!state||!state[market])return [];
    const source=(kind==='poc'?(state[market].newRows||[]):(state[market].follow||[])).map(r=>normalizeEmailRow(r,market));
    return issueType?source.filter(r=>r.issueType===issueType):source;
  }
  function logType(kind,issueType=''){
    const base=kind==='poc'?'POC Escalation':(kind==='followup'?'POC Follow-Up':'Daily Marketplace Report');
    return issueType?`${base} · ${issueType}`:base;
  }
  function sentLog(type,market){
    return (v7CommunicationsState?.logs||[]).find(l=>l.communicationType===type&&l.marketplace===market&&l.status==='Sent');
  }
  function safeSheetFilename(text){return String(text||'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/_+/g,'_');}

  function communicationHtml(kind,market,rows,state,issueType=''){
    if(kind==='internal'){
      return `<div style="font-family:Arial,sans-serif;font-size:13px"><p>Hi,</p><p>Please find the Daily Marketplace Report for ${escapeHtml(state.date)}.</p><p>The attached workbook contains the complete actionable marketplace report for the day.</p><p>Regards,<br>WakeSuite</p></div>`;
    }

    const label=identifierLabel(market);
    const groups=new Map();
    (rows||[]).forEach(row=>{
      const type=row.issueType||'Issue';
      if(!groups.has(type))groups.set(type,new Set());
      const id=rowIdentifier(row,market); if(id)groups.get(type).add(id);
    });
    const total=uniqueProducts(rows,market).size;
    const title=issueType?`${marketName(market)} ${issueType}`:`${marketName(market)} ${kind==='poc'?'POC Escalation':'POC Follow-Up'}`;
    let table='';
    if(groups.size){
      table=`<table style="border-collapse:collapse;margin:12px 0;font-family:Arial,sans-serif;font-size:12px"><thead><tr><th style="border:1px solid #d0d5dd;padding:7px;text-align:left">Issue</th><th style="border:1px solid #d0d5dd;padding:7px;text-align:left">No. of ${label}</th></tr></thead><tbody>`+
        [...groups.entries()].map(([type,ids])=>`<tr><td style="border:1px solid #d0d5dd;padding:7px">${escapeHtml(type)}</td><td style="border:1px solid #d0d5dd;padding:7px">${ids.size.toLocaleString('en-IN')}</td></tr>`).join('')+
        `<tr><td style="border:1px solid #d0d5dd;padding:7px;font-weight:700">Total Unique ${label}</td><td style="border:1px solid #d0d5dd;padding:7px;font-weight:700">${total.toLocaleString('en-IN')}</td></tr></tbody></table>`;
    }
    const aptNote=kind==='poc'&&market==='amazon'&&(rows||[]).some(r=>r.issueType==='Buy Box Suppression')
      ? '<p>The Amazon Buy Box APT is attached together with the POC report.</p>' : '';
    return `<div style="font-family:Arial,sans-serif;font-size:13px"><p>Hi,</p><p>Please find the ${escapeHtml(title)} for ${escapeHtml(state.date)}.</p>${table}${aptNote}<p>Regards,<br>WakeSuite</p></div>`;
  }

  function buildMimeMulti({to,cc=[],bcc=[],subject,html,attachments=[]}){
    const boundary=`WakeSuite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headers=[
      `To: ${to.join(', ')}`,
      cc.length?`Cc: ${cc.join(', ')}`:'',
      bcc.length?`Bcc: ${bcc.join(', ')}`:'',
      `Subject: ${v4MimeSubject(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    ].filter(Boolean).join('\r\n');

    let body=`${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${v4Utf8Base64(html)}\r\n`;
    for(const attachment of attachments){
      if(!attachment?.name||!attachment?.bytes)continue;
      body+=`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${attachment.name}"\r\nContent-Disposition: attachment; filename="${attachment.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${v4BytesToBase64(attachment.bytes)}\r\n`;
    }
    body+=`--${boundary}--`;
    return v4Base64Url(v4Utf8Base64(body));
  }

  async function sendMime({to,cc=[],bcc=[],subject,html,attachments=[]}){
    const token=await v4GetGmailToken();
    const raw=buildMimeMulti({to,cc,bcc,subject,html,attachments});
    const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({raw})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||`Gmail API error ${response.status}`);
    return data;
  }

  async function aptAttachment(rows,state){
    const buyRows=(rows||[]).filter(r=>r.issueType==='Buy Box Suppression');
    if(!buyRows.length)return null;
    if(!window.WakeSuiteBuyBoxApt?.buildAptWorkbook){
      throw new Error('Buy Box APT generator is unavailable. POC email was not sent.');
    }
    const built=await window.WakeSuiteBuyBoxApt.buildAptWorkbook(buyRows,{snapshots:[state.snapshot]});
    const bytes=XLSX.write(built.wb,{bookType:'xlsx',type:'array',cellStyles:true});
    return {name:`Amazon_Buy_Box_APT_${state.date}.xlsx`,bytes};
  }

  function mainAttachment(kind,market,rows,state,type){
    const workbook=v7CommunicationWorkbook(kind,market,rows,state);
    const bytes=XLSX.write(workbook,{bookType:'xlsx',type:'array'});
    const name=kind==='internal'
      ? `WakeSuite_Daily_Marketplace_Report_${state.date}.xlsx`
      : `WakeSuite_${marketName(market)}_${safeSheetFilename(type)}_${state.date}.xlsx`;
    return {name,bytes};
  }

  async function sendDailyCommunication938(kind,market,issueType=''){
    const state=v7CommunicationsState;
    if(!state)return;
    if(kind!=='internal'&&!v7HasAction('pocEscalation')){showWakeSuiteToast('POC Escalation permission is required.','warning');return;}
    if(!v7HasAction('email')){showWakeSuiteToast('Email permission is required.','warning');return;}

    let rows=[],to=[],subject='',type='';
    if(kind==='internal'){
      type='Daily Marketplace Report';
      to=v7SplitEmails(v7OperationalControls.internalMarketplaceRecipients);
      subject=`Daily Marketplace Report - ${state.date}`;
    }else{
      rows=issueRows(kind,market,issueType);
      type=logType(kind,issueType);
      const cfg=market==='amazon'?v7OperationalControls.amazonPoc:v7OperationalControls.flipkartPoc;
      to=v7Unique([cfg?.email,...v7SplitEmails(cfg?.additional)]);
      if(issueType){
        subject=`${marketName(market)} ${issueType}${kind==='followup'?' Follow-Up':''} - ${state.date}`;
      }else{
        subject=`${marketName(market)} ${kind==='poc'?'POC Escalation':'POC Follow-Up'} - ${state.date}`;
      }
    }

    if(!to.length){showWakeSuiteToast('Recipients are not configured in Settings → System → Operational Controls.','warning');return;}
    if(kind!=='internal'&&!rows.length){showWakeSuiteToast('No issues are ready for this communication.','info');return;}

    try{
      const attachments=[mainAttachment(kind,market,rows,state,type)];
      if(kind==='poc'&&market==='amazon'){
        const apt=await aptAttachment(rows,state);
        if(apt)attachments.push(apt);
      }
      const html=communicationHtml(kind,market,rows,state,issueType);
      await sendMime({to,subject,html,attachments});
      if(kind!=='internal')await window.recordPocEscalations(rows,state.date);
      await window.saveCommunicationLog({
        reportDate:state.date,
        communicationType:type,
        marketplace:market,
        recipients:to,
        status:'Sent',
        issueType:issueType||'',
        issueCount:kind==='internal'?Object.values(state.issues.internal).reduce((a,r)=>a+r.length,0):rows.length,
        uniqueIdentifierCount:kind==='internal'?null:uniqueProducts(rows,market).size
      });
      showWakeSuiteToast(`${type} sent successfully.`,'success');
      await loadDailyCommunications();
    }catch(error){
      showWakeSuiteToast(error.message,'error',`${type||'Communication'} failed`);
    }
  }

  function downloadDailyCommunication(kind,market,issueType=''){
    const state=v7CommunicationsState;
    if(!state)return;
    if(!v7HasAction('download')){showWakeSuiteToast('Download permission is required.','warning');return;}
    const rows=kind==='internal'?[]:issueRows(kind,market,issueType);
    if(kind!=='internal'&&!rows.length){showWakeSuiteToast('No rows are available to download.','info');return;}
    const type=kind==='internal'?'Daily Marketplace Report':logType(kind,issueType);
    const workbook=v7CommunicationWorkbook(kind,market,rows,state);
    const filename=kind==='internal'
      ? `WakeSuite_Daily_Marketplace_Report_${state.date}.xlsx`
      : `WakeSuite_${marketName(market)}_${safeSheetFilename(type)}_${state.date}.xlsx`;
    XLSX.writeFile(workbook,filename);
  }

  function renderDailyCommunications938(){
    const state=v7CommunicationsState;
    const cards=document.getElementById('communicationsCards');
    const history=document.getElementById('communicationsHistoryTable');
    if(!state||!cards)return;
    const canPoc=v7HasAction('pocEscalation')&&v7HasAction('email');
    const canEmail=v7HasAction('email');
    const canDownload=v7HasAction('download');

    function card({title,rows=[],meta,kind,market,issueType='',internal=false}){
      const count=internal?Object.values(state.issues.internal).reduce((a,r)=>a+r.length,0):uniqueProducts(rows,market).size;
      const label=internal?'issue rows':identifierLabel(market);
      const type=internal?'Daily Marketplace Report':logType(kind,issueType);
      const sent=sentLog(type,market);
      const disabled=internal?!canEmail:(!canPoc||!rows.length);
      const dlDisabled=!canDownload||(internal?count===0:!rows.length);
      const sendLabel=internal?'Send Internal Report':(issueType?'Email Separately':(kind==='poc'?'Send All to POC':'Send Follow-Up'));
      return `<div class="communication-card"><h3>${escapeHtml(title)}</h3><div class="communication-count">${formatNumber(count)}</div><div class="communication-meta">${escapeHtml(sent?`Sent ${sent.sentAtText||''} by ${sent.sentBy||''}`:`${meta} · ${count} ${label}`)}</div><div class="communication-actions"><button class="secondary-btn" onclick="downloadDailyCommunication('${kind}','${market}','${escapeHtml(issueType)}')" ${dlDisabled?'disabled':''}>Download</button><button class="primary-btn" onclick="sendDailyCommunication('${kind}','${market}','${escapeHtml(issueType)}')" ${disabled?'disabled':''}>${escapeHtml(sendLabel)}</button></div></div>`;
    }

    let html='';
    html+=card({title:'Amazon POC Escalation',rows:state.amazon.newRows,meta:'Combined Amazon Live Disparity, threshold-qualified Suppression and Buy Box report',kind:'poc',market:'amazon'});
    for(const type of ISSUE_TYPES.amazon){
      html+=card({title:`Amazon · ${type}`,rows:issueRows('poc','amazon',type),meta:'Separate Amazon POC escalation',kind:'poc',market:'amazon',issueType:type});
    }
    html+=card({title:'Amazon POC Follow-Up',rows:state.amazon.follow,meta:'Previously escalated Amazon issues still unresolved',kind:'followup',market:'amazon'});
    html+=card({title:'Flipkart POC Escalation',rows:state.flipkart.newRows,meta:'Combined Flipkart actionable Live Price Disparity report',kind:'poc',market:'flipkart'});
    for(const type of ISSUE_TYPES.flipkart){
      html+=card({title:`Flipkart · ${type}`,rows:issueRows('poc','flipkart',type),meta:'Separate Flipkart POC escalation',kind:'poc',market:'flipkart',issueType:type});
    }
    html+=card({title:'Flipkart POC Follow-Up',rows:state.flipkart.follow,meta:'Previously escalated Flipkart issues still unresolved',kind:'followup',market:'flipkart'});
    html+=card({title:'Daily Marketplace Report',meta:'Internal Amazon + Flipkart actionable report',kind:'internal',market:'combined',internal:true});
    cards.innerHTML=html;

    const logs=state.logs||[];
    finalSetText('communicationsHistoryCount',String(logs.length));
    if(history){
      history.innerHTML=logs.length
        ? '<thead><tr><th>Type</th><th>Marketplace</th><th>Sent At</th><th>Sent By</th><th>Recipients</th><th>Status</th></tr></thead><tbody>'+logs.map(l=>`<tr><td>${escapeHtml(l.communicationType)}</td><td>${escapeHtml(l.marketplace)}</td><td>${escapeHtml(l.sentAtText||'')}</td><td>${escapeHtml(l.sentBy||'')}</td><td>${escapeHtml((l.recipients||[]).join(', '))}</td><td>${v7HtmlStatus(l.status)}</td></tr>`).join('')+'</tbody>'
        : '<tbody><tr><td class="empty-row">No communications sent for this date.</td></tr></tbody>';
    }
  }

  // Individual report email compatibility: the strict Price Disparity Explorer
  // uses identifier/marketSku fields, while the legacy email engine expects
  // asin/fsn and azSku/fkSku. Normalize once so COUNT, inline summary and the
  // Excel attachment all use the same selected report rows.
  if(typeof v4EmailIssueRows==='function'){
    const baseV4EmailIssueRows=v4EmailIssueRows;
    v4EmailIssueRows=function(report){
      const rows=baseV4EmailIssueRows(report)||[];
      const market=report?.def?.marketplace||'';
      return rows.map(row=>normalizeEmailRow(row,market));
    };
    window.v4EmailIssueRows=v4EmailIssueRows;
  }

  function reportIdentifierAudit(report){
    if(!report?.def)return {rows:[],count:0,market:''};
    const market=report.def.marketplace||'';
    const rows=typeof v4EmailIssueRows==='function'?v4EmailIssueRows(report):[];
    return {rows,count:uniqueProducts(rows,market).size,market};
  }

  if(typeof openShareEmailModal==='function'){
    const baseOpenShareEmailModal=openShareEmailModal;
    openShareEmailModal=async function(...args){
      if(currentHistoricalReport?.def){
        const audit=reportIdentifierAudit(currentHistoricalReport);
        if(audit.rows.length&&audit.count===0){
          showWakeSuiteToast?.('Report rows were found but no ASIN/FSN identifiers could be resolved. Email was not generated. Refresh the report and try again.','error','Email data validation failed');
          return;
        }
      }
      return baseOpenShareEmailModal.apply(this,args);
    };
    window.openShareEmailModal=openShareEmailModal;
  }

  if(typeof sendCurrentReportEmail==='function'){
    const baseSendCurrentReportEmail=sendCurrentReportEmail;
    sendCurrentReportEmail=async function(...args){
      const report=currentShareEmailPackage?.report;
      if(report?.def){
        const audit=reportIdentifierAudit(report);
        if(audit.rows.length&&audit.count===0){
          showWakeSuiteToast?.('The selected email has report rows but no valid ASIN/FSN identifiers. Send was blocked to prevent a false 0-count email.','error','Email send blocked');
          return;
        }
      }
      return baseSendCurrentReportEmail.apply(this,args);
    };
    window.sendCurrentReportEmail=sendCurrentReportEmail;
  }

  // Replace communication actions without changing data qualification rules.
  sendDailyCommunication=sendDailyCommunication938;
  renderDailyCommunications=renderDailyCommunications938;
  window.sendDailyCommunication=sendDailyCommunication938;
  window.renderDailyCommunications=renderDailyCommunications938;
  window.downloadDailyCommunication=downloadDailyCommunication;

  // Dedicated Disparity Orders replaced the legacy embedded order-impact panel.
  function removeLegacyImpact(){document.getElementById('liveDisparityImpactPanel')?.remove();}
  document.addEventListener('DOMContentLoaded',removeLegacyImpact);
  setTimeout(removeLegacyImpact,0);

  window.WakeSuiteV938={communicationHtml,buildMimeMulti,uniqueProducts,issueRows,rowIdentifier,normalizeEmailRow,reportIdentifierAudit};
})();
