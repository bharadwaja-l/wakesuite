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

## V9.3.3
Added `js/wakesuite-v9.3.3.js` as an independent analytics extension. It reads existing versioned raw files, maps Order Reports through existing master pricing mappings, and overlays order impact on Live Price Disparity and Inventory History without changing the core snapshot schema. `css/wakesuite-v9.3.3.css` contains isolated presentation changes.

## V9.3.5 additions

### Dynamic spreadsheet schema resolver
`readWakeSuiteFile()` now inspects worksheet rows before parsing. It scores candidate header rows against known report definitions, selects the strongest recognized schema, and then parses the worksheet from that detected row. Downstream readers continue to resolve values using canonical header names, so physical column indexes are not part of the data contract.

### Disparity Orders analytical view
`js/modules/disparity/disparity-orders.js` combines:
1. stored Amazon daily pricing/audit snapshots,
2. raw Amazon Order Report rows,
3. canonical AZ SKU/ASIN/WF SKU mappings,
4. effective exception state already present on the daily disparity row.

The join key is date + AZ SKU where possible, falling back to date + ASIN. Only raw Live Price Disparity dates qualify.


## V9.3.6 coverage-aware source ingestion
Data Center stores coverage metadata (`coverageFrom`, `coverageTo`, `coverageDays`) with local report versions for Amazon Business and marketplace Order Reports. Order analytics de-duplicate across successful raw versions before downstream Exception, Disparity Orders and Inventory/DRR consumers.


## V9.3.7 — Buy Box APT adapter
`js/wakesuite-v9.3.7.js` provides a version-scoped Amazon Buy Box APT generator backed by `assets/BuyBox_APT_Template.xlsx`. It resolves filtered Buy Box ASINs to atomic ASIN/WF SKU rows from loaded Amazon snapshots, validates required mapping/pricing fields, writes the template fields, preserves the supplied workbook structure/styles where possible, and downloads the completed XLSX locally. No new Firestore collection or schema is introduced.


## V9.3.8 reliability layer
`js/wakesuite-v9.3.8.js` is a compatibility/reliability layer loaded after V9.3.7 and before Firebase startup. It normalizes email identifiers across strict disparity, historical-report and POC row shapes so counts and exported attachments share one identifier contract. It also supplies multi-attachment POC MIME generation and keeps Download available independently of email. Startup-critical dashboard hydration remains in the core/Firebase path; non-critical source/config/master-pricing hydration runs after the first dashboard paint.


### V9.3.8 report-bound email pipeline
The strict Price Disparity page captures its visible rows and view key into the email package. Count, preview and attachment generation use the same package instead of re-filtering through the legacy parity marker or mutable global navigation state. Daily Communications keeps the existing issue-qualification engine and adds a multi-attachment MIME sender so an Amazon Buy Box escalation can carry both the normal POC workbook and the generated APT.

### V9.3.8 startup sequencing
The latest completed snapshot is rendered first. Local source restoration, upload configuration, Master Pricing cache and suppression workload then hydrate independently. Snapshot/range and IndexedDB report caches are reused to avoid immediately loading the same data again.

## V9.3.9 report-action visibility layer
`css/wakesuite-v9.3.9.css` gives individual-report action rows a bounded, wrapping layout so page-level horizontal overflow protection cannot clip Download or Email actions. `js/wakesuite-v9.3.9.js` is intentionally narrow: it verifies required report-action buttons exist and restores only a missing action element. It does not alter report data, filtering, access qualification, email contents, APT generation, or persistence.

## V9.3.10 report-control compatibility
Individual report action visibility is permission-aware. Effective permissions are resolved by merging the role preset with explicit stored user overrides so older access documents do not lose default actions merely because a newer permission key is absent. Price Disparity strict reports keep the shared analytics filter bar while exposing the dedicated report-type selector and sort control.
