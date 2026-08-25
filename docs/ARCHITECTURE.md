# WakeSuite V9.3.2 Architecture

## Design principle
WakeSuite is modular: changing one marketplace template, upload parser, exception rule, suppression workflow or analytics module should not require editing unrelated functionality.

## Layers
1. **UI / views** — `index.html`, CSS and module renderers.
2. **Source adapters / parsing** — `js/config/upload-sources.js` and marketplace-specific adapters.
3. **Normalized data / identity** — atomic mappings, Product Resolver and processed snapshots.
4. **Business engines** — disparity, parity, suppression, exceptions, business insights.
5. **Storage / security** — `wakesuite-firebase.js`, Firestore rules, local IndexedDB raw/version cache.
6. **Exports** — marketplace template adapters and analytical exports.

## Shared core
- Auth / permissions
- Firestore access
- Product Resolver / canonical identity graph
- Navigation history / Back state
- Column manager
- Shared Date/Period controls
- Shared currency/decimal formatting
- Audit/logging

## Independent modules
- Dashboard routing and business-health cards
- Marketplace Insights
- Business Insights (Pricing / Inventory)
- Amazon/Flipkart standalone Price Parity
- Pricing Exceptions / Exception Insights
- Amazon Suppression Management
- Product 360
- Central History
- Data Administration
- Amazon and Flipkart Price Update adapters

## Source normalization
Source file → source-specific adapter/validator → normalized WakeSuite records → shared business engines → Dashboard/Insights/Product 360/History/Exports.
External column-name changes should be localized to source/adaptor configuration wherever possible.

### Exception Insights data path
Marketplace Order Report → daily normalized order rows → canonical identifier mapping → exception-scope aggregation → before/during/after comparison → inventory/suppression/Buy Box interference context → observed outcome.
Amazon Business Reports are intentionally outside this calculation path.

### Suppression lifecycle path
Fresh valid Amazon audit → derive Suppressed/Live marketplace state → preserve occurrence dates → overlay case/POC/POA/QC/override workflow → Dashboard/Management/History. Missing fresh audit does not infer Live.

### Product 360
A single Product Resolver accepts ASIN, FSN, WF SKU, AZ SKU or FK SKU, preserves one-to-many relationships, then renders only data allowed by marketplace/category/module permissions. Dashboard opens full page; module clicks may use scoped drawers.

## Performance guardrails
- Avoid Firestore query-per-row patterns.
- Cache snapshots and canonical mappings.
- Aggregate large datasets in one pass.
- Index exception matching.
- Lazy-load heavy History/Product 360 paths where practical.
- Keep page-level horizontal scrolling disabled; wide tables scroll internally.
