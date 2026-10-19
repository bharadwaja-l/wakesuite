'use strict';
const {GoogleAuth}=require('google-auth-library');
const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore,FieldPath}=require('firebase-admin/firestore');
const {eligibleInputs,planInputUpdates,revenueSortRequests}=require('../../js/modules/connections/input-plan.js');
const projectId='wakesuite-4daf9',sheetId='1KeVVOLASOsHO5Efgf4IVsNWDLD3X1SqsivExGbJ1Bms',tab='master_final_with_flipkart',tabId=743318554;
const backupTab='_Wakesuite_Input_Backup';
function unpack(packed){return Array.isArray(packed)?packed:Object.keys(packed||{}).sort().map(k=>packed[k]);}
async function main(){
 if(process.env.GITHUB_REPOSITORY_VISIBILITY!=='public')throw Error('Only free public-repository standard runners are supported.');
 const credentials=JSON.parse(process.env.WAKESUITE_EOD_SERVICE_ACCOUNT_JSON||'{}');
 if(credentials.project_id!==projectId||!credentials.client_email||!credentials.private_key)throw Error('A matching service-account secret is required.');
 const auth=new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/spreadsheets']});
 const client=await auth.getClient();
 const billing=await client.request({url:'https://cloudbilling.googleapis.com/v1/projects/'+projectId+'/billingInfo'});
 if(billing.data.billingEnabled!==false)throw Error('Zero-cost policy: Google Cloud billing is enabled or could not be verified. No Firestore or Sheet operation was started.');
 initializeApp({credential:cert(credentials),projectId});const db=getFirestore();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let cursor=null,source=null;
 while(!source){
  let q=db.collection('daily_snapshots').where(FieldPath.documentId(),'<=',today).orderBy(FieldPath.documentId(),'desc').limit(20);if(cursor)q=q.startAfter(cursor);
  const page=await q.get();if(page.empty)throw Error('No completed Wakesuite snapshot.');
  source=page.docs.find(d=>d.data().status==='completed');cursor=page.docs.at(-1);
 }
 const meta=source.data();if(!meta.sourceAvailability?.wakefit)throw Error('Latest snapshot has no Wakefit pricing. Inputs were not changed.');
 const groups={amazonRows:[],flipkartRows:[]};
 const collections=meta.schemaVersion==='v7'&&Array.isArray(meta.scopeKeys)?meta.scopeKeys.map(id=>source.ref.collection('scopes').doc(id).collection('chunks')):[source.ref.collection('chunks')];
 for(const col of collections){
  const snap=await col.get();
  for(const c of snap.docs.map(d=>d.data()).sort((a,b)=>Number(a.index)-Number(b.index)))if(Object.hasOwn(groups,c.type))groups[c.type].push(...unpack(c.rows));
 }
 async function sheets(path,method='GET',data){return (await client.request({url:'https://sheets.googleapis.com/v4/spreadsheets/'+sheetId+path,method,data})).data;}
 const metadata=await sheets('?fields=sheets(properties(sheetId,title,gridProperties)),developerMetadata');
 const sheet=metadata.sheets.find(s=>s.properties.sheetId===tabId)?.properties;if(!sheet||sheet.title!==tab)throw Error('Input tab contract changed.');
 const values=(await sheets('/values/'+encodeURIComponent("'"+tab+"'!A1:AK"+sheet.gridProperties.rowCount)+'?valueRenderOption=FORMULA')).values||[];
 const eligible=eligibleInputs(groups),plan=planInputUpdates(values,eligible.rows);
 if(plan.requiredRows>50000)throw Error('Reviewed sheet cleanup is required; no inputs changed.');
 function columnLabel(n){let result='';for(;n>0;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;}
 const backupColumns=sheet.gridProperties.columnCount+2,backupEnd=columnLabel(backupColumns),backupTime=new Date().toISOString();
 const backupRows=[['Source row',...Array.from({length:sheet.gridProperties.columnCount},(_,j)=>values[0]?.[j]??''),'Backup time'],...values.slice(1).map((r,i)=>[i+2,...Array.from({length:sheet.gridProperties.columnCount},(_,j)=>r[j]??''),backupTime])];
 const backup=metadata.sheets.find(s=>s.properties.title===backupTab)?.properties,requests=[];
 if(!backup)requests.push({addSheet:{properties:{title:backupTab,hidden:true,gridProperties:{rowCount:Math.max(1000,backupRows.length),columnCount:backupColumns}}}});
 else{
  if(backupRows.length>backup.gridProperties.rowCount)requests.push({appendDimension:{sheetId:backup.sheetId,dimension:'ROWS',length:backupRows.length-backup.gridProperties.rowCount}});
  if(backupColumns>backup.gridProperties.columnCount)requests.push({appendDimension:{sheetId:backup.sheetId,dimension:'COLUMNS',length:backupColumns-backup.gridProperties.columnCount}});
 }
 if(requests.length)await sheets(':batchUpdate','POST',{requests});
 await sheets('/values/'+encodeURIComponent("'"+backupTab+"'!A1:"+backupEnd+backupRows.length)+'?valueInputOption=RAW','PUT',{values:backupRows});
 const backupRead=(await sheets('/values/'+encodeURIComponent("'"+backupTab+"'!A1:"+backupEnd+backupRows.length)+'?valueRenderOption=UNFORMATTED_VALUE')).values||[];
 if(backupRows.some((r,i)=>r.some((v,j)=>String(backupRead[i]?.[j]??'')!==String(v))))throw Error('Full-row backup verification failed; no input write started.');
 const fresh=(await source.ref.get()).data();
 if(fresh.status!=='completed'||fresh.fingerprint!==meta.fingerprint||fresh.revision!==meta.revision)throw Error('Snapshot changed; no input write started.');
 if(plan.requiredRows>sheet.gridProperties.rowCount)await sheets(':batchUpdate','POST',{requests:[{appendDimension:{sheetId:tabId,dimension:'ROWS',length:plan.requiredRows-sheet.gridProperties.rowCount}}]});
 for(let i=0;i<plan.updates.length;i+=400)await sheets('/values:batchUpdate','POST',{valueInputOption:'RAW',data:plan.updates.slice(i,i+400).map(u=>({range:"'"+tab+"'!A"+u.row+':F'+u.row,values:[u.values]}))});
 const after=(await sheets('/values/'+encodeURIComponent("'"+tab+"'!A1:F"+plan.requiredRows)+'?valueRenderOption=UNFORMATTED_VALUE')).values||[];
 if(plan.updates.some(u=>u.values.some((v,i)=>String(after[u.row-1]?.[i]??'')!==String(v))))throw Error('Input readback failed; restore the backup before retrying.');
 await sheets(':batchUpdate','POST',{requests:revenueSortRequests(plan,eligible.rows,sheet.gridProperties.columnCount,tabId)});
 const sorted=(await sheets('/values/'+encodeURIComponent("'"+tab+"'!A2:F"+(eligible.rows.length+1))+'?valueRenderOption=UNFORMATTED_VALUE')).values||[];
 if(eligible.rows.some((r,i)=>r.some((v,j)=>String(sorted[i]?.[j]??'')!==String(v))))throw Error('Revenue sort verification failed. Check the full-row backup.');
 const receipt={status:'completed',mode:'github-actions',completedAt:new Date().toISOString(),sourceReportDate:source.id,rows:eligible.rows.length,skipped:eligible.skipped,schedule:'18:30 Asia/Kolkata (GitHub may delay)',zeroCostBillingCheck:'disabled'};
 const receiptRequests=(metadata.developerMetadata||[]).filter(m=>m.metadataKey==='wakesuite_eod_sync').map(m=>({deleteDeveloperMetadata:{dataFilter:{developerMetadataLookup:{metadataId:m.metadataId}}}}));
 receiptRequests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:'wakesuite_eod_sync',metadataValue:JSON.stringify(receipt),visibility:'DOCUMENT',location:{spreadsheet:true}}}});
 await sheets(':batchUpdate','POST',{requests:receiptRequests});
 console.log('Verified input sync: '+eligible.rows.length+' rows; source date '+source.id+'. No source rows or credentials are logged.');
}
if(require.main===module)main().catch(()=>{console.error('EOD sync failed. No credentials or business data were printed. Check setup permissions and input backup before retrying.');process.exitCode=1;});
module.exports={main,unpack};
