# WakeSuite V9.1 Architecture

## File layout

```text
WakeSuite_V9_1/
├── index.html
├── css/
│   └── wakesuite.css
├── js/
│   ├── wakesuite-app.js          # proven core parsing/processing and legacy-compatible helpers
│   ├── wakesuite-v9.1.js         # V9.1 UI/business-actionability layer
│   └── wakesuite-firebase.js     # authentication, Firestore, scoped persistence, V9.1 operations
├── assets/
│   └── PriceAndQuantity.xlsm     # canonical Amazon Price & Quantity update template
├── CHANGELOG.md
├── README.md
└── docs/
    ├── ARCHITECTURE.md
    ├── BUSINESS_RULES.md
    ├── CHANGE_CONTROL.md
    └── FIRESTORE_V9_1.md
```

## Processing model

```text
Source reports
    ↓
Raw marketplace detection
    ↓
Persist raw issue flags + product state
    ↓
Exception / suppression-override overlay
    ↓
Actionable state
    ↓
Dashboard / Insights / Emails / Price Updates / Downloads
```

Raw marketplace state and business actionability are intentionally separate.

## Local raw file cache
Flipkart marketplace-ready CSV generation uses the latest successful raw Flipkart Listing File cached in browser IndexedDB for that report date. The large daily Flipkart file is not shipped as a static application asset.

## Amazon template
Amazon update generation loads `assets/PriceAndQuantity.xlsm`, preserves its workbook structure through SheetJS, and populates only fields required by the selected action.

## New V9.1 Firestore concepts
- `marketplace_update_batches`: generated marketplace correction batches and row targets.
- `system_audit_log`: privileged processed-data deletion audit records.
- Existing `pricing_exceptions` stores target/rule metadata in addition to identifier/effective period.
- Existing `suppression_overrides` is also read as a workflow state in Suppression Management.

See `FIRESTORE_V9_1.md` for collection details and deployment notes.


## V9.1.1 performance architecture

Dashboard rendering is split into a fast primary render and non-blocking secondary enrichment. Pricing Exceptions are loaded once and applied through an indexed lookup. Expanded snapshot rows with exception overlays are cached per snapshot and invalidated by the exception-version token. Action Center workflow reads use a short-lived cache and update after the primary Dashboard is already usable. Update Verification is not fetched by Dashboard; it is loaded only within Price Updates.
