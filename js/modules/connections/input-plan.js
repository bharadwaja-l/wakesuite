'use strict';
function expand(row,market){
 if(!Array.isArray(row))return row;
 return {category:row[0],wfSku:row[1],identifier:row[3],wfMrp:row[4],wfPrice:row[5],listingPrice:row[7],inventory:row[9],...(market==='amazon'?{asin:row[3]}:{fsn:row[3]})};
}
function eligibleInputs(groups){
 const bySku=new Map(),skipped={missingPrice:0,outOfStock:0,missingIdentifier:0,conflictingPrice:0};
 for(const market of ['amazon','flipkart'])for(const raw of groups[market==='amazon'?'amazonRows':'flipkartRows']||[]){
  const row=expand(raw,market),sku=String(row.wfSku||'').trim(),id=String(row[market==='amazon'?'asin':'fsn']||row.identifier||'').trim();
  if(!sku||!id){skipped.missingIdentifier++;continue;}
  if(!(Number(row.inventory)>0)||row.active===false||['inactive','archived'].includes(String(row.status||'').toLowerCase())){skipped.outOfStock++;continue;}
  const price=Number(row.wfPrice),mrp=Number(row.wfMrp);
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(mrp)||mrp<=0){skipped.missingPrice++;continue;}
  if(!bySku.has(sku))bySku.set(sku,{sku,category:String(row.category||''),price,mrp,amazon:new Set(),flipkart:new Set(),conflict:false});
  const item=bySku.get(sku);if(item.price!==price||item.mrp!==mrp)item.conflict=true;
  item[market].add(id);
 }
 const rows=[];
 for(const item of [...bySku.values()].sort((a,b)=>a.sku.localeCompare(b.sku))){
  if(item.conflict){skipped.conflictingPrice++;continue;}
  const asins=[...item.amazon].sort(),fsns=[...item.flipkart].sort();
  for(let i=0;i<Math.max(asins.length,fsns.length);i++)rows.push([item.category,asins[i]||'',fsns[i]||'',item.sku,item.price,item.mrp]);
 }
 return {rows,skipped};
}
const key=row=>[row[1],row[2],row[3]].map(v=>String(v??'').trim()).join('|');
function planInputUpdates(existing,eligible){
 const expected=['Category','ASIN','FSN','WF Item SKU','WF Price','WF MRP'];
 if(expected.some((h,i)=>String(existing[0]?.[i]||'').trim()!==h))throw Error('Input columns A:F do not match the verified contract.');
 if(!eligible.length)throw Error('No eligible priced, in-stock SKUs. Existing inputs were left unchanged.');
 const wanted=new Map(eligible.map(row=>[key(row),row])),seen=new Set(),updates=[];let cleared=0,retained=0;
 for(let i=1;i<existing.length;i++){
  const row=existing[i]||[];
  if(row.slice(0,6).some(v=>typeof v==='string'&&v.startsWith('=')))throw Error('Input columns contain formulas. Nothing will be overwritten.');
  if(!row.slice(0,6).some(v=>v!==''&&v!=null))continue;
  const k=key(row),desired=wanted.get(k);
  if(desired&&!seen.has(k)){updates.push({row:i+1,values:desired});seen.add(k);retained++;}
  else{updates.push({row:i+1,values:['','','','','','']});cleared++;}
 }
 let next=existing.length+1;
 for(const [k,row]of wanted)if(!seen.has(k))updates.push({row:next++,values:row});
 return {updates,retained,cleared,appended:wanted.size-seen.size,requiredRows:Math.max(existing.length,next-1)};
}
if(typeof module!=='undefined'&&module.exports)module.exports={eligibleInputs,planInputUpdates,expand};
else window.WakeSuiteInputPlan={eligibleInputs,planInputUpdates,expand};
