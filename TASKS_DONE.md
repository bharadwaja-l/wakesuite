# TASKS_DONE / CHANGELOG — Flipkart audit price fix

Updated 07 Oct 2026. Includes all prior V9.3.11 changes and the email resend fix.

## Cause
The old Flipkart resolver substituted the Listing File's “Your Selling Price” when an audit FSN or price was missing, or Buy Now was unknown. Saved rows did not retain price-source evidence. Those substituted prices could remain in stored live-disparity reports. The existing raw-audit date selector already requires an exact report-date match; borrowing an older raw audit was not reproduced.

## Changes completed
- Live price now comes only from the selected date's audit “flipkart_selling_price”, matched by FSN, with a positive price and Buy Now=True.
- Missing, blank, zero, negative, unknown-status and conflicting audit entries do not become live disparity or parity observations. Listing-price/MRP comparisons remain separate.
- Saved live prices are checked against available current audit data. Unverified legacy or changed values are excluded until the date is reprocessed. New snapshots retain audit evidence through saving/reloading.
- Audit content changes invalidate previous processing even when file name, size, row count and modification time stay the same.
- Missing audit evidence preserves existing escalation history without sending those rows or treating them as resolved.
- Flipkart price history keeps unavailable live prices blank and labels them unavailable; it does not create price movements from missing observations.
- Previous email resend, POC/report/download/Drive fixes, approved columns, ₹5 threshold, exceptions, APT code and binary templates are preserved.

## Uploaded workbook checked
Source: amazon_flipkart_report_master_final_with_flipkart_20261007_050040.xlsx, sheet master_final_with_flipkart, rows 2–8194. FSN: column C; Flipkart live price: Z; Buy Now: AD.

8,193 rows: 6,990 positive prices and 1,203 blank prices. Of the blanks, 1,202 have FSN “Not Available on FK”; the remaining row has Buy Now=False. 3,483 rows have a positive price and Buy Now=True. These are audit eligibility counts; the final WakeSuite disparity count also depends on active listing/stock, master mapping, Wakefit daily pricing and exceptions. All 8,193 audit rows passed the source-selection check.

## Validation and use
Passed production builder, saved-report, POC refresh/resolution, history export, missing-price/duplicate/date/fingerprint and full-app startup checks. Passed existing report/template regressions and repeated email authorization/delivery checks with mocked integrations. All ZIP entries passed CRC and byte comparison.

Upload the contents of WakeSuite/ to the existing repository root, retain repository-specific settings, and hard-refresh the browser. In Data Center select 2026-10-07 and re-upload this audit with that date's required Wakefit pricing, FK Listing and master mapping available, so processing replaces the affected saved results. Reprocess other affected dates with their own source files. Date selection/login alone does not rewrite stored data. Do not delete source history to apply this fix.

No live email, Drive/Firestore write or deployment was performed; real-account integration remains unverified.
