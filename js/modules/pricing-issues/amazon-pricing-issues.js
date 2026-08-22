/* Amazon Min/Max Pricing Issues are separate from general Pricing Exceptions. */
(function(){
  window.WakeSuiteAmazonPricingIssues={manualTreatment:'No Pricing Issue',generalPricingExceptions:false,minRule:'Listing Price × (1 − configured reduction %)',maxRule:'WF MRP'};
  window.WakeSuiteModules?.register('amazonPricingIssues',window.WakeSuiteAmazonPricingIssues);
})();
