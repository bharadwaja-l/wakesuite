# WakeSuite V9.3.3

WakeSuite is the internal marketplace operations and analytics application for Amazon and Flipkart workflows. V9.3.3 is the consolidated post-review build. AI / Ask WakeSuite is intentionally excluded.

## Deployment

Upload the **contents of this folder** to the root of the GitHub Pages repository so `index.html` remains at the repository root. Preserve any existing repository-specific files such as `.github/` or `CNAME` if used.

Publish `firestore.rules` separately in Firebase Console → Firestore Database → Rules. Uploading the file to GitHub does not deploy Firestore security rules.

After deployment, wait for GitHub Pages to finish and hard-refresh the browser (`Ctrl + Shift + R`).

## Main V9.3.3 changes

- Added one analytical Order Report path for Exception Insights, Live Price Disparity Impact and Inventory History velocity analysis.
- Added Amazon FBA / FBM analysis and Flipkart `Fulfillment By` analysis.
- Added Live Price Disparity order overlap, units, Amazon order revenue, modeled impact, exception-excluded days and category/fulfilment breakdowns.
- Added DRR and order-day velocity columns to Inventory History.
- Business Insights now mirrors the Marketplace Insights view-switch pattern with `Insights`, `Detailed Data` and `History`.
- Active effective Live Price exceptions are excluded from actionable disparity impact while raw mismatches remain visible.
- Flipkart Order Report revenue is not estimated because the provided schema contains no revenue field.

## Main V9.3.2 changes

- Balanced Dashboard with native operational routing, Price Change Performance, Inventory Risk and a single revenue-impact summary strip.
- Full-page Dashboard Product 360 with explicit marketplace coverage states.
- Marketplace Insights remains marketplace-issue focused; Business Insights is separate and follows the same interaction pattern.
- Pricing Exceptions is fully self-contained with Add Exceptions, Exceptions Manager and Exception Insights.
- Exception Insights uses marketplace Order Reports exclusively for observed business-impact analysis.
- Suppression Management is a permission-aware operations console with Suppressed/Live marketplace state, editable POC/POA/QC/case workflow and selected-ASIN bulk actions.
- Dynamic History filters, atomic one-mapping-per-row history, Marketplace Data diagnostics, standardized dates/columns/currency, and granular Data Administration/source deletion.

## Project structure

- `index.html` — application shell and views
- `css/` — base/responsive/V9.3.2 UI styles
- `js/wakesuite-app.js` — proven shared processing/runtime layer
- `js/wakesuite-firebase.js` — Firebase/Firestore integration
- `js/core/` — shared navigation, columns, product resolver and UI controls
- `js/config/` — upload/source contracts and header aliases
- `js/modules/` — independently changeable marketplace/business/operations modules
- `assets/PriceAndQuantity.xlsm` — canonical Amazon price-update workbook
- `firestore.rules` — Firestore security rules to publish separately
- `docs/` — business rules, architecture, Firestore notes and change-control process

## Important operating rules

- One atomic marketplace mapping per row; never concatenate multiple ASINs/AZ SKUs/FSNs/FK SKUs with `|`.
- General Pricing Exceptions do not rewrite raw marketplace mismatch; they change actionability only.
- Amazon Min/Max Pricing Issues use only `No Pricing Issue` as the manual treatment.
- Flipkart Buy Box is not part of WakeSuite current logic.
- Suppression State is only `Suppressed` / `Live`; case/POC/POA/QC/override are separate operational fields.
- Exception business impact is not estimated when required Order Report data is unavailable.

### V9.3.4 UI update
WakeSuite now uses a shared analytics filter-bar UI across analytical workspaces. The component is a presentation/compatibility layer and synchronizes with existing page controls so established report engines remain reusable. Page-specific analytical filters remain separate.
