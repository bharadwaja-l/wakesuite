/* Marketplace Insights remains issue-focused; Pricing/Inventory live under Business Insights. */
(function(){
  const allowed=['all','parity','price_disparity','amazon_suppression','buy_box','exceptions','revenue_impact'];
  window.WakeSuiteMarketplaceInsights={allowedFocus:allowed};
  window.WakeSuiteModules?.register('marketplaceInsights',window.WakeSuiteMarketplaceInsights);
})();
