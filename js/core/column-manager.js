/* WakeSuite V9.3 · reusable table column preferences */
(function(){
  const defs=new Map();
  function userKey(){const u=window.wakeSuiteFirebase?.auth?.currentUser;return u?.uid||u?.email||'local';}
  function storageKey(key,suffix='visible'){return `WakeSuite.Columns.${userKey()}.${key}.${suffix}`;}
  function normalizeColumns(cols){return (cols||[]).map((c,i)=>typeof c==='string'?{key:c,label:c,index:i}:{index:i,...c,key:c.key||c.label||String(i),label:c.label||c.key||String(i)});}
  function load(key,cols,defaults){try{const v=JSON.parse(localStorage.getItem(storageKey(key))||'null');if(Array.isArray(v))return v.filter(x=>cols.some(c=>c.key===x));const d=JSON.parse(localStorage.getItem(storageKey(key,'default'))||'null');if(Array.isArray(d))return d.filter(x=>cols.some(c=>c.key===x));}catch(_){}return (defaults?.length?defaults:cols.map(c=>c.key)).filter(Boolean);}
  function register(key,columns,defaults,containerId,onChange){const cols=normalizeColumns(columns);const def={key,cols,defaults:defaults||cols.map(c=>c.key),containerId,onChange,visible:load(key,cols,defaults)};defs.set(key,def);render(key);apply(key);return def;}
  function render(key){const d=defs.get(key);if(!d)return;const host=document.getElementById(d.containerId||`${key}Columns`);if(!host)return;host.innerHTML=`<div class="column-picker-grid">${d.cols.map(c=>`<label><input type="checkbox" data-ws-col-key="${escapeHtmlSafe(c.key)}" ${d.visible.includes(c.key)?'checked':''}> ${escapeHtmlSafe(c.label)}</label>`).join('')}</div>`;host.querySelectorAll('[data-ws-col-key]').forEach(cb=>cb.addEventListener('change',()=>{d.visible=[...host.querySelectorAll('[data-ws-col-key]:checked')].map(x=>x.dataset.wsColKey);persist(key);apply(key);d.onChange?.(d.visible);}));}
  function apply(key){const d=defs.get(key);if(!d)return;const table=document.querySelector(`[data-ws-column-table="${CSS.escape(key)}"]`)||document.getElementById(d.tableId||({pricingHistory:'pricingHistoryTable',inventoryHistory:'inventoryHistoryTable',priceParity:'priceParityTable',revenueImpact:'revenueImpactTable',suppressionManagement:'suppressionManagementTable',historyHub:'historyHubTable',dataAdminAudit:'dataAdminAuditTable',exceptionManager:'v93ExceptionTable',marketplaceData:'marketplaceDataTable'}[key]||''));if(!table)return;const visible=new Set(d.visible);[...table.rows].forEach(row=>[...row.cells].forEach((cell,i)=>{const col=d.cols[i];if(col)cell.style.display=visible.has(col.key)?'':'none';}));}
  function persist(key){const d=defs.get(key);if(!d)return;localStorage.setItem(storageKey(key),JSON.stringify(d.visible));}
  function setVisible(key,vals){const d=defs.get(key);if(!d)return;d.visible=vals.filter(v=>d.cols.some(c=>c.key===v));persist(key);render(key);apply(key);d.onChange?.(d.visible);}
  function selectAll(k){const d=defs.get(k);if(d)setVisible(k,d.cols.map(c=>c.key));}
  function clearAll(k){const d=defs.get(k);if(d)setVisible(k,[]);}
  function setDefault(k){const d=defs.get(k);if(!d)return;localStorage.setItem(storageKey(k,'default'),JSON.stringify(d.visible));window.showWakeSuiteToast?.('Column default saved.','success');}
  function restoreDefault(k){const d=defs.get(k);if(!d)return;let val=d.defaults;try{val=JSON.parse(localStorage.getItem(storageKey(k,'default'))||'null')||d.defaults;}catch(_){}setVisible(k,val);}
  function visible(k){return defs.get(k)?.visible||[];}
  function escapeHtmlSafe(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  window.WakeSuiteColumns={register,render,apply,selectAll,clearAll,setDefault,restoreDefault,visible,setVisible,defs};
})();
