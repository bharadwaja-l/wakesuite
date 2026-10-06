/* WakeSuite V9.2 suppression lifecycle presentation */
(function(){
  const days=(a,b)=>{if(!a||!b)return null;const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return Math.max(1,Math.floor((y-x)/86400000)+1)};
  const esc=s=>typeof window.escapeHtml==='function'?window.escapeHtml(s??''):String(s??'');
  const money=n=>typeof window.formatINR==='function'?window.formatINR(n):String(n??0);
  function lifecycle(r){const first=r.firstSeen||r.firstDetected||r.detectedDate||'',last=r.lastSeen||r.lastDetected||first,state=typeof window.ws91SuppressionState==='function'?window.ws91SuppressionState(r):(r.status==='Closed'?'Closed':'Active');return {...r,firstSeen:first,lastSeen:last,ageDays:days(first,last),resolvedOn:r.resolvedOn||r.closedOn||'',currentState:state};}
  const baseRender=window.renderSuppressionManagement;
  window.renderSuppressionManagement=function(){
    if(!document.getElementById('suppressionManagementTable'))return baseRender?.();
    const rows=(window.v7SuppressionCases||[]).map(lifecycle);window.v7SuppressionCases=rows;
    if(typeof baseRender==='function')baseRender();
    const table=document.getElementById('suppressionManagementTable');if(!table||!rows.length)return;
    // Add lifecycle data without overloading every operational timestamp.
    const head=table.querySelector('thead tr');if(head&&!head.textContent.includes('First Seen')){
      const th1=document.createElement('th');th1.textContent='First Seen';const th2=document.createElement('th');th2.textContent='Last Seen';const th3=document.createElement('th');th3.textContent='Age';head.children[2]?.before(th1,th2,th3);
      [...table.querySelectorAll('tbody tr[data-case-id]')].forEach(tr=>{const r=rows.find(x=>String(x.id)===String(tr.dataset.caseId));if(!r)return;const a=document.createElement('td'),b=document.createElement('td'),c=document.createElement('td');a.textContent=r.firstSeen||'—';b.textContent=r.lastSeen||'—';c.textContent=r.ageDays?`${r.ageDays}d`:'—';tr.children[2]?.before(a,b,c);});
    }
  };
  window.toggleSuppressionMoreFilters=function(){const panel=document.getElementById('suppressionMoreFilters'),btn=document.getElementById('suppressionMoreFiltersButton');if(!panel)return;const opening=panel.hidden;panel.hidden=!opening;btn?.setAttribute('aria-expanded',String(opening));if(btn)btn.textContent=opening?'Less Filters':'More Filters';};
  window.WakeSuiteSuppressionLifecycle={lifecycle};window.WakeSuiteModules?.register('suppressionLifecycle',window.WakeSuiteSuppressionLifecycle);
})();
