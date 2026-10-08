# TASKS_DONE / CHANGELOG — Duplicate source deletion fix

Updated 07 Oct 2026. Includes the email resend and Flipkart audit-price fixes, with approved formats retained.

## Cause and correction
Deleting any Flipkart Order Report previously called a dataset-wide Flipkart pricing clear for its registered report date, without checking remaining copies. A September 1–30 file registered under October 7 therefore cleared October 7's processed Flipkart price/parity rows. Removing one duplicate was a valid action; the deletion behavior was incorrect.

## Completed
- Check all selected versions together and identify the surviving active source before deletion.
- Removing a non-active version preserves current source data and all processed results.
- Removing the active copy preserves processed results when an identical file with matching coverage remains, and promotes that remaining copy.
- Removing the last FK Order Report, or switching to a different remaining report, preserves listing/live/MRP prices, disparity/parity flags, audit evidence and inventory quantities. Only order/revenue/velocity calculations become unavailable until refreshed.
- Update local active-source records atomically with version/raw-file removal; clear stale source caches. Future uploads retain their active version and parsed record.
- Show the actual deletion effect in the existing confirmation and retain remaining-version information in the audit log. Failures no longer silently report successful invalidation.
- Change the processing fingerprint so the next explicit upload rebuilds older results cleared by the previous bug. Login/date selection remains read-only.

## Validation
Passed real UI/IndexedDB cases: newest identical legacy duplicate, non-active different version, different active replacement, final copy, multiple selected copies, cancellation and active-version persistence. Tested the actual persistence helper against compact/object FK rows: independent prices/flags/evidence/inventory and Amazon chunks stayed intact; only order metrics changed. Existing release, audit-price and Gmail authorization checks passed. Every ZIP entry passed CRC and byte comparison.

## Apply and recover
Deploy the contents of WakeSuite/ to the existing repository root and hard-refresh. For October 7, keep one valid September 1–30 Order Report. Re-upload that remaining file once under report date 2026-10-07, with the date's Wakefit pricing, FK Listing, audit and master mapping available. The explicit upload rebuilds the cleared processed results; it does not require deleting the other sources. Future duplicate removal preserves the retained copy's results.

No live account data was accessed, restored or deleted during this fix. Firestore writes were tested with mocks; the ZIP has not been deployed.
