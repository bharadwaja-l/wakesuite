# WakeSuite V9.3.4 Implementation

V9.3.4 is an analytics and source-governance upgrade on top of the V9.3.3 consolidated baseline.

## Explicit exclusion

V9.3.4 does **not** implement the proposed Shared Analytics Filter Bar. Existing page-specific filter/dropdown layouts remain independent. Data Center keeps its existing dropdown visual structure; only source naming is corrected.

## Dashboard analysis destinations

Dashboard cards now route to dedicated analysis destinations:

- Amazon / Flipkart Price Parity → existing dedicated Price Parity analysis.
- Amazon / Flipkart Price Disparity → dedicated V9.3.4 Price Disparity Analysis.
- Amazon ASIN Suppression → dedicated Suppression Analysis.
- Amazon Buy Box Suppression → dedicated Buy Box Analysis.
- Amazon / Flipkart Price Change Performance → rebuilt Pricing Insights.
- Amazon / Flipkart Inventory Risk → rebuilt Inventory Insights.
- Amazon / Flipkart / Combined Revenue Impact → dedicated Revenue Impact Analysis.

The operational sidebar pages remain separate from these analytical destinations.

## Business Insights rebuild

### Pricing Insights

Order Reports drive order and unit observations. Amazon Order Report `item-price` is used only in Order-Report analytical contexts. Flipkart revenue is not estimated because the supplied Flipkart Order Report has no monetary field.

Pricing Insights includes before/after 7/14/30 day windows, price direction, orders, units, Amazon revenue response, fulfilment, exception status, inventory interference, suppression / Buy Box interference, and decision signals such as Positive Price Response, Review Price Increase, Revenue Dilution, Inventory Constraint, Marketplace Interference and Inconclusive.

### Inventory Insights

Inventory snapshots remain the stock-position source. Marketplace Order Reports supply units sold and DRR inputs.

Inventory Insights includes Opening Stock, Closing Stock, Units Sold, Selling Days, DRR, 7/14/30-Day DRR, Days of Cover, OOS Days, OOS %, stock movement, Inventory Depletion %, explicit true Sell-Through unavailability when no receipts/inbound source exists, fulfilment dimensions, potential Amazon OOS revenue loss and Possible Overstock.

Risk thresholds remain:

- `<3` days: Critical
- `3–7` days: At Risk
- `7–14` days: Watch
- `>14` days: Healthy

## Live Price Disparity order impact

The dedicated Price Disparity Analysis includes exact-date Live Price Disparity order overlap. Raw disparity dates covered by an active applicable exception remain visible but orders/units from those dates are shown separately as Exception Excluded instead of being counted as actionable.

Amazon order revenue is shown from Amazon Order Report. Flipkart monetary revenue remains unavailable rather than estimated.

## Data Center source naming

The existing Data Center dropdown UI is retained. Source labels are corrected so canonical source names no longer imply ownership by Exception Insights or another consumer module.

- Amazon → Business Reports
- Amazon → Order Reports
- Flipkart → Order Reports

One canonical marketplace Order Report source is reused by downstream analytical consumers.

## Security / persistence

No new Firestore collection or Firestore security-rule change is required for this V9.3.4 layer.
