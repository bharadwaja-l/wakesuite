# WakeSuite V9.3.2 Business Rules

## Global eligibility
- Marketplace analysis uses Active + In-Stock products unless a module explicitly analyses OOS/inventory state.
- Wakefit Daily Pricing uses Active rows and no Wakefit stock filter.
- Amazon inventory: All Listings quantity first; blank falls back to FBA SELLABLE.
- Flipkart inventory: `System Stock count` only.
- One atomic marketplace mapping = one row. Never concatenate multiple identifiers with `|`.

## Price disparity and parity
- Selling-price tolerance is WF Price ± ₹5.
- Listing Price Disparity compares marketplace listing price with WF Price.
- Live Price Disparity compares a valid live price directly with WF Price under the marketplace eligibility rules.
- MRP Disparity compares marketplace MRP with WF MRP.
- Approved exceptions preserve raw mismatch but remove only the matching target from actionable counts/impact while active.
- Parity states are Parity / Actionable Disparity / Approved Exception. Approved Exception is not converted to Parity.
- `Parity % = Parity / (Parity + Actionable Disparity)`; approved exceptions are excluded from the denominator.

## Price Updates
Amazon and Flipkart selector order: **All, Price, Live Price, Price + Live Price, MRP**.
- Price and Live Price issue selections write target WF Price to the marketplace selling-price field.
- MRP writes WF MRP.
- Amazon Min SAP = Listing Price × (1 − configured reduction %, default 5%).
- Amazon Max SAP = WF MRP.
- Amazon uses `assets/PriceAndQuantity.xlsm`; Flipkart uses the latest listing-file structure and produces CSV.

## Pricing Exceptions
Menu: **Add Exceptions / Exceptions Manager / Exception Insights**.
General targets: Price, Live Price Only, MRP, Price + MRP, All Pricing.
General types: Pricing, Parity, Amazon Deal Tag, Flipkart Opt-In, Category Exception.
Periods are date-only: Today Only, Custom Range, No Expiry. Remarks/reason is required for manual creation.
Normal removal is soft removal with status Active / Expired / Removed and audit fields.
Amazon Min/Max Pricing Issues are separate; the only manual treatment there is **No Pricing Issue**.

## Exception Insights
- Sales-impact source is **Order Report only**.
- Amazon: daily Amazon Order Report keyed by AZ SKU, resolved through canonical mapping to ASIN/WF SKU/Category. ASIN-level exceptions aggregate mapped AZ SKUs only when required by the exception scope.
- Flipkart: daily Flipkart Order Report. No Flipkart Business Report is expected.
- Amazon Business Reports are not used in Exception Insights calculations.
- Inventory, Suppression and Buy Box are contextual/interference signals only.
- If required Order Report coverage/revenue data is insufficient, show **Impact Unavailable — Insufficient Order Data**; never fabricate ₹0, positive or negative impact.
- Active exceptions compare baseline vs exception-to-date. Expired/removed exceptions may compare before vs during vs after when sufficient daily data exists.
- Outcome labels: Observed Positive, Observed Negative, Neutral / No Material Change, Inconclusive, Impact Unavailable. These are observed associations, not causal claims.

## Suppression / Buy Box
Buy Box is Amazon-only.
**Suppression State contains only:** Suppressed, Live.
- Latest valid fresh audit determines Suppressed/Live automatically.
- Missing/stale audit must not change state.
- Default Suppression Management queue = Suppressed.
- First Seen = beginning of current continuous suppressed occurrence.
- Last Seen = latest date suppression was detected.
- Resolved On may record the first later valid date where suppression is no longer detected; it is a lifecycle date, not a Suppression State value.
- Re-suppression after Live starts a new First Seen occurrence while historical occurrence data remains preserved.

Operational fields are separate from marketplace state: Case ID, Case Status, Owner, POC, POA, QC, Follow-up, Notes and Override Status.
- POC: Not Required / Required / Escalated / Follow-up Pending / Closed.
- POA: Not Required / Pending / Submitted / Approved / Rejected.
- QC: Not Required / Pending / Submitted / Passed / Failed / Rework Required.
- Multi-ASIN actions affect selected ASINs only and must be audited per ASIN.
- A single Case ID may be applied to multiple explicitly selected ASINs.
- ASIN Suppression report multi-select for bulk Override is visible only to users with Suppression Override permission.

## Dashboard / insights
Dashboard routes cards/sub-counts to native report/operational pages with current date/category context. Marketplace Insights is not the default operational drilldown destination.
Business Insights contains Pricing Insights and Inventory Insights, uses the same interaction pattern as Marketplace Insights, and remains decision-support rather than source-data editing.
Pricing and Inventory signals may cross-reference each other to classify results as positive, review required, inventory-constrained or inconclusive.

## Product 360
Dashboard global search opens full Product 360. Context-specific clicks may open scoped detail with an explicit Open Full Product 360 action.
Permitted marketplaces must not disappear merely because a product is OOS/inactive/unmapped. Coverage states include Active & In Stock, Active but OOS, Inactive, Not Available / No Current Listing, Not Sold / No Mapping, Mapping Conflict and Data Unavailable.

## History
History is read-only. Status filters are context-specific:
- Pricing: Pricing State plus separate Price Change Direction.
- Inventory: Inventory State plus Stock Movement.
- Suppression: Suppressed / Live.
- Buy Box: Buy Box Suppressed / Buy Box Available, Amazon only.
- Exceptions: Active / Expired / Removed plus exception activity/effective view.
- Price Updates: Generated / Pending Reflection / Reflected / Partially Reflected / Still Incorrect.

