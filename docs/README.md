# WakeSuite V9.3.11 — Flipkart audit price fix

This release includes the email resend correction and all locked POC/report/download/Drive fixes. See ../TASKS_DONE.md for the current fix, validation and reprocessing steps. Upload the contents of WakeSuite/ to the existing repository root. Keep runtime folders js/, css/ and assets/ together with index.html. docs/ and qa/ contain reference documents and validation evidence; removing these optional folders does not change runtime assets.

Unavailable FK audit prices remain unavailable. Existing legacy live results without audit evidence require reprocessing with the correct date's source files; listing/MRP results remain independent.

---

## V9.3.11
Priority sale-readiness communication build. Adds the locked Amazon POC format, inline Flipkart disparity mail, whole-rupee revenue-impact presentation, and category-based Drive POA generation/reuse using the four bundled DOCX masters. The Google OAuth client used by WakeSuite must allow the Google Drive scope used by the POA feature, and the deploying users who generate POAs must have write access to the configured POA category folders.

# WakeSuite V9.3.9

WakeSuite is the internal marketplace operations and analytics application for Amazon and Flipkart workflows. V9.3.9 is the current priority pre-sale consolidated build. AI / Ask WakeSuite is intentionally excluded.

## Deployment

Upload the **contents of this folder** to the root of the GitHub Pages repository so `index.html` remains at the repository root. Preserve any existing repository-specific files such as `.github/` or `CNAME` if used.

Publish `firestore.rules` separately in Firebase Console → Firestore Database → Rules. Uploading the file to GitHub does not deploy Firestore security rules.

After deployment, wait for GitHub Pages to finish and hard-refresh the browser (`Ctrl + Shift + R`).


## V9.3.9 priority hotfix — individual report actions
- Individual operational reports keep **Download Excel** and **Share via Email** as independent actions.
- Report action rows now wrap on desktop/tablet/mobile instead of being clipped by the title row or page-level horizontal-overflow protection.
- Runtime guards restore required Download/Email actions if a stale/partial DOM omits them.
- Disparity Orders and Marketplace Insights Download actions receive the same visibility protection.
- No report qualification, email-count, Buy Box APT, disparity-order attribution, pricing, suppression or analytics business rule changed in this hotfix.

## Main V9.3.8 changes

- Fixed zero-ASIN/FSN and empty-attachment strict Price Disparity emails.
- Preserved Download while adding separate POC email actions and keeping combined marketplace sends.
- Added multi-attachment Amazon Buy Box POC delivery with the generated APT.
- Removed the duplicate embedded Live Disparity order-impact panel.
- Reduced startup blocking by rendering the latest Dashboard before independent background hydration.

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
- `js/wakesuite-v9.3.8.js` — email/POC reliability, multi-attachment sending and release cleanup
- `js/core/` — shared navigation, columns, product resolver and UI controls
- `js/config/` — upload/source contracts and header aliases
- `js/modules/` — independently changeable marketplace/business/operations modules
- `assets/PriceAndQuantity.xlsm` — canonical Amazon price-update workbook
- `assets/BuyBox_APT_Template.xlsx` — user-supplied Amazon Buy Box APT workbook
- `firestore.rules` — Firestore security rules to publish separately
- `docs/` — business rules, architecture, Firestore notes and change-control process

## Important operating rules

- One atomic marketplace mapping per row; never concatenate multiple ASINs/AZ SKUs/FSNs/FK SKUs with `|`.
- General Pricing Exceptions do not rewrite raw marketplace mismatch; they change actionability only.
- Amazon Min/Max Pricing Issues use only `No Pricing Issue` as the manual treatment.
- Flipkart Buy Box is not part of WakeSuite current logic.
- Suppression State is only `Suppressed` / `Live`; case/POC/POA/QC/override are separate operational fields.
- Exception business impact is not estimated when required Order Report data is unavailable.

### V9.3.6
This build adds Amazon Disparity Orders and hardens spreadsheet ingestion against Audit Report column insertions/reordering. Audit fields are located by header name rather than fixed column position.


### V9.3.6 hotfix
Disparity Orders now remains visible after login/access hydration. Existing Amazon Live Disparity permission grants access to this child module automatically.


## V9.3.6 source coverage
Amazon Business Reports, Amazon Order Reports and Flipkart Order Reports now record explicit data coverage. Order uploads are safe across overlapping files through atomic line de-duplication. Business Report overlap is blocked because the source is period-aggregated.


### V9.3.7 — Amazon Buy Box APT
Amazon Buy Box Suppression now includes `Generate Buy Box APT`. WakeSuite uses the bundled user-supplied APT template, maps Merchant SKUs from WF SKU, GL from Category, and uses WF Price for every required price field. POA/QC generation is not part of this release.


### V9.3.8 — Reliability / communications
- Fixes strict disparity emails that could show `0 ASINs / 0 FSNs` and attach an empty workbook because strict rows do not use the legacy `parityStatus=Disparity` marker.
- Uses the selected visible disparity rows consistently for count, preview and attachment generation, and blocks empty sends.
- Restores Download beside email actions and supports combined/separate POC communications with unique identifier counts.
- Amazon Buy Box POC escalation includes the generated Buy Box APT attachment when Buy Box issues are present.
- Removes the old embedded Live Disparity Order Impact panel; use Amazon → Price Disparity → Disparity Orders.
- Moves non-critical startup hydration behind the first dashboard paint.


## V9.3.10 priority patch
Restores individual Price Disparity report controls and fixes backward-compatible Download permission hydration without changing report data logic.
