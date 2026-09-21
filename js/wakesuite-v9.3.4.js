/* WakeSuite V9.3.4 · Daily Communications consolidation
   Amazon POC escalation is sent as one email with one summary dashboard and
   separate issue-specific attachments. Zero-issue attachment types are omitted. */
(function(){
  'use strict';

  const VERSION='9.3.4';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v??''):String(v??'');
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const unique=a=>Array.from(new Set((a||[]).filter(Boolean)));
  const xlsxMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  function dateLabel(iso){
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return String(iso||'');
    const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2])-1]||m[2];
    return `${Number(m[3])} ${mon} ${m[1]}`;
  }

  function issueImpact(row,type){
    if(type==='Live Price Disparity')return num(row.liveDailyRevenueImpact ?? row.revenueImpactPerDay);
    if(type==='Buy Box Suppression')return num(row.buyBoxRevenueImpactPerDay ?? row.revenueImpactPerDay);
    return num(row.revenueImpactPerDay);
  }

  function revenueAvailable(rows){
    return !rows.some(r=>r && r.revenueAvailable===false);
  }

  function money(v){
    try{return typeof formatINR==='function'?formatINR(num(v)):`₹${num(v).toLocaleString('en-IN',{maximumFractionDigits:2})}`;}
    catch(_e){return `₹${num(v).toFixed(2)}`;}
  }

  function byType(rows,type){return (rows||[]).filter(r=>r.issueType===type);}

  function sortOperational(rows){
    return [...(rows||[])].sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''))||String(a.productId||a.asin||'').localeCompare(String(b.productId||b.asin||'')));
  }

  function makeWorkbook(sheetName,headers,rows,widths=[],linkColumn=-1){
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
    ws['!cols']=widths.map(w=>({wch:w}));
    if(linkColumn>=0){
      for(let i=0;i<rows.length;i++){
        const value=rows[i][linkColumn];
        if(!value)continue;
        const addr=XLSX.utils.encode_cell({r:i+1,c:linkColumn});
        if(ws[addr])ws[addr].l={Target:String(value)};
      }
    }
    XLSX.utils.book_append_sheet(wb,ws,sheetName);
    return wb;
  }

  function workbookAttachment(name,wb){
    return {name,mimeType:xlsxMime,bytes:XLSX.write(wb,{bookType:'xlsx',type:'array'})};
  }

  function liveAttachment(rows,date){
    const data=sortOperational(rows).map(r=>[
      r.category||'',
      r.azSku||r.marketplaceSku||'',
      r.asin||r.productId||'',
      num(r.wfPrice)
    ]);
    const wb=makeWorkbook('Temp_Export_Values_Only',['Category','Seller sku','ASIN','Price'],data,[20,26,18,14]);
    return workbookAttachment(`Action Required _ Amazon Live Price Disparity ${dateLabel(date)}.xlsx`,wb);
  }

  function casePoaLink(c){
    return String(c?.poaLink||c?.poaUrl||c?.poaDocumentUrl||c?.poaDocumentLink||'').trim();
  }

  function suppressionAttachment(rows,date,cases){
    const map=new Map();
    for(const c of cases||[]){
      const asin=String(c.asin||'');if(!asin)continue;
      const prev=map.get(asin);
      if(!prev||String(c.lastDetected||c.lastSeen||'')>String(prev.lastDetected||prev.lastSeen||''))map.set(asin,c);
    }
    const data=sortOperational(rows).map(r=>{
      const c=map.get(String(r.asin||r.productId||''));
      const impact=r.revenueAvailable===false?'Revenue Data Refresh Required':issueImpact(r,'ASIN Suppression');
      return [r.category||'',r.asin||r.productId||'',impact,casePoaLink(c),dateLabel(date)];
    });
    const wb=makeWorkbook('ASIN Suppression',['Category','ASIN','Rev Impact','POA Link','Escalated On'],data,[20,18,18,42,18],3);
    return workbookAttachment(`Action Required _ Amazon ASIN Suppression ${dateLabel(date)}.xlsx`,wb);
  }

  function buyBoxAttachment(rows,date){
    const data=sortOperational(rows).map(r=>[
      r.category||'',
      r.asin||r.productId||'',
      r.wfSku||'',
      num(r.wfPrice),
      r.revenueAvailable===false?'Revenue Data Refresh Required':issueImpact(r,'Buy Box Suppression')
    ]);
    const wb=makeWorkbook('Buy Box Suppression',['Category','ASIN','WF Item SKU','WF Price','Rev Impact'],data,[20,18,24,16,18]);
    return workbookAttachment(`Action Required _ Amazon Buy Box Suppression ${dateLabel(date)}.xlsx`,wb);
  }

  function bytesToBase64(bytes){
    if(typeof v4BytesToBase64==='function')return v4BytesToBase64(bytes);
    const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let binary='';
    const size=0x8000;for(let i=0;i<u8.length;i+=size)binary+=String.fromCharCode(...u8.subarray(i,i+size));
    return btoa(binary);
  }
  function utf8Base64(text){
    if(typeof v4Utf8Base64==='function')return v4Utf8Base64(text);
    return bytesToBase64(new TextEncoder().encode(text));
  }
  function base64Url(v){return String(v).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
  function mimeSubject(v){return typeof v4MimeSubject==='function'?v4MimeSubject(v):`=?UTF-8?B?${utf8Base64(v)}?=`;}

  function buildMultiAttachmentMime({to,cc=[],bcc=[],subject,html,attachments=[]}){
    const boundary=`WakeSuite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headers=[
      `To: ${to.join(', ')}`,
      cc.length?`Cc: ${cc.join(', ')}`:'',
      bcc.length?`Bcc: ${bcc.join(', ')}`:'',
      `Subject: ${mimeSubject(subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    ].filter(Boolean).join('\r\n');
    let body=`${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${utf8Base64(html)}\r\n`;
    for(const a of attachments){
      body+=`--${boundary}\r\nContent-Type: ${a.mimeType||'application/octet-stream'}; name="${a.name}"\r\nContent-Disposition: attachment; filename="${a.name}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${bytesToBase64(a.bytes)}\r\n`;
    }
    body+=`--${boundary}--`;
    return base64Url(utf8Base64(body));
  }

  async function sendGmailMulti(payload){
    const token=await v4GetGmailToken();
    const raw=buildMultiAttachmentMime(payload);
    const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error?.message||`Gmail API error ${response.status}`);
    return data;
  }

  function summaryBucket(rows,type){
    const typed=byType(rows,type);
    return {type,rows:typed,count:typed.length,available:revenueAvailable(typed),impact:typed.reduce((a,r)=>a+issueImpact(r,type),0)};
  }

  function summaryHtml(date,pocName,buckets){
    const totalCount=buckets.reduce((a,b)=>a+b.count,0);
    const totalAvailable=buckets.every(b=>b.count===0||b.available);
    const totalImpact=buckets.reduce((a,b)=>a+(b.available?b.impact:0),0);
    const rev=b=>b.count===0?money(0):(b.available?money(b.impact):'Revenue Data Refresh Required');
    const totalRev=totalCount===0?money(0):(totalAvailable?money(totalImpact):'Revenue Data Refresh Required');
    const rows=buckets.map(b=>`<tr><td style="border:1px solid #d9d9d9;padding:9px">${esc(b.type)}</td><td style="border:1px solid #d9d9d9;padding:9px;text-align:right">${b.count}</td><td style="border:1px solid #d9d9d9;padding:9px;text-align:right">${esc(rev(b))}</td></tr>`).join('');
    return `<div style="font-family:Arial,sans-serif;font-size:13px;color:#222;line-height:1.5">
      <p>Hi ${esc(pocName||'Team')},</p>
      <p>Please find below the consolidated Amazon escalation summary for <strong>${esc(dateLabel(date))}</strong>.</p>
      <table style="border-collapse:collapse;width:680px;max-width:100%;margin:16px 0">
        <tr style="background:#ffe600"><th style="border:1px solid #a6a6a6;padding:9px;text-align:left">Issue</th><th style="border:1px solid #a6a6a6;padding:9px;text-align:right">No. of Issues</th><th style="border:1px solid #a6a6a6;padding:9px;text-align:right">Revenue Impact / Day</th></tr>
        ${rows}
        <tr style="font-weight:bold;background:#fafafa"><td style="border:1px solid #a6a6a6;padding:9px">Total</td><td style="border:1px solid #a6a6a6;padding:9px;text-align:right">${totalCount}</td><td style="border:1px solid #a6a6a6;padding:9px;text-align:right">${esc(totalRev)}</td></tr>
      </table>
      <p>Please find the attached files and take necessary actions and let us know once done.</p>
      <p>Regards,<br>WakeSuite</p>
    </div>`;
  }

  async function sendAmazonConsolidatedEscalation(state){
    if(!state)return;
    if(typeof v7HasAction==='function'&&!v7HasAction('pocEscalation')){showWakeSuiteToast?.('POC Escalation permission is required.','warning');return;}
    if(typeof v7HasAction==='function'&&!v7HasAction('email')){showWakeSuiteToast?.('Email permission is required.','warning');return;}
    const rows=state.amazon?.newRows||[];
    if(!rows.length){showWakeSuiteToast?.('No new Amazon issues are ready for escalation.','info');return;}

    const cfg=v7OperationalControls?.amazonPoc||{};
    const split=typeof v7SplitEmails==='function'?v7SplitEmails:(v=>String(v||'').split(/[;,]+/).map(x=>x.trim()).filter(Boolean));
    const to=unique([cfg.email,...split(cfg.additional)]);
    if(!to.length){showWakeSuiteToast?.('Amazon POC recipients are not configured in Settings → System → Operational Controls.','warning');return;}

    const live=summaryBucket(rows,'Live Price Disparity');
    const suppression=summaryBucket(rows,'ASIN Suppression');
    const buyBox=summaryBucket(rows,'Buy Box Suppression');
    const buckets=[live,suppression,buyBox];
    let cases=[];
    if(suppression.count&&typeof window.loadSuppressionCases==='function'){
      try{cases=await window.loadSuppressionCases();}catch(e){console.warn('Unable to load suppression cases for POC attachment',e);}
    }
    const attachments=[];
    if(live.count)attachments.push(liveAttachment(live.rows,state.date));
    if(suppression.count)attachments.push(suppressionAttachment(suppression.rows,state.date,cases));
    if(buyBox.count)attachments.push(buyBoxAttachment(buyBox.rows,state.date));

    const subject=`Action Required | Amazon Daily Escalations | ${dateLabel(state.date)}`;
    const html=summaryHtml(state.date,cfg.name||'Team',buckets);
    try{
      await sendGmailMulti({to,subject,html,attachments});
      await window.recordPocEscalations?.(rows,state.date);
      await window.saveCommunicationLog?.({
        reportDate:state.date,communicationType:'POC Escalation',marketplace:'amazon',recipients:to,status:'Sent',issueCount:rows.length,
        attachmentNames:attachments.map(a=>a.name),summary:{
          livePriceDisparity:{count:live.count,revenueImpact:live.available?live.impact:null},
          asinSuppression:{count:suppression.count,revenueImpact:suppression.available?suppression.impact:null},
          buyBoxSuppression:{count:buyBox.count,revenueImpact:buyBox.available?buyBox.impact:null}
        }
      });
      showWakeSuiteToast?.('Amazon POC consolidated escalation sent successfully.','success');
      await window.loadDailyCommunications?.();
    }catch(error){showWakeSuiteToast?.(error.message,'error','Amazon POC escalation failed');}
  }

  const baseSend=window.sendDailyCommunication;
  const upgradedSend=async function(kind,market){
    if(kind==='poc'&&market==='amazon')return sendAmazonConsolidatedEscalation(v7CommunicationsState);
    if(typeof baseSend==='function')return baseSend(kind,market);
  };
  window.sendDailyCommunication=upgradedSend;
  try{sendDailyCommunication=upgradedSend;}catch(_e){}

  document.addEventListener('DOMContentLoaded',()=>{
    const name=document.getElementById('amazonPocName');
    if(name){name.placeholder='Amazon POC Name';const label=name.closest('.settings-field')?.querySelector('label');if(label)label.textContent='Amazon POC Name';}
  });

  window.WakeSuiteV934={version:VERSION,sendAmazonConsolidatedEscalation,summaryHtml};
})();