## Data Administration
Super Admin only. Clear Processed Data and Delete Source File / Remove Uploaded Version are separate workflows.
Both support Today, Yesterday, Single Report Date and Custom Range. Preview + explicit confirmation + mandatory reason + audit are required. Source-file deletion invalidates only downstream outputs derived from the selected source version/date.

## Formatting / exports
Keep full numeric precision internally. Display INR values using Indian grouping with max 2 decimals; never expose floating-point artifacts. Wide tables use reusable column controls where useful. Normal exports follow visible columns where supported; Full Export includes all fields.

## Permissions
Marketplace/category/module/action permissions are enforced before rendering/exporting and in Firestore write rules. Super Admin has authoritative full access.

## V9.3.3 Order Analytics
- Amazon Order Report and Flipkart Order Report are approved analytical sources for Exception Insights, Live Price Disparity Impact and Inventory History velocity analysis.
- Amazon fulfilment is normalized to FBA/FBM from `fulfillment-channel`.
- Flipkart current listing fulfilment is taken from `Fulfillment By` in the Flipkart Listing File.
- Active effective Live Price exceptions exclude overlapping dates from actionable Live Price Disparity order and modeled-impact totals while preserving raw mismatch.
- Flipkart Order Report has no revenue field; Flipkart order revenue is not estimated.
- DRR = Units Sold / Selling Days. True sell-through is not claimed without receipts/inbound data.

## V9.3.5 — Disparity Orders
- `Disparity Orders` is Amazon-only.
- A row is included only when the Amazon Order Report purchase date overlaps a stored date where the same ASIN/AZ SKU has raw Live Price Disparity.
- Listing Price Disparity and MRP Disparity alone do not qualify an order for this module.
- Current disparity must never pull historical orders outside the actual affected date.
- Effective Live Price exception dates remain visible as `Exception Excluded`; they are not silently converted into actionable disparity.
- Amazon `item-price` is the order-value field displayed for the order row; `quantity` is units; `fulfillment-channel` is normalized to FBA/FBM while retaining the raw value.

## V9.3.5 — Audit Report schema
- Audit Report ingestion is header-name based, not column-position based.
- Reordering columns or inserting new columns must not break ingestion.
- Required header names must remain present. If a required header is absent, validation must fail clearly instead of reading another column.


## V9.3.6 source coverage rules
- Amazon Business Reports require Data From / Data To. Coverage days are inclusive and drive per-day normalization. Overlapping non-identical Business Report ranges are rejected.
- Amazon and Flipkart Order Reports use actual order dates to resolve coverage when Data From / Data To is blank. Overlapping uploads are permitted only because atomic order lines are de-duplicated before analytics.
- Amazon order-line identity prefers Amazon Order ID + Order Item ID. Flipkart prefers Order Item ID.


## V9.3.7 — Amazon Buy Box APT
- Buy Box APT applies only to Amazon Buy Box Suppression.
- Merchant SKUs in the APT workbook are WF SKUs mapped to the affected ASIN, not AZ SKUs.
- GL is WakeSuite Category.
- Marketplace ID and Seller ID are fixed values from the supplied APT template.
- Landed Price, Brand Manufacturer/Competitor Product Price, Shipping Price and L7/+ Custom Override all equal WF Price.
- One ASIN/WF SKU mapping = one APT row; do not concatenate WF SKUs.
- APT generation must not change suppression state. Buy Box availability is verified only from a subsequent valid audit.
- POA and QC generation are out of scope for V9.3.7.


## V9.3.8 communication rules
- Operational report email rows must match the report's current selected period, category and identifier-search result.
- Amazon report counts are unique ASINs; Flipkart report counts are unique FSNs.
- When no rows match the selected report/filters, email generation must stop instead of sending a zero-count message with an empty workbook.
- Download remains available independently of email sharing.
- Amazon combined POC escalation may contain Live Price Disparity, threshold-qualified ASIN Suppression and Buy Box Suppression. Those three issue types may also be emailed separately.
- Flipkart POC uses actionable Live Price Disparity and may also be emailed separately.
- Combined POC totals are de-duplicated across issue types, so the same ASIN/FSN is counted once in the total.
- If an Amazon POC escalation contains Buy Box Suppression, the email must include both the standard POC workbook and the generated Buy Box APT. If APT generation fails, do not send an incomplete Buy Box escalation.
- Generating, downloading or emailing an APT does not resolve Buy Box Suppression; a later valid audit must show Buy Box available.
- Live Price Disparity operational pages contain disparity rows only. Historical order evidence is shown only in Amazon `Disparity Orders`.


## V9.3.8 communication reliability
- Individual report email counts must be computed from the same filtered rows used to build the attachment.
- Amazon counts are unique ASINs; Flipkart counts are unique FSNs. A row alias such as `identifier` / `productId` must be normalized before counting; WakeSuite must never send `0 ASINs` / `0 FSNs` when report rows exist.
- If rows exist but no canonical marketplace identifier can be resolved, email generation/send is blocked rather than guessing a count.
- Daily Communications keeps Download and Email as independent actions. Combined marketplace POC sends remain available in addition to separate issue-type emails.
- Amazon Buy Box POC escalation includes the Buy Box APT attachment whenever Buy Box Suppression rows are present.
- Buy Box APT Merchant SKU remains WF SKU mapped to the ASIN; GL is Category; Landed Price, manufacturer/competitor price, Shipping Price and L7/+ override all use WF Price only.
- Live Disparity order evidence belongs only to the dedicated Amazon Disparity Orders module; it is not embedded below Live Price Disparity.
