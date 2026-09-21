/* Flipkart latest-listing CSV adapter contract */
(function(){
  const adapter={aliases:{sku:['Seller SKU Id','Seller SKU ID','SKU'],price:['Your Selling Price','Selling Price'],mrp:['MRP'],fsn:['FSN']},output:'csv',targets:{price:r=>r.wfPrice,mrp:r=>r.wfMrp}};
  window.WakeSuiteFlipkartUpdateAdapter=adapter;window.WakeSuiteModules?.register('flipkartPriceUpdateAdapter',adapter);
})();
