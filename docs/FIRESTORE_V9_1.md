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

## V9.3 additions — 23 Aug 2026

### Authoritative Super Admin administration
V9.3 Data Administration uses the signed-in access record with `role = super_admin` as the authoritative browser-side gate. Deployed Firestore Security Rules must independently enforce equivalent authorization; browser UI checks are not a security boundary.

### `system_audit_log`
V9.3 audit events may include:
- `processed_data_clear`
- `source_version_delete`
- `source_file_delete` (compatible audit read)

Processed-data audit fields can include reportDate, selected dataset types, scope, marketplace, category, issue/status filter, identifier filter, reason, deletedBy and server timestamp/text.

Source-version audit fields can include reportDate, sourceType/configId, fileName, versionId, reason, deletedBy and timestamp/text. Browser IndexedDB source deletion remains local to the browser cache; shared source-storage deletion must be enforced by the actual source-storage implementation if/when one is introduced.

### `suppression_case_audit`
V9.3 may write per-ASIN bulk/suppression workflow audit events to `suppression_case_audit`. Fields are operation-dependent and can include ASIN, Case ID, action metadata, marketplace=`amazon`, user and created timestamp/text.

### `amazon_pricing_issue_overrides`
Remains the dedicated store for Amazon Min/Max `No Pricing Issue` treatments. General `pricing_exceptions` must not be reused as the Min/Max override dropdown.

### `pricing_exceptions`
Remains the single general exception source of truth for Add Exceptions / Exceptions Manager. Existing records created by older Upload Center workflows remain valid. Lifecycle fields may include status, removedBy, removedAt, removalRemarks, updatedBy and updatedAt.

### History / normalized snapshot reads
Standalone Price Parity, Pricing/Inventory History, Marketplace Data, Revenue Impact and Product 360 read from existing normalized daily snapshot structures and existing operational collections rather than creating duplicate history stores unless explicitly required later.

### Security-rule deployment intent
If rules enumerate collection names, add/verify scoped rules for:
- `suppression_case_audit`
- `amazon_pricing_issue_overrides`
- `system_audit_log`
- `marketplace_update_batches`
- `pricing_exceptions`

Super Admin destructive operations must be server-rule restricted. Scoped users must never gain broader historical/Product 360 data merely because a client-side route exists.
