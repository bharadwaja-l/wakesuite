# WakeSuite V9.3.10 — Individual Report Controls

## Corrected behavior

### Price Disparity strict reports
Amazon and Flipkart Listing / Live / MRP pages display:
- Shared period/category/identifier filters
- Report Type dropdown (Listing / Live / MRP)
- Sort dropdown
- Download Excel (when effective access permits download)
- Share via Email (when effective access permits email)

Changing Report Type opens the corresponding dedicated strict report. It does not merge Listing, Live and MRP rows.

### Permission compatibility
Older saved access documents may omit the `download` field. V9.3.10 resolves effective permissions as:
1. Role preset
2. Explicit stored permission overrides

Therefore an omitted key inherits the role default, while an explicit `false` remains denied.
