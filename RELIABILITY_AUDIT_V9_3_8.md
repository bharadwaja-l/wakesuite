# WakeSuite V9.3.8 Reliability Audit

Date: 06 Oct 2026

## Exact cause of the `0 ASINs` Live Price Disparity email
V9.3.7's strict Price Disparity email path passed `v6DisparityExplorerRawRows` into the legacy email engine. The legacy `v4EmailIssueRows()` then kept price rows only when `parityStatus === "Disparity"`. Explorer rows use disparity flags / `issueTypes` rather than relying on that `parityStatus` field, so valid selected-period rows could be filtered out at email generation time. The email therefore resolved `{{COUNT}}` to `0`, and the attachment could be generated from an empty row set even though the visible report contained disparity rows.

## Fixes applied
- Strict disparity email now uses the actual currently filtered/aggregated Explorer rows for the selected period and category/search state.
- Email issue-row qualification accepts explicit Listing/Live/MRP issue flags and `issueTypes`, not only `parityStatus`.
- Email rows normalize Amazon `ASIN` / Flipkart `FSN` plus marketplace SKU aliases before counts, summaries and attachment generation.
- Individual email generation refuses to proceed when there are no selected report rows.
- Individual email generation/send is blocked when rows exist but no valid marketplace identifier can be resolved; WakeSuite will not send a false `0 ASINs` / `0 FSNs` message.
- Summary totals use unique ASINs / FSNs rather than summing category counts, avoiding double counting when the same identifier occurs in more than one category/report row context.
- Email workbook and filename resolution use the report's own `viewKey`, preventing a later navigation state from changing the attachment format.

## POC / Daily Communications audit
- Download is available independently of Email.
- Combined Amazon and Flipkart POC sends remain available.
- Separate issue-type POC sends are available.
- POC email bodies show per-issue unique identifier counts plus a deduplicated total unique ASIN/FSN count.
- Amazon POC sends with Buy Box Suppression add the Buy Box APT as a second attachment.
- Buy Box APT row resolution accepts POC `productId` / `identifier` aliases and resolves them to the affected ASIN before generating the template.

## Disparity Orders / UI audit
- Legacy embedded `Live Price Disparity · Order Impact` presentation is retired.
- Amazon Disparity Orders remains the dedicated order-evidence module.
- Disparity Orders remains permission-compatible with existing Amazon Live Disparity access.

## Startup/performance audit
- Latest permitted dashboard data is hydrated before non-critical background startup tasks finish.
- Upload configuration and Master Pricing cache load in the background after initial access/dashboard startup.
- Refresh/login remains read-only and does not automatically process/write a new snapshot.

## Validation executed
- JavaScript syntax check across every `.js` file: pass.
- HTML ID uniqueness: 625 IDs, 0 duplicates.
- Local script/style/asset reference check: 42 references, 0 missing.
- Script source duplication check: 0 duplicate script includes.
- V9.3.8 runtime layer included exactly once.
- Synthetic strict-email alias test (`identifier`/`marketSku` -> `asin`/`azSku`): pass.
- Unique Amazon POC count test with cross-issue ASIN overlap: pass.
- Multi-attachment Gmail MIME construction test: pass.
- Buy Box APT POC `productId` -> ASIN resolution test: pass.
- Bundled Buy Box APT template SHA-256 matches the user-provided template exactly.
