# WakeSuite Changelog

## V9.2.0 — 22 Aug 2026

### Architecture / maintainability
- Added module registry and independent modules for Upload Source schemas, Amazon/Flipkart Price Update adapters, Pricing Exceptions, Amazon Pricing Issues, Suppression lifecycle, Marketplace Insights, Business Insights and Product 360.
- Added config-driven upload header validation/alias normalization so common source header renames are localized to `js/config/upload-sources.js`.
- Kept shared Auth/Permissions/Firestore/snapshot services centralized.

### Responsive / navigation UI
- Added adaptive responsive stylesheet with desktop/tablet/mobile breakpoints.
- Mobile sidebar is now a fixed off-canvas drawer with a simple dark backdrop, no blur and no page shift.
- Prevented page-level horizontal panning; wide tables scroll in their own containers.
- Fixed sidebar alignment rules for expanded/collapsed/mobile states.
- Suppression More Filters now expands inline.
- Dashboard category breakdown rows are keyboard/click navigable into the matching Marketplace Insights focus/category.

### Marketplace Insights / Business Insights
- Marketplace Insights now uses focused tabs: Overview, Price Parity, Price Disparity, ASIN Suppression, Amazon Buy Box Suppression, Exceptions and Revenue Impact.
- Replaced toggle-off focus behavior with stable one-focus navigation.
- Default Marketplace Insights display is analysis-first (`Insights`); raw rows are under `Detailed Data`.
- Moved Pricing Insights and Inventory Insights into independent Business Insights.
- Pricing Insights default comparison window is 7 days; change day is excluded; decision signals include price-increase/reduction outcomes and inconclusive operational interference.
- Inventory decision labels use Critical <3, At Risk 3–7, Watch >7–14, Healthy >14 days cover.

### Pricing Exceptions
- Added dedicated Add Exceptions / Exceptions Manager workflow.
- Added `Parity` Exception Type for every general pricing target.
- General targets are Price, Live Price Only, MRP, Price + MRP and All Pricing.
- Removed Min/Max SAP from the general exception target workflow.
- Added Today Only / Custom Period / No Expiry date-only periods.
- Manual remarks/reason required.
- Exceptions Manager supports Active/Expired/Removed, View, Edit and soft Remove Exception with audit fields.

### Amazon Pricing Issues / Price Updates
- Min/Max Pricing Issues now use only `No Pricing Issue` as the manual treatment; no general exception dropdown.
- Min SAP target = Listing Price × (1 − configured reduction %, default 5%).
- Max SAP target = WF MRP; no Max Increase % rule.
- Added Firestore-backed `amazon_pricing_issue_overrides`.
- Amazon update template remains `assets/PriceAndQuantity.xlsm`; populated cells retain template style metadata where present.
- Flipkart update adapter uses latest listing file schema/header aliases and produces CSV.

### Disparity / Flipkart cleanup
- Live Price Disparity is separate only when live price differs from listing price and is outside WF ±₹5.
- Retired Flipkart Buy Box from current UI, active Flipkart processing result, current snapshot module status and actionable totals.

### Suppression lifecycle
- Added First Seen, Last Seen, Age, Resolved On and Current State to suppression occurrence handling.
- Added Reactivated occurrence tracking and previous-occurrence link fields.
- Added operational timestamps for Case ID, POC, POA, QC, override and close events.
- Default Suppression Management table now exposes lifecycle essentials without overloading the table.

### Product 360
- Added canonical resolver for ASIN, FSN, WF SKU, AZ SKU and FK SKU.
- Added context-aware clickable identifiers across result tables.
- Dashboard global identifier search opens full permitted Product 360.
- Added context-scoped/full permitted product download and mapping-change history.

### Performance / permissions
- Dashboard category drilldowns reuse current context instead of intentionally starting a new full-load path.
- Product 360 tabs/exports filter data domains by module permissions.
- Category/marketplace scope remains authoritative across resolver and lifecycle views.

### Documentation
- Updated README, Business Rules, Architecture, Firestore notes and Change Control for V9.2.
- AI / Ask WakeSuite explicitly excluded from this release.

# WakeSuite Change Log

WakeSuite uses semantic release notes. Every production code change must be recorded here before deployment.

## V9.1.1 — 21 Aug 2026

