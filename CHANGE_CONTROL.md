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

## V9.3.3 change control
Order analytics is isolated in `js/wakesuite-v9.3.3.js`. Future changes to Order Report aliases, fulfilment normalization, disparity attribution or inventory velocity should be localized there unless a source contract changes; source aliases remain documented in `js/config/upload-sources.js`.

## V9.3.5 change record — 04 Oct 2026
- Approved: new Amazon `Price Disparity → Disparity Orders` menu.
- Approved: include only orders overlapping actual Live Price Disparity dates.
- Approved: dynamic Audit Report parser based on header names; tolerate added/reordered columns.
- Explicitly not added: audit alias-learning/manual column mapping because source column names are unchanged.
- No Firestore security-rule change.


## V9.3.6
Approved scope: fix attached UI duplication/overflow issues and add source-range controls plus overlap protection for Amazon Business Reports, Amazon Order Reports and Flipkart Order Reports.


## 06 Oct 2026 — V9.3.7
Approved scope: implement Amazon Buy Box APT generation using the supplied template and locked WF-price mapping. POA/QC generation intentionally deferred to a future upgrade.


## 06 Oct 2026 — V9.3.8
Approved correction scope:
- fix zero-ASIN/FSN and empty-attachment strict disparity email regression across Amazon and Flipkart price-disparity report types;
- preserve Download while adding separate issue-type POC email actions and retaining combined marketplace sends;
- attach the Buy Box APT automatically to Amazon Buy Box POC escalation;
- use unique ASIN/FSN counts in communication bodies;
- remove the redundant embedded Live Disparity order-impact panel in favor of dedicated Disparity Orders;
- optimize startup sequencing/caching without changing business calculations;
- keep POA/QC generation deferred.


## V9.3.8 — 06 Oct 2026
- Corrected strict disparity email row qualification/counting so selected-period report rows cannot produce a false 0-ASIN/0-FSN email.
- Added canonical identifier normalization and send-time validation for report emails.
- Restored Daily Communications Download actions and added unique identifier POC summaries plus Buy Box APT multi-attachment sending.
- Moved non-critical startup hydration behind first dashboard paint and kept startup read-only.
- Removed legacy embedded Live Disparity order-impact presentation in favor of the dedicated Disparity Orders module.

## 06 Oct 2026 — V9.3.9 priority hotfix
Approved scope: restore and harden individual-report Download visibility before the 08 Oct sale. Changes are limited to report action layout/visibility and a missing-action DOM guard. No pricing, disparity, suppression, email-count, APT, order-attribution, access-control, upload, or analytics business logic may change as part of this hotfix.
