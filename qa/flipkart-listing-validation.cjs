const fs=require('node:fs'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/../userscripts/marketplace-reports-workflow-helper.user.js','utf8');
new Function(src);
const part=(a,b)=>src.slice(src.indexOf('  '+a),src.indexOf('  '+b));
const workflow=part('async function runFlipkartListingWorkflow()','async function generateFreshFlipkartListing()');
const poll=part('async function waitForFlipkartListing(','async function runFlipkartListingWorkflow()');
(async()=>{
 for(const mode of ['ready','pending','empty']){
  let clicked=0,generated=0,waited=0;
  const run=new Function('openFlipkartHistory','wait','flipkartListingRows','flipkartPendingListingRows','waitForFlipkartListing','flipkartListingKey','clickFlipkartListingDownload','generateFreshFlipkartListing',workflow+'return runFlipkartListingWorkflow;')(async()=>{},async()=>{},()=>mode==='empty'?[]:[{key:'old.xls'}],()=>mode==='pending'?[{key:'new.xls'}]:[],async()=>{waited++},r=>r.key,()=>{clicked++},async()=>{generated++});
  await run();assert.equal(clicked,mode==='ready'?1:0);assert.equal(generated,mode==='empty'?1:0);assert.equal(waited,mode==='pending'?1:0);
 }
 let now=0,clicks=0,iteration=0;
 const run=new Function('Date','setStatus','flipkartListingRows','flipkartListingKey','clickFlipkartListingDownload','wait',poll+'return waitForFlipkartListing;')({now:()=>now},()=>{},()=>iteration?[{key:'old.xls'},{key:'new.xls'}]:[{key:'old.xls'}],r=>r.key,()=>{clicks++},async()=>{iteration++;now+=2500;});
 await run(new Set(['old.xls']),['new.xls']);assert.equal(clicks,1);
 const timeout=new Function('Date','setStatus','flipkartListingRows','flipkartListingKey','clickFlipkartListingDownload','wait',poll+'return waitForFlipkartListing;')({now:()=>now},()=>{},()=>[{key:'old.xls'}],r=>r.key,()=>{throw Error('stale download')},async()=>{now+=20*60*1000;});
 await assert.rejects(timeout(new Set(['old.xls'])),/Timed out/);
 const generate=part('async function generateFreshFlipkartListing()','function sqlEditor()');
 assert(generate.includes('if (pending.length) return waitForFlipkartListing'));
 assert(!workflow.includes('listingSizeMb'));
 assert(!src.includes('Seller Hub does not expose the latest file size'));
 console.log('PASS ready file download; pending file wait; no duplicate generation; bounded polling; no stale file on timeout; no size gate; helper syntax.');
})().catch(e=>{console.error(e);process.exitCode=1;});
