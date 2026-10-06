/* Amazon PriceAndQuantity.xlsm adapter contract */
(function(){
  const adapter={
    asset:'./assets/PriceAndQuantity.xlsm',sheet:'Template',
    columns:{sku:'SKU',price:'Your Price INR (Sell on Amazon, IN)',mrp:'Maximum Retail Price (Sell on Amazon, IN)',minSap:'Minimum Seller Allowed Price (Sell on Amazon, IN)',maxSap:'Maximum Seller Allowed Price (Sell on Amazon, IN)'},
    targets:{price:r=>r.wfPrice,mrp:r=>r.wfMrp,minSap:(r,pct=5)=>Math.round(Number(r.listingPrice||0)*(1-pct/100)*100)/100,maxSap:r=>r.wfMrp}
  };
  window.WakeSuiteAmazonUpdateAdapter=adapter;window.WakeSuiteModules?.register('amazonPriceUpdateAdapter',adapter);
})();
