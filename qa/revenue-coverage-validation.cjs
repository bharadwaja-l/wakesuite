const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=fs.readFileSync(__dirname+'/../js/wakesuite-app.js','utf8');
const ctx={Date,Map,Set,window:{},document:{getElementById:()=>null}};vm.createContext(ctx);
vm.runInContext(core.slice(core.indexOf('function v936InclusiveDays('),core.indexOf('function v936OrderCoverageFromRows(')),ctx);
vm.runInContext(core.slice(core.indexOf('function resolveAmazonRevenueDays('),core.indexOf('function updateBusinessDaysVisibility(){',core.indexOf('function resolveAmazonRevenueDays('))),ctx);
vm.runInContext(core.slice(core.indexOf('function v4BuildAmazonIssueRows('),core.indexOf('/* ---------- Amazon modular result ---------- */')),ctx);
const current={coverageFrom:'2026-09-19',coverageTo:'2026-10-18',businessReportDays:60};
assert.equal(ctx.resolveAmazonRevenueDays(current),30);
assert.equal(ctx.resolveAmazonRevenueDays({businessReportDays:60}),60);
assert.equal(ctx.resolveAmazonRevenueDays({businessSummary:{reportDays:60}}),60);
assert.throws(()=>ctx.resolveAmazonRevenueDays({}),/unknown/);
assert.throws(()=>ctx.resolveAmazonRevenueDays({coverageFrom:'2026-10-18'}),/valid/);
const rows=[{asin:'A',listingPrice:100},{asin:'A',listingPrice:110}],map=new Map([['A',{revenue:60000}]]);
for(const [days,expected]of [[30,2000],[60,1000]]){
 const out=ctx.v4BuildAmazonIssueRows(rows,map,days,true,()=>true);assert.equal(out.length,1);assert.equal(out[0].revenueImpactPerDay,expected);
}
assert(!core.includes('Number(businessReport.businessReportDays)||DEFAULT_AMAZON_BUSINESS_REPORT_DAYS'));
assert(!core.includes('Number(businessReport.businessReportDays) || DEFAULT_AMAZON_BUSINESS_REPORT_DAYS'));
console.log('PASS 30/60-day normalization, coverage precedence, legacy recorded periods, unknown/invalid rejection, ASIN deduplication and suppression/Buy Box daily impact.');
