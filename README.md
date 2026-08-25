# WakeSuite V9.3.2

WakeSuite is the internal marketplace operations and analytics application for Amazon and Flipkart workflows. V9.3.2 is the consolidated post-review build. AI / Ask WakeSuite is intentionally excluded.

## Deployment

Upload the **contents of this folder** to the root of the GitHub Pages repository so `index.html` remains at the repository root. Preserve any existing repository-specific files such as `.github/` or `CNAME` if used.

Publish `firestore.rules` separately in Firebase Console → Firestore Database → Rules. Uploading the file to GitHub does not deploy Firestore security rules.

After deployment, wait for GitHub Pages to finish and hard-refresh the browser (`Ctrl + Shift + R`).

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