### Performance
- Removed repeated forced Firestore reloads of Pricing Exceptions from every Dashboard and Marketplace Insights refresh. Exceptions are now loaded once per session/version and reused until changed.
- Added snapshot-level exception-overlay caching so the same Amazon/Flipkart snapshot rows are not recalculated repeatedly during one UI session.
- Added an indexed exception lookup by marketplace / SKU / identifier / category instead of scanning the full exception list for every row and every disparity type.
- Moved suppression-case refresh for Action Center to a 2-minute cache and background refresh so the Dashboard first paint does not wait for workflow collections.
- Moved suppression override refresh to a short-lived cache/background refresh.
- Removed Dashboard auto-loading of Update Verification; verification remains available under Price Updates where it belongs.

### Dashboard UI
- Removed Data Health / Input Confidence from Dashboard. Source availability remains in the top source indicator and Data Center.
- Simplified Dashboard utility area to a single compact Action Center strip.
- Fixed Action Center CSS/HTML class mismatch that previously caused browser-default button rendering.
- Action Center now uses aligned count badges, action text, supporting context, and a consistent chevron.

### Navigation / Responsive
- Reworked desktop sidebar alignment, spacing, child indentation, and chevron placement.
- Fixed collapsed-sidebar layout so icons are centered and group chevrons are hidden instead of floating at the sidebar edge.
- Increased collapsed width slightly to prevent the brand/collapse control from clipping.
- Removed `backdrop-filter` blur from the mobile sidebar overlay and mobile top bar to avoid the blurred-menu effect and reduce GPU cost.
- Disabled metric-card entrance animation on smaller screens.

### Scope
- No marketplace pricing, MRP, suppression, revenue-impact, eligibility, exception, or access-control business rule was changed in this hotfix.

## V9.1.0 — 21 Aug 2026

### Navigation and UI
- Rebuilt the marketplace navigation hierarchy so analysis and update actions are separate.
- Amazon now contains **Price Disparity**, **Price Updates**, and **Suppressions** groups.
- Amazon Price Updates contains **Price & MRP Update** and **Min / Max Price Update**.
- Flipkart now contains **Price Disparity** and **Price Updates**; Price Updates contains **Price & MRP Update**.
- Removed text abbreviation badges such as `OV`, `IN`, `PD`, `SP`, `BB`, and `MU`; replaced them with consistent inline SVG icons.
- Improved sidebar row height, indentation, icon alignment, collapsed state, and expandable-group chevrons.
- Standardized all select controls on the WakeSuite purple dropdown chevron (`#4c2c92`).
- Removed the retired Flipkart Buy Box UI from Marketplace Insights.

### Dashboard
- Added category breakdowns directly inside existing Amazon and Flipkart KPI cards.
- Category breakdown respects the signed-in user's category scope.
- Added approved-exception counts to parity/disparity cards.
- Added suppression override count to the Amazon Suppression card.
- Added **Action Center** for high-impact disparities, pending Case IDs, pending POC escalation, expiring exceptions, and generated updates that have not reflected.
- Added **Marketplace Update Verification** summary.
- Added **Data Health** summary for source availability.

### Marketplace Insights
- Added domain tabs: **Overview**, **Pricing Insights**, **Inventory Insights**.
- Converted Overview to focus-based analysis: Price Parity, Price Disparity, ASIN Suppression, Buy Box Suppression, Approved Exceptions, or Total Revenue Impact.
- Selecting an insight now suppresses unrelated charts instead of showing every issue type at once.
- Added Price Parity focus metrics including parity %, parity products, eligible checks, and exceptions excluded.
- Added Approved Exceptions as a first-class insight focus.
- Added Pricing Insights using before/after historical observations around price changes. Output is explicitly labelled observed response, not causal attribution.
- Added Inventory Insights with current OOS, potential revenue loss, low-cover risk, restock recovery, days of cover, and inventory/revenue quadrants.
- Retained historical Pricing/Inventory pages only as drill-down capability; removed them from the primary sidebar.

### Pricing Exceptions
- Reworked exceptions as a centralized actionability overlay while preserving raw issue detection.
- Exceptions are no longer counted as parity.
- Parity denominator excludes approved exceptions.
- Added targets: Listing, Live, MRP, Min SAP, Max SAP, Price + MRP, All Pricing.
- Added rules: Full Exclusion, Approved Price, Approved Price Range, Custom ₹ Tolerance, Custom % Tolerance.
- Kept reason types: Pricing, Amazon Deal Tag, Flipkart Opt-In, Category Exception.
- Identifier upload now accepts only selected identifier columns (WF SKU, AZ SKU, ASIN, FK SKU, FSN); rule conditions are configured in WakeSuite.
- Added manual **Add Exception** action from Pricing Issues and Price Updates preview.
- Added bulk selected-row exception workflow from Price Updates.
- Exception changes invalidate snapshot cache and update actionable views without requiring a new source upload.
- Added V9.1 raw-disparity flags to newly persisted snapshot rows so later exception changes can restore actionability without losing marketplace truth.

