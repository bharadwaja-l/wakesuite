const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../userscripts/marketplace-reports-workflow-helper.user.js','utf8');
const documentListeners={},windowListeners={},messages=[],domMessages=[],attrs={};
const ctx={URLSearchParams,Date,location:{origin:'https://bharadwaja-l.github.io',pathname:'/wakesuite/',search:''},
 GM_getValue:()=>null,GM_listValues:()=>[],GM_deleteValue(){},
 CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},
 document:{documentElement:{setAttribute:(key,value)=>attrs[key]=value},addEventListener:(key,fn)=>documentListeners[key]=fn,dispatchEvent:event=>domMessages.push(event)},
 window:{addEventListener:(key,fn)=>windowListeners[key]=fn,postMessage:value=>messages.push(value)}};
vm.runInNewContext(code,ctx);
assert.equal(attrs['data-mwf-helper-version'],'2.2.2');
documentListeners['mwf-helper-poll']({detail:'not-json'});assert.equal(messages.length,0);
documentListeners['mwf-helper-poll']({detail:JSON.stringify({channel:'wakesuite-marketplace-helper-v1',type:'poll',runId:'../bad'})});assert.equal(messages.length,0);
documentListeners['mwf-helper-poll']({detail:JSON.stringify({channel:'wakesuite-marketplace-helper-v1',type:'poll',runId:'connection-check'})});
assert.equal(messages.length,1);assert.equal(messages[0].version,'2.2.2');assert.equal(domMessages[0].type,'mwf-helper-status');assert.equal(JSON.parse(domMessages[0].detail).runId,'connection-check');
windowListeners.message({source:{},origin:ctx.location.origin,data:{channel:'wakesuite-marketplace-helper-v1',type:'poll',runId:'connection-check'}});assert.equal(messages.length,1);
console.log('PASS actual userscript bridge: installed marker, malformed request rejection, safe run IDs, DOM fallback reply, version and foreign-source rejection.');
