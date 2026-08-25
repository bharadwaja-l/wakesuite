# WakeSuite Change Control

Every WakeSuite change must follow: **review → lock requirement → consolidate → implement once → validate → document → package**.

## Mandatory documentation
- Any code change → `CHANGELOG.md`
- Business-rule change → `docs/BUSINESS_RULES.md`
- Architecture/module-boundary change → `docs/ARCHITECTURE.md`
- Firestore/security/data-model change → Firestore documentation + `firestore.rules` where applicable
- Process changes → this file

## Shared-component rule
Common interactions (Date/Period selector, Columns selector, Back navigation, currency formatting, status filters, bulk-selection patterns) should use reusable shared components rather than page-local duplicates.

## Regression checklist before release
- Dashboard loads without renderer hang and card routing is native/context-correct.
- Product 360 global search and marketplace coverage render correctly.
- Marketplace Insights contains no Business Insights leakage and Approved Exceptions use canonical exception data.
- Business Insights Pricing/Inventory controls and history routes work.
- Suppression State is Suppressed/Live; POC/POA/QC/case edits and selected-ASIN bulk actions respect permissions.
- Existing exceptions load; Exceptions Manager bulk edit/remove and Exception Insights data-availability behavior work.
- Marketplace Data distinguishes missing data from zero filtered rows.
- History filters are type-specific and no options leak between history types.
- Data Administration clear/delete-source workflows require preview/confirmation/reason and audit.
- Mobile sidebar does not shift the page; no page-level horizontal scrolling.
- JavaScript syntax, duplicate IDs, local references and inline handlers are validated.
- ZIP integrity is verified before handoff.