### Amazon Pricing Issues and Price Updates
- Separated **Pricing Issues** (analysis) from **Price Updates** (marketplace correction output).
- Replaced the old Amazon template asset with the user-provided `PriceAndQuantity.xlsm` canonical template.
- Verified production asset checksum matches the supplied template.
- Price update writes `SKU` + `Your Price INR (Sell on Amazon, IN)` using WF Price.
- MRP update writes `SKU` + `Maximum Retail Price (Sell on Amazon, IN)` using WF MRP.
- Min SAP correction = current Amazon listing price × (1 − configured Min reduction %), default 5%.
- Max SAP correction = target MRP; target MRP is WF MRP when mapped.
- If Max SAP requires correction and Amazon MRP is also disparate, the same output file also carries the WF MRP correction.
- Removed Max Increase % from V9.1 controls and prevented the legacy local-storage Max % from driving output.
- Pricing Issues now treats Min/Max exception targets independently.
- Added marketplace-ready preview and row selection before file generation.

### Flipkart Price Updates
- Added Flipkart **Price & MRP Update** module.
- Uses the latest successfully uploaded Flipkart Listing File for the selected date as the runtime schema.
- Dynamically finds the header row containing `Seller SKU Id`, `Your Selling Price`, and `MRP` instead of assuming row 1.
- Preserves pre-header rows and exact source column order in the generated CSV.
- Price correction uses WF Price; MRP correction uses WF MRP.
- Output is CSV and contains only selected actionable correction rows after the original header structure.
- The large daily Flipkart listing file is intentionally not bundled in the production package.

### Suppression Management
- Simplified primary filters to period/date, category, suppression state, case status, and search.
- Moved POC/source/owner/POA/QC filters into progressive **More Filters** and hides them when the user lacks the corresponding permission.
- Added visible Suppression State: Active, Overridden, Reactivated, Closed.
- Integrated the Override action directly into Suppression Management for authorized users.
- Users without POC permission can see POC status but cannot manipulate it.
- Case ID, POA/QC, POC, and general case management editability are permission-specific.
- Made ASIN clickable into the V9.1 product detail drawer.

### Access and Security
- Super Admin is now authoritative full access in both UI and Firebase helper logic.
- Super Admin receives both marketplaces, all categories, all V9.1 modules, all actions, all upload/download scopes.
- Super Admin checkboxes are automatically checked and locked in the access editor.
- Added permissions for Price Updates and Data Administration.
- Restricted Data Administration to Super Admin.

### Data Administration
- Added **Settings → System → Data Administration** for Super Admin only.
- Supports clearing processed Amazon pricing, Amazon suppression, Amazon Buy Box, Flipkart pricing, inventory analysis, or an entire processed snapshot by report date.
- Clearing processed data does **not** delete locally stored uploaded source-file versions.
- Requires an audit reason and writes a data-administration audit record.

### Update Verification
- Added persistence for generated marketplace update batches.
- Added statuses: Pending Reflection, Reflected, Partially Reflected, Still Incorrect.
- Verification compares generated target values against the latest completed marketplace snapshot.

### Data / Logic Fixes
- Fixed Amazon compact-row deserialization so Min SAP and Max SAP read indexes 32/33 instead of colliding with exception flags at 28–31.
- Live disparity continues to compare a valid marketplace live price directly against WF Price ±₹5; it does not require live price to differ from listing price.
- Flipkart Buy Box remains retired and excluded from issue/impact output.
- Removed the aggregate **OOS Product Days** KPI; per-product OOS duration remains available in historical drill-downs.

### Code Organization
- Added `js/wakesuite-v9.1.js` as a version-scoped enhancement layer instead of adding another large patch into core processing code.
- Added V9.1 Firebase operations extension in `js/wakesuite-firebase.js`.
- Added version/date headers to new V9.1 code sections.
- Added formal documentation and change-control policy under `/docs`.

### Migration Note
Snapshots created before V9.1 may not contain the new persisted raw-disparity flags. If an older date was originally saved while an exception had already removed a raw disparity, reprocess that date from its source files when exact historical reactivation is required.
