# WakeSuite V9.3 Architecture

## File layout

```text
WakeSuite_V9_3/
├── index.html
├── css/
│   ├── wakesuite.css
│   ├── wakesuite-responsive.css
│   └── wakesuite-v9.3.css
├── js/
│   ├── wakesuite-app.js
│   ├── wakesuite-v9.1.js
│   ├── wakesuite-v9.2.js
│   ├── wakesuite-v9.3.js
│   ├── wakesuite-firebase.js
│   ├── core/
│   │   ├── module-registry.js
│   │   ├── navigation-history.js
│   │   ├── column-manager.js
│   │   └── product-resolver.js
│   ├── config/
│   │   └── upload-sources.js
│   └── modules/
│       ├── admin/data-administration.js
│       ├── business/business-insights.js
│       ├── dashboard/dashboard-routing.js
│       ├── exceptions/pricing-exceptions.js
│       ├── history/history-hub.js
│       ├── insights/marketplace-insights.js
│       ├── parity/price-parity.js
│       ├── price-updates/
│       │   ├── amazon-template-adapter.js
│       │   ├── flipkart-template-adapter.js
│       │   └── price-updates-v9.3.js
│       ├── pricing-issues/amazon-pricing-issues.js
│       ├── product360/product360.js
│       └── suppressions/
│           ├── suppression-lifecycle.js
│           └── suppression-management-v9.3.js
├── assets/
│   └── PriceAndQuantity.xlsm
├── CHANGELOG.md
├── README.md
└── docs/
    ├── ARCHITECTURE.md
    ├── BUSINESS_RULES.md
    ├── CHANGE_CONTROL.md
    └── FIRESTORE_V9_1.md
```

## Architectural rule
Major workflows are independently changeable. A marketplace template/header change should normally be localized to its adapter/config rather than requiring edits to Dashboard, Exceptions, Suppression or unrelated analytics.

Layers are separated conceptually as:

```text
UI
↓
Business rules / actionability
↓
Normalized WakeSuite data
↓
Source adapters/parsers + persistence
↓
Raw source files / Firestore / browser cache
```

Shared core services remain centralized: Auth, Permissions, Firestore access, snapshot/cache handling, audit/logging, common UI utilities, navigation history, column preferences and Product Resolver.

## Processing / actionability model

```text
Source reports
    ↓
Source-specific adapter / parser
    ↓
Normalized atomic marketplace rows
    ↓
Raw marketplace issue detection
    ↓
Exception / suppression-override / No-Pricing-Issue overlay
    ↓
Actionable state
    ↓
Dashboard / Native reports / Insights / Emails / Price Updates / Downloads / History
```

Raw marketplace truth is never silently rewritten by an exception/override. Operational treatments change actionability only.

## Atomic identity model
ASIN, FSN, WF SKU, AZ SKU and FK SKU are atomic identifiers. One-to-many mappings are preserved as separate rows/edges. Multiple identifiers must never be concatenated with `|` for normalized storage/presentation.

`js/core/product-resolver.js` is the canonical identity resolver. Context-aware Product 360 uses the resolver and then applies permission/module scope before rendering/exporting.

## Navigation model
Dashboard drilldowns route to native operational/report pages, not Marketplace Insights by default. A context stack captures originating view + control state so Back can restore the prior WakeSuite state. Browser Back remains compatible where possible.

## Price Parity module
Price Parity is a standalone Amazon/Flipkart module outside Price Disparity. It reads normalized snapshots, applies the exception/actionability model and calculates parity with approved exceptions excluded from the denominator.

## Marketplace Insights vs Business Insights
Marketplace Insights is marketplace-issue analysis only. Pricing and Inventory decision-support analytics live under the separate Business Insights module. Central History is read-only and complements module-specific History tabs.

## Pricing Exceptions
`pricing_exceptions` is the single exception source of truth. Future creation is handled by `js/modules/exceptions/pricing-exceptions.js`; Upload Center no longer owns the operational exception workflow. Existing exception records remain available to Exceptions Manager.

## Price Update adapters
- Amazon: `amazon-template-adapter.js` maps targets into `assets/PriceAndQuantity.xlsm`.
- Flipkart: `flipkart-template-adapter.js` uses the latest uploaded Flipkart Listing File structure and produces CSV.
- `price-updates-v9.3.js` owns selection modes/workflow behavior.

## Suppression lifecycle
Suppression records expose occurrence lifecycle (First Seen / Last Seen / Resolved On / Reactivated / Closed) separately from case workflow timestamps. Bulk actions apply only to selected ASINs and are audited per ASIN where supported.

## Data Administration
Super Admin can clear processed data and, separately, remove uploaded source versions. Source-file deletion is explicit and must invalidate only downstream processed outputs derived from that source version. Raw source deletion and processed-data clearing remain distinct workflows.

## Local raw file cache
Large uploaded source versions may live in browser IndexedDB (`report_versions` / `raw_files`) for runtime reuse. Firestore stores processed/shared state and audit collections. A wrong source version can be explicitly removed through Data Administration without silently deleting unrelated history.

## Performance
- Reuse loaded snapshots/cache for dashboard drilldowns.
- Keep exception matching indexed/cached.
- Lazy-load heavy history/product detail where practical.
- Avoid duplicate Firestore reads and page-wide reprocessing.
- Wide tables scroll inside their own containers; mobile sidebar is fixed off-canvas and does not shift page width.
