# WakeSuite V9.3.4 — Shared Analytics Filter Bar

## Purpose
Introduce one reusable analytics filter-bar UI across analytical pages while preserving the existing page-specific filters and business logic.

## Shared hierarchy
1. Period
2. Marketplace (where applicable)
3. Category
4. Identifier Search
5. Apply
6. Reset
7. Active filter chips
8. Custom/selected date inputs shown only when required

## Periods
- Today
- Yesterday
- Selected Date (where the page supports a single selected date)
- Last 7 Days
- Last 14 Days
- Last 30 Days
- Custom Range

## Covered analytical pages
- Dashboard
- Price Parity
- Revenue Impact
- Marketplace Insights
- Price Disparity Explorer
- Pricing History
- Inventory History
- Business Insights (Pricing and Inventory)
- Central History Hub

## Compatibility
The existing page-specific controls remain in the DOM for the proven processing/reporting engine. Shared controls synchronize to those controls on Apply/Reset. Analysis-specific controls such as disparity type, issue type, inventory state, price direction, sort, and column selection remain separate.

## UI behavior
- Desktop: compact single-row hierarchy where space permits.
- Tablet: two-row responsive arrangement.
- Mobile: stacked controls with no page-level horizontal movement.
- Identifier search uses a compact placeholder: `ASIN, FSN, WF SKU, AZ SKU, FK SKU`.
- Active filters appear as removable chips.
- No new backend schema or Firestore rule is required.
