const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Node{
 constructor(tag,text=''){this.tagName=tag;this.children=[];this.listeners={};this._text=text;this.style={};this.disabled=false;}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
 setAttribute(){}
 addEventListener(type,fn){this.listeners[type]=fn;}
}
const host=new Node('section'),section=new Node('section'),audit=new Node('section'),master=new Node('p');section.append(host);
const today='2026-10-19',state={columns:37,values:[['Category','ASIN','FSN','WF Item SKU','WF Price','WF MRP','WF EDD','amazon_timestamp','flipkart_selling_price','flipkart_buy_now_present'],
 ['Mattress','LOW-A','LOW-F','LOW',10,20,'LOW-EDD',today+' 08:00:00',11,'True'],['Mattress','HIGH-A','HIGH-F','HIGH',10,20,'HIGH-EDD',today+' 08:00:00',11,'True']],receipt:[]};
let backupWorks=true,allow=true;
const ctx={console,Date,Map,Set,Number,String,JSON,Promise,File,FINAL_VIEW_TITLES:{},sheetsAccessToken:'mock',GOOGLE_SHEETS_CLIENT_ID:'test',
 document:{getElementById:id=>id==='liveConnectionsPanel'?host:id==='liveAuditPanel'?audit:id==='masterPricingStatus'?master:null,createElement:tag=>new Node(tag)},
 v7HasAction:()=>allow,v7CurrentScopes:()=>({allData:true,marketplaces:['amazon','flipkart'],categories:['*']}),todayIso:()=>today,
 loadAllMasterPricing:async()=>{master.textContent='Loaded';},v8PersistUploadVersion:async()=>backupWorks?'backup':null};
ctx.window=ctx;
ctx.google={accounts:{oauth2:{initTokenClient:cfg=>({requestAccessToken:()=>cfg.callback({access_token:'write-token',expires_in:3600})})}}};
const snapshot={amazonRows:[{category:'Mattress',wfSku:'LOW',asin:'LOW-A',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:100,revenueAvailable:true},{category:'Mattress',wfSku:'HIGH',asin:'HIGH-A',wfPrice:10,wfMrp:20,inventory:1,asinRevenue:1000,revenueAvailable:true}],flipkartRows:[{category:'Mattress',wfSku:'LOW',fsn:'LOW-F',wfPrice:10,wfMrp:20,inventory:1},{category:'Mattress',wfSku:'HIGH',fsn:'HIGH-F',wfPrice:10,wfMrp:20,inventory:1}]};
ctx.listDailySnapshotMetas=async()=>[{reportDate:today,status:'completed',sourceAvailability:{wakefit:true},fingerprint:'fp',revision:1}];
ctx.loadDailySnapshot=async()=>snapshot;ctx.getDailySnapshotMeta=async()=>({status:'completed',fingerprint:'fp',revision:1});
let writes=0;
ctx.fetch=async(url,options={})=>{
 assert(String(url).startsWith('https://sheets.googleapis.com/'));let data={},input=options.body?JSON.parse(options.body):{};
 if(String(url).includes('?fields='))data={sheets:[{properties:{sheetId:743318554,title:'master_final_with_flipkart',gridProperties:{rowCount:100,columnCount:state.columns}}}],developerMetadata:state.receipt};
 else if(String(url).includes('/values:batchUpdate')){writes++;for(const update of input.data){const row=Number(update.range.match(/!A(\d+)/)[1])-1;state.values[row]||=[];update.values[0].forEach((v,i)=>state.values[row][i]=v);}}
 else if(String(url).includes(':batchUpdate')){
  writes++;
  for(const req of input.requests){
   if(req.appendDimension?.dimension==='COLUMNS')state.columns++;
   if(req.updateCells){const start=req.updateCells.range.startRowIndex,col=req.updateCells.range.startColumnIndex;req.updateCells.rows.forEach((r,i)=>{state.values[start+i]||=[];state.values[start+i][col]=r.values[0].userEnteredValue.numberValue;});}
   if(req.sortRange){const r=req.sortRange.range,col=req.sortRange.sortSpecs[0].dimensionIndex,rows=state.values.slice(r.startRowIndex,r.endRowIndex).sort((a,b)=>a[col]-b[col]);state.values.splice(r.startRowIndex,rows.length,...rows);}
   if(req.deleteDimension){state.values.forEach(r=>r.splice(req.deleteDimension.range.startIndex,1));state.columns--;}
   if(req.deleteDeveloperMetadata)state.receipt=[];
   if(req.createDeveloperMetadata)state.receipt=[{metadataId:1,...req.createDeveloperMetadata.developerMetadata}];
  }
 }else if(String(url).includes('/values/'))data={values:JSON.parse(JSON.stringify(state.values))};
 else throw Error('Unexpected Sheet request');
 return {ok:true,status:200,json:async()=>data};
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../js/modules/connections/input-plan.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(__dirname+'/../js/modules/connections/live-connections.js','utf8'),ctx);
const descendants=n=>[n,...n.children.flatMap(descendants)],button=text=>descendants(host).find(n=>n.tagName==='button'&&n.textContent===text);
(async()=>{
 assert(section.children.includes(audit));
 await button('Refresh status').listeners.click();assert(host.textContent.includes('2 WF SKUs'));assert.equal(master.textContent,'Loaded');
 await button('Preview latest inputs').listeners.click();assert(host.textContent.includes('highest first'));assert.equal(writes,0);
 backupWorks=false;await button('Manual Update').listeners.click();assert(host.textContent.includes('Local backup could not be verified'));assert.equal(writes,0);
 backupWorks=true;await button('Manual Update').listeners.click();
 assert(host.textContent.includes('Manual Update complete'),host.textContent.slice(-1500));
 assert.equal(state.values[1][3],'HIGH');assert.equal(state.values[1][6],'HIGH-EDD');assert.equal(state.values[2][3],'LOW');assert.equal(state.values[2][6],'LOW-EDD');assert.equal(state.columns,37);assert.equal(state.receipt.length,1);
 const count=writes;allow=false;await button('Manual Update').listeners.click();assert.equal(writes,count);assert(host.textContent.includes('Upload permission'));
 console.log('PASS actual connections UI handlers: live stats, preview, backup-before-write, manual update, whole-row revenue ordering, output alignment, temp-column cleanup, receipt and permission checks. All external access mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
