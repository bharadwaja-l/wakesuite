/* WakeSuite V9.2 source contracts. Header aliases live here so source changes stay local. */
(function(){
  const S={
    wakefit_daily_pricing:{label:'Wakefit Daily Pricing',requiredAny:[['sku','item sku','wf sku'],['price','selling price','wf price']],aliases:{wfSku:['sku','item sku','wf sku'],wfPrice:['price','selling price','wf price'],wfMrp:['mrp','wf mrp'],active:['active','status']}},
    amazon_all_listings:{label:'Amazon All Listings',requiredAny:[['seller-sku','seller sku','sku'],['asin1','asin']],aliases:{azSku:['seller-sku','seller sku','sku'],asin:['asin1','asin'],listingPrice:['price','your price'],quantity:['quantity'],status:['status'],minAllowedPrice:['minimum-seller-allowed-price','minimum allowed price'],maxAllowedPrice:['maximum-seller-allowed-price','maximum allowed price']}},
    amazon_fba_inventory:{label:'Amazon FBA Inventory',requiredAny:[['sku','seller-sku'],['afn-fulfillable-quantity','sellable']],aliases:{azSku:['sku','seller-sku'],sellable:['afn-fulfillable-quantity','sellable']}},
    amazon_business_reports:{label:'Amazon Business Reports',requiredAny:[['(child) asin','child asin'],['ordered product sales','sales']],aliases:{asin:['(child) asin','child asin'],revenue:['ordered product sales','sales'],units:['units ordered','units']}},
    shared_audit_report:{label:'Shared Audit Report',requiredAny:[['asin','fsn']],aliases:{asin:['asin'],fsn:['fsn'],amazonSuppressed:['amazon_has_supersede_issue'],amazonBuyNow:['amazon_buy_now_present'],amazonLivePrice:['amazon_selling_price','amazon live price'],flipkartLivePrice:['flipkart_selling_price','flipkart live price']}},
    flipkart_listing:{label:'Flipkart Listing File',requiredAny:[['seller sku id','sku'],['fsn']],aliases:{fkSku:['seller sku id','seller sku','sku'],fsn:['fsn'],listingPrice:['your selling price','selling price'],mrp:['mrp'],systemStock:['system stock count'],status:['listing status','status']}},
    flipkart_orders:{label:'Flipkart Order Report',requiredAny:[['fsn']],aliases:{fsn:['fsn'],revenue:['revenue','selling price'],units:['quantity','units']}}
  };
  window.WakeSuiteUploadSources=S;
  window.WakeSuiteModules?.register('uploadSources',{sources:S});
})();
