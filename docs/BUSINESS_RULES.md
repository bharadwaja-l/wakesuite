# WakeSuite V9.3 Business Rules

## 1. Global eligibility
- Marketplace analysis uses Active + In-Stock products unless a module explicitly analyses inventory/OOS.
- Wakefit Daily Pricing uses Active rows and does not apply a Wakefit stock filter.
- Amazon inventory: All Listings quantity first; when unavailable use FBA SELLABLE fallback according to the existing eligibility engine.
- Flipkart inventory uses `System Stock count` only.

## 2. Price disparity
- Standard selling-price tolerance = **WF Price ± ₹5**.
- Listing disparity compares marketplace listing price with WF Price.
- Live disparity compares a valid marketplace live price directly with WF Price. Live price does **not** need to differ from listing price.
- MRP disparity compares marketplace MRP with WF MRP.
- Approved exceptions preserve raw mismatch but remove only their matching target from actionability/revenue impact during the active exception period.

## 3. Price Parity
States are separate:
- Parity
- Actionable Disparity
- Approved Exception

Approved Exception is not converted to Parity.

`Parity % = Parity / (Parity + Actionable Disparity)`

Approved exceptions are excluded from the denominator. Standalone Amazon and Flipkart Price Parity reports support Today, Yesterday, selected date, 7/14/30-day and Custom Range analysis.

## 4. Amazon Price Updates
Canonical workbook: `assets/PriceAndQuantity.xlsm`.

Key target fields:
- `SKU`
- `Your Price INR (Sell on Amazon, IN)`
- `Maximum Retail Price (Sell on Amazon, IN)`
- `Minimum Seller Allowed Price (Sell on Amazon, IN)`
- `Maximum Seller Allowed Price (Sell on Amazon, IN)`

Rules:
- New selling price = WF Price.
- New MRP = WF MRP.
- Corrected Min SAP = Amazon Listing Price × `(1 − configured Min reduction %)`, default 5%.
- Corrected Max SAP = WF MRP when valid mapped WF MRP exists.
- If Max SAP correction also requires Amazon MRP correction, include WF MRP in the same output where supported.

Price & MRP Update selector order:
1. All
2. Price
3. Live Price
4. Price + Live Price
5. MRP

`Live Price` is an issue-selection source, not a separate marketplace template column. Selling-price correction still targets WF Price.

## 5. Flipkart Price Updates
- Use the latest uploaded Flipkart Listing File structure for the selected report date/range.
- Dynamically locate the required selling-price/MRP columns via the adapter.
- New selling price = WF Price.
- New MRP = WF MRP.
- Final marketplace output = CSV.
- Preserve the source structure/header order where supported and output only actionable selected correction rows.
- Selector order matches Amazon: All, Price, Live Price, Price + Live Price, MRP.

## 6. General Pricing Exceptions
General targets include:
- Price
- Live Price Only
- MRP
- Price + MRP
- All Pricing

General Exception Types include:
- Pricing
- Parity
- Amazon Deal Tag
- Flipkart Opt-In
- Category Exception

`Parity` is available for all general Pricing Exception targets.

Identifiers:
- WF SKU
- AZ SKU
- ASIN
- FK SKU
- FSN

Effective period is date-only:
- Today Only
- Custom Range / Custom Period
- No Expiry

Manual remarks/reason is required for creation. Normal removal is soft removal with lifecycle/audit fields; removed/expired exceptions never delete raw marketplace detection.

Pricing Exceptions is self-contained under Add Exceptions / Exceptions Manager. Existing `pricing_exceptions` records remain the source of truth even if originally created through an older Upload Center workflow.

## 7. Amazon Min/Max Pricing Issues
Amazon Min/Max Pricing Issues are separate from General Pricing Exceptions.

The only manual treatment currently available is:
- **No Pricing Issue**

This preserves raw detection but removes the selected detected Min/Max issue from the actionable Min/Max workflow according to the override scope.

## 8. Amazon Suppression / Buy Box
Buy Box Suppression is Amazon-only.

Occurrence lifecycle fields:
- First Seen
- Last Seen
- Age
- Resolved On
- Current State: Active / Overridden / Reactivated / Closed

`First Seen` means the beginning of the current continuous occurrence. A resolved issue that reappears starts a new occurrence.

Operational timestamps can include Case ID Raised On, POC Escalated On, POA Submitted On, QC Submitted On, Override Applied On and Closed On.

Suppression Management supports multi-ASIN selection. A single Case ID may be applied to multiple explicitly selected ASINs only; it must never spill to unselected rows.

Suppression detail/download opened from Suppression Management is Amazon suppression-scoped by default. Broader Product 360 is an explicit secondary action and remains permission-controlled.

## 9. Dashboard routing
Dashboard acts as a routing hub to native reports/workflows:
- Price Parity → standalone marketplace Price Parity report.
- Price Disparity → native marketplace Price Disparity area.
- ASIN Suppression → Amazon ASIN Suppression report.
- Buy Box Suppression → Amazon Buy Box Suppression report.
- Approved Exceptions → Exceptions Manager with dashboard context.
- Overridden → Suppression Management filtered to Overridden.
- Total Revenue Impact → Revenue Impact report.
- Inventory Risk → Business Insights / Inventory workspace.

Category rows route to the same destination with category context. Marketplace Insights is not the default destination for routine Dashboard operational drilldowns.

## 10. Marketplace Insights
Marketplace Insights is limited to marketplace issue analysis:
- Overview
- Price Parity
- Price Disparity
- ASIN Suppression
- Buy Box Suppression (Amazon only)
- Exceptions
- Revenue Impact

Pricing Insights and Inventory Insights do not render inside Marketplace Insights.

## 11. Business Insights / History
Business Insights contains Pricing Insights and Inventory Insights with analytical manipulation controls (filter, compare, group, sort, columns, date ranges, download) but does not directly edit historical source data.

Pricing History and Inventory History are read-only. A top-level History hub provides cross-module read-only history/audit access.

## 12. Atomic identifier rule
One atomic marketplace mapping = one row. Never concatenate multiple AZ SKUs, ASINs, FSNs, FK SKUs or equivalent identifiers into one cell with `|` or similar separators. Shared attributes may repeat across rows.

## 13. Column controls / exports
Wide data tables should expose reusable Columns controls where useful:
- Select All
- Clear All
- Set as Default
- Restore Default

User defaults are persisted per signed-in user/module where supported. Normal export follows visible columns when the module supports visible-column export; Full Export explicitly includes all fields.

## 14. Super Admin / Data Administration
Super Admin is authoritative full access. Data Administration is restricted to Super Admin.

Processed-data control supports Today, Yesterday, Single Report Date and Custom Range plus dataset/marketplace/category/status/identifier filters and granular deletion scopes.

`Clear Processed Data` and `Delete Source File / Remove Uploaded Version` are separate workflows.

Deleting a source version requires explicit preview/confirmation/reason and should invalidate only downstream processed outputs derived from that source version. Unrelated source history must remain untouched.

All destructive actions must be auditable.

## 15. Flipkart Buy Box
Flipkart Buy Box is retired from current WakeSuite V9.3 UI/actionability/reporting paths. Do not add new Flipkart Buy Box calculations, cards, reports, emails or operational actions.

## 16. Permissions
Marketplace, category, module and action permissions are applied before presentation/export. Product 360 and History must not leak unauthorized marketplace/category/module data.
