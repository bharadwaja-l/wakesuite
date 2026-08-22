# WakeSuite V9.2

WakeSuite V9.2 is the 22 Aug 2026 modular, responsive, product-intelligence release built on the proven V9.1.1 core. **AI / Ask WakeSuite is intentionally not included.**

## Deploy
Upload the **contents of this folder** to the root of the existing GitHub Pages repository and preserve the paths.

```text
index.html
css/
  wakesuite.css
  wakesuite-responsive.css
js/
  wakesuite-app.js
  wakesuite-v9.1.js
  wakesuite-v9.2.js
  wakesuite-firebase.js
  core/
  config/
  modules/
assets/
  PriceAndQuantity.xlsm
CHANGELOG.md
docs/
```

Do not upload the ZIP itself as the site and do not place `index.html` one folder below the Pages root.

## V9.2 highlights
- Modular adapters/config for Amazon Price Updates, Flipkart Price Updates and Upload Center schemas.
- Marketplace Insights is issue-focused: Overview, Price Parity, Price Disparity, Amazon Suppression, Amazon Buy Box, Exceptions and Revenue Impact.
- Pricing Insights and Inventory Insights are independent under **Business Insights**.
- Pricing Exceptions now has **Add Exceptions** and **Exceptions Manager**, including Edit and soft **Remove Exception**.
- `Parity` is available as an Exception Type for every general pricing target.
- Amazon Min/Max Pricing Issues are separate from general Pricing Exceptions and use only **No Pricing Issue**.
- Amazon suppression cases have First Seen, Last Seen, Age, Resolved On and lifecycle state, plus operational timestamps.
- ASIN / FSN / WF SKU / AZ SKU / FK SKU identifiers are clickable and open context-aware Product 360 details.
- Dashboard global identifier search opens full permitted Product 360 and supports product-level download.
- Mobile UI is adaptive with a fixed off-canvas sidebar and no page-level horizontal panning.
- Suppression **More Filters** expands inline rather than floating over the table/sidebar.
- Flipkart Buy Box is retired from the current V9.2 UI, active marketplace processing, actionable totals and current persistence path.

## Important business behavior
- Price tolerance: WF Price ± ₹5.
- Live Price Disparity is a separate issue only when a valid live price **differs from listing price** and is outside WF Price ± ₹5. If live equals listing, that mismatch is handled as Listing Price Disparity only.
- Approved exceptions preserve the raw mismatch but remove the matching target from actionability/revenue impact.
- Amazon Min SAP target = Amazon Listing Price × (1 − configured reduction %, default 5%).
- Amazon Max SAP target = WF MRP.
- Amazon update output uses `assets/PriceAndQuantity.xlsm`.
- Flipkart Price/MRP update output uses the latest locally cached Flipkart Listing File for that report date and downloads CSV.

## Modular change points
For common future changes, edit only the relevant file where possible:

```text
js/config/upload-sources.js
  Upload source header aliases / validation contract

js/modules/price-updates/amazon-template-adapter.js
  Amazon marketplace update template adapter

js/modules/price-updates/flipkart-template-adapter.js
  Flipkart marketplace update CSV adapter

js/modules/exceptions/pricing-exceptions.js
  General Pricing Exceptions workflow

js/modules/pricing-issues/amazon-pricing-issues.js
  Amazon Min/Max issue workflow

js/modules/suppressions/suppression-lifecycle.js
  Suppression lifecycle / management presentation

js/modules/insights/marketplace-insights.js
  Marketplace issue analysis UX

js/modules/business/business-insights.js
  Pricing / Inventory decision-support shell

js/core/product-resolver.js
js/modules/product360/product360.js
  Canonical identifier resolution and context-aware product detail
```

Shared authentication, Firestore, permissions, snapshot persistence and proven parsers remain centralized.

## Documentation
Every production change must update `CHANGELOG.md` and the applicable docs:
- `docs/BUSINESS_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/FIRESTORE_V9_1.md` (kept at this path for deployment continuity; contains V9.2 additions)
- `docs/CHANGE_CONTROL.md`

## Validation included for this package
- `node --check` on every JavaScript file.
- HTML parse / duplicate-ID validation.
- Module/script file existence checks.
- Amazon template integrity/hash verification against the V9.1.1 packaged source template.
- ZIP integrity test.

## Live-environment checks still required after deployment
Firebase Authentication, deployed Firestore Security Rules, Google Sheets OAuth, Gmail actions and marketplace acceptance of generated files depend on the live WakeSuite environment and cannot be fully exercised by an offline package validation.
