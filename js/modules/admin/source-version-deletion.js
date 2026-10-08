/* Source-version deletion: retain surviving copies and independent pricing. */
(function(){
  'use strict';
  const RULE='SOURCE_VERSION_DELETION_V1';
  const isFkOrder=id=>['flipkart_order_report','flipkart_orders'].includes(id);
  const successful=v=>!v.status||v.status==='successful';
  const bytes=v=>v instanceof ArrayBuffer?new Uint8Array(v):ArrayBuffer.isView(v)?new Uint8Array(v.buffer,v.byteOffset,v.byteLength):null;
  function equalBytes(a,b){a=bytes(a);b=bytes(b);if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
  async function state(chosen){
    const db=await openWakeSuiteDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['report_versions','raw_files','reports'],'readonly'),out={report_versions:[],raw_files:[],reports:[]},selected=new Set(chosen.map(v=>v.versionId));
      // Read only affected groups and their active/replacement bytes. Historical
      // raw files can be large and must not all be loaded to remove one duplicate.
      for(const dateConfig of new Set(chosen.map(v=>`${v.reportDate}::${v.configId}`))){
        const q=tx.objectStore('report_versions').index('dateConfig').getAll(dateConfig);
        q.onsuccess=()=>{
          const versions=q.result||[];out.report_versions.push(...versions);
          const record=tx.objectStore('reports').get(dateConfig);
          record.onsuccess=()=>{
            if(record.result)out.reports.push(record.result);
            const all=versions.filter(successful).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)),active=all.find(v=>v.versionId===record.result?.record?.versionId)||all[0],next=all.find(v=>!selected.has(v.versionId));
            for(const id of new Set([active?.versionId,next?.versionId].filter(Boolean))){const raw=tx.objectStore('raw_files').get(id);raw.onsuccess=()=>{if(raw.result)out.raw_files.push(raw.result);};}
          };
        };
      }
      tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Source read cancelled.'));
    });
  }
  async function promotedRecord(version,raw,current){
    if(version.record?.parsedFile?.rows)return {...version.record,versionId:version.versionId,file:null};
    if(!raw?.bytes)throw new Error('The remaining source version has no readable local file. Re-upload it before deleting the active version.');
    const file=new File([raw.bytes],version.fileName||'source.xlsx',{type:raw.mimeType||'',lastModified:version.lastModified||0});
    const parsedFile=await readWakeSuiteFile(file,REPORT_DEFINITIONS[version.configId]||null);
    const headers=parsedFile.headers||[],expected=REPORT_DEFINITIONS[version.configId];
    if(expected&&(expected.requiredHeaders||[]).some(h=>!headers.some(x=>canonicalHeader(x)===canonicalHeader(h))))throw new Error('The remaining source file failed header validation. Re-upload the correct file before deleting this version.');
    return {...(current||{}),reportDate:version.reportDate,configId:version.configId,versionId:version.versionId,file:null,fileName:version.fileName,fileSize:version.fileSize,lastModified:version.lastModified||0,parsedFile,coverageFrom:version.coverageFrom||null,coverageTo:version.coverageTo||null,coverageDays:version.coverageDays||null,auditSummary:version.configId==='marketplace_audit_report'?processAuditReport(parsedFile):null,businessSummary:version.configId==='amazon_business_reports'?processBusinessReport(parsedFile,version.coverageDays||DEFAULT_AMAZON_BUSINESS_REPORT_DAYS):null};
  }
  async function plan(chosen){
    const data=await state(chosen),selected=new Set(chosen.map(v=>v.versionId)),plans=[];
    const raw=new Map(data.raw_files.map(r=>[r.versionId,r]));
    const groups=new Map();for(const v of chosen){const k=`${v.reportDate}::${v.configId}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(v);}
    for(const [dateConfig,deletions] of groups){
      const sample=deletions[0],all=data.report_versions.filter(v=>v.reportDate===sample.reportDate&&v.configId===sample.configId&&successful(v)).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
      if(deletions.some(v=>!all.some(x=>x.versionId===v.versionId)))throw new Error('A selected source version changed. Reload the versions before deleting.');
      const current=data.reports.find(r=>r.key===dateConfig)?.record;
      const active=(current?.versionId&&all.find(v=>v.versionId===current.versionId))||all[0],remaining=all.filter(v=>!selected.has(v.versionId)),next=remaining[0]||null;
      const sameCoverage=!!next&&['coverageFrom','coverageTo','coverageDays'].every(k=>String(active?.[k]??'')===String(next[k]??''));
      const activeDeleted=!!active&&selected.has(active.versionId),duplicate=activeDeleted&&sameCoverage&&equalBytes(raw.get(active.versionId)?.bytes,raw.get(next.versionId)?.bytes);
      let replacement=current;
      if(activeDeleted&&next){replacement=duplicate&&current?.parsedFile?.rows?{...current,versionId:next.versionId,file:null,fileName:next.fileName,fileSize:next.fileSize,lastModified:next.lastModified||0,parsedFile:{...current.parsedFile,fileName:next.fileName,fileSize:next.fileSize}}:await promotedRecord(next,raw.get(next.versionId),current);}
      if(activeDeleted&&!next)replacement=null;
      const invalidate=activeDeleted&&!duplicate;
      plans.push({dateConfig,reportDate:sample.reportDate,configId:sample.configId,deletions,activeId:active?.versionId||'',activeDeleted,remainingId:(activeDeleted?next:active)?.versionId||'',duplicate,replacement,invalidate,effect:!invalidate?'Remaining active source and processed results retained':isFkOrder(sample.configId)?'Pricing/parity retained; order calculations need refresh':'Dependent processed outputs invalidated'});
    }
    return plans;
  }
  async function commitLocal(plan){
    const db=await openWakeSuiteDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['report_versions','raw_files','reports'],'readwrite');
      for(const version of plan.deletions){tx.objectStore('report_versions').delete(version.versionId);tx.objectStore('raw_files').delete(version.versionId);}
      if(plan.activeDeleted){
        if(plan.replacement)tx.objectStore('reports').put({key:plan.dateConfig,reportDate:plan.reportDate,configId:plan.configId,record:plan.replacement});
        else tx.objectStore('reports').delete(plan.dateConfig);
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Source deletion cancelled.'));
    });
    window.__wakeSuiteAllReportsCache=null;
    const session=window.wakeSuiteSessionReports?.[plan.configId];
    if(plan.activeDeleted&&session?.reportDate===plan.reportDate){if(plan.replacement)window.wakeSuiteSessionReports[plan.configId]=plan.replacement;else delete window.wakeSuiteSessionReports[plan.configId];}
  }
  const basePersist=v8PersistUploadVersion;
  v8PersistUploadVersion=async function(date,id,file,record){
    const versionId=await basePersist(date,id,file,record);if(!versionId)return versionId;
    const db=await openWakeSuiteDb(),saved={...record,file:null,versionId,fileName:file.name,fileSize:file.size,lastModified:file.lastModified||0};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('reports','readwrite');
      tx.objectStore('reports').put({key:`${date}::${id}`,reportDate:date,configId:id,record:saved});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });window.__wakeSuiteAllReportsCache=null;return versionId;
  };
  // Older partial snapshots may have lost FK chunks while retaining an unchanged
  // fingerprint. The next explicit upload must rebuild them, not reload emptiness.
  const baseFingerprint=buildInputFingerprint;
  buildInputFingerprint=function(date){return `${baseFingerprint(date)}::${RULE}`;};
  window.WakeSuiteSourceDeletion={plan,commitLocal,equalBytes,isFkOrder,RULE};
})();
