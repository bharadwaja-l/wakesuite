# WakeSuite V9.1 Business Rules

## 1. Global eligibility
- Marketplace analysis uses Active + In-Stock products unless a module explicitly analyses inventory/OOS.
- Wakefit Daily Pricing uses Active rows; it does not apply a Wakefit stock filter.
- Amazon inventory: All Listings quantity first; if unavailable/zero, use FBA SELLABLE fallback when available.
- Flipkart inventory: use `System Stock count` only.

## 2. Price disparity
- Standard selling-price tolerance is WF Price ± ₹5.
- Listing disparity compares marketplace listing price with WF Price.
- Live disparity compares a valid marketplace live price directly with WF Price. Live price does not need to differ from listing price to be a live disparity.
- MRP disparity compares marketplace MRP with WF MRP.
- Approved exceptions remove a raw issue from actionability and revenue-impact calculations but do not convert it to parity.

## 3. Parity
- States are separate: **Parity**, **Actionable Disparity**, **Approved Exception**.
- Approved exceptions are excluded from the parity denominator.
- Parity % = Parity / (Parity + Actionable Disparity).

## 4. Amazon Price Updates
Canonical template: `assets/PriceAndQuantity.xlsm`, using the Amazon `Template` sheet.

Key fields:
- `SKU`
- `Your Price INR (Sell on Amazon, IN)`
- `Maximum Retail Price (Sell on Amazon, IN)`
- `Minimum Seller Allowed Price (Sell on Amazon, IN)`
- `Maximum Seller Allowed Price (Sell on Amazon, IN)`

Rules:
- New selling price = WF Price.
- New MRP = WF MRP.
- Corrected Min SAP = Amazon Listing Price × (1 − configured Min reduction %). Default = 5%.
- Corrected Max SAP = target MRP.
- Target MRP = WF MRP when a valid mapping exists.
- If Max SAP is corrected while Amazon MRP is disparate, include the WF MRP correction in the same Amazon file.

## 5. Flipkart Price Updates
- Use the latest Flipkart Listing File uploaded for the selected report date as the update schema.
- Dynamically locate the header containing `Seller SKU Id`, `Your Selling Price`, and `MRP`.
- New selling price = WF Price.
- New MRP = WF MRP.
- Final output = CSV.
- Preserve source column order/pre-header structure; include only selected correction rows after the source header.

## 6. Pricing Exceptions
Exception targets:
- Listing Price
- Live Price
- MRP
- Min SAP
- Max SAP
- Price + MRP
- All Pricing

Rules:
- Full Exclusion
- Approved Price
- Approved Price Range
- Custom ₹ Tolerance
- Custom % Tolerance

Reasons:
- Pricing
- Amazon Deal Tag
- Flipkart Opt-In
- Category Exception

Identifiers:
- WF SKU
- AZ SKU
- ASIN
- FK SKU
- FSN

Raw detection is preserved. Exceptions only change the actionable state.

## 7. Amazon Suppression
Suppression state:
- Active
- Overridden
- Reactivated
- Closed

Override:
- Requires Suppression Override permission.
- Requires reason.
- Applies to the selected report date.
- Raw suppression detection remains auditable.
- Override removes that day's suppression from actionable revenue exposure.

Permission-specific actions:
- `manageSuppressions`: owner/general status/notes.
- `raiseCaseId`: Case ID.
- `managePoaQc`: POA and QC workflow.
- `pocEscalation`: POC escalation workflow.
- `suppressionOverride`: suppression override.

## 8. Marketplace Insights
Marketplace Insights is the decision hub.

Overview is focus-based:
- Price Parity
- Price Disparity
- ASIN Suppression
- Buy Box Suppression (Amazon)
- Approved Exceptions
- Total Revenue Impact

Pricing Insights:
- Uses before/after historical observations around actual price changes.
- Shows **Observed Revenue Change Following Price Change** rather than claiming price caused the revenue change.
- Inventory constraints can mark a result inconclusive.

Inventory Insights:
- Current OOS
- Potential revenue loss
- Low stock / Days of Cover risk
- Restock recovery
- Potential over-stock
- Healthy/watch classification

Aggregate `OOS Product Days` is not a headline KPI.

## 9. Dashboard
- Category breakdown appears directly inside primary KPI cards for categories the user is authorized to view.
- Exceptions are visible on price cards and clickable into Marketplace Insights.
- Suppression overrides are visible on the Amazon Suppression card.
- Aggregate metrics must never include categories outside the current user's data scope.

## 10. Super Admin
Super Admin always has:
- Amazon + Flipkart
- All categories
- All modules
- All actions
- All upload/download scopes
- Settings and User Administration
- Price Updates
- Pricing Exceptions
- Suppression/POC/POA/QC/Case ID controls
- Data Administration

A saved checkbox configuration cannot reduce Super Admin access.

## 11. Data Administration
- Super Admin only.
- Clears processed analysis by date/dataset.
- Does not silently delete uploaded source-file versions.
- Requires reason.
- Writes an audit record.

## V9.2 additions — 22 Aug 2026
- General Pricing Exceptions targets: Price, Live Price Only, MRP, Price + MRP, All Pricing.
- `Parity` is an Exception Type available for all general Pricing Exception targets. Raw mismatch remains stored; matching exception removes actionability/revenue impact for its effective period.
- Exception periods are date-only: Today Only, Custom Period, No Expiry. Manual remarks/reason is required.
- Exceptions Manager statuses: Active, Expired, Removed. Normal removal is soft removal with remover/timestamp/remarks; raw issue history is not deleted.
- Amazon Min/Max Pricing Issues are separate from general Pricing Exceptions. The only manual treatment currently supported there is `No Pricing Issue`.
- Amazon Min SAP target = Listing Price × (1 − configured reduction %, default 5%). Amazon Max SAP target = WF MRP.
- Amazon update asset = `PriceAndQuantity.xlsm`; Flipkart Price/MRP output follows the latest Flipkart listing schema and downloads CSV.
- Amazon Suppression / Buy Box lifecycle uses First Seen, Last Seen, Age, Resolved On and Current State. A reactivated occurrence starts a new continuous occurrence.
- Product identifiers (ASIN, FSN, WF SKU, AZ SKU, FK SKU) resolve through one canonical Product 360 identity layer and remain permission-scoped.
- Buy Box Suppression is Amazon-only. Flipkart Buy Box is retired from current processing/UI.
