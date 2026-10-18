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
  let state = null, helperSeen = 0, helperVersion = '';
  const helperTimeout=30000;
  try { const saved=JSON.parse(sessionStorage.getItem(storageKey)); if (saved && /^[\w-]{1,100}$/.test(saved.id) && Date.now()-saved.startedAt<86400000) state=saved; } catch {}
  function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
  function node(tag,text){const el=document.createElement(tag); if(text!==undefined)el.textContent=text; return el;}
  const title=node('div');title.className='mwf-trial-heading';title.append(node('h2','Marketplace automation'));
  const badge=node('span','TRIAL');badge.className='mwf-trial-badge';title.append(badge);panel.append(title);
  panel.append(node('p','Run report downloads in your signed-in Chrome tabs and monitor their status here. Keep the report tabs open.'));
  const install=node('a','Install / update Marketplace Reports Workflow Helper v2.2.2');
  install.href='./userscripts/marketplace-reports-workflow-helper.user.js';install.target='_blank';install.rel='noopener';panel.append(install);
  const connection=node('p','Checking helper connection…');connection.setAttribute('role','status');panel.append(connection);
  const setup=node('details');setup.className='mwf-trial-setup';
  setup.append(node('summary','Connect the Chrome helper'));
  const steps=node('ol');
  ['Open the Install / update link above in the same Chrome profile as Wakesuite.',
   'Install helper v2.2.2 in Tampermonkey, replacing the old version. Keep only one copy enabled.',
   'If the link shows code, copy it into the existing helper in Tampermonkey Dashboard and save.',
   'Refresh Wakesuite. Wait for Helper connected, then try an Amazon or SQL report individually.'].forEach(value=>steps.append(node('li',value)));
  setup.append(steps);panel.append(setup);
  const retry=node('button','Check helper connection');retry.className='secondary-btn';retry.addEventListener('click',()=>{setup.open=true;poll();});panel.append(retry);
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
    const connected=helperSeen>0 && Date.now()-helperSeen<helperTimeout;
    const detected=document.documentElement?.getAttribute('data-mwf-helper-version');
    text(connection,connected?'Helper connected · v'+helperVersion:detected
      ?'Helper v'+detected+' detected, but not responding. Click Check helper connection; refresh Wakesuite if this persists.'
      :'Helper is not detected on Wakesuite. Install/update it in this Chrome profile, then refresh.');
    connection.dataset.connected=String(connected);
    runAll.disabled=!!state?.active;
    runAll.textContent=connected?'Run all daily reports':'Set up helper to run reports';
    let unfinished=false;
    for(const [kind,cell] of cells){
      const item=state?.tasks?.[kind];
      const pending=item && !['finished','attention','blocked'].includes(item.phase);
      if(pending)unfinished=true;
      text(cell.status,item ? (pending && Date.now()-item.updatedAt>30000 ? 'No recent update — check the report tab. ' : '')+item.message : 'Not started');
      cell.status.dataset.phase=item?.phase||'idle';
      text(cell.updated,item?.updatedAt?new Date(item.updatedAt).toLocaleTimeString():'—');
      cell.button.disabled=!!pending;
      cell.button.textContent=connected?'Run':'Connect helper';
    }
    const items=Object.values(state?.tasks||{}),finished=items.filter(item=>item.phase==='finished').length;
    const attention=items.filter(item=>['attention','blocked'].includes(item.phase)).length;
    text(summary,finished+' finished actions · '+attention+' need attention · '+items.filter(item=>['running','opening'].includes(item.phase)).length+' running');
    progress.value=finished;
    if(state){state.active=unfinished;runAll.disabled=unfinished;save();}
  }
  function text(el,value){if(el.textContent!==value)el.textContent=value;}
  function launch(selected){
    if(!helperSeen || Date.now()-helperSeen>=helperTimeout){
      setup.open=true;
      text(connection,'No helper response yet. Complete the steps below in this Chrome profile; no report has been started.');
      requestStatus();
      return;
    }
    if(!state)state={id:Date.now()+'-'+crypto.randomUUID(),startedAt:Date.now(),tasks:{},active:true};
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
  function receiveStatus(data){
    if(data?.channel!==channel || data.type!=='status'
      || !['2.2.0','2.2.1','2.2.2'].includes(data.version) || data.runId!==(state?.id||'connection-check') || !Array.isArray(data.statuses))return;
    helperSeen=Date.now();
    helperVersion=data.version;
    for(const item of data.statuses){
      if(!state?.tasks?.[item.kind] || item.runId!==state.id || typeof item.message!=='string'
        || !['running','finished','attention'].includes(item.phase) || !Number.isFinite(item.updatedAt))continue;
      if(item.updatedAt>=state.tasks[item.kind].updatedAt)state.tasks[item.kind]={phase:item.phase,message:item.message.slice(0,1200),updatedAt:item.updatedAt};
    }
    render();
  }
  window.addEventListener('message',event=>{
    if(event.source===window && event.origin===location.origin)receiveStatus(event.data);
  });
  document.addEventListener('mwf-helper-status',event=>{
    if(typeof event.detail!=='string' || event.detail.length>20000)return;
    try{receiveStatus(JSON.parse(event.detail));}catch{}
  });
  function requestStatus(){
    const request={channel,type:'poll',runId:state?.id||'connection-check'};
    window.postMessage(request,location.origin);
    document.dispatchEvent(new CustomEvent('mwf-helper-poll',{detail:JSON.stringify(request)}));
  }
  function poll(){requestStatus();render();}
  setInterval(poll,1500);poll();
})();
