# Daily Communications — V9.3.4

## Amazon POC Escalation

WakeSuite sends one consolidated Amazon POC escalation email for new issues on the selected communication date.

### Email body

The body contains only one summary table with:

- Issue
- No. of Issues
- Revenue Impact / Day

Rows are always shown for Live Price Disparity, ASIN Suppression and Buy Box Suppression. If an issue type has no rows, it is displayed as 0 issues and ₹0 revenue impact.

The salutation is `Hi [Amazon POC Name],` using Settings → System → Operational Controls → Amazon POC Name. If the name is empty, WakeSuite uses `Hi Team,`.

The closing action line is exactly:

> Please find the attached files and take necessary actions and let us know once done.

No issue-detail tables are embedded in the email body.

### Attachments

Attachments are generated only for issue types with at least one row.

1. Live Price Disparity
   - Sheet: `Temp_Export_Values_Only`
   - Columns: `Category | Seller sku | ASIN | Price`
   - `Price` is the WF correction price.
   - Revenue impact is not included in this attachment.

2. ASIN Suppression
   - Columns: `Category | ASIN | Rev Impact | POA Link | Escalated On`
   - `POA Link` comes from the optional Suppression Management POA Link field.
   - `Escalated On` uses the selected communication/report date for a new escalation.

3. Buy Box Suppression
   - Columns: `Category | ASIN | WF Item SKU | WF Price | Rev Impact`

### Preserved workflows

Flipkart POC escalation/follow-up, Amazon POC follow-up and the internal Daily Marketplace Report keep their existing behavior.
