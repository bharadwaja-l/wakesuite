const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let code=fs.readFileSync(__dirname+'/../userscripts/marketplace-reports-workflow-helper.user.js','utf8');
code=code.slice(0,code.indexOf("  if (location.hostname === 'sellercentral.amazon.in' && location.pathname.startsWith('/business-reports'))"));
code+=`globalThis.api={amazonEditableDateFields,sqlResultsMatchExpected,sqlQueryMatchesExpected,sqlResultHeaders,selectVisibleOption,bridgeRun,bridgeKind};})();`;
let elements=[],headers=[],formValue='';
const input=value=>({tagName:'INPUT',type:'text',value,placeholder:'DD/MM/YYYY',getClientRects:()=>[1],getRootNode:()=>({}),getAttribute:()=>null});
const table={querySelectorAll:()=>headers.map(value=>({innerText:value,getAttribute:()=>null,querySelector:()=>null}))};
class Select {set value(value){this._value=value;}get value(){return this._value;}get selectedOptions(){return this.options.filter(option=>option.value===this.value);}}
const ctx={HTMLSelectElement:Select,Event:class{},setTimeout:fn=>fn(),URLSearchParams,URL,Date,Intl,getComputedStyle:()=>({visibility:'visible'}),setInterval(){},
 location:{origin:'https://reports.wakefit.co',hostname:'reports.wakefit.co',pathname:'/explorer/play/',search:''},
 document:{querySelectorAll:()=>elements,querySelector:selector=>selector==='#nav-preview table'?table:selector==='#id_sql'?{value:formValue}:null},
 sessionStorage:{getItem:()=>JSON.stringify({startedAt:Date.now(),runId:'test-sql-refresh',kind:'sql'})},
 GM_setValue(){}};
vm.runInNewContext(code,ctx);const api=ctx.api;
assert.equal(api.bridgeRun,'test-sql-refresh');assert.equal(api.bridgeKind,'sql','SQL refresh must retain its Data Center task identity');
elements=[input('17/09/2026'),input('17/10/2026')];assert.equal(api.amazonEditableDateFields().length,2,'native date fields must be found');
const child=input('17/10/2026');const root={querySelector:()=>child,querySelectorAll:()=>[child]};child.getRootNode=()=>root;
const host={tagName:'KAT-INPUT',shadowRoot:root,getClientRects:()=>[1],getAttribute:key=>key==='placeholder'?'DD/MM/YYYY':null};
elements=[host];assert.equal(api.amazonEditableDateFields().length,1,'Katal host and shadow input must not count twice');
headers=['#','scm_master_category ↑','item_sku','mrp','sale_price','active'];assert.equal(api.sqlResultsMatchExpected(),true,'row-number header and sort arrow must not reject the correct query');
headers=['#','scm_master_category','item_sku','mrp','sale_price','stock'];assert.equal(api.sqlResultsMatchExpected(),false,'a different result schema must still block export');
elements=[];formValue='SELECT scm_master_category, item_sku, mrp, sale_price, active FROM wf_products_pricing WHERE active = 1;';
assert.equal(api.sqlQueryMatchesExpected(),true,'normal form SQL must verify even when the editable DOM is absent after refresh');
formValue='SELECT scm_master_category, item_sku, mrp, sale_price, active FROM wf_products_pricing WHERE active = 0;';
assert.equal(api.sqlQueryMatchesExpected(),false,'same result headers must not accept a different query');
const datePattern=fs.readFileSync(__dirname+'/../userscripts/marketplace-reports-workflow-helper.user.js','utf8').match(/await selectVisibleOption\(dateRange, (\/.*?\/)\);/)[1];
const pattern=vm.runInNewContext(datePattern);
const rangeHost=new Select();rangeHost.tagName='SELECT';rangeHost.options=[{textContent:'Date range: Last day',value:'today'},{textContent:'Date range: Last 30 days',value:'30'},{textContent:'Exact dates',value:'custom'}];rangeHost.value='today';rangeHost.dispatchEvent=()=>{};
api.selectVisibleOption(rangeHost,pattern).then(()=>{assert.equal(rangeHost.value,'custom');console.log('PASS portal regressions: native/shadow dates, SQL row header, wrong-schema/query rejection, form SQL verification after refresh, SQL run identity and Amazon Exact dates option selection.');}).catch(error=>{console.error(error);process.exitCode=1;});
