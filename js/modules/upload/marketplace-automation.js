/* Trial controller: launch normal portal pages; receive status from Tampermonkey. */
(() => {
  'use strict';
  const panel = document.getElementById('marketplaceAutomationTrial');
  if (!panel) return;
  panel.classList.add('mwf-trial');
  const channel = 'wakesuite-marketplace-helper-v1';
  const storageKey = 'ws-marketplace-trial-v1';
  const fkRequest = { one_time_request:{reportGroup:null,reportName:null,enable:true,status:null},
    repeat_request:{repeat_report_group_name:null,repeat_report_name:null,repeat_enable:false},
    pagination:{page_size:10,starting_page:1},
    request_report:{create_request:true,report_type:'Fulfilment Reports',report_subtype:'Orders',repeat_report:false} };
  const tasks = [
    ['inventory','Amazon Listings + FBA','https://sellercentral.amazon.in/listing/reports'],
    ['asin','Amazon ASIN Sales','https://sellercentral.amazon.in/business-reports#/report?id=102%3ADetailSalesTrafficByChildItem&chartCols=&columns=0%2F1%2F3%2F8%2F10%2F20%2F30%2F34%2F36'],
    ['amazonOrders','Amazon All Orders','https://sellercentral.amazon.in/order-reports-and-feeds/reports/allOrders#'],
    ['flipkart','Flipkart Listings','https://seller.flipkart.com/index.html#dashboard/home-page'],
    ['fkOrders','Flipkart Orders','https://seller.flipkart.com/index.html#dashboard/metrics/report-centre?query='+encodeURIComponent(JSON.stringify(fkRequest))],
    ['sql','Wakefit active pricing CSV','https://reports.wakefit.co/explorer/play/']
  ];
  let state = null, helperSeen = 0;
  try { const saved=JSON.parse(sessionStorage.getItem(storageKey)); if (saved && /^[\w-]{1,100}$/.test(saved.id) && Date.now()-saved.startedAt<86400000) state=saved; } catch {}
  function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
  function node(tag,text){const el=document.createElement(tag); if(text!==undefined)el.textContent=text; return el;}
  const title=node('div');title.className='mwf-trial-heading';title.append(node('h2','Marketplace automation'));
  const badge=node('span','TRIAL');badge.className='mwf-trial-badge';title.append(badge);panel.append(title);
  panel.append(node('p','Run report downloads in your signed-in Chrome tabs and monitor their status here. Keep the report tabs open.'));
  const install=node('a','Install / update Marketplace Reports Workflow Helper v2.2.0');
  install.href='./userscripts/marketplace-reports-workflow-helper.user.js';install.target='_blank';install.rel='noopener';panel.append(install);
  const connection=node('p','Checking helper connection…');connection.setAttribute('role','status');panel.append(connection);
  const summary=node('div');summary.className='mwf-trial-summary';panel.append(summary);
  const progress=node('progress');progress.max=tasks.length;progress.value=0;progress.setAttribute('aria-label','Report tasks finished');panel.append(progress);
  const runAll=node('button','Run all daily reports');runAll.className='primary-btn';panel.append(runAll);
  const table=node('table');table.className='result-table';
  const head=node('thead'),header=node('tr');['Report','Live status','Last update','Action'].forEach(label=>header.append(node('th',label)));head.append(header);table.append(head);
  const body=node('tbody');table.append(body);const wrap=node('div');wrap.className='table-wrap';wrap.append(table);panel.append(wrap);
  const cells=new Map();
  for(const task of tasks){const tr=node('tr'),status=node('td','Not started'),updated=node('td','—'),action=node('td'),button=node('button','Run');button.className='secondary-btn';button.addEventListener('click',()=>launch([task]));action.append(button);tr.append(node('td',task[1]),status,updated,action);body.append(tr);cells.set(task[0],{status,updated,button});}
  panel.append(node('p','Download clicked means the portal control was activated; confirm completion in Chrome Downloads. This trial does not import data, save report history, or delete Drive files.'));
  function render(){
    const connected=Date.now()-helperSeen<6000;
    text(connection,connected?'Helper connected · v2.2.0':'Helper not connected. Install/update it, enable it for this site, then refresh Wakesuite.');
    connection.dataset.connected=String(connected);
    runAll.disabled=!connected || !!state?.active;
    let unfinished=false;
    for(const [kind,cell] of cells){
      const item=state?.tasks?.[kind];
      const pending=item && !['finished','attention','blocked'].includes(item.phase);
      if(pending)unfinished=true;
      text(cell.status,item ? (pending && Date.now()-item.updatedAt>30000 ? 'No recent update — check the report tab. ' : '')+item.message : 'Not started');
      cell.status.dataset.phase=item?.phase||'idle';
      text(cell.updated,item?.updatedAt?new Date(item.updatedAt).toLocaleTimeString():'—');
      cell.button.disabled=!connected || pending;
    }
    const items=Object.values(state?.tasks||{}),finished=items.filter(item=>item.phase==='finished').length;
    const attention=items.filter(item=>['attention','blocked'].includes(item.phase)).length;
    text(summary,finished+' finished actions · '+attention+' need attention · '+items.filter(item=>['running','opening'].includes(item.phase)).length+' running');
    progress.value=finished;
    if(state){state.active=unfinished;runAll.disabled=!connected || unfinished;save();}
  }
  function text(el,value){if(el.textContent!==value)el.textContent=value;}
  function launch(selected){
    if(Date.now()-helperSeen>=6000)return;
    if(!state || !state.active)state={id:Date.now()+'-'+crypto.randomUUID(),startedAt:Date.now(),tasks:{},active:true};
    for(const [kind,,raw]of selected){
      const prior=state.tasks[kind];if(prior&&!['finished','attention','blocked'].includes(prior.phase))continue;
      const url=new URL(raw);url.searchParams.set('mwfRun',kind);url.searchParams.set('mwfRunId',state.id);url.searchParams.set('mwfAttempt',crypto.randomUUID());
      // Open directly inside the user's click, preserving Chrome's popup rules.
      const tab=window.open(url.href,'_blank');
      if(tab) { try { tab.opener=null; } catch {} }
      state.tasks[kind]={phase:tab?'opening':'blocked',message:tab?'Opening report tab…':'Popup blocked — use this report’s Run button.',updatedAt:Date.now()};
    }
    save();render();
  }
  runAll.addEventListener('click',()=>launch(tasks));
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window || event.origin!==location.origin || data?.channel!==channel || data.type!=='status'
      || data.version!=='2.2.0' || data.runId!==(state?.id||'connection-check') || !Array.isArray(data.statuses))return;
    helperSeen=Date.now();
    for(const item of data.statuses){
      if(!state?.tasks?.[item.kind] || item.runId!==state.id || typeof item.message!=='string'
        || !['running','finished','attention'].includes(item.phase) || !Number.isFinite(item.updatedAt))continue;
      if(item.updatedAt>=state.tasks[item.kind].updatedAt)state.tasks[item.kind]={phase:item.phase,message:item.message.slice(0,1200),updatedAt:item.updatedAt};
    }
    render();
  });
  function poll(){window.postMessage({channel,type:'poll',runId:state?.id||'connection-check'},location.origin);render();}
  setInterval(poll,1500);poll();
})();
