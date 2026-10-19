# Live Data Connections - zero-additional-service-cost rollout

## Revised replacement behavior

Manual Update and the prepared EOD runner now rebuild inputs in Amazon revenue order and clear every previous result/value/formula below the header across the source tab. Headers and formatting remain. The earlier output-preserving row allocation described below is superseded. A verified full-row backup is required before replacement; empty eligibility stops without clearing anything.

Missing identifiers are written as `Not available on AZ` and `Not available on FK`. The scraper team must skip these labels as non-identifiers. Manual Update displays stage-based progress and opens a success dialog only after input/header/result-clearing verification and receipt completion. Failed updates show their error without a success popup. Background sync remains disabled pending owner setup.

The menu is renamed from Master Pricing to Live Data Connections. The existing mapping connection remains intact. URL audit imports use `master_final_with_flipkart` in the verified work spreadsheet.

## Manual Update

1. Open Live Data Connections and connect the work Google account.
2. Refresh status to read the live sheet. The paginated table shows every populated input row and all returned columns. Counts cover all rows.
3. Preview latest inputs shows the most recent completed Wakesuite snapshot and eligible rows.
4. Manual Update requests normal Google Sheets write consent and updates only input columns A:F.

Rows start from eligible WF SKUs in saved marketplace data; ASIN/FSN identifiers are joined by WF SKU. Source marketplace rows must be in stock, with positive finite WF Price and WF MRP. Missing or conflicting pricing is excluded. A missing marketplace identifier displays as Not available, but the actual input cell is blank so it cannot be scraped as an invalid ID.

Existing identifier/WF-SKU combinations remain on their original sheet rows. Ineligible A:F cells are cleared; new combinations append after existing data. Columns G:AK (including scraped results and formulas) are preserved. This can leave gaps: the scraper must read populated ASIN/FSN rows rather than stop at the first blank. Manual updates save a rollback copy to this browser before any input write. Cloud historical audit snapshots still use the existing Audit import; this feature does not silently replace a complete history archive.

Google Sheets API standard usage has no additional charge. Existing Firestore reads remain subject to the project's existing quotas. No billing plan, paid function, Cloud Scheduler, paid runner, cache, or public business-data artifact is provisioned.

## Optional free background sync

The workflow `Free EOD URL sheet input sync` targets 13:00 UTC, i.e. 18:30 Asia/Kolkata. GitHub can delay scheduled workflows, and inactive public repositories can have schedules disabled; this is not an exact-time service.

The workflow is **disabled by default** until repository variable `WAKESUITE_EOD_ENABLED=true` is set. It uses only the public repository's standard Ubuntu runner; it refuses private repository execution.

One-time setup by the project owner:

1. Keep the Firebase project `wakesuite-4daf9` on its free, billing-disabled configuration. Do not enable Blaze or attach billing. If billing is already enabled, do not disable an existing production billing account merely for this feature; leave this workflow disabled and use Manual Update.
2. Create a dedicated Google service account in that project. Grant read-only Firestore access (`roles/datastore.viewer`) and the `resourcemanager.projects.get` permission (for example `roles/browser`) for the zero-cost billing check. Enable the Google Sheets and Cloud Billing APIs if needed; enabling an API is separate from attaching a billing account.
3. Share only the URL scraping spreadsheet to that service account as Editor.
4. Add its JSON credential directly in GitHub Settings  Secrets and variables  Actions as secret `WAKESUITE_EOD_SERVICE_ACCOUNT_JSON`. Never paste the private key into chat, code, screenshots or workflow logs.
5. Set repository variable `WAKESUITE_EOD_ENABLED=true`.
6. Run the workflow manually once and verify its success receipt and sheet readback. This connection cannot be activated from the ChatGPT Drive connection alone.

Before querying Firestore or writing Sheets, the runner calls the Cloud Billing read API and requires `billingEnabled === false`. Failure or an enabled billing account stops the job. Quota failures stop the job instead of enabling paid services. It never changes billing, IAM, Firebase rules or marketplace report download behavior.

The runner keeps a hidden `_Wakesuite_Input_Backup` tab containing the preceding A:F inputs and source row numbers, then verifies the backup and writes only A:F. It preserves G:AK, verifies every updated input cell, and stores a non-sensitive success receipt in spreadsheet developer metadata. The backup is a single rollback copy, not a multi-day data warehouse.

Do not start Manual Update and the background sync at the same time; Google Sheets does not offer an atomic cross-client compare-and-set for these updates. Both paths are idempotent for the same source snapshot. After a partial failure, review the sheet and backup before retrying.

No service-account credential or repository variable was configured during implementation. The background job is prepared but not active.

## Checks

`node qa/live-connections-validation.cjs`

Checks cover missing-price/MRP and inventory filtering, WF SKU joins, missing-ID blanks, duplicate/conflicting source handling, stable row allocation, formula protection, no writes for empty eligibility, output-column preservation, and the billing-disabled execution gate.

Official references:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://developers.google.com/workspace/sheets/api/limits
- https://cloud.google.com/billing/docs/reference/rest/v1/projects/getBillingInfo
