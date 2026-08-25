# WakeSuite Firestore Notes — V9.3.2

`firestore.rules` is the deployable security rules file for this package and must be published separately in Firebase Console.

## Authoritative access
`access_users/{uid}` is the access source of truth. `role = super_admin` has authoritative full access. Marketplace/category/module/action permissions are enforced by rules for writes and sensitive reads.

## Key collections used by current workflows
- `access_users`, `access_requests`, `access_invites`
- processed daily snapshot metadata/chunks
- `pricing_exceptions`
- `amazon_pricing_issue_overrides`
- `suppression_cases`, suppression case audit/history collections
- `suppression_overrides`
- marketplace update batch metadata/chunks
- user preferences/column defaults where configured
- Data Administration audit records

Large uploaded source files/versions may also be cached in browser IndexedDB (`report_versions`, `raw_files`) for runtime processing. Source deletion from Data Administration removes the selected local version and invalidates only affected downstream processed outputs.

## V9.3.2 suppression permissions
- `suppressionOverride` controls override actions.
- `raiseCaseId` controls Case ID writes.
- `manageSuppressions` controls general case workflow/owner/notes/lifecycle writes.
- `managePoaQc` controls POA/QC writes.
- `pocEscalation` controls POC workflow writes.

Suppression State is stored as `Suppressed` / `Live`; it is marketplace condition, not a case-status value.

## Pricing Exceptions
`pricing_exceptions` remains the canonical exception store for Add Exceptions, Exceptions Manager, Marketplace Insights approved-exception counts, Product 360 and Exception Insights. Soft removal preserves audit fields and history.

## Exception Insights
Daily Order Reports are read from uploaded source versions/raw cache, not merged into Amazon Business Report revenue. Removing an Amazon/Flipkart Order Report version invalidates Exception Insights derived output for the affected source/date.

## Data Administration
Destructive actions are Super Admin-only and must be audited. Clear Processed Data and Delete Source File are separate operations.
