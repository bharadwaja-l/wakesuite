/* Read-only Data Center snapshot coverage. Never loads or processes report rows. */
(function(){
  const sources={wakefit:'Wakefit Daily Pricing',amazonListings:'Amazon All Listings',amazonFba:'Amazon FBA Inventory',amazonBusiness:'Amazon Business Reports',amazonOrders:'Amazon Order Report',flipkartListing:'Flipkart Listing File',flipkartOrders:'Flipkart Order Report',audit:'Shared Audit Report'};
  const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function status(meta,date,today,source='all'){
    if(!meta)return date>today?'Future':'Missing';
    if(meta.status!=='completed')return meta.status==='processing'?'Processing':'Incomplete';
    if(source!=='all')return meta.sourceAvailability?.[source]===true?'Stored':meta.sourceAvailability?.[source]===false?'Missing':'Unknown';
    return meta.dataStatus==='complete'?'Stored':meta.dataStatus==='partial'?'Partial':'Unknown';
  }
  window.WakeSuiteDataCalendar={status};
  const host=document.getElementById('dataCenterCalendar');
  if(!host)return;
  let month=iso(new Date()).slice(0,7),selected=iso(new Date()),metas=new Map(),loaded=false,busy=false,request=0;
  host.innerHTML='<div class="panel-title-row"><h2>Data Availability Calendar</h2><button type="button" class="secondary-btn" data-cal-refresh>Refresh</button></div><div class="ws-cal-controls"><button type="button" class="secondary-btn" data-cal-prev aria-label="Previous month">‹</button><label>Month <input type="month" data-cal-month aria-label="Calendar month"></label><button type="button" class="secondary-btn" data-cal-next aria-label="Next month">›</button><label>Source <select data-cal-source aria-label="Calendar source"><option value="all">All sources</option></select></label></div><p data-cal-message role="status"></p><div class="ws-cal-grid" data-cal-grid></div><p class="ws-cal-legend">Stored · Partial · Missing · Processing · Incomplete · Unknown · Future</p><div data-cal-detail aria-live="polite"></div>';
  const find=s=>host.querySelector(s),source=find('[data-cal-source]');
  Object.entries(sources).forEach(([key,label])=>source.add(new Option(label,key)));
  function render(){
    find('[data-cal-month]').value=month;
    const grid=find('[data-cal-grid]');grid.replaceChildren();
    for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']){const el=document.createElement('strong');el.textContent=day;grid.append(el);}
    if(!loaded){find('[data-cal-detail]').textContent='';return;}
    const [year,m]=month.split('-').map(Number),first=new Date(year,m-1,1),count=new Date(year,m,0).getDate(),today=iso(new Date()),totals={};
    for(let i=0;i<first.getDay();i++)grid.append(document.createElement('span'));
    for(let day=1;day<=count;day++){
      const date=iso(new Date(year,m-1,day)),state=status(metas.get(date),date,today,source.value),button=document.createElement('button');
      totals[state]=(totals[state]||0)+1;
      button.type='button';button.className='ws-cal-day ws-cal-'+state.toLowerCase();button.classList.toggle('ws-cal-selected',date===selected);
      button.setAttribute('aria-label',date+': '+state);button.setAttribute('aria-pressed',String(date===selected));button.dataset.calDate=date;
      const n=document.createElement('strong'),label=document.createElement('span');n.textContent=day;label.textContent=state;button.append(n,label);grid.append(button);
    }
    find('[data-cal-message]').textContent=Object.entries(totals).map(([key,n])=>n+' '+key.toLowerCase()).join(' · ');
    detail();
  }
  function detail(){
    const box=find('[data-cal-detail]');box.replaceChildren();
    const title=document.createElement('h3');title.textContent=selected;box.append(title);
    const meta=metas.get(selected),note=document.createElement('p');
    note.textContent=meta?'Snapshot: '+status(meta,selected,iso(new Date()))+'. Source status reflects saved snapshot metadata.':selected>iso(new Date())?'Future date — no saved snapshot.':'No saved processed snapshot for this date.';
    box.append(note);
    if(!meta)return;
    const list=document.createElement('ul');
    Object.entries(sources).forEach(([key,label])=>{const li=document.createElement('li');const available=meta.sourceAvailability?.[key];li.textContent=label+': '+(available===true?'Available':available===false?'Missing':'Unknown');list.append(li);});box.append(list);
  }
  async function refresh(){
    const token=++request;
    if(!window.currentWakeSuiteAccess){loaded=false;metas.clear();render();find('[data-cal-message]').textContent='Sign in with approved WakeSuite access to view stored dates.';return;}
    if(typeof window.listDailySnapshotMetas!=='function'){find('[data-cal-message]').textContent='Data connection is not ready. Use Refresh when connected.';return;}
    busy=true;find('[data-cal-refresh]').disabled=true;find('[data-cal-message]').textContent='Loading saved dates…';
    try{
      const rows=await window.listDailySnapshotMetas();
      if(token!==request)return;
      metas=new Map(rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.reportDate||r.id||'')).map(r=>[r.reportDate||r.id,r]));loaded=true;render();
    }catch(e){if(token!==request)return;loaded=false;metas.clear();render();find('[data-cal-message]').textContent='Could not verify saved dates. '+(e.message||'Try Refresh.');}
    finally{if(token===request){busy=false;find('[data-cal-refresh]').disabled=false;}}
  }
  host.addEventListener('click',e=>{
    const date=e.target.closest('[data-cal-date]')?.dataset.calDate;
    if(date){selected=date;render();return;}
    if(e.target.closest('[data-cal-refresh]')){refresh();return;}
    const delta=e.target.closest('[data-cal-prev]')?-1:e.target.closest('[data-cal-next]')?1:0;
    if(delta){const [y,m]=month.split('-').map(Number);month=iso(new Date(y,m-1+delta,1)).slice(0,7);render();}
  });
  find('[data-cal-month]').addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){month=e.target.value;render();}});
  source.addEventListener('change',render);
  const section=document.getElementById('uploadSection');
  new MutationObserver(()=>{if(section.classList.contains('active'))refresh();}).observe(section,{attributes:true,attributeFilter:['class']});
  render();
  if(section.classList.contains('active'))refresh();
  refresh=window.WakeSuiteLoading.wrap(refresh);
})();
