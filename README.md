# WakeSuite V9.3

WakeSuite V9.3 is the consolidated 23 Aug 2026 release that applies the locked Dashboard, Price Parity, Business Insights, History, Pricing Exceptions, Suppression Management, Marketplace Data, Data Administration, responsive UI and modular-maintainability changes. **AI / Ask WakeSuite is intentionally excluded.**

## Deploy
Upload the **contents of this folder** to the root of the existing GitHub Pages repository and preserve the paths.

```text
index.html
css/
  wakesuite.css
  wakesuite-responsive.css
  wakesuite-v9.3.css
js/
  wakesuite-app.js
  wakesuite-v9.1.js
  wakesuite-v9.2.js
  wakesuite-v9.3.js
  wakesuite-firebase.js
  core/
  config/
  modules/
assets/
  PriceAndQuantity.xlsm
CHANGELOG.md
docs/
```

Do not upload the ZIP itself as the website and do not place `index.html` one folder below the configured GitHub Pages root.

## V9.3 highlights
- Dashboard cards/sub-counts route to their native reports/workflows with the selected Dashboard date/category context instead of disturbing Marketplace Insights.
- Standalone Amazon and Flipkart **Price Parity** report pages with date/range analysis, category parity, daily trend, detailed data, columns and download.
- Dashboard global identifier search opens permission-aware **Product 360** for ASIN / FSN / WF SKU / AZ SKU / FK SKU.
- Marketplace Insights is issue-analysis only; Pricing Insights and Inventory Insights are independent under **Business Insights**.
- Business Insights includes filterable analysis, Custom Range, 7/14/30-day pricing comparison, inventory risk/restock analysis and module history.
- Added a centralized read-only **History** menu for pricing, inventory, suppression, Buy Box, exceptions, updates, mappings, uploads and Data Administration audit trails.
- Pricing Exceptions is self-contained under **Add Exceptions / Exceptions Manager**; existing `pricing_exceptions` records remain the source of truth.
- Exceptions Manager supports View, Edit and soft **Remove Exception**. `Parity` is available for all general pricing targets.
- Amazon Min/Max Pricing Issues remain separate and use only **No Pricing Issue** as the manual treatment.
- Amazon and Flipkart Price Update selector order: **All, Price, Live Price, Price + Live Price, MRP**.
- Suppression Management includes lifecycle dates, suppression-scoped detail/download, multi-ASIN selection and shared Case ID application to selected ASINs only.
- Marketplace Data loads the selected/latest processed Amazon or Flipkart dataset and supports mapping/identifier history.
- Data Administration supports granular processed-data deletion and explicit source-version deletion with Today / Yesterday / Single Date / Custom Range, preview, confirmation, reason and audit.
- Wide operational tables use reusable column selectors and visible-column exports where supported.
- Atomic identifier rule: one marketplace mapping per row; no `AZ SKU A | AZ SKU B` style concatenation in V9.3 normalized/history/report views.
- Mobile UI uses an adaptive fixed off-canvas sidebar and prevents page-level horizontal panning.

## Key business behavior
- Selling-price tolerance = **WF Price ± ₹5**.
- Listing Price Disparity compares marketplace listing price to WF Price.
- Live Price Disparity compares a valid live price **directly to WF Price**; the live price does not need to differ from listing price.
- MRP Disparity compares marketplace MRP to WF MRP.
- Price Parity states are Parity / Actionable Disparity / Approved Exception; approved exceptions are excluded from the parity denominator.
- `Parity % = Parity / (Parity + Actionable Disparity)`.
- Approved exceptions preserve the raw mismatch and remove only the matching target from actionability/revenue impact during the active period.
- General exception targets: Price, Live Price Only, MRP, Price + MRP, All Pricing.
- General exception types include Pricing, Parity, Amazon Deal Tag, Flipkart Opt-In and Category Exception.
- Amazon Min SAP target = Amazon Listing Price × (1 − configured reduction %, default 5%).
- Amazon Max SAP target = WF MRP.
- Amazon marketplace output uses `assets/PriceAndQuantity.xlsm`.
- Flipkart Price/MRP output uses the latest cached Flipkart Listing File structure and downloads CSV.
- Buy Box Suppression is Amazon-only.

## Modular change points
Future marketplace/source changes should be localized where possible:

```text
js/config/upload-sources.js
  Upload source headers, aliases and validation contracts

js/modules/price-updates/amazon-template-adapter.js
  Amazon PriceAndQuantity template mapping/output

js/modules/price-updates/flipkart-template-adapter.js
  Flipkart listing-file CSV mapping/output

js/modules/exceptions/pricing-exceptions.js
  General Pricing Exceptions creation/management

js/modules/pricing-issues/amazon-pricing-issues.js
  Amazon Min/Max Pricing Issues / No Pricing Issue

js/modules/suppressions/
  Suppression lifecycle and management/bulk workflow

js/modules/parity/price-parity.js
  Standalone Price Parity reports

js/modules/business/business-insights.js
  Pricing / Inventory decision-support and history

js/modules/history/history-hub.js
  Central read-only history hub

js/modules/admin/data-administration.js
  Super Admin deletion/preview/audit UI

js/core/product-resolver.js
js/modules/product360/product360.js
  Canonical identifier resolution and context-aware Product 360
```

Shared authentication, permissions, Firestore, snapshot persistence, audit/logging and common UI utilities remain centralized.

## Documentation
Every production change must update `CHANGELOG.md` and the applicable docs:
- `docs/BUSINESS_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/FIRESTORE_V9_1.md` (path retained for deployment continuity; contains V9.3 additions)
- `docs/CHANGE_CONTROL.md`

## Package validation
The final package is checked for:
- JavaScript syntax with `node --check` on every JS file.
- HTML parsing and duplicate IDs.
- Local CSS/JS reference existence.
- Inline HTML handler symbol resolution.
- absence of the broken `requireApprovedAccess` reference.
- Amazon `.xlsm` ZIP/container integrity.
- ZIP archive integrity.

## Live-environment validation after deployment
Firebase Authentication, deployed Firestore Security Rules, Google integrations, Gmail actions and marketplace acceptance of generated files depend on the live WakeSuite environment and cannot be fully certified by offline/static package checks alone.
