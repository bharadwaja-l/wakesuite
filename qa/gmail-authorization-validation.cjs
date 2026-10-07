const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('work/release/WakeSuite/js/wakesuite-app.js','utf8');
const auth=app.slice(app.indexOf('function v4InvalidateGmailToken(){'),app.indexOf('function v4BytesToBase64('));
const old=fs.readFileSync('work/repeat-send/original-gmail-token.js','utf8');
const deliveryFile=fs.readFileSync('work/release/WakeSuite/js/wakesuite-v9.3.11.js','utf8');
const delivery=deliveryFile.slice(deliveryFile.indexOf('  async function gmailDeliver('),deliveryFile.indexOf('  async function preparePocRows('));
function runtime(code){
 let now=0;const state={clients:[],requests:0,mode:'success',token:0,timers:new Map(),nextTimer:0,fetches:[],statuses:[]};
 class DateStub extends Date{static now(){return now;}}
 const google={accounts:{oauth2:{initTokenClient(cfg){state.clients.push(cfg);return {requestAccessToken(){state.requests++;queueMicrotask(()=>{if(state.mode==='success')cfg.callback({access_token:'mock-token-'+(++state.token),expires_in:3600});else if(state.mode==='closed')cfg.error_callback?.({type:'popup_closed'});else if(state.mode==='blocked')cfg.error_callback?.({type:'popup_failed_to_open'});else if(state.mode==='oauth-error')cfg.callback({error:'access_denied'});else if(state.mode==='throw')throw Error('test');});}};}}}};
 const ctx=vm.createContext({Promise,Error,Number,Date:DateStub,google,GOOGLE_SHEETS_CLIENT_ID:'test',GMAIL_SCOPE_V4:'gmail.send',setTimeout:fn=>{const id=++state.nextTimer;state.timers.set(id,fn);return id;},clearTimeout:id=>state.timers.delete(id),buildMimeMulti:message=>JSON.stringify(message),fetch:async(url,opts)=>{state.fetches.push({url,opts});const status=state.statuses.shift()||200;return {status,ok:status===200,json:async()=>status===200?{id:'mock-message-'+state.fetches.length}:{error:{message:'Mock API rejection '+status}}};}});
 ctx.window=ctx;ctx.WakeSuiteRelease={clock:()=> '01:35 PM',stampedName:(name,time)=>name.replace(/(\.[^.]+)$/,'_'+time.replace(':','-').replace(' ','-')+'$1')};
 vm.runInContext('let gmailTokenClientV4=null,gmailAccessTokenV4="",gmailAccessTokenExpiresV4=0,gmailTokenRequestV4=null;\n'+code,ctx);
 return {ctx,state,advance:ms=>now+=ms};
}
async function within(p,ms=250){let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('pending')),ms))]);}finally{clearTimeout(timer);}}
(async()=>{
 const baseline=runtime(old);assert.equal(await baseline.ctx.v4GetGmailToken(),'mock-token-1');await assert.rejects(within(baseline.ctx.v4GetGmailToken(),100),/pending/);console.log('REPRODUCED: previous Gmail callback leaves second authorization unresolved');
 const fixed=runtime(auth+delivery);assert.equal(await fixed.ctx.v4GetGmailToken(),'mock-token-1');assert.equal(await fixed.ctx.v4GetGmailToken(),'mock-token-1');assert.equal(fixed.state.requests,1);console.log('PASS repeated sends reuse unexpired token without a new sign-in request');
 fixed.advance(3600000);const one=fixed.ctx.v4GetGmailToken(),two=fixed.ctx.v4GetGmailToken();assert.strictEqual(one,two);assert.equal(await one,'mock-token-2');assert.equal(await two,'mock-token-2');assert.equal(fixed.state.clients.length,2);console.log('PASS expired token refresh uses new callbacks; concurrent callers share one request');
 for(const [mode,pattern] of [['closed',/closed/],['blocked',/could not open/],['oauth-error',/access_denied/]]){
   fixed.ctx.v4InvalidateGmailToken();fixed.state.mode=mode;await assert.rejects(within(fixed.ctx.v4GetGmailToken()),pattern);fixed.state.mode='success';await within(fixed.ctx.v4GetGmailToken());
 }console.log('PASS popup close/block/OAuth rejection release the request and allow retry');
 fixed.ctx.v4InvalidateGmailToken();fixed.state.mode='silent';const timedOut=fixed.ctx.v4GetGmailToken();const rejected=assert.rejects(timedOut,/did not complete/);for(const fn of [...fixed.state.timers.values()])fn();await rejected;fixed.state.mode='success';await within(fixed.ctx.v4GetGmailToken());console.log('PASS authorization timeout releases the request and allows retry');
 for(const subject of ['Individual POC','All POC','Individual POC again'])await within(fixed.ctx.gmailDeliver({to:['test@example.test'],subject,html:'Mock test'}));assert.equal(fixed.state.fetches.length,3);console.log('PASS shared real delivery gateway completes repeated individual/combined requests');
 const before=fixed.state.fetches.length;fixed.state.statuses=[401,200];await within(fixed.ctx.gmailDeliver({to:['test@example.test'],subject:'401 recovery',html:'test'}));assert.equal(fixed.state.fetches.length,before+2);assert.notEqual(fixed.state.fetches[before].opts.headers.Authorization,fixed.state.fetches[before+1].opts.headers.Authorization);console.log('PASS one explicit Gmail 401 refreshes the token and retries once');
 fixed.state.statuses=[500];const count=fixed.state.fetches.length;await assert.rejects(within(fixed.ctx.gmailDeliver({to:['test@example.test'],subject:'Do not duplicate',html:'test'})),/500/);assert.equal(fixed.state.fetches.length,count+1);console.log('PASS uncertain/API delivery failure is not automatically resent');
 fs.writeFileSync('work/repeat-send/validation.json',JSON.stringify({reproducedOldFailure:true,passed:['cached token reuse','expiry refresh','concurrent authorization','popup cancellation and blocked popup recovery','OAuth rejection recovery','authorization timeout recovery','repeated individual/combined gateway delivery','401 retry once','no retry on uncertain delivery'],liveGmailTested:false},null,2));
})().catch(e=>{console.error(e.stack);process.exit(1)});
