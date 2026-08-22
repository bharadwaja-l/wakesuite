# WakeSuite V9.1 Firestore Additions

## Existing collections used
- `daily_snapshots`
- `access_users`
- `access_requests`
- `access_invites`
- `pricing_exceptions`
- `suppression_cases`
- `suppression_overrides`
- `poc_escalations`
- `communication_log`
- `system_settings`
- `user_preferences`

## New collection: `marketplace_update_batches`
Metadata document fields include:
- reportDate
- marketplace
- mode (`price_mrp` or `min_max`)
- updateType
- fileName
- rowCount
- status
- generatedBy
- generatedAt
- generatedAtText
- scopeKeys

Rows are stored in `marketplace_update_batches/{batchId}/chunks/{chunkId}` to avoid oversized documents.

Each row can include:
- category
- wfSku
- marketSku
- identifier
- targetPrice
- targetMrp
- targetMin
- targetMax
- status

## New collection: `system_audit_log`
V9.1 writes `processed_data_clear` audit events with:
- reportDate
- types
- reason
- deletedBy
- deletedAt
- deletedAtText

## Pricing exception additions
`pricing_exceptions` can now additionally store:
- target
- rule
- ruleValue
- ruleValueTo
- source

## Security deployment note
The browser code cannot deploy Firestore Security Rules. If your deployed rules enumerate collection names, extend those rules before using V9.1 update-verification or data-administration features.

Recommended policy intent:
- `marketplace_update_batches`: authenticated approved users may read only allowed marketplace/category scopes; write requires Price Updates/Download permission. Super Admin unrestricted within the organization.
- `system_audit_log`: read/write only Super Admin for data-administration events.
- `pricing_exceptions`: existing organization/scoped rules plus Manage Pricing Exceptions for writes.
- `suppression_overrides`: existing scoped reads; writes require Suppression Override permission.

Do not weaken organization-domain restrictions to enable these features.

## V9.2 additions — 22 Aug 2026
`pricing_exceptions` retains raw exception records and supports lifecycle fields `status`, `removedBy`, `removedAt`, `removalRemarks`, `updatedBy`, `updatedAt`.

`amazon_pricing_issue_overrides` stores the dedicated Amazon Min/Max manual treatment `No Pricing Issue`, scoped by report date, AZ SKU, issue type and category.

Suppression lifecycle records may carry First Seen / Last Seen / Resolved On and operational timestamps (Case ID, POC, POA, QC, override, close). Historical uploaded source versions remain separate from processed-data deletion.

All resolver/Product 360 reads must be filtered by the signed-in user's marketplace, category and module scopes before presentation/export.
